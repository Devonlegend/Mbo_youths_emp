# Frontend Integration Guide — Mbo Youth Empowerment Portal

This is the hand-off doc for the frontend developer. It explains **what to build**,
**screen by screen, per role**, and which API each screen calls. The backend is a
Django + DRF API and is feature-complete — nothing on the server needs to change to
build the UI.

> **Two sources of truth:**
> - **This file** — flows, screens, and which endpoint each screen calls (read this first).
> - **Live OpenAPI docs** — exact, always-current request/response fields. Run the
>   backend and open **`/api/docs/`** (Swagger) or **`/api/redoc/`**. The raw schema is
>   at **`/api/schema/`** and can generate a typed API client.

---

## 1. The system in 60 seconds

A local-government youth funding portal. Admins publish **schemes** (scholarship,
grant, or empowerment/vocational). Students browse open schemes and **apply**. The
backend auto-runs **eligibility** at submission; if the student already holds a
conflicting award it gets flagged for a **waiver**. **Verifiers/admins** then review and
approve/reject.

**Roles:** `student` · `verifier` · `admin` · `superadmin`. The UI must be role-gated
(get the role from `GET /auth/me/`).

**Core lifecycle:**
`Admin creates + publishes scheme` → `Student applies` → eligibility auto-check →
`submitted` (or `double_dip_flag` → waiver → `document_review`) → `Verifier reviews` →
`approved` / `rejected` / `shortlisted`.

---

## 2. Conventions (apply to every request)

| Topic | What the frontend must do |
|---|---|
| **Base URL** | No version prefix. Routes mount at root: `/auth/`, `/students/`, `/applications/`, `/schemes/`, `/verification/`, `/audit/`, `/notifications/`. |
| **Auth** | Cookie-based JWT. **Never** store tokens in JS/localStorage. Send every request with `credentials: 'include'` (fetch) / `withCredentials: true` (axios). |
| **CORS** | Backend allows credentialed requests only from `CORS_ALLOWED_ORIGINS` (dev default `http://localhost:3000`). Your dev origin must be in that list. |
| **401 handling** | On `401`, call `POST /auth/token/refresh/` once, then retry the original request. If refresh also fails, send the user to login. |
| **Pagination** | List endpoints return `{ count, next, previous, results }`. Page size 50. Use `?page=N`. |
| **Throttling** | Limits: anon 60/min, user 1000/day, OTP 5/min, auth 10/min. On `429` you may get `{ error, retry_after_seconds }` — show a countdown. |
| **Errors** | Typically `{ "error": "message" }`. Field validation: `{ "error": "...", "fields": { "cgpa": ["..."] } }`. Missing docs: `{ "error": "...", "documents": [{ key, label }] }`. |
| **File uploads** | Passport/certificate at register use `multipart/form-data`. Application **documents** must be uploaded to Cloudinary first (you receive URLs), then passed as a `{ key: url }` dict in the submit body. Allowed: JPEG/PNG/PDF, max 5 MB. |

---

## 3. Authentication flows

Login and registration are **two-step**: credentials → email OTP → cookies set.
The NIN is **pre-hashed on the client** and sent as `nin_hash` (the server never sees raw NIN).

### Register
1. `POST /auth/register/` — `multipart/form-data`:
   `email, firstname, lastname, phone_number, password, nin_hash, passport` (file, required),
   optional `certificate` (file), `date_of_birth`, `gender`, `ward`, `lga`.
   → `201 { message, email }`. **Not logged in yet.**
2. `POST /auth/otp/send/` `{ email }` → `{ message }` (OTP emailed; in DEBUG it is logged, not sent).
3. `POST /auth/otp/verify/` `{ email, code }` → `{ message }` **+ sets cookies**. User is now authenticated.

### Login
1. `POST /auth/login/` `{ email, password }` → `{ otp_required: true, email }`.
2. `POST /auth/otp/send/` `{ email }`.
3. `POST /auth/otp/verify/` `{ email, code }` → cookies set.

### OTP rules (drive the OTP screen)
- 6-digit code, **TTL 10 min**, **max 5 attempts**, **resend cooldown 60s**.
- Use `POST /auth/otp/resend/` `{ email }` for an explicit "resend" button.
- During cooldown you get `429 { error, retry_after_seconds }` — disable resend and show the countdown.

