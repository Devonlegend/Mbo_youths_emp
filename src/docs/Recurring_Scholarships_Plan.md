# Recurring (Multi-Year) Scholarships — Implementation Plan

Feature: scholarships that pay every academic year until the student graduates, gated by a yearly CGPA threshold check. Covers 4-year and 5-year programmes, students who joined at 100L or via direct entry (200L), HND programmes, and research/postgraduate awards. Status: Proposed. Date: September 2026.

---

## 1. Current State (what exists today)

- **One-shot awards only.** A `ScholarshipScheme` has a single `award_amount`. Approval puts the student on the Beneficiary Register (`GET /applications/approved-list/`) and that is the end of the lifecycle. No concept of year 2, 3, 4 payments.
- **Eligibility criteria** (per `src/docs/Eligibility_Criteria.md`) already supports `min_cgpa` and `allowed_levels` — but they are only evaluated **once, at application time**.
- **Cycles** exist (`/schemes/cycles/`, one active at a time, `YYYY/YYYY`) and map 1:1 to academic years — the natural heartbeat for yearly renewals.
- **Academic records** endpoints exist (`GET/POST /students/academic-records/`) but nothing consumes them for eligibility re-checks.
- Students have `cgpa`, `current_level` (100–500, Postgraduate) captured on the application form. **No `faculty`, `department`, `programme_type`, or expected-graduation data is stored anywhere.**
- Admin has: Schemes, Cycles, Beneficiaries, Disqualifications, Audit Log. Student has: Programmes, Applications, Profile, Notifications.

**Conclusion:** this feature is ~80% backend, ~20% frontend. The frontend repo (this repo) cannot ship it alone — the Django backend needs new models, a renewal engine, and new endpoints first. Sections 2–3 are the backend spec to hand to whoever owns the Django project; Sections 4–6 are the frontend work in this repo.

---

## 2. Domain Model (backend — new/changed)

### 2.1 Scheme changes (`ScholarshipScheme`)

New fields (scholarship category only):

| Field | Type | Notes |
|---|---|---|
| `is_recurring` | bool, default `false` | Master switch. `false` = current one-shot behavior, zero regression. |
| `min_renewal_cgpa` | decimal, nullable | Threshold checked **every year**. Falls back to eligibility `min_cgpa` if unset. |
| `applicable_programme_types` | JSON list | Subset of `["undergraduate", "hnd", "postgraduate_taught", "postgraduate_research"]`. Blank = undergrad only (current behavior). |

Per-programme-type duration table (drives tenure math):

| Programme type | Typical duration | Joins at |
|---|---|---|
| Undergraduate (4-yr faculty) | 4 | 100L, or 200L (direct entry) |
| Undergraduate (5-yr faculty: Eng, Law, Arch, Pharm…) | 5 | 100L, or 200L (direct entry) |
| Undergraduate (6-yr faculty: Medicine, Dentistry, Vet) | 6 | 100L, or 200L (direct entry) |
| HND | 2 | HND1 (assumes completed ND/OND) |
| PG taught (MSc) | 1–2 | — |
| PG research (MPhil/PhD) | 2–4 | — |

Because duration varies *per student* (a 200L direct-entry student in a 5-yr faculty needs 4 payments, a 100L student needs 5), the scheme stores the **allowed programme types**; the **tenure is resolved per award** from the student's own programme data (see 2.2/2.3). This matches the agreed "both 1 and 2" answer: scheme declares what it funds, student profile declares their programme length.

### 2.2 Student profile changes (`StudentProfile`)

New fields:

| Field | Type | Notes |
|---|---|---|
| `faculty` | string, nullable | e.g. "Engineering" |
| `department` | string, nullable | e.g. "Computer Science" — the apply form already collects this, it just isn't persisted on the profile |
| `programme_type` | enum | `undergraduate` / `hnd` / `postgraduate_taught` / `postgraduate_research` |
| `programme_duration_years` | int, nullable | 4 or 5 for undergrad, 2 for HND, etc. |
| `entry_level` | int, nullable | 100 or 200 (direct entry); null for HND/PG |
| `expected_graduation_year` | int, nullable | Derived/helper, editable by admin |

### 2.3 New model: `Award` (the multi-year contract)

One per approved recurring application. This is the core entity the frontend renders.

