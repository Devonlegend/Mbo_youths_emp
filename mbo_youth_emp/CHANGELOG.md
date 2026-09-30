# Changelog

## v1.2.0 (recurring-scholarships)

**Multi-year scholarships: a recurring-award contract that pays every academic year until graduation, gated by a yearly CGPA threshold, with renewal verification, suspension/appeal recovery, and an automatic cycle-rollover engine.**

### 🗃️ Data model

- **`schemes.ScholarshipScheme`** — new `is_recurring` (master switch; default `False` = today's one-shot behaviour), `min_renewal_cgpa` (yearly gate; falls back to `eligibility_criteria.min_cgpa`) and `applicable_programme_types` (JSON list; empty = undergrad only). Serializer handles them as flat top-level keys, same convention as the eligibility keys.
- **`students.Student`** — new optional academic profile: `faculty`, `programme_type` (`ProgrammeType` choices), `programme_duration_years`, `entry_level`. Exposed on `StudentSerializer`.
- **`schemes.Cycle`** — new `activated_at`, the anchor for the renewal grace window.
- **New app `awards`** — `Award` (the multi-year contract; `scheme` is `PROTECT`ed), `AwardInstallment` (one row per payment year), `AwardAppeal`, `AwardEvent` (append-only audit trail). `Award.current_year_index` is a **paid-years counter starting at 0** — advanced on disbursement only.
- **Migrations**: `schemes/0002`, `students/0012`, `schemes/0003`, `awards/0001`.

### 🧮 Tenure resolver (`awards/services/tenure.py`)

- `resolve_total_years(student, application_row)` → `TenureResolution(total_years, confidence, programme_type, flags)`. Counts from the student's **current** level (never entry level), clamps to `[1, 6]` with a flag, and **never raises** (it runs inside the approval transaction). Free-text inference is `inferred` + flagged; unresolvable input degrades to 1 year + a flag.

### ✅ Award creation

- `awards/services/creation.py::create_award` hooked into `review()` and `staff_create` inside the approval transaction — idempotent via `unique(application_id)`, snapshots amount + threshold, creates the year-1 installment as `approved`.
- Withdrawal of an approved application cascades: `terminate_award_for_withdrawal` terminates the award and cancels non-disbursed installments (disbursed money is terminal).

### 🔄 Lifecycle + API (`awards/services/lifecycle.py`, `awards/views.py`)

- Source-status-guarded transitions, each writing an `AwardEvent` (+ `audit.record_admin_action` for staff): `submit_renewal` (normalized 5.0-scale CGPA), `verify_installment` (approve/reject/withhold; server-side CGPA gate; reject-cap → cancel + suspend), `disburse_installment` (the only path that advances the index and the only path that graduates), `suspend_award` / `terminate_award`, and the `submit_appeal` / `review_appeal` recovery flow.
- Endpoints: `GET /awards/`, `/awards/mine/`, `/awards/{id}/`, `POST /awards/{id}/renew/`, `/appeal/`, `/suspend/`, `/terminate/`, `GET /awards/renewals/`, `GET /awards/appeals/`, `POST /awards/installments/{id}/verify/`, `/disburse/`, `POST /awards/appeals/{id}/review/`, `GET /awards/export/?export=csv`.

### ⏱️ Rollover + expiry

- `awards/services/rollover.py::run_cycle_rollover` — cycle-locked, per-award savepoints, skips unresolved/complete/suspended awards with reasons, never advances the index and never graduates; idempotent (`already_rolled`). Wired into `CycleViewSet.activate`, which now sets `activated_at`.
- `awards/services/expiry.py` + `expire_renewals` management command (`--dry-run`) — cancels overdue renewals (suspend) and expires lapsed appeal windows (terminate).

### 🎯 Eligibility (`applications/services/eligibility.py`)

- Recurring scholarships gate on `programme_type` (missing data passes with a verifier note).
- Recurring `Award` rows participate in double-dip detection **across every cycle they span**, with a same-scheme-any-policy rule and dedup against the originating approved row; suspended awards raise a soft flag (not a hard conflict). The stacking predicate is shared verbatim with the application-row scan.

### 📧 Emails

- `EmailService` methods + Celery tasks + templates for renewal-open, suspension, disbursement, graduation, and appeal-decision. All dispatched via `transaction.on_commit` (a broker blip never breaks a committed transition), with the renewal fan-out using `bulk_create` for in-app notifications.

### 🛠️ Fixes

- **Pre-existing `CycleViewSet` 500**: `create`/`update`/`destroy`/`activate` referenced the non-existent `cycle.label`; now `cycle.name`. Activation is now atomic (can no longer leave zero active cycles).
- **Dead `student.cgpa` / `student.level` reads** removed from `EligibilityEngine._check_cgpa`/`_check_level` and from `students/views.py::eligibility_check` (fields were removed from `Student` in migration 0010).

### 🧪 Tests

- New `awards` test package (tenure, creation, lifecycle, API, appeals, rollover, expiry, eligibility, emails) — Postgres-native, since the scheme `post_save` signal builds each physical application table via `schema_editor`.

---

## v1.1.8 (email-provider)

**Transactional email provider switched from Brevo to ZeptoMail (Zoho) — all Brevo SDK usage removed. Healthchecks added for every service (Coolify-ready).**

### 📧 Email

- **`verification/services/email.py`** — `_brevo_send` (sib-api-v3-sdk) replaced with `_zepto_send` using the `zeptomail` SDK; `EmailService` public API and mock mode unchanged, so Celery tasks keep working as-is. `_zepto_send` now strips any pasted `Zoho-enczapikey ` prefix from the configured key so the SDK header is always well-formed.
- **`requirements.txt`** — dropped `sib-api-v3-sdk==7.6.0`, added `zeptomail==1.0.0`.
- **`config/settings.py`** — `BREVO_MOCK_MODE` / `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` renamed to `ZEPTO_*` (env var names changed accordingly).
- **`accounts/services.py`** — deleted (unused legacy Brevo OTP/reset senders; views already use the Celery tasks).
- **`docker-compose.yml`, `.env.example` (root + `mbo_youth_emp/`), `DEPLOYMENT.md`, `README.md`** — env/docs updated to the `ZEPTO_*` variables.

### 🩺 Healthchecks

- **New `health` app** — `GET /api/health/` runs `connection.ensure_connection()` and returns `200 {"status":"ok"}` or `503 {"status":"error"}` (try/except — never a 500). Registered in `INSTALLED_APPS`, routed at `config/urls.py`.
- **New frontend route** — `src/app/api/health/route.js` returns `200 {"ok":true}` (no DB dependency).
- **`docker-compose.yml`** — healthchecks on all services so Coolify reports them Healthy:
  - `db` (existing `pg_isready`), `redis` (`redis-cli ping`)
  - `backend` probes `/api/health/` on `127.0.0.1:8080` via `urllib` (10s/5s/5, start_period 30s)
  - `frontend` probes `/api/health` on `127.0.0.1:3000` via `node fetch` (10s/5s/5, start_period 20s)
  - `worker` pings via `celery -A config inspect ping` (15s/10s/3, start_period 60s)
  - `caddy` checks its admin API at `127.0.0.1:2019/config/` (10s/5s/5, start_period 5s)
- **`ALLOWED_HOSTS`** — compose default now includes `localhost,127.0.0.1` so in-container health probes aren't rejected with `DisallowedHost`.

---

## v1.1.7 (scale)

**Student converted to multi-table inheritance of `User` — identity fields now live once on the parent, and registration creates both rows in a single call.**

---

###  Backend

- **`accounts/models.py`** — `firstname`, `lastname`, `date_of_birth` moved up from `Student` to `User`; `gender` now lives on `User` (with its `male`/`female` choices); `role` gained a `default=Role.STUDENT`. These are shared identity fields used by staff accounts too.
- **`students/models.py`** — `Student` is now `class Student(User)` (multi-table inheritance) instead of a standalone model with a FK `user`:
  - Duplicated columns removed from the child table: `email`, `phone_number`, `nin_hash`, `passport` (inherited from `User` now)
  - `user = OneToOneField(User, primary_key=True, related_name='student', parent_link=True)` — the parent-link column, so `student.pk == user.id` and `request.user.student` / `student.user` resolve to the same row
- **`accounts/views.py` — `register` simplified**: previously `User.objects.create_user(...)` + `Student.objects.create(user=user, ...)` inside one `transaction.atomic()`; now a single `Student.objects.create_user(...)` that writes both rows (the manager is inherited). `ward` / `lga` / `nin_slip` / `certificate` flow through as `extra_fields`.
- **Duplicate-NIN fix in `register`**: removed `_delete_unverified_user(nin_hash=...)` and restored the `nin_taken` pre-check. The NIN-reclaim branch previously deleted another (unverified) account sharing the same NIN, so a second registration with the same NIN succeeded (201). Now only the same-email skeleton can be reclaimed; a duplicate NIN returns `400 {"error": "NIN already in use", "code": "nin_taken"}`.
- **New migrations**: `accounts/0005_alter_user_role` (role default) and `students/0011_remove_student_date_of_birth_remove_student_email_and_more` (drop the now-duplicated child columns; rewire the `user` column as the MTI parent link).

### 🛠️ Fixes

- **Boot blocker**: `Student(User)` re-declared `firstname` / `lastname` / `gender` / `date_of_birth`, which Django forbids for concrete parent fields — the app would not start (`FieldError`). Removed the shadowed fields.
- **Parent link**: the `user` OneToOneField originally lacked `parent_link=True`, which would have made Django auto-add a second implicit `user_ptr` join column. Now explicit.
- **New helper `Student.attach_to_user(user, **student_fields)`** — creates the child row for an already-persisted User via `save_base(raw=True)`. A plain `save()` force-inserts the parent row (Django force-inserts any new instance whose PK has a default), which would have raised a duplicate-PK error.

### 🧪 Tests

- **`students/tests.py`** — student fixtures now built with `Student.attach_to_user(...)`; passport-from-User behaviour unchanged (detail/list return `user.passport.url`, null when absent).
- **`applications/tests.py`** — `SlotBookkeepingTests`, `WithdrawApplicationTests`, `ApprovedListExportTests`, and `_make_approved_in_ward` attach students to their existing users via the helper.
- **`accounts/tests.py`** — `test_duplicate_nin_is_rejected` passes again (`register` returns `400 nin_taken`).
- **Full suite: Ran 45 tests — OK.** `manage.py check` clean; `makemigrations --check` reports no drift.

---

## v1.1.6 (wip)

**Audit log completed — every administrative action is now recorded, and `GET /audit/` returns a paginated response.**

---

### 🗂️ Backend

- **`audit/services.py` (new)** — failure-safe `record_admin_action()` helper that appends an immutable `AuditLog` row. The write is wrapped in try/except so a logging failure never breaks (or rolls back) the admin action that triggered it. A `None` / unauthenticated actor is stored as `null` and surfaced as "System" by the serializer.
- **`audit/views.py`** — added `AuditLogPagination` (100 rows per page) and converted `AuditLogView` from a fixed 100-row slice back to a proper DRF paginated envelope (`{ count, next, previous, results }`, newest first). This fixes the contract mismatch where the frontend Audit Log page read `results/count/next/previous` from a bare-array response the old endpoint never provided — the page always rendered "No audit entries yet".
- **Admin actions now write audit entries.** Entity types match the UI filter chips: `Application`, `Student`, `Scheme`, `Cycle`, `SchemeProvider`.
  - **`applications/views.py`** — `review` (approved / rejected / shortlisted), `withdraw`, `staff_create`, `publish` (approval emails, with count sent)
  - **`schemes/views.py`** — scheme create/update/delete + `publish` / `close` / `reopen`; cycle create/update/delete + `activate`; provider create/update/delete
  - **`students/views.py`** — `verify` (verification approved / rejected)
- **`audit/admin.py`** — `AuditLog` registered in Django admin as a read-only browsable trail: `list_display`, entity-type + date filters, search across action / entity id / admin name & email, newest first. Add and delete permissions are disabled and every field is read-only so entries can never be tampered with from the admin.
- **Tests (`audit/tests.py`)** — `RecordAdminActionTests` (row created, `entity_id` stringified, `None`/unauthenticated actor → System, never raises) and `AuditLogApiTests` (paginated envelope shape, `page_size = 100`, page 2 slice, admin + superadmin allowed, student + anonymous denied, serialized fields). **Ran 13 tests — OK**; full `students` suite still green.

---




**Note:** audit search/filter stays client-side over the current page (100 rows); paging through older entries uses the existing pagination bar.

---

## v1.1.5 (wip)

**Ward-filtered approved-list CSV + Student passport from the User table.**

---

### 🗂️ Backend — `GET /applications/approved-list/` now filters by ward

- **`applications/views.py`** — added an optional `?ward=` query param. When present, approved applicants are filtered by `student.ward` (case-insensitive, `iexact`) for **both** the JSON response and the `&export=csv` download.
- **Swagger** — new `ward` parameter documented on the action.
- **`schemes/admin.py`** — the "Export approved applicants" action now routes through an intermediate ward-picker page instead of streaming immediately:
  - `_stream_approved_csv(response, schemes, ward=None)` — extracted streaming helper; honours an optional ward filter
  - `ScholarshipSchemeAdmin.export_approved_list_view` — GET lists the selected schemes and a ward dropdown (only wards that actually have approved applicants); POST streams the CSV
  - Download filename becomes `approved-applicants-{ward}.csv` when a ward is chosen
- **New template** — `schemes/templates/admin/schemes/export_approved_list.html`

### 🧪 Tests (`applications/tests.py` — `ApprovedListExportTests`)

- Ward filter returns only that ward's approved applicants (JSON)
- Ward filter is case-insensitive
- CSV export filtered by ward excludes other wards
- Admin action redirects to the ward picker
- Admin ward-picker page lists the real wards
- Admin ward-filtered CSV export; all-wards export unchanged
- Full `ApprovedListExportTests` suite: **Ran 12 tests — OK**

---

### 🗂️ Backend — Student passport now read from the User table

- **`students/serializers.py`** — `StudentSerializer.passport` now serializes the linked `accounts.User.passport` photo (`obj.user.passport.url`). The legacy `Student.passport` column is never populated, so it was always empty.
- **`students/views.py`** — `StudentViewSet.queryset` now uses `select_related('user')` so the serializer read doesn't trigger an N+1 query per row.
- **Tests** (`students/tests.py` — `StudentDetailPassportTests`): detail returns the user's passport URL; null when the user has no photo; the list endpoint returns it too.

---

### 🖥️ Service (Frontend API client)

- **`src/services/applications.js`** — `downloadApprovedListCsv(schemeId, ward?)` now forwards an optional `ward` to the API. Omitted/empty ⇒ unchanged behaviour (all wards).

---

### 🔧 Ops

- **`docker-compose.yml`** — expose Postgres on `127.0.0.1:5432:5432` (localhost only) for local tooling
- **`DEPLOYMENT.md`** — corrected backend base URL references

---

### 🖥️ What the frontend should do (NOT implemented yet in this release)

Backend + service support for ward filtering is in, but the admin UI does **not** surface it yet. To let admins download one ward's approved list from the portal:

1. **`src/app/admin/beneficiaries/[id]/page.js`**
   - Add a `ward` state (default `""` = all wards) and a ward `<select>` in the toolbar next to the search box. Populate options client-side from the loaded `beneficiaries` (unique non-empty `b.ward`, sorted, plus an "All wards" option) — no extra API call needed since `getApprovedList` already returns every approved record for the scheme.
   - Include the ward in the table filter: `(!ward || b.ward === ward)`.
   - Pass the selected ward to the export handler: `downloadApprovedListCsv(schemeId, ward)`.
   - When a ward/search filter is active, show the filtered count in the header count pill.
2. **`src/app/admin/beneficiaries/[id]/page.module.css`** — add a `.wardSelect` style matching the existing `.searchInput` look.

## v1.1.4 (wip)

**Backend-only: new API to pull every approved applicant for a single scheme — names, phone numbers, emails & bank details — as JSON or CSV.**

---

### 🗂️ Backend — `GET /applications/approved-list/?scheme={scheme_id}`

Fetches the approved (disbursement) list for **one scheme** in flat rows. Verifier/admin only.

- **New endpoint** in `applications/views.py` — `approved_list` action on `ApplicationViewSet`
  - `?scheme=` **required** (400 if missing · 404 if unknown scheme · 400 if scheme has no table)
  - Returns `{ scheme, count, applications[] }`
  - Each row merges the student's `full_name`, `phone_number`, `email`, `ward` with the application's own bank snapshot (`bank_name`, `bank_code`, `account_number`, `account_name`)
  - `approved_at` — latest `ApplicationStatusHistory` transition into `approved` (fallback `reviewed_at`)
  - Reads the scheme's dynamic table (`get_application_model`) filtered to `status='approved'` — **no “only after publish” constraint**
- **CSV export** — same URL + `&export=csv` streams a downloadable `approved-list-{scheme}-{date}.csv`
  - Columns: `S/N, Full Name, Phone Number, Email, Ward, Scheme ID, Scheme, Award Type, Bank Name, Bank Code, Account Number, Account Name, Approved At, Application ID`
  - Uses `export`, **not** `format` — DRF reserves the `format` query param (returns 404 when no renderer matches)
- **Django admin** — new `export_approved_list` action on `ScholarshipSchemeAdmin`: select one or more schemes and run “Export approved applicants for selected scheme(s) as CSV” (streams the same disbursement CSV via the shared helpers, no view code duplicated)
- **New helpers** in `applications/serializers.py` — `serialize_approved_application()`, `approved_application_csv_row()`, `APPROVED_LIST_CSV_FIELDNAMES`, `_csv_cell()`

### 🧪 Tests (`applications/tests.py` — `ApprovedListExportTests`)

- Missing `scheme` → 400 · empty scheme → 200 empty list
- Only `approved` rows returned, with correct contact + bank data
- CSV content-type, `Content-Disposition: attachment`, header + row values
- Non-verifier (student) → 403
- Django admin action `export_approved_list` streams the CSV (`schemes/admin.py`)
- Full `applications` suite: **Ran 11 tests — OK** (5 existing + 6 new, no regressions)

---

### 🖥️ What the should be done on frontend (NOT implemented yet in this release)

To surface the list in the admin UI:

1. **Add service fetchers** in `src/services/applications.js` (via the existing `/api/proxy` axios instance; auth = the same CookieJWT):
   ```js
   export const getApprovedList = (schemeId) =>
     api.get("/applications/approved-list/", { params: { scheme: schemeId } });

   export const downloadApprovedListCsv = (schemeId) =>
     api.get("/applications/approved-list/", {
       params: { scheme: schemeId, export: "csv" },
       responseType: "blob",
     });
   ```

2. **Download button** (scheme detail page or a scheme selector): call `downloadApprovedListCsv(schemeId)` and trigger the browser download from the returned blob (object URL + `<a download>`). It must be fetched as a blob — the backend streams `text/csv` with `Content-Disposition: attachment`; do **not** use `responseType: "json"`.

3. **Beneficiaries register** (`src/app/admin/beneficiaries/page.js`): add a **scheme dropdown**, load rows with `getApprovedList(schemeId)`, and add **Phone** and **Email** columns next to the existing Name + Account-number columns.

4. **Field mapping** for the UI: `full_name` · `phone_number` · `email` · `ward` · `bank_name` · `account_number` · `account_name` · `approved_at` · `scheme.name`.

## v1.1.3 (`f14262d`)

**Merge PR #2 (`Master` → `backend`).** 46 files changed · +2,315 / −1,286 lines

---

### 🗂️ Admin: Scheme-scoped Application Management

**Applications are now manageable per-scheme, and the main list got a major simplification.**

- **New page `src/app/admin/applications/scheme/[schemeId]`** (page.js + page.module.css) — a dedicated dashboard for all applications within one scheme
- **`admin/applications` list rewritten** — `page.js` and `page.module.css` both cut down heavily (hundreds of changed lines each); leaner cards and simpler state handling
- **`src/services/applications.js` updated** — new fetchers backing the scheme-scoped view
- Touch-ups in `admin/applications/[id]`, `admin/applications/approvals`, `admin/schemes/[id]`, `admin/schemes/new`, `admin/students/[id]`

---

### 🗂️ Admin: Scheme Management Suite

**Creating schemes now has a dedicated page, and scheme details gained a full management UI.**

- **New "Create Scheme" page** (`src/app/admin/schemes/new` + page.module.css)
- **Scheme detail page extended** (`src/app/admin/schemes/[id]/page.js`, +191 lines)
- **`src/docs/Eligibility_Criteria.md` added** — documents the eligibility rules behind scheme setup

---

### ✉️ Email Templates Redesigned

**Every transactional email rebuilt on a refreshed shared layout.**

- **`templates/email/base.html` overhauled** (+118/−163) — shared structure used by all emails
- Rebuilt on top of it: `application_approved`, `application_rejected`, `application_submitted`, `double_dip_flagged`, `student_verified`, `welcome`, `password_reset`
- **`notifications/helpers.py`** — link fix

---

### 🎨 Landing Page Polish + Navbar Overhaul

- **New `Reveal` component** (`Reveal.jsx` + `Reveal.module.css`) — reusable scroll-reveal animation wrapper
- **Navbar rewritten** (`Navbar.jsx` 366 changed lines, `Navbar.module.css` 398 changed lines) with follow-up alignment/colour fixes
- Minor polish across `About`, `CTABanner`, `Contact`, `Eligibility`, `FAQ`, `Footer`, `Hero`, `HowItWorks`, `Programmes`

---

### 🛠️ Other Fixes

- `dashboard/help`, `dashboard/profile`, `dashboard/programmes/apply`, `forgot-password`, `login`, `register` pages and the global `layout.js` updated

---

## Previous release — v1 (`da25bd7`)

### 58 files changed · +2,090 / −3,465 lines

---

### NIN Hashing Moved Server-Side

**The raw 11-digit NIN is now hashed on the server, not the client.** Previously the frontend pre-hashed the NIN before sending it — now the client should send the raw NIN as `"nin"` and the backend hashes it with a secret pepper before storage.

- **New:** `accounts/utils.py` — `hash_nin(raw_nin)` → SHA-256 hex digest (64 chars)
  - Mixes in `NIN_HASH_PEPPER` (a server-only secret) so the hash resists offline brute-force despite the NIN's tiny 10^11 keyspace
  - Strips whitespace, validates exactly 11 digits, raises `ValueError` on bad input
- **`User.nin_hash`** — max length 20 → **64**, now `unique=True` (migration `0004`)
- **`Student.nin_hash`** — max length 20 → **64** (migration `0002`)
- **Register endpoint** — changed field from `nin_hash` to `nin`; hashes it server-side before storing
- **`createsuperuser`** — accepts raw NIN at the CLI prompt, hashes it internally — no more plain or client-hashed NINs in the DB
- **New setting:** `NIN_HASH_PEPPER` (defaults to `SECRET_KEY`, separable for independent rotation)
- **Duplicate NIN handling:** same `"nin_taken"` error code; `IntegrityError` caught to handle concurrent-registration races
- **Abandoned signup cleanup:** `_delete_unverified_user()` sweeps skeleton accounts before re-registration so no email/NIN/phone gets permanently squatted

### Tests (`accounts/tests.py` — 147 lines)

- Unit tests for `hash_nin`: determinism, uniqueness, hex format, pepper application, whitespace handling, invalid input rejection
- Integration tests for `/auth/register/`: stores hash not raw NIN, duplicate NIN rejected, missing/malformed NIN rejected
- DB-level uniqueness constraint test

---

### Email System Overhaul

### All email dispatch moved to Celery tasks

- OTP emails → `send_email_task.delay(template_name='otp', otp=code)`
- Password reset → `send_password_reset_task.delay(email=email, otp=code)`
- Welcome email → `send_welcome_email.delay(user_id=...)` — fires once on first OTP verification
- Student verified → `send_student_verified_email.delay(student_id=...)` — fires when admin approves verification

**Why:** Previously OTP and reset emails were sent synchronously (`send_otp_email`) — a Brevo API hiccup blocked the request. Now they queue via Celery so the HTTP response is instant, and failures retry automatically (3 retries, 60s back-off).

### 8 New HTML Email Templates

| Template | When it fires |
|---|---|
| `base.html` | Shared layout — RMHCDT branding, Sora/DM Sans fonts, responsive |
| `otp.html` | Login & registration OTP |
| `password_reset.html` | Password reset code |
| `welcome.html` | First OTP verification (account created) |
| `application_submitted.html` | Application received by the system |
| `application_approved.html` | Verifier publishes scheme results |
| `application_rejected.html` | Rejection notice (deprecated — no longer sent, kept as reference) |
| `double_dip_flagged.html` | Award conflict detected — prompts waiver submission |
| `student_verified.html` | Admin approves identity verification |

**Design:** Sora headings, DM Sans body, MBO Forest green (`#15803d`) brand colour, info boxes (green/amber/red), detail tables, CTA buttons, reference badges. `support_email` and `portal_url` injected globally.

### `EmailService` changes (`verification/services/email.py`)

- `send_student_verified(student)` — new method
- Safe `award_amount` formatting (`award_amount or 0` fixes `None` crash)
- Award type comparison fixed: uses `get_award_type_display()` instead of raw `award_type` value
- `support_email` injected into every template context

---

### Approval Notification Deferral ("Publish" Flow)

**Approval emails are no longer sent at the moment of review.** Instead they are staged and dispatched in bulk when a reviewer "publishes" a scheme's results.

### New model: `PendingApplicationNotification`

Tracks "approved but not yet emailed" — one row per approved application. `sent_at` stamped when the publish endpoint fires. Indexed on `(scheme, sent_at)`.

### New endpoint: `POST /applications/publish/{scheme_id}/`

- Verifier/admin only
- Sends all staged approval emails for one scheme
- Idempotent — already-sent rows are skipped
- Returns `{ sent: N, scheme: "name" }`

### New endpoint: `GET /applications/schemes-overview/`

Drives the scheme-card grid on the verifier/admin dashboard. For every scheme with applications: `pending_review` count + `unpublished` (staged but not sent) count.

### Rejection emails deprecated

Rejection emails are no longer sent. `send_application_rejected_email` is intentionally not imported. The in-app notification still fires.( would remove it too , must remember)

---

### Staff-Create Application Endpoint

**`POST /applications/staff-create/`** — Admin creates an application on behalf of a student.

- Requires `student_id` (student UUID)
- Skips scheme-open, slot-remaining, and duplicate-application checks
- Optional `status_override` lets the admin set the initial status directly (e.g. `approved`)
- Supports the same multipart document upload flow as the regular submit
- Admin-only, not to be done in nextjs admin only django admin

---

### Notification System Refactored

### New: `notifications/helpers.py` (160 lines)

7 factory functions that create `Notification` rows — a single place to define titles and messages, replacing inline `Notification.objects.create()` calls scattered across views:

| Function | Trigger |
|---|---|
| `notify_welcome(user)` | First OTP verification |
| `notify_application_submitted(user, app)` | Application submitted (no conflict) |
| `notify_award_conflict(user, app)` | Double-dip flag raised |
| `notify_application_status_update(user, app, status)` | Review decision (approved/rejected/shortlisted) |
| `notify_approval_published(user, app)` | Scheme results published |
| `notify_new_application_in_queue(application)` | New app → alert ALL staff (verifier/admin/superadmin) |
| `notify_profile_verified(user)` | Admin approves identity verification |
| `notify_password_changed(user)` | Password reset confirmed |

### Notification type cleanup (`notifications/models.py`)

Removed `verification_approved` and `verification_rejected` types — those now use the `profile` and `application` types via the helpers above.

---

### 📄 Application Submission Improvements

### Multipart file upload at submit

The submit endpoint now accepts `multipart/form-data` with a `payload` JSON part + document file parts:
```
payload: { scheme_id, programme_answers, bank_*, ... }
admission_letter: <file>
last_result: <file>
```
Files are validated (`validate_upload`) and uploaded through `default_storage` (Cloudinary). Falls back to plain JSON for non-browser callers.

### Removed `is_verified` gate

Students no longer need admin verification before submitting applications — the `is_verified` check on the submit endpoint is gone. why? there's already a check on dashboard to prevent students from accessing application, so the check here is redundant

### `by-scheme` response enriched

`GET /applications/by-scheme/{scheme_id}/` now includes `pending_review` and `unpublished` counts alongside the existing `scheme` + `applications`.

### Serializer trim

- `StudentNestedSerializer` — removed `email`, `lga` (not needed on the list view)
- `serialize_application_list` — removed `rejection_reason`, `details` (bank fields)
the bank details check is now a must , it must match your name before u can submit
---

### Removals

| Removed | Why |
|---|---|
| `POST /auth/admin-users/` (list, create, update-role, deactivate, reactivate) | Admin user management moves to Django Admin (`/admin/`) where NIN hashing and the `UserAdmin` form enforce security |
| `GET /students/pending/` | Unused; verification queue uses the standard student list filtered by `is_verified` |
| `POST /verification/upload/` | Document upload is now inline at application submit — no separate upload-then-submit step |
| `AcademicRecord` model | Removed entirely — academic data is captured in per-scheme application tables |
| `schema.yml` (1,998 lines) | Auto-generated by `drf-spectacular` at `/api/schema/` — no reason to commit |
| `FRONTEND_GUIDE.md` (288 lines) | Replaced by live Swagger/ReDoc at `/api/docs/` |
| `Admin_Portal_Changes.md` (199 lines) | Session work log, folded into this commit |

---

### Django Admin Hardening

**`accounts/admin.py`** rewritten from a bare `UserAdmin(admin.ModelAdmin): pass`:

- **`UserCreationForm`** — prompts for raw NIN, hashes it server-side; password confirmation matching
- **`UserChangeForm`** — shows password as read-only hash; passport field not required (staff accounts don't have passports)
- **`UserAdmin`** — `list_display`, `list_filter`, `search_fields`, `ordering`, `readonly_fields`, `filter_horizontal`
- **Superuser-only locking:** non-superusers cannot change `role`, `is_staff`, `is_superuser`, `groups`, or `user_permissions` — prevents privilege escalation by a compromised admin account

---

### Production Readiness

### Docker

- **New `Dockerfile`:** Python 3.13-slim, gunicorn on port 8080, `collectstatic` at build time

### Static files

- **WhiteNoise** (`whitenoise==6.12`) added for static file serving — no CDN needed
- `STORAGES['staticfiles']` → `CompressedManifestStaticFilesStorage`
- Middleware ordering corrected: `WhiteNoiseMiddleware` before `CorsMiddleware`

### Security hardening

- **HSTS** (`SECURE_HSTS_SECONDS`, `includeSubDomains`, `preload`) now gated behind `ENVIRONMENT=production` — won't break Railway staging deployments
- **Cookie flags** configurable: `JWT_COOKIE_SAMESITE` and `JWT_COOKIE_SECURE` from env
- `SECURE_SSL_REDIRECT` defaults to `False` (Railway terminates TLS at the load balancer)

### Config

- `.env.example` flattened to simple `KEY=VALUE` format (no sections/comments)
- `NIN_HASH_PEPPER` added
- `SUPPORT_EMAIL` added
- `requirements.txt` pinned: `gunicorn`, `whitenoise`, `attrs`, `jsonschema`, `referencing`, `rpds-py`, `uritemplate`, `PyYAML`, `inflection`, `django-cloudinary-storage`

---

### Student Model Changes

- **New fields on Student:** `email`, `phone_number`, `gender` — previously only on User, now mirrored on Student for direct access
- **`nin_hash`** — max_length 20 → 64 (matches User)
- **`StudentCreateSerializer`** — `nin_hash` intentionally NOT writable (derived server-side)
- **`AcademicRecordSerializer`** removed (model deleted)
- **Permission fixes:** `student_profile` relation name corrected (was `student`, now uses the Django-generated `student_profile`); bank endpoint GET/PATCH unified as single `@action`
- **Verify endpoint:** `permission_classes=[IsVerifier]` (was `[IsAdmin]`); imports `notify_profile_verified` helper instead of inline notification creation
- **Stats:** `Count('id')` instead of `Count('user_id')` (Student's PK is `id`, not `user_id`)

---

### Other Changes

- **Audit log:** simplified from paginated `ListAPIView` back to `APIView` returning the latest 100 entries (fixed slice)
- **Audit log creation removed** from application review — no audit entry on approve/reject
- **`me` endpoint** response reordered: `gender` before `date_of_birth`, `last_login` removed
- **`upload_document` endpoint** and its Cloudinary import removed
- **Bank resolution** no longer persists details to the Student row (submit carries the values)
- **Template dirs** configured: `BASE_DIR / 'templates'` added to `TEMPLATES[0]['DIRS']`


---

> **Summary:** This commit froze the codebase for go-live. The biggest shifts: NIN hashing moved server-side with a pepper, email dispatch moved to Celery with retry, approval emails deferred behind a publish step, notification logic centralized into helpers, admin-user management pushed to Django Admin, document upload moved inline at submit, and the Docker/WhiteNoise/gunicorn stack wired for Railway deployment.