### Session management
- `GET /auth/me/` → `{ id, email, firstname, lastname, phone_number, role, passport }`. Call on app load to know who/what role.
- `POST /auth/token/refresh/` — no body; rotates cookies. Call on 401.
- `POST /auth/logout/` — clears cookies, blacklists refresh token.

### Password reset
1. `POST /auth/password/reset/request/` `{ email }` → always `200` (no account enumeration).
2. `POST /auth/password/reset/verify/` `{ email, code }` → gates the "new password" step.
3. `POST /auth/password/reset/confirm/` `{ email, code, new_password }` → resets and invalidates other sessions.

---

## 4. Screens to build — by role

### 4A. Student

**1. Auth screens** — Register (multipart + file picker), OTP entry (cooldown/TTL/attempts as above), Login, Forgot password, Reset password. See §3.

**2. Scheme catalog** — `GET /schemes/?award_type=&cycle=active`
- Filters: `award_type` = `scholarship` | `empowerment` | `grant`; `cycle=active` or `cycle={uuid}`.
- Each card: `name`, `award_type_display`, `award_amount`, `remaining_slots`/`total_slots`,
  `application_open_date`–`application_close_date`, `description`.
- Students only see **published + active** schemes. Disable "Apply" when slots are 0 or the window is closed.

**3. Scheme detail + Apply form** — `GET /schemes/{id}/`, then `POST /applications/submit/`
- Render the eligibility requirements from `eligibility_criteria` (JSON; shape depends on `award_type`).
- **The form fields depend on `award_type`** (`programme_answers` object in the submit body):
  - **scholarship:** `institution_name, course_of_study, current_level, cgpa, admission_year, matric_number`
  - **empowerment:** `trade_or_skill`, optional `training_provider, training_duration_months, prior_experience`
  - **grant:** `business_name, business_stage` (`idea`|`startup`|`growth`|`mature`), `business_description, requested_amount, intended_use`
- **Bank capture:** `GET /verification/banks/` for the dropdown → user enters account number →
  `POST /verification/bank/` `{ account_number, bank_code }` → shows resolved `account_name` and a
  `name_match` result. Pass these into submit as `bank_account_number, bank_code, bank_name, bank_account_name, bank_name_match_passed`.
- **Self-declaration:** a yes/no ("received support from another org?") + a repeater of
  `{ organisation, category, year }` rows when yes. Send as `self_declaration_received_support` + `self_declaration_details` (array).
- **Attestation:** a checkbox that **must be true** (`attestation_agreed`).
- **Documents:** upload files to Cloudinary, then send `documents: { key: url }`.
  Scholarship **requires** `admission_letter` and `last_result`; empowerment/grant have no required docs.
- **Submit body** (`POST /applications/submit/`):
  ```jsonc
  {
    "scheme_id": "<uuid>",
    "programme_answers": { /* fields per award_type, see above */ },
    "bank_account_number": "0123456789",
    "bank_code": "058",
    "bank_name": "GTBank",
    "bank_account_name": "JOHN DOE",
    "bank_name_match_passed": true,
    "self_declaration_received_support": false,
    "self_declaration_details": [],
    "attestation_agreed": true,
    "documents": { "admission_letter": "https://res.cloudinary.com/...", "last_result": "https://..." }
  }
  ```
- **Submit response** `201`:
  `{ application_id, status, eligible, has_conflict, conflict_details, checks, message }`.
  - `status: "submitted"` → success screen.
  - `status: "double_dip_flag"` (`has_conflict: true`) → route to the **waiver** screen (see below).
  - Handle `400` errors: scheme closed / no slots / already applied / invalid `fields` / missing `documents`.

**4. Conflict / waiver screen** — shown when `has_conflict: true`
- Display `conflict_details` (each: `scheme_id`, `scheme_name`, `award_type`, `reason`).
- One action: `POST /applications/{application_id}/waiver/` (no body) → `{ message }`. Moves the
  application to `document_review` for manual admin decision. (The waiver does **not** auto-resolve the conflict.)

**5. My applications** — `GET /applications/mine/`
- List card fields: `status`, `status_display`, `submission_date`, `eligibility_passed`, `has_conflict`, `can_waive`.
- Detail: `GET /applications/{id}/` → full object incl. `eligibility_details` (per-check breakdown),
  `documents`, `reviewer_notes`, `rejection_reason`.
- Timeline: `GET /applications/{id}/history/` → list of `{ from_status, to_status, reason, changed_by_email, changed_at }`.

**6. Profile** — `GET /students/me/`; edit via `PATCH /students/{user}/` (the path id is the user's UUID — same value as `me`'s `id`).