| Field | Notes |
|---|---|
| `student` (FK) | |
| `scheme` (FK) | |
| `application` (FK, unique) | Source application |
| `total_years` | Resolved at award creation: `programme_duration_years - (entry_level/100 - 1)` for undergrad; `programme_duration_years` for HND/PG |
| `start_year` / `start_cycle` (FK) | Year of first payment |
| `expected_end_year` | `start_year + total_years - 1` |
| `annual_amount` | Defaults to `scheme.award_amount` (overridable per award) |
| `status` | `active` → `suspended` / `graduated` / `terminated` / `appeal_pending` |
| `current_year_index` | 1-based; which payment year the award is on |
| `suspended_reason`, `suspended_at` | For CGPA breaches |

**Tenure examples** (resolved server-side at approval time):
- 100L entry, 4-yr faculty → `total_years = 4` (pays 100L→400L)
- 200L direct entry, 5-yr faculty → `total_years = 4` (pays 200L→500L)
- HND1 → `total_years = 2`
- PhD year 1, 3-yr research award → `total_years = 3`

### 2.4 New model: `AwardInstallment` (one row per year per award)

| Field | Notes |
|---|---|
| `award` (FK) | |
| `year_index` | 1..total_years |
| `cycle` (FK) | Academic year this installment belongs to |
| `amount` | Copied from award at creation |
| `status` | `pending_renewal` → `pending_verification` → `approved` → `disbursed`; or `withheld` / `cancelled` |
| `submitted_cgpa`, `submitted_level`, `transcript` (file) | Student's renewal submission |
| `verified_by`, `verified_at`, `verifier_note` | Admin verification trail |
| `disbursed_at`, `disbursement_ref` | Payment trail |
| unique(`award`, `year_index`) | |

Year 1's installment is auto-created `disbursed`/`approved` when the award is created (initial approval = first payment), so the register stays consistent with today's behavior.

### 2.5 New model: `AwardAppeal`

For the agreed "suspend + allow appeal" flow:

| Field | Notes |
|---|---|
| `award` (FK) | |
| `installment` (FK) | The withheld installment being appealed |
| `reason` (text), `evidence` (file) | Student's case (e.g. medical, improved result) |
| `status` | `pending` / `upheld` / `rejected` |
| `reviewed_by`, `reviewed_at`, `review_note` | |

Upholding an appeal re-activates the award and moves the installment to `approved`. Rejecting moves the award to `terminated` and the student into the Disqualifications register (existing flow).

### 2.6 Status machine

```
Award:    active ──(CGPA below threshold)──▶ suspended ──(appeal upheld)──▶ active
                 │                              │
                 │                              └─(appeal rejected / no appeal window)──▶ terminated
                 └─(final installment disbursed)──▶ graduated

Installment: pending_renewal ──(student submits CGPA+transcript)──▶ pending_verification
                    ▲                                                    │
                    │                                          (admin approves / rejects)
                    │                                                    │
             (admin rejects → resubmission allowed, N attempts)          ▼
                                                                     approved ──▶ disbursed
                                                                    (CGPA fail → withheld + award suspended)
```

---

## 3. API Surface (backend — new endpoints)

All under existing proxy conventions; frontend just calls `/api/proxy/...`.

**Student-facing**
| Endpoint | Purpose |
|---|---|
| `GET /awards/mine/` | My awards with installments (dashboard "My Scholarship" view) |
| `GET /awards/mine/{id}/` | Award detail: progress, installment history, next action |
| `POST /awards/{id}/renew/` | Submit yearly renewal: `{ cgpa, level, transcript }` → creates/moves installment to `pending_verification`. Validates against `min_renewal_cgpa` client-visible but **enforced server-side** |
| `POST /awards/{id}/appeal/` | Submit appeal for a suspended award |
| `GET /awards/mine/{id}/status/` | Lightweight poll for notification badges |

**Admin-facing**
| Endpoint | Purpose |
|---|---|
| `GET /awards/` | Register of all awards, filterable by `status`, `scheme`, `cycle`, `programme_type` |
| `GET /awards/renewals/?status=pending_verification` | The yearly renewal review queue |
| `POST /awards/installments/{id}/verify/` | `{ action: "approve" \| "reject", note }` — approve moves to `approved` (queues disbursement); reject sends back for resubmission |
| `POST /awards/installments/{id}/disburse/` | Mark paid (manual, since payment is external/bank) with `disbursement_ref` |
| `POST /awards/{id}/suspend/`, `POST /awards/{id}/terminate/` | Manual overrides |
| `GET /awards/appeals/`, `POST /awards/appeals/{id}/review/` | Appeal queue + decision |
| `GET /awards/export/?scheme=&cycle=` | CSV export, mirrors the existing approved-list CSV pattern |

**Eligibility engine changes (backend)**
- At application time: if `scheme.is_recurring`, also check `programme_type` ∈ `applicable_programme_types` and that remaining tenure > 0.
- `allowed_levels` stays as-is (entry-time gate).

