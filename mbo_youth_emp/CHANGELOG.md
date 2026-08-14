# Changelog

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