**7. Notifications** — `GET /notifications/` (`[{ id, type, title, message, read, time }]`);
`POST /notifications/{id}/read/`; `POST /notifications/read-all/`; `DELETE /notifications/{id}/`; `DELETE /notifications/clear/`.

### 4B. Verifier

Verifiers see **all** applications and act on the reviewable ones.

**1. Review queue** — `GET /applications/queue/?status=`
- Default: all applications in reviewable states. Optional `?status=` narrows to one
  (`submitted`, `document_review`, `shortlisted`, `waiver_required`, `double_dip_flag`).

**2. Flagged (conflicts)** — `GET /applications/flagged/` — everything in `double_dip_flag`.

**3. Applications-by-scheme** — `GET /applications/by-scheme/{scheme_id}/?status=`
→ `{ scheme: { id, name, award_type, total }, applications: [ <full detail> ] }`.

**4. Application detail + decision** — `GET /applications/{id}/`, then
`POST /applications/{id}/review/` `{ decision, notes }`:
- `decision` = `approved` | `rejected` | `shortlisted`. **`notes` is required when rejecting.**
- Approving sets the student's active award and decrements the scheme's remaining slots.
- Show `eligibility_details` and `has_conflict` so the reviewer can make an informed override.

### 4C. Admin / SuperAdmin

Everything a verifier can do, plus scheme/cycle/student management.

**1. Scheme management** — `/schemes/` CRUD
- `GET /schemes/` (admins see all, incl. unpublished), `POST /schemes/` (create),
  `GET/PATCH/DELETE /schemes/{id}/`.
- `POST /schemes/{id}/publish/` and `POST /schemes/{id}/close/`.
- ⚠️ `award_type` is **immutable** after creation (PATCH attempts to change it → 400).
- Scheme fields: `name, award_type, description, academic_year, award_amount, total_slots,
  stacking_policy` (`exclusive`|`major_only`|`open`), `eligibility_criteria` (JSON),
  `application_open_date, application_close_date, is_active, is_published`, optional `cycle_id`.

**2. Cycle management** — `/schemes/cycles/`
- CRUD + `POST /schemes/cycles/{id}/activate/` (activating one deactivates the others).
- Fields: `name` (e.g. "2026/2027"), `start_year, end_year, is_active`.

**3. Students admin** — `GET /students/` (admin only, paginated),
`GET /students/stats/` (`{ total_students, verified, unverified, with_active_award, by_ward }`),
`DELETE /students/{id}/` (admin only).

**4. Audit log** — `GET /audit/` (admin/superadmin) → last 100 entries
`[{ id, admin_name, action, entity_type, entity_id, timestamp }]`.

---

## 5. Reference: key enums & shapes

**Application status:** `draft, submitted, eligibility_check, double_dip_flag,
document_review, shortlisted, approved, rejected, waiver_required, withdrawn`.
Reviewable (verifier can act): `submitted, document_review, shortlisted, waiver_required, double_dip_flag`.