**Notifications (backend)**
Hook into the existing notifications app: renewal window opened, renewal approved/rejected, installment disbursed, award suspended, appeal decided, graduation congratulations. (These are server-generated; frontend needs no new mechanism.)

**Cycle-rollover job (backend, the engine)**
When a new cycle is activated (`POST /schemes/cycles/{id}/activate/` already exists):
1. For every `active` recurring award, create the next `AwardInstallment` (`year_index+1`, new cycle, status `pending_renewal`).
2. Notify those students that renewal is open.
3. Auto-suspend awards whose students never submitted within the renewal window (configurable grace period).
4. Auto-graduate awards where `current_year_index == total_years` and final installment is `disbursed`.

---

## 4. Frontend Changes (this repo)

### 4.1 Services

New file `src/services/awards.js` mirroring existing style, exported from `src/services/index.js`:

```js
// student
getMyAwards, getMyAward(id), renewAward(id, body), submitAppeal(id, body)
// admin
getAwards(params), getRenewalQueue(status), verifyInstallment(id, body),
disburseInstallment(id, body), suspendAward(id), terminateAward(id),
getAppeals(), reviewAppeal(id, body), exportAwardsCsv(params)
```

`src/services/students.js`: profile update already goes through `updateStudentProfile` — new fields (faculty, department, programme_type, programme_duration_years, entry_level) ride along in the same PATCH body. No new endpoint needed, assuming serializer accepts them (backend task).

### 4.2 Scheme create/edit forms

`src/app/admin/schemes/new/page.js` and `src/app/admin/schemes/[id]/page.js`:

- Add a **"Recurring award"** section, visible only when `award_type === "scholarship"`:
  - Toggle: `is_recurring`
  - When on: `min_renewal_cgpa` (prefilled from `min_cgpa`, editable), `applicable_programme_types` (checkbox group: Undergraduate / HND / PG Taught / PG Research)
- Keys sent as flat top-level fields in the existing POST/PATCH body — same pattern documented in `Eligibility_Criteria.md` (`ScholarshipSchemeSerializer` assembles them server-side). Frontend sends; backend must persist.
- Scheme detail view: show "Recurring · every year till graduation · min CGPA X.XX" badge + a **Renewals** count/link.

### 4.3 Student profile

`src/app/dashboard/profile/page.js` (Academic section): add Faculty, Department, Programme type (select), Programme duration (select, options filtered by programme type), Entry level (100/200, undergrad only), Expected graduation year (auto-computed display). All optional, editable, saved via existing `updateStudentProfile`.

### 4.4 Student: "My Scholarship" (new pages)

- `src/app/dashboard/awards/page.js` — card per award: scheme name, provider, year progress (e.g. "Year 2 of 4"), amount/year, status chip (Active / Suspended / Graduated), next action CTA.
- `src/app/dashboard/awards/[id]/page.js` — timeline of installments (per academic year: status, submitted CGPA, disbursement date/ref), and the **renewal action area**:
  - If current installment is `pending_renewal`: form — CGPA input, new level select, transcript upload (multipart, same pattern as `submitApplication`), threshold shown up front ("You need ≥ 3.50 to renew").
  - Client-side soft-check warns if below threshold but still lets them submit with an explanation (admin decides), or hard-blocks — **flag: pick one with backend owner** (recommend: warn + require explanation text, since suspension+appeal already handles failures).
  - If `suspended`: appeal form (reason + evidence upload) with the breach details shown.
- Dashboard home (`src/app/dashboard/page.js`): "Renewal due" banner when any award has a `pending_renewal` installment; reuses the existing notifications bell for server-generated events.
- Sidebar (`src/app/dashboard/layout.js` nav): add "My Scholarship" entry (icon: `GraduationCap` or `Repeat`).

### 4.5 Admin: renewal operations

- **Sidebar** (`src/app/admin/components/AdminSidebar.js`): add **Renewals** under a new "Awards" group — roles `["admin", "superadmin", "verifier"]` (verifiers already review students/applications; renewals are the same kind of work).
- `src/app/admin/awards/page.js` — awards register: stats strip (Active / Suspended / Graduating this year / Total committed ₦/yr), filter by scheme/status, table with student, scheme, year x-of-y progress, status.
- `src/app/admin/awards/renewals/page.js` — **the renewal queue** (main new workflow): table of `pending_verification` installments — student, scheme, year, submitted CGPA vs threshold (green/red), transcript link. Row action opens a verify modal (Approve → queues disbursement / Reject → note + resubmission). Two-tap confirm pattern like the Send Approvals page.
- `src/app/admin/awards/[id]/page.js` — award detail: installment timeline, verify/disburse actions per installment, suspend/terminate buttons with confirm modal (reuse the modal pattern from `cycles/page.js`), appeal review panel when `appeal_pending`.
- `src/app/admin/awards/appeals/page.js` — or fold appeals into the renewals page as a tab (recommend: tab, fewer nav items).
- Beneficiaries page (`admin/beneficiaries/[id]`): add a "Recurring" chip + link to the award for schemes where `is_recurring`.

