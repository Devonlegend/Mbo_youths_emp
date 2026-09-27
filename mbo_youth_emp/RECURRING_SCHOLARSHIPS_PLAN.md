# Recurring (Multi-Year) Scholarships — Backend Implementation Plan

Project: `mbo_youth_emp` (Django + DRF + Celery). Feature: scholarships that pay every academic year until the beneficiary graduates, gated by a yearly CGPA threshold. Covers 4-yr, 5-yr and 6-yr faculties (Medicine/Dentistry = 6), 100L vs 200L (direct-entry) intake, HND top-up (2 yrs), and research/postgraduate awards. Status: Proposed. Date: September 2026. Revised: October 2026 after tenure-resolver and rollover-engine pressure-tests (see §11 Revision notes).

> **Reading order:** §2–3 (models + engine) and §9 (PR order) carry the load. **§11 Revision notes is a changelog of this doc — read it before implementing** so the corrected decisions are not missed.

---

## 1. What exists today (relevant findings from the code scan)

- **Awards are one-shot.** `ApplicationViewSet.review()` approving an application does three things: `consume_slot(scheme)`, sets `student.active_award = scheme.name` (a plain `CharField` label on `Student`), and stages a `PendingApplicationNotification`. Nothing tracks payment, year 2+, or re-checks. `EligibilityEngine` (`applications/services/eligibility.py`) only runs **once, at submit time**.
- **Per-scheme dynamic application tables** (`applications/dynamic.py`). Every scheme owns a physical table (`app_<hex>`, `managed=False`, memoised model classes, `schema_editor` create/drop via `schemes/signals.py`). Cross-scheme reads are UNIONs via `iter_application_models()`. **This is the sharpest edge in the codebase** — anything we add must not assume a global `Application` table exists.
- **Scholarship application rows already carry**: `institution_name`, `course_of_study`, `current_level` (char), `cgpa` (Decimal 4,2), `admission_year`, `matric_number`. **No faculty, no programme duration, no entry mode, no programme type.**
- **`Student` (MTI child of `accounts.User`)** has bank fields, ward/lga, `active_award` char label. `cgpa`/`level` were **removed** from Student in migration `0010` (they only live on application rows now) — yet `students/views.py::eligibility_check` still reads `student.cgpa`/`student.level` (dead fields, would raise if called — pre-existing bug, unrelated).
- **`Cycle`** (`schemes/models.py`): `name "2026/2027"`, `start_year`, `end_year`, one `is_active` at a time, activated via `POST /schemes/cycles/{id}/activate/` (`CycleViewSet.activate` — currently just flips flags). **This is the natural heartbeat for yearly renewals.**
  - ⚠️ **Pre-existing bug that blocks the engine:** `CycleViewSet.create/update/activate` all reference `cycle.label` (schemes/views.py lines 66/75/100) but `Cycle` has no such field — it has `name`. All three endpoints raise `AttributeError` today. `activate` flips `is_active` **before** the crash, so the cycle silently activates while the admin sees a 500.
  - ⚠️ The `activate` flip (`Cycle.objects.all().update(is_active=False)` then set target) is **not atomic** — a crash between the two leaves zero active cycles. Both must be fixed before rollover can be built on this endpoint (see §3.3, §9 PR 7).
- **Celery** is wired (`config/celery.py`, `django_celery_results`, `CELERY_TASK_ALWAYS_EAGER=DEBUG`), but **no celery-beat schedule configured** — no periodic tasks exist yet. All email tasks are `@shared_task` in `verification/tasks.py`, dispatched defensively (`_dispatch_email` swallows broker errors).
- **Notifications**: `notifications/helpers.py` factory functions creating `Notification` rows; staff-wide alerts pattern exists (`notify_new_application_in_queue`).
- **Audit**: `audit.services.record_admin_action(user, action, entity_type, entity_id)` used everywhere — renewal actions must use it too.
- **Permissions**: `accounts.permissions.IsAdmin / IsVerifier / IsStudent`. Verifiers already review applications — renewals should be verifier-work too.
- **Documents**: Cloudinary via `default_storage`, validated by `accounts.validators.validate_upload` at the request boundary (same pattern for transcripts).

---

## 2. Data model changes

### 2.1 `schemes.ScholarshipScheme` — new fields

| Field | Type | Notes |
|---|---|---|
| `is_recurring` | `BooleanField(default=False)` | Master switch. `False` = today's one-shot behavior; zero regression for existing schemes. |
| `min_renewal_cgpa` | `DecimalField(4,2, null=True, blank=True)` | Yearly threshold. Falls back to `eligibility_criteria['min_cgpa']` when null. |
| `applicable_programme_types` | `JSONField(default=list)` | Subset of `undergraduate` / `hnd` / `postgraduate_taught` / `postgraduate_research`. Empty list = undergrad only. |