**Award types:** `scholarship, empowerment, grant`.
**Stacking policy:** `exclusive` (no other active award), `major_only` (can't stack with other major awards), `open`.
**Wards:** `efiat, efiat II, enwang I, enwang II, ebughu I, ebughu II, ibaka, uda I, uda II, udesi`.

**`eligibility_criteria` (JSON) by award type** — used to render requirements:
- scholarship: `{ min_cgpa, allowed_levels[], ward_restriction[]|null, disability_relaxation, max_prior_awards }`
- empowerment/grant: `{ min_age, max_age, allowed_trades[], ward_restriction[]|null, disability_relaxation, max_prior_awards }`

**`eligibility_details` (in application detail)** — per-check results, each `{ passed, ... }`:
`slots, window, ward, prior_awards, double_dip` plus award-specific `cgpa`/`level` (scholarship)
or `age`/`trade` (empowerment).

---

## 6. Full endpoint reference

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/register/` | public | Register (multipart) |
| POST | `/auth/login/` | public | Validate credentials → OTP step |
| POST | `/auth/otp/send/` | public | Send OTP |
| POST | `/auth/otp/resend/` | public | Resend OTP |
| POST | `/auth/otp/verify/` | public | Verify OTP → set cookies |
| GET | `/auth/me/` | auth | Current identity |
| POST | `/auth/token/refresh/` | public (cookie) | Rotate access cookie |
| POST | `/auth/logout/` | auth | Logout |
| POST | `/auth/password/reset/request/` | public | Send reset code |
| POST | `/auth/password/reset/verify/` | public | Verify reset code |
| POST | `/auth/password/reset/confirm/` | public | Set new password |
| GET | `/schemes/` | public (filtered) | List schemes |
| POST | `/schemes/` | admin | Create scheme |
| GET/PATCH/DELETE | `/schemes/{id}/` | public / admin | Scheme detail / edit / delete |
| POST | `/schemes/{id}/publish/` | admin | Publish |
| POST | `/schemes/{id}/close/` | admin | Close |
| GET/POST | `/schemes/cycles/` | public / admin | Cycles list / create |
| GET/PATCH/DELETE | `/schemes/cycles/{id}/` | public / admin | Cycle detail / edit / delete |
| POST | `/schemes/cycles/{id}/activate/` | admin | Activate cycle |
| GET | `/applications/` | auth (scoped) | List (own for students, all for staff) |
| GET | `/applications/{id}/` | auth (scoped) | Application detail |
| GET | `/applications/mine/` | student | My applications |
| POST | `/applications/submit/` | student | Submit application |
| POST | `/applications/{id}/waiver/` | student | Submit double-dip waiver |
| GET | `/applications/queue/` | verifier | Review queue |
| GET | `/applications/flagged/` | verifier | Flagged applications |
| GET | `/applications/by-scheme/{scheme_id}/` | verifier | Apps for one scheme |
| GET | `/applications/{id}/history/` | auth (scoped) | Status history |
| POST | `/applications/{id}/review/` | verifier | Approve/reject/shortlist |
| GET | `/students/` | admin | List students |
| POST | `/students/` | auth | Create student |
| GET/PUT/PATCH | `/students/{user}/` | auth (scoped) | Student detail / update (path id = user UUID) |
| DELETE | `/students/{user}/` | admin | Delete student |
| GET | `/students/me/` | auth | My profile |
| GET | `/students/stats/` | auth | Aggregate stats |
| GET | `/students/{user}/eligibility-check/` | auth | Quick pre-check |
| POST | `/verification/bank/` | auth | Resolve bank account |
| GET | `/verification/banks/` | auth | Bank list |
| GET | `/audit/` | admin | Audit log |
| GET | `/notifications/` | auth | List notifications |
| POST | `/notifications/{id}/read/` | auth | Mark read |
| POST | `/notifications/read-all/` | auth | Mark all read |
| DELETE | `/notifications/{id}/` | auth | Dismiss |
| DELETE | `/notifications/clear/` | auth | Clear all |
| GET | `/api/docs/` · `/api/redoc/` · `/api/schema/` | — | Interactive API docs / OpenAPI schema |

---

## 7. Gotchas (read before coding)

1. **Cookie auth, not bearer tokens.** No localStorage; always send credentials; handle 401 → refresh → retry. CSRF: your origin must be in `CSRF_TRUSTED_ORIGINS`.
2. **Two-step login/register.** A successful `/login/` or `/register/` does **not** log you in — the OTP verify step sets the cookies.
3. **`award_type` drives the apply form.** Send the right `programme_answers` keys for the scheme's type, or you'll get a `400` with field errors.
4. **Upload documents to Cloudinary first**, then pass URLs in the `documents` dict at submit. Scholarship requires `admission_letter` + `last_result`.
5. **Eligibility is computed once at submit and is immutable.** Admins can approve despite a failed check or a conflict — that's expected; the override is recorded in history.
6. **Conflicts → waiver, not auto-block.** `double_dip_flag` means the student can submit a waiver and an admin decides manually.
7. **Per-scheme storage is invisible to you.** The API unifies applications across schemes; treat them uniformly. Cross-scheme staff lists can be slower with many schemes — paginate.
8. **DEBUG mocks.** Locally, OTP/reset emails are written to the server log (read the code from there) and Paystack bank resolution returns canned data.

---

## 8. Running the backend locally (for the dev)

```bash
pip install -r requirements.txt
# configure .env from .env.example (DB, Cloudinary, etc.)
python manage.py migrate
python manage.py runserver        # API at http://127.0.0.1:8000
```
Then browse **http://127.0.0.1:8000/api/docs/** for the interactive, always-current
endpoint reference. Point your frontend dev server (default `http://localhost:3000`) at
the API and ensure that origin is in `CORS_ALLOWED_ORIGINS`.