### 4.6 Consistency notes (existing conventions to reuse)

- CSS modules per page (`page.module.css`), summary-strip + table-row grid pattern (see `beneficiaries/page.js`, `cycles/page.js`).
- `useRoleGuard` for page access.
- Lucide icons, `Loader2` spinners, skeleton rows while loading.
- CSV export via blob download pattern from `downloadApprovedListCsv`.
- All money formatted with the existing `formatCurrency` helper; dates `en-GB`.

---

## 5. Delivery Phases

| Phase | Scope | Depends on |
|---|---|---|
| **0. Backend spec sign-off** | Hand §2–3 to the Django owner; agree field names, tenure formula, renewal window/grace period, hard vs soft CGPA block | — |
| **1. Backend models + engine** | Migrations (Award, AwardInstallment, AwardAppeal, scheme/profile fields), award creation on approval, cycle-rollover job | 0 |
| **2. Backend endpoints** | §3 routes + notifications | 1 |
| **3. Frontend: profile + scheme forms** | §4.1–4.3 (unblocks data collection even before awards exist) | 0 (can build against agreed contract with mocks) |
| **4. Frontend: student awards + renewal** | §4.4 | 2 |
| **5. Frontend: admin register + renewal queue + appeals** | §4.5 | 2 |
| **6. End-to-end test** | Full loop: approve → year 1 paid → new cycle → renewal submit → verify → disburse → breach → suspend → appeal | 4, 5 |

Frontend phases 3–5 can start against a mock/fixture layer (`src/services/awards.js` behind a flag) while backend lands, since the proxy forwards any path transparently.

---

## 6. Edge Cases & Decisions to Confirm

1. **Level progression mismatch** — student submits renewal at the same level as last year (repeated a year). Recommend: allow, consume one installment, flag to admin (award still caps at `total_years` payments).
2. **Extra year / spillover** — student exceeds `total_years` without graduating. Recommend: no payment beyond `total_years`; admin may manually extend (`total_years + 1`) with a note.
3. **CGPA scale differences** — 5.0 vs 4.0 scales across institutions. `min_renewal_cgpa` assumes one scale per scheme; if mixed institutions are common, store `cgpa_scale` on the student profile and normalize server-side. **Confirm with backend owner.**
4. **HND entry assumption** — HND students always enter at HND1 (post-ND), so `entry_level` doesn't apply; tenure = 2. Research awards: tenure from `programme_duration_years` on profile, no levels.
5. **Mid-award scheme edits** — changing `min_renewal_cgpa` after awards exist. Recommend: threshold snapshots onto each installment at creation, so edits only affect future years.
6. **Stacking with one-shot awards** — `stacking_policy` already exists; recurring awards should count as the student's "major" award for `max_prior_awards` checks in later cycles. Backend eligibility change.
7. **Grace period length** for renewal submission after a new cycle activates (recommend: 8 weeks, configurable on the cycle or settings).
8. **Amount changes year-to-year** — `annual_amount` is snapshotted per award; if the Trust increases scheme amounts later, existing awards keep their rate unless admin edits the award.

---

## 7. Files Touched (frontend, this repo)

**New**
- `src/services/awards.js`
- `src/app/dashboard/awards/page.js` + `page.module.css`
- `src/app/dashboard/awards/[id]/page.js` + `page.module.css`
- `src/app/admin/awards/page.js` + `page.module.css`
- `src/app/admin/awards/[id]/page.js` + `page.module.css`
- `src/app/admin/awards/renewals/page.js` + `page.module.css`

**Modified**
- `src/services/index.js` (export awards)
- `src/app/admin/schemes/new/page.js`, `src/app/admin/schemes/[id]/page.js` (recurring section)
- `src/app/dashboard/profile/page.js` (academic fields)
- `src/app/dashboard/layout.js`, `src/app/admin/components/AdminSidebar.js` (nav entries)
- `src/app/dashboard/page.js` (renewal-due banner)
- `src/app/admin/beneficiaries/[id]/page.js` (recurring chip/link)
- `src/CHANGELOG.md`, `src/docs/` (document the feature, per repo convention)