Keep all three **outside** `eligibility_criteria` (they're award-lifecycle config, not application-time gates — except `applicable_programme_types`, which *also* gates applications; see §5.1).

Serializer: `ScholarshipSchemeSerializer.create()/update()` already reads flat keys off `request.data` — extend that pattern for these three (consistent with `Eligibility_Criteria.md`).

### 2.2 `students.Student` — new academic-profile fields

| Field | Type | Notes |
|---|---|---|
| `faculty` | `CharField(120, blank=True)` | |
| `programme_type` | `CharField(choices=ProgrammeType, blank=True)` | `undergraduate` / `hnd` / `postgraduate_taught` / `postgraduate_research` |
| `programme_duration_years` | `PositiveSmallIntegerField(null=True, blank=True)` | 4, 5 or 6 (undergrad — Medicine/Dentistry = 6), 2 (HND), 1–2 (PG taught), 2–4 (research) |
| `entry_level` | `PositiveSmallIntegerField(null=True, blank=True)` | 100 or 200 (direct entry); null for HND/PG |

All optional — existing students and non-scholarship flows are untouched. Writable via `StudentSerializer` (PATCH `/students/me/`) and admin student edit. **Do NOT resurrect `cgpa`/`level` on Student** — CGPA is per-installment data (§2.3), level comes from the latest verified installment.

### 2.3 New app: `awards`

New Django app (keeps applications/schemes clean; mirrors existing app boundaries). Registered in `INSTALLED_APPS`, `config/urls.py` (`path('awards/', include('awards.urls'))`).

**`Award`** — the multi-year contract, one per approved recurring application:

| Field | Notes |
|---|---|
| `id` UUID pk | |
| `student` | FK `students.Student`, `related_name='awards'` |
| `scheme` | FK `schemes.ScholarshipScheme` |
| `application_id` | UUID, `unique=True` — **plain UUID, not a FK** (application rows live in per-scheme tables; a DB FK is impossible). Same approach as `ApplicationStatusHistory`. |
| `total_years` | Resolved at creation — see §3.1 tenure formula |
| `start_cycle` | FK `schemes.Cycle` |
| `annual_amount` | Decimal(12,2), snapshot of `scheme.award_amount` at creation (overridable by admin) |
| `min_cgpa_snapshot` | Decimal(4,2) — threshold in force when the award was created (scheme edits later don't retroactively change existing awards) |
| `current_year_index` | int — the **highest disbursed** payment year. `0` until year 1 is paid; set to the installment's `year_index` on each disbursement (§4). Advances on **disbursement only**, never on installment creation (§3.3). Frontend renders the in-progress year as `Year {current_year_index + 1} of {total_years}`. |
| `status` | `active` / `suspended` / `graduated` / `terminated`. **`appeal_pending` is NOT a status** — it is `suspended` + a `pending` AwardAppeal (derived, not stored; keeps one source of truth). |
| `suspended_reason`, `suspended_at` | |
| `tenure_confidence` | `confirmed` / `inferred` / `degraded` — output of the tenure resolver (§3.1). Anything ≠ `confirmed` must be **surfaced in the admin renewal queue / awards register** for human verification, not just stored. |
| `tenure_flags` | JSON list — human-readable reasons from the resolver (unmatched course text, assumed default duration, unparseable level, clamped value, …). |
| `created_at`, `updated_at` | |

Constraints/indexes: `unique(application_id)`; index on `(status)`, `(scheme, status)`; CHECK `current_year_index <= total_years` (via `CheckConstraint`).

**`AwardInstallment`** — one row per payment year:

| Field | Notes |
|---|---|
| `award` FK, `related_name='installments'` | |
| `year_index` int | 1..total_years |
| `cycle` FK | The academic year this installment pays for |
| `amount` Decimal | Snapshot (award amount edits don't touch existing installments) |
| `status` | `pending_renewal` / `pending_verification` / `approved` / `disbursed` / `withheld` / `cancelled` |
| `submitted_cgpa` Decimal(4,2, null) | Student's renewal submission |
| `submitted_level` CharField(20, blank) | Level they're entering (e.g. "300") |
| `transcript` FileField(null) | Cloudinary, same storage pattern as application documents |
| `threshold` Decimal(4,2) | Snapshot of the threshold this installment is judged against |
| `verified_by` FK User(null), `verified_at`, `verifier_note` | |
| `disbursed_at`, `disbursement_ref` CharField(blank) | Manual payment marking |
| `resubmission_count` int default 0 | Cap resubmissions (e.g. 2) |
| `created_at`, `updated_at` | |

Constraints: `UniqueConstraint('award', 'year_index')`. Indexes: `(status)`, `(cycle, status)`, `(award, year_index)`.

**`AwardAppeal`** — the agreed suspend→appeal flow:

| Field | Notes |
|---|---|
| `award` FK, `installment` FK | The withheld installment being appealed |
| `reason` Text, `evidence` FileField(null) | |
| `status` | `pending` / `upheld` / `rejected` |
| `reviewed_by` FK User(null), `reviewed_at`, `review_note` | |
| `created_at` | |

Constraint: only one `pending` appeal per installment (enforce in service layer — partial unique index is Postgres-only and we're on SQLite in dev).

### 2.4 `Student.active_award` cleanup

It's a display label consumed by the frontend and `has_active_award()`. Keep it, but derive it: when an `Award` is `active` set the label, on `graduated`/`terminated` clear it **if no other active award exists**. (Double-dip checks don't read this field — `_check_double_dip` scans approved application rows — but recurring awards must ALSO feed conflict detection; see §5.2.)

---

## 3. Tenure resolution (the core formula)

### 3.1 `awards/services/tenure.py::resolve_total_years(student, application_row) -> TenureResolution`

Returns a `TenureResolution(total_years, confidence, programme_type, flags)`, not a bare int — the confidence + flags are what let admins catch a wrong guess (see below). `application_row` is duck-typed (needs `.current_level`, `.course_of_study`), so this service imports no dynamic models and is unit-testable without touching per-scheme tables.

```
programme_type = student.programme_type (fallback: infer 'undergraduate' when level parses numeric)
duration       = student.programme_duration_years

undergraduate:
    current = parse_level(application_row.current_level)   # digits only; 'Postgraduate'/''/None → None. NEVER int() raw.
    total   = duration - (current // 100 - 1)   # counts from CURRENT level, NOT entry level:
                                                #   100L/4yr → 4 ; 200L(DE)/5yr → 4 ; 300L/4yr → 2
                                                #   300L(DE, entered 200)/5yr → 3 ; Medicine 6yr @100L → 6
hnd:                     total = duration or 2   # HND1 → 2
postgraduate_taught:     total = duration or 1
postgraduate_research:   total = duration or 3
```

**Three non-negotiable correctness rules (all were wrong in the first draft):**

1. **Never raise.** This runs inside `review()`'s `transaction.atomic()` — an exception rolls back the *whole approval*, not just the award. Malformed input must degrade, never 500. `parse_level` extracts digits (`'200L'`→200) and returns `None` for anything else.
2. **Count from CURRENT level, not entry level.** The award starts paying *this* cycle. A 300L student in a 4-yr course has 2 payments left (300L, 400L). Using `entry_level` (100) would compute 4 and **overpay every mid-course applicant, silently**. `entry_level` stays on the profile for record-keeping and direct-entry display only — it never drives tenure math. (Direct entry is already handled: a DE student at 200L in a 5-yr course gives `5-(2-1)=4`.)
3. **Inference is a hint, never a silent value.** `programme_duration_years` from the profile → `confirmed`. A keyword match on `student.faculty` / `course_of_study` (Medicine/MBBS→6, Engineering/Law/Pharmacy→5, default 4) → `inferred` **and** a flag. Missing/unresolvable everything → `degraded`, `total_years=1`, flag. Free-text matching is unreliable (real data has `course_of_study="CS"`, `"Mech Eng"`, `"MBBS"`), so a *wrong* inference is the failure mode to defend against: it doesn't error, it pays the wrong number of years.

**Clamp to `[1, 6]` and flag on clamp.** 6 = Medicine/Dentistry/Vet at 100L, the longest real tenure. Values needing clamp mean bad input (e.g. `'50'`→`50//100-1=-1`→7; a 500L in a 4-yr course → 0). Clamped awards get `total_years` in range **plus** a flag — never a silent clamp.

**Duration source priority when profile fields are blank:** profile field → faculty `_infer_duration` → course-text `_infer_duration` → programme-type default (`UNDERGRADUATE:4, HND:2, PG_TAUGHT:1, PG_RESEARCH:3`). Anything unresolvable → `total_years=1` + `degraded`. **Never block award creation on missing data** — but always leave a flag (§2.3 surfaced in the admin queue).

**Test matrix** (in `awards/tests/test_tenure.py`; must include): 4/5/6-yr × 100L/200L; mid-course (300L/4yr → 2) and DE-mid-course (300L in 5yr → 3, proving entry_level is ignored); HND/PG defaults vs explicit; keyword inference (`MBBS`→6, Engineering→5, `"CS"`→loud 4-yr default); non-numeric `current_level` (`'Postgraduate'`); clamp over/under; and a fuzz test asserting garbage never raises and always lands in `[1,6]`.

### 3.2 Award creation hook

In `ApplicationViewSet.review()` (and `staff_create` status_override path), inside the existing `transaction.atomic()` approval block:

```python
if decision == 'approved':
    ...existing consume_slot / active_award / PendingApplicationNotification...
    if scheme.is_recurring and scheme.award_type == 'scholarship':
        create_award(student=student, scheme=scheme, application=application, actor=request.user)
```

`create_award` (in `awards/services/creation.py`):
1. Guard: skip if `Award.objects.filter(application_id=app.id).exists()` (idempotent — retries/double-clicks are safe).
2. Resolve `total_years` via §3.1.
3. Create `Award` (status `active`, `current_year_index=0` — paid-years counter, see §2.3; snapshots: `annual_amount`, `min_cgpa_snapshot` from `scheme.min_renewal_cgpa or eligibility_criteria.min_cgpa`; plus `tenure_confidence`/`tenure_flags` from §3.1).
4. Create year-1 `AwardInstallment` with `status='approved'`, `cycle=scheme.cycle or Cycle.get_active()` — approval = first payment queued, consistent with today's one-shot semantics. It moves to `disbursed` when admin marks it paid.

### 3.3 Cycle rollover — the renewal engine

Extend `CycleViewSet.activate` (or better: a post-activation service call, keeping the view thin) → `awards/services/rollover.py::run_cycle_rollover(new_cycle)`:

**Semantics that make or break this engine (corrected — do not implement the naive version):**

- **`current_year_index` advances on DISBURSEMENT, never on installment creation.** An installment created at rollover is `pending_renewal` — unsubmitted, unverified, unpaid. Bumping the index at creation makes it point at a year the student never received, so the frontend progress bar ("Year 3 of 4") and any "how many years paid" logic silently drift one year ahead. Rollover creates the *next* row; only `disburse_installment` moves the index.
- **Rollover NEVER graduates.** The first draft graduated an award when `current_year_index >= total_years` — combined with the pre-bump above, that graduates a student the moment they *enter* their final year, skipping their last payment. Graduation happens **only** when the final installment is disbursed (§4). Rollover's job is create-next-row, nothing else.
- **Renew only awards whose latest installment is `approved` or `disbursed`.** If the previous year is still `pending_verification`, `withheld`, or under appeal, rolling the award forward creates a *second* open installment and the renewal queue shows the same student twice. Skip these and report them with a reason (`{created, skipped: [{award_id, reason}], already_rolled}`).
- **Lock each renewal to the successor cycle, not "whatever was just activated".** Idempotency via `(award, year_index)` handles *re-running the same cycle*. It does **not** handle "admin activated the wrong cycle, then corrected it" — that creates a later `year_index` on the wrong cycle and orphans a payable year. Renew an award only if (a) no installment exists for `year_index+1`, and (b) `new_cycle` is chronologically after the award's latest installment's cycle. Re-activating an already-rolled cycle must be a clean no-op returning `{created: 0, already_rolled: true}`.
- **Per-award savepoints, not one outer `atomic()`.** "Wrap in `transaction.atomic()`" and "log failures per-award and continue" cannot both be naive: a caught exception inside a single outer `atomic()` marks the transaction broken (`TransactionManagementError` on the next query). Structure it as:

```python
for award in active_awards:
    try:
        with transaction.atomic():   # per-award savepoint — isolates this award
            ...create the next installment...
    except Exception:
        logger.exception("rollover failed for award %s", award.id)
        results['failed'] += 1
        continue                      # one bad award never aborts the batch
```

- **Cycle activation must itself be atomic** (see §1): fix the `cycle.label`→`cycle.name` 500 and wrap the `is_active` flip so it can't leave zero active cycles.

**Fan-out:** notifications via `Notification.objects.bulk_create(...)` and emails via `transaction.on_commit` + the defensive `_dispatch_email` pattern (see §7) — the one job that touches every awardee must not 500 on a broker blip or write N+1.

**Grace/suspension for non-submission** needs time passing, so it can't live in the activation request. Add `awards/management/commands/expire_renewals.py` (run via cron/Task Scheduler, or wire `django-celery-beat` later): installments still `pending_renewal` after `settings.RENEWAL_GRACE_DAYS` (default 56) past cycle activation → `cancelled`, award → `suspended` with reason "No renewal submitted", notify student. Because `current_year_index` no longer advanced (§ above), a cancelled renewal correctly leaves the index on the last *paid* year. Manual-runnable first; beat schedule is a deployment dependency, not a nicety (see §8 #4).

---

## 4. Renewal, verification, suspension, appeal (services)

`awards/services/lifecycle.py`. Every transition is guarded by an explicit **allowed-source-status** check (double-clicks / retries must be no-ops, never double-pay), and every mutation writes both `audit.record_admin_action` and an `AwardEvent`.

**Installment transitions** (any source/event pair not listed is rejected with 400):

| From | Event | To | Actor |
|---|---|---|---|
| `pending_renewal` | student submits | `pending_verification` | student |
| `pending_verification` | approve (normalized CGPA ≥ threshold) | `approved` | verifier |
| `pending_verification` | reject (bad transcript / wrong level) | `pending_renewal` (`resubmission_count += 1`) | verifier |
| `pending_verification` | withhold (normalized CGPA < threshold) | `withheld` (+ award `suspended`) | verifier |
| `pending_renewal` | rejection cap reached | `cancelled` (+ award `suspended`, "repeated invalid submissions") | verifier |
| `pending_renewal` | grace expired | `cancelled` (+ award `suspended`, "no renewal submitted") | system |
| `approved` | mark paid | `disbursed` (advance index; graduate if final year) | admin |

**CGPA comparison is normalized.** `min_renewal_cgpa` (scheme) and `installment.threshold` are on the **5.0 scale** — state that in the scheme form and validate it there — and the gate compares `submitted_cgpa_normalized` against the threshold, never the raw value. `threshold == 0` means no gate.

> **Reality check — there is no "disqualifications register".** `src/app/admin/disqualifications` is a read-only *view* that lists applications with `status='rejected'` per scheme (`getApplicationsByScheme(schemeId, 'rejected')`); the backend has no `Disqualification` model or endpoint. So "surface the terminated award in disqualifications" is not implementable as written — and is probably not wanted: a student whose application was **approved** and later breached a renewal was never *rejected*. **Recommendation: terminate the award only; do not manufacture a rejection record.** A hard blacklist, if ever required, is a new, separate feature (§8 #24).

- **`submit_renewal(award, student, cgpa, cgpa_scale, level, transcript)`** — guards: own award, award `active`, current installment `pending_renewal`. Stores `submitted_cgpa` + `submitted_cgpa_scale` + `submitted_cgpa_normalized` (`cgpa * 5 / scale`, §8 #3), saves transcript via `default_storage` after `validate_upload`, → `pending_verification`. Notifies staff (pattern: `notify_new_application_in_queue`). **Not allowed on a `withheld` installment** — a CGPA breach resumes only through a upheld appeal (below), never by re-submitting into the same year. (The first draft allowed this and conflated a quality-reject with a CGPA withhold.)
- **`verify_installment(installment, verifier, action, note)`** — `IsVerifier`. 
  - `approve`: **server-side CGPA gate** — compare `submitted_cgpa_normalized` (not the raw value) against `installment.threshold`; if below, refuse with 400 + instruction to use withhold. `threshold == 0` = no gate. Else installment → `approved`.
  - `reject` (bad transcript, mismatched level): installment → back to `pending_renewal`, `resubmission_count += 1`, note required. **When the cap (2) is reached the installment goes `cancelled` (+ award suspended, reason "repeated invalid submissions") — NOT `withheld`.** Withhold is reserved for a genuine CGPA breach; routing an unreadable-PDF student through the academic-appeal path is a category error. Admin may manually re-open a cancelled installment.
  - `withhold` (CGPA below threshold): installment → `withheld`, award → `suspended` + reason. Notify student with appeal instructions.
- **`disburse_installment(installment, admin, ref)`** — `IsAdmin` only (money action). Requires `approved`. Sets `disbursed_at`, `disbursement_ref`, → `disbursed`, **and advances `award.current_year_index = installment.year_index`** — this is the *only* place the index moves (see §3.3; rollover creation must not touch it). If `year_index == total_years` → award `graduated`, clear `active_award` if no other active award, congratulation notification. **This is the only path that graduates an award** — rollover never does.
- **`suspend_award` / `terminate_award`** — admin manual overrides, guarded (cannot suspend a `terminated`/`graduated` award; cannot terminate a `graduated` one). Terminate releases no slot (intake already consumed), clears `active_award` when no other active award remains, and writes an `AwardEvent`. **It does NOT create any "disqualifications register" entry — no such model exists** (see callout above).
- **`submit_appeal(award, student, reason, evidence)`** — award must be `suspended`; the unresolved installment may be `withheld` (CGPA breach) **or** `cancelled` (late / never submitted) — both are appealable. At most one `pending` appeal per installment (service-layer guard). Not allowed once the award is `terminated` (final).
- **`review_appeal(appeal, reviewer, decision, note)`** — outcome depends on the appealed installment's status:
  - `upheld` on `withheld` → `approved` (human waives the CGPA gate; note required), award → `active`.
  - `upheld` on `cancelled` → **`pending_renewal`** — reopen so the student can actually submit; you cannot "approve" an installment with no CGPA/transcript on file — award → `active`.
  - `rejected` → award `terminated`. **No disqualifications-register side effect** (see callout; §8 #24).

Every mutation records `audit.record_admin_action` **and** an `AwardEvent` (`award`, `actor` — null for system, `action`, `note`, `created_at`). `AwardEvent` is **mandatory, not optional** (§2.3): this is a multi-year money trail spanning students, verifiers and admins, and retrofitting history later is not viable.

---

## 5. Eligibility & conflict-engine changes

### 5.1 Application-time gates (`EligibilityEngine`)

For `scheme.is_recurring` scholarships, add a `programme_type` check: `student.programme_type` (fallback infer from level) must be in `scheme.applicable_programme_types` (empty list = undergrad-only, so old behavior unchanged). Missing profile data → **pass with a note** (don't hard-fail applicants over data admins can fix), but record it in checks so verifiers see the gap.

### 5.2 Double-dip: recurring awards are multi-year conflicts

Current `_check_double_dip` (`applications/services/eligibility.py`) matches only schemes with the **same `academic_year`** string, scanning every scheme's table via `iter_application_models()` and applying the stacking rule. A recurring award from 2026/2027 must still conflict in 2027/2028, so Award rows join the scan — carefully.

**Implementation shape**
- Fetch the student's awards **once**, *before* the scheme loop: `Award.objects.filter(student=student, status__in=…).select_related('scheme')`, indexed into a dict by `scheme_id`. Do **not** query per scheme — that would add ~N queries on top of `_check_double_dip`'s existing per-scheme UNION.
- Fold them into the existing decision using the **same predicate**, never a paraphrase.

**Exact predicate (reuse, don't reinvent).** The current same-type rule is: conflict ⇔ `scheme.stacking_policy == 'exclusive'` **or** `existing.stacking_policy == 'exclusive'` **or** (both `major_only` **and** both `award_amount >= 50000`). `StackingPolicy` has a third value — **`open`** — which the first draft's "`major_only`/`exclusive`" shorthand dropped. Under `open` a naive port would let a student stack recurring awards.

**Two recurring-specific additions on top of the shared predicate**
1. **Same scheme, any policy → conflict.** An `active` Award on scheme S always conflicts with a new application to S, *regardless of stacking policy* — otherwise `open`-policy schemes double-pay a student who re-applies.
2. **Cycle-independent.** A recurring Award conflicts in *every* cycle it spans, not just its start cycle (the entire point of this section).

**Dedup (a bug the first draft would have shipped).** A recurring award's **originating application is itself an approved row** in the start cycle, so the same conflict would be counted twice (approved row + Award row) in 2026/2027. When merging, skip an award whose `application_id` already appeared among the approved rows for the current cycle — or dedup `conflicting_ids` by scheme id.

**Decide these explicitly (don't leave implicit)**
- **`suspended` awards.** The first draft counted `status in ('active','suspended')` as a blocking conflict. A suspended award (CGPA breach, possibly headed for termination) blocking the student from *every* new application is a policy call. Recommend: `active` blocks; `suspended` raises a **soft flag** (verifier sees it) rather than a hard conflict, or exclude it. Pick one.
- **Cross-type across cycles.** Today the cross-type rule is same-cycle only, and the new clause was "same-type" only — together they miss a recurring *scholarship* Award blocking a *grant* application in a later cycle. RULE-2 intent ("cannot hold awards of different types simultaneously") implies a multi-year award should block cross-type for its whole span. Decide.
- **One-shot prior awards.** A one-shot approved award from a past cycle does **not** conflict in a later cycle (it ended). State this so nobody "fixes" it later.

**Comparison basis.** The engine compares `scheme.academic_year` **strings**. Awards carry `start_cycle` (FK) *and* `scheme.academic_year`. Use the scheme's `academic_year` string for consistency (a scheme may have `cycle=NULL` while `academic_year` is set) — never mix cycle-chronology with string equality.

**Surfacing.** Conflicts populate `conflicting_ids` + `conflict_details` (persisted to the application's `conflict_scheme_ids` JSON). Include award metadata in the detail (`award_id`, `year x/y`, `start_cycle`) so the verifier reviewing a `double_dip_flag` waiver sees *why* — e.g. "holds active recurring award (2026/27, year 2/4)". Conflict stays a **flag + waiver**, not a hard reject (unchanged from today).

### 5.3 Slots

No change: slots cap **intake** per scheme. Recurring payments are obligations of prior intakes, funded outside `remaining_slots`. (If the Trust later wants budget-caps per cycle, that's a separate feature — don't conflate.)

---

## 6. API surface (new `awards` app)

Mounted at `/awards/`. All IsAuthenticated; object-level checks in services. drf-spectacular docstrings like existing code.

**Student**
| Route | Action |
|---|---|
| `GET /awards/mine/` | List my awards + installment summaries (year x/y, status, amount, next action) |
| `GET /awards/{id}/` | Full detail incl. installments timeline (student sees own only; staff any) |
| `POST /awards/{id}/renew/` | multipart: `cgpa`, `level`, `transcript` file |
| `POST /awards/{id}/appeal/` | multipart: `reason`, `evidence` file |

**Staff (verifier+)**
| Route | Action |
|---|---|
| `GET /awards/` | Register; filters `?status=`, `?scheme=`, `?cycle=`, `?programme_type=`; paginated |
| `GET /awards/renewals/` | Queue: installments `pending_verification` (+ `pending_renewal` for visibility), `?cycle=` |
| `POST /awards/installments/{id}/verify/` | `{action: approve\|reject\|withhold, note}` |
| `POST /awards/installments/{id}/disburse/` | `{disbursement_ref}` — IsAdmin |
| `POST /awards/{id}/suspend/` , `/terminate/` | Admin overrides |
| `GET /awards/appeals/` , `POST /awards/appeals/{id}/review/` | Appeal queue + decision |
| `GET /awards/export/?scheme=&cycle=` | CSV (mirror `approved_list` pattern: plain `HttpResponse`, `export=csv` convention) |
| `POST /awards/installments/{id}/remind/` | Optional: resend renewal reminder notification |

Serializers: `AwardSerializer` (nested installments for detail), `AwardListSerializer` (flat for tables), `InstallmentSerializer`, `AppealSerializer`, plus a tiny `RenewalSubmitSerializer`. Response shapes mirror the frontend contract already planned (`src/docs/Recurring_Scholarships_Plan.md` in the frontend repo).

---

## 7. Notifications & emails

New helpers in `notifications/helpers.py` (follow existing factory style): `notify_renewal_open`, `notify_renewal_approved`, `notify_renewal_rejected` (with note), `notify_award_suspended`, `notify_installment_disbursed`, `notify_appeal_decision`, `notify_award_graduated`, and a staff-queue alert for new pending verifications.

Emails in `verification/tasks.py` (new `@shared_task`s + templates in `templates/`): renewal reminder, suspension notice (must include appeal window), disbursement confirmation, graduation. Dispatch through the same try/except `_dispatch_email` pattern — notification failures must never 500 a state change.

**Rollover fan-out (§3.3).** The yearly "renewal open" notification goes to *every* active awardee in one request. Use `Notification.objects.bulk_create(...)` for the in-app rows (not one `create()` per awardee) and dispatch the emails via `transaction.on_commit` so a broker blip mid-fan-out can't 500 the cycle activation. Reuse the existing staff-wide pattern (`notify_new_application_in_queue`) for the "renewal submitted — waiting on you" alert to verifiers.

---

## 8. Edge cases (the full list — design decision for each)

1. **Repeat year (level doesn't advance).** Student submits same level as last year. → Allow; consumes one installment; verifier sees `level_repeat` hint in the queue (computed: `submitted_level == previous installment's submitted_level`). Award still caps at `total_years` payments. (Hint applies from year 2 onward — year 1 has no prior submission.)
2. **Spillover / extra year.** Student exceeds `total_years` without graduating. → No installment beyond `total_years` is created. Admin may `extend_award(award, +1 year, note)` — explicit audited action, not automatic.
3. **CGPA scale mismatch (5.0 vs 4.0).** Thresholds assume one scale per scheme. Add `cgpa_scale` to the renewal submission (default "5.0"); normalize server-side (`cgpa * 5/scale`) before comparing to threshold, store both raw and normalized. Cheap insurance against cross-institution applicants.
4. **Student never submits renewal.** Grace period (`RENEWAL_GRACE_DAYS`, default 56) → `expire_renewals` command cancels the installment + suspends the award. Because `current_year_index` only advances on disbursement (§3.3), the award correctly stays on the last *paid* year. Appeal can still revive it — but the revival must **reuse the existing cancelled installment** (flip its status per §4), never insert a new row: the `unique(award, year_index)` constraint forbids a second installment for the same year. **Deployment dependency:** this only fires if the command is actually scheduled (cron / celery-beat) — it currently is not, so without that wiring, non-submission never suspends. Flag as a hard prerequisite for launch, not a nicety.
5. **Breach then recovery.** Below-threshold year: installment `withheld` (not deleted), award `suspended`. **There is no "next year's CGPA recovers" auto-resume** — while suspended the award's latest installment is unresolved, so rollover creates no next year (§3.3). The only resume path is: student appeals the withheld year → `upheld` → installment `approved` → disbursed (index advances) → the *following* rollover creates the next year. If the appeal is rejected (or the window lapses) the award is `terminated`, with no recovery after that. (Reworded from the first draft, which implied both an appeal *and* an independent next-year CGPA path — they are the same path.)
6. **Appeal window.** Appeal allowed while `suspended`; auto-`terminated` if none is filed within `APPEAL_WINDOW_DAYS` (default 60) measured from `suspended_at`. Handled by the **same periodic command** as grace expiry (`expire_renewals`) — two independent timers, one job — which is why that job's scheduling is a hard prerequisite (see #4).
7. **Mid-award scheme edits.** Thresholds/amounts are **snapshotted onto Award and each AwardInstallment at creation** — editing the scheme never retroactively changes obligations. Frontend scheme form should warn about this for recurring schemes.
8. **Double-click / retry on review-approve.** `unique(application_id)` on Award + idempotent `create_award` guard → no duplicate awards even if the approval request is retried.
9. **Cycle activated twice / rollover re-run.** `(award, year_index)` unique constraint makes rollover idempotent.
10. **Award created from `staff_create` override path.** Hook award creation into both approval paths (they share `review`'s logic only partially — explicitly add to `staff_create`'s override block too).
11. **Withdrawal of an approved recurring application** (`/applications/{id}/withdraw/`). Must also terminate the linked Award + cancel non-disbursed installments. Add to `withdraw_application` service.
12. **Scheme deletion.** `schemes/signals.py` drops the application table on scheme delete. Awards FK to scheme with `on_delete=models.PROTECT` (never silently lose financial obligations) — admin must terminate awards first.
13. **Student account data incomplete** (no `programme_duration_years`, unknown faculty). Tenure resolver degrades to `total_years=1`, `tenure_confidence='degraded'`, + flags; never blocks award creation. **Storing the flag is not enough — non-`confirmed` confidence must be surfaced in the admin renewal queue / awards register** so a human corrects the tenure (per §2.3/§3.1). Admin can edit `total_years` later (audited).
14. **HND & PG entries.** No `entry_level` — tenure = `programme_duration_years` (HND default 2, PG taught 1, research 3). `allowed_levels` eligibility doesn't apply; `applicable_programme_types` gates instead.
15. **Disbursed-then-error.** `disbursed` is terminal (money left). Corrections happen via a new adjusting record/admin note, never by editing a disbursed installment. Enforce in service layer.
16. **Verifier vs admin split.** Verify/withhold = verifier; disburse/terminate/extend = admin only (money + finality), enforced via permission classes.
17. **Transcript file safety.** Reuse `validate_upload` (type/size) at the boundary; store under `award_renewals/{award_id}/` in Cloudinary.
18. **Performance of the register.** `/awards/` list must paginate (existing `PageNumberPagination`) and `select_related('student__user', 'scheme', 'start_cycle')` — don't repeat the N+1 the union-helpers force elsewhere.
19. **SQLite dev vs Postgres prod.** No partial indexes, no `JSONField` key lookups in hot paths; keep queries portable. (Existing code already follows this.) **Sharper consequence for tests:** `schemes/signals.py` builds each scheme's physical table via `schema_editor` on `post_save`, which SQLite refuses to do inside Django's `TestCase` transaction — so any test that creates a `ScholarshipScheme` (essentially all existing `applications` tests, and every new award-creation/rollover test) **cannot run on SQLite**. The suite is Postgres-native. CI and local dev therefore need a running Postgres, or tests must disconnect the scheme signal, or the project adds a `config/settings_test.py`. Decide this in PR 1 so the awards suite has a home.
20. **Dead `cgpa`/`level` fields on `Student`** (removed in migration 0010) are still read in two places. **(a)** `students/views.py::eligibility_check` reads `student.cgpa`/`student.level` directly. **(b)** The engine itself: `EligibilityEngine._check_cgpa` (eligibility.py:115) falls back to `student.cgpa` and `_check_level` (:133) to `student.level`. In the engine they're currently *masked* (submitted `details` take precedence) but would `AttributeError` if that precedence ever changed. Not caused by us, but renewal work touches this area — fix both by reading the latest verified installment, or dropping the fallback. Flag in PR.
21. **Rollover re-run for the *wrong* cycle.** `(award, year_index)` idempotency only covers re-running the *same* cycle. If an admin activates cycle A then corrects to cycle B, a naive engine creates a later `year_index` on the wrong cycle and orphans a payable year. Fix: lock each renewal to the award's successor cycle and make re-activation a no-op (§3.3).
22. **Rollover while a prior year is unresolved.** An award whose latest installment is `pending_verification` / `withheld` / under appeal must be **skipped** by rollover (reported with a reason), not advanced — otherwise one award holds two open installments and the queue double-lists the student (§3.3).
23. **`CycleViewSet` pre-existing 500.** `create`/`update`/`activate` reference the non-existent `cycle.label`; `activate` also flips `is_active` non-atomically. Both block the rollover host endpoint and must be fixed in PR 7 (§1).
24. **Terminated/graduated recurring award still appears as a current beneficiary.** `approved-list` and the admin disbursement CSV read *applications* with `status='approved'` — they know nothing about awards, so a student whose award was later terminated or who has graduated still exports as a current beneficiary. Decide: join awards and exclude `terminated`, or annotate the row. Note this is a **different** thing from the (derived) disqualifications view, which keys off `rejected` applications (§4 callout).
25. **Threshold scale ambiguity.** If an admin enters `min_renewal_cgpa = 3.5` intending a 4.0 scale while submissions normalize to 5.0, the gate silently mis-compares (a 3.5/5.0 student passes a threshold meant to be 4.375/5.0). Fix by declaring and validating `min_renewal_cgpa` as 5.0-scale in the scheme form, or storing a `threshold_scale` on the scheme. See the §4 CGPA note.

---

## 9. Implementation order (sized in PRs)

| # | PR | Contents |
|---|---|---|
| 1 | **Scheme + Student fields** | Migrations for §2.1/§2.2, serializer flat-key handling, admin.py registration. Also **settle the test-DB strategy (edge 19 — suite is Postgres-native)** so later PRs have somewhere to run. No behavior change. |
| 2 | **Awards app skeleton** | Models + migrations (Award, AwardInstallment, AwardAppeal, AwardEvent; Award carries `tenure_confidence`/`tenure_flags`), tenure service (`TenureResolution` + confidence/flags) + unit tests under `awards/tests/`. |
| 3 | **Award creation on approval** | Hook `review()` + `staff_create`, idempotent `create_award`, year-1 installment, withdrawal cascade (edge 11). |
| 4 | **Renewal submission (student)** | `/mine/`, detail, `/renew/` + notifications + tests. |
| 5 | **Verification queue + disburse** | Staff endpoints, CGPA gate, withhold→suspend, disburse→graduate, CSV export. |
| 6 | **Appeals** | Submit/review, uphold/reject transitions, window expiry. |
| 7 | **Cycle rollover engine** | **First fix `CycleViewSet` (`cycle.label` 500 + non-atomic `is_active` flip).** Then `run_cycle_rollover`: cycle-locked, per-award savepoints, skips awards with unresolved latest installments, creates the next installment only (never advances the index, never graduates). Plus the `expire_renewals` command. |
| 8 | **Eligibility/double-dip integration** | §5.1 `programme_type` gate; §5.2 recurring-aware conflicts (one Award query indexed by scheme, dedup vs the originating approved row, same-scheme-any-policy rule, `open` stacking handled) + regression tests. Also fix the engine's dead `student.cgpa`/`student.level` fallbacks (§8 #20b). |
| 9 | **Emails + polish** | Email tasks/templates, `eligibility_check` fix, admin.py for awards, CHANGELOG. |

Tests throughout: follow existing service-level test style (see `audit/tests.py`); the awards app uses a `tests/` package (it will outgrow one file). **These tests need Postgres** (edge 19) — the scheme `post_save` signal can't build its table on SQLite inside `TestCase`.

Critical test matrix:
- **Tenure** (§3.1): 4/5/6-yr × 100L/200L/300L; DE-mid-course proves `entry_level` is ignored; HND/PG defaults vs explicit; keyword inference incl. an unmatched `"CS"`→loud default; unparseable `current_level`; clamp both ends; fuzz = never raises, always `[1,6]`.
- **Creation/idempotency**: retried approval creates one award; year-1 installment `approved`; threshold snapshot survives a scheme edit; withdrawal cascade terminates + cancels non-disbursed only.
- **Rollover** (§3.3): re-running the same cycle is a no-op; re-activating a *different* cycle does not orphan a year; awards with an unresolved latest installment are skipped with reasons; **index advances only on disbursement**; rollover never graduates.
- **Lifecycle**: breach→withhold→suspend→appeal→uphold (resumes) / reject (terminates); resubmission cap; disburse gates (`IsAdmin`, requires `approved`, terminal).

## 10. Files touched (summary)

**New app `awards/`**: `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `services/{tenure,creation,lifecycle,rollover}.py`, `management/commands/expire_renewals.py`, `tests.py`, migrations.

**Modified**: `schemes/models.py` + `schemes/serializers.py` (3 fields), `students/models.py` + `students/serializers.py` (4 fields), `applications/views.py` (`review`, `staff_create` hooks), `applications/services/withdrawal.py` (award cascade), `applications/services/eligibility.py` (programme-type gate, recurring-aware double-dip), `schemes/views.py` (rollover on cycle activate), `notifications/helpers.py` (new helpers), `verification/tasks.py` + `templates/` (emails), `config/settings.py` (`awards` app, grace-day constants), `config/urls.py` (mount), `CHANGELOG.md`.

---

## 11. Revision notes (October 2026)

Two pressure-tests — the tenure resolver and the rollover engine — changed several decisions after the first draft. **Where this section conflicts with earlier prose, this section wins.**

### Tenure resolver (§2.3, §3.1, §4)
- Formula now counts from the student's **current** level, not entry level. The original `duration - (entry//100 - 1)` overpaid every mid-course applicant, silently.
- Resolver returns `TenureResolution(total_years, confidence, programme_type, flags)`; `parse_level` never raises (it runs inside the approval transaction).
- Clamp `[1, 6]` with flag-on-clamp (was `[1, 7]`, silent).
- Free-text duration inference is `inferred` + flagged, never silent; `tenure_confidence` / `tenure_flags` added to `Award` and surfaced in the admin queue.
- **Implemented & unit-tested**: `awards/services/tenure.py` + `awards/tests/test_tenure.py` (26 tests, incl. a fuzz test).

### Rollover engine (§3.3, §4, §7)
- `current_year_index` is now a **paid-years counter starting at 0** (highest disbursed year), not the "current payment year". Advances on **disbursement only**, never on installment creation.
- ⚠️ **Code/plan delta to reconcile (PR 2/3):** the already-committed `awards/models.py` default (`current_year_index=1`), `creation.py` (`current_year_index=1`), and `test_creation.py` assertion still use the old `1`-based meaning. Align them to `0` before building the rollover on top.
- Rollover **never graduates**; graduation happens only when the final installment is disbursed (§4).
- Rollover **skips** awards whose latest installment is unresolved (`pending_verification` / `withheld` / under appeal) and reports per-award reasons.
- Renewals are **cycle-locked**; re-activating an already-rolled cycle is a no-op (`already_rolled`).
- **Per-award savepoints** — a single outer `atomic()` is incompatible with log-and-continue.
- Notification fan-out uses `bulk_create` + `on_commit` email dispatch.
- Fixed two **pre-existing** `CycleViewSet` blockers: the `cycle.label` `AttributeError` (create/update/activate all 500 today) and the non-atomic `is_active` flip.

### Lifecycle state machine (§4, §8)
- Added an explicit **installment transition table**; every mutation is source-status-guarded (idempotent vs double-click / double-pay).
- **Quality rejects no longer end in `withheld`** — the rejection cap routes to `cancelled` (+ suspend), keeping the academic-appeal path for genuine CGPA breaches only. A `withheld` vs `cancelled` appeal **upholds differently** (`approved` vs reopen to `pending_renewal`).
- **The CGPA gate compares the normalized (5.0-scale) value**; `min_renewal_cgpa` is declared 5.0-scale (edge #25).
- **Open decision resolved:** there is no disqualifications register (it is a derived rejected-applications view) — a rejected appeal **terminates the award only**, no manufactured rejection record.
- New edge cases **#24** (a terminated/graduated award still exports in the approved-list CSV) and **#25** (threshold scale).

### Conflict / double-dip integration (§5.2)
- The first draft's shorthand "`major_only`/`exclusive`" **dropped `StackingPolicy.OPEN`** — under it, a naive port lets a student stack recurring awards. The new clause must call the **existing** stacking predicate, plus a same-scheme-any-policy rule.
- **Dedup required:** a recurring award's originating application is an approved row *and* an Award row in the start cycle — without dedup the same conflict counts twice.
- **One award query, not one per scheme** (index by `scheme_id` before the loop), or the fix adds ~N queries to an already-UNION-scanning check.
- Three policy decisions spelled out in §5.2: whether `suspended` awards block, whether cross-type conflicts persist across cycles, and that one-shot prior awards do **not**.
- Comparison basis fixed to `scheme.academic_year` strings (never mixed with cycle chronology).
- New §8 #20(b): the engine's own `student.cgpa` / `student.level` fallbacks are dead fields (same class as the `eligibility_check` bug).

### Cross-cutting / contract
- **`appeal_pending` is not an Award status** (§2.3) — it is `suspended` + a `pending` appeal. The frontend-repo plan still lists it as a status; reconcile before the frontend builds.
- **`cgpa_scale`** is part of the renewal contract (§8 #3); the frontend-repo plan's `/renew/` line omits it — reconcile.
- **Tests are Postgres-native** (edge 19): the scheme `post_save` signal builds tables via `schema_editor`, which SQLite forbids inside `TestCase`. CI/local dev needs Postgres, or the suite must disconnect the signal / add `config/settings_test.py`.

### Still-open decisions (neither pressure-test resolved these)
1. ~~**Appeal rejected** — surface in the Disqualifications register, or just terminate?~~ **Resolved (§4, §8 #24):** there is no register to surface into — it is a derived view of `rejected` applications. A rejected appeal **terminates the award only**; the application stays `approved`, so no rejection record is manufactured. A hard blacklist, if ever wanted, is a new, separate feature.
2. **`GET /awards/` aggregate** for the "Committed ₦/yr" stat — backend-provided, or the frontend drops that stat? (Summing a paginated list is wrong.)
3. **Scheduling `expire_renewals`** (cron vs `django-celery-beat`) — owner and mechanism. Without it, non-submission never suspends and appeal windows never expire.
4. **Terminated/graduated awards in the approved-list & disbursement CSV** (edge #24) — exclude or annotate? Product call; the export is application-based today.
