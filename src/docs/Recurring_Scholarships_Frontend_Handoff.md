# Recurring Scholarships — Frontend Handoff (What You're Building)

Audience: the frontend dev (Next.js repo, project root). The backend contract is already agreed and being built in `mbo_youth_emp` (see `mbo_youth_emp/RECURRING_SCHOLARSHIPS_PLAN.md` — that doc is the source of truth for endpoint shapes). This doc tells you exactly what to build in this repo, page by page, in order. Status: Ready to implement. Date: September 2026.

---

## 0. Ground rules before you start

- **Follow existing conventions, don't invent new ones.** CSS modules per page (`page.module.css`), summary-strip + table-row grid pattern (copy from `src/app/admin/beneficiaries/page.js` and `src/app/admin/cycles/page.js`), `useRoleGuard` for page access, Lucide icons, `Loader2` spinners, skeleton rows while loading, two-tap confirm buttons instead of modals where the cycles/approvals pages already do that.
- **All API calls go through `src/services/`.** Create `src/services/awards.js`, export from `src/services/index.js`. Never call `axiosInstance` directly from a page (the cycles page does — don't copy that).
- **Multipart uploads**: follow the `submitApplication` pattern — `api.post(url, body, { headers: { "Content-Type": "multipart/form-data" } })`.
- **CSV export**: blob-download pattern from `downloadApprovedListCsv` in `src/services/applications.js` (responseType `"blob"`, filename from `content-disposition`).
- **Money** via the existing currency formatting; dates `en-GB` (`day: "numeric", month: "short", year: "numeric"`).
- **Update docs when done**: `src/CHANGELOG.md` + a short entry in `src/docs/`, same style as `Eligibility_Criteria.md`.

You can build all of this against the contract below before the backend ships — the `/api/proxy` forwards any path, so wire the real paths and test end-to-end when the backend lands.

---

## 1. Backend contract you're coding against

Base paths (proxied, so call them as `/awards/...` on the axios instance):

**Student**
```
GET  /awards/mine/                      → my awards, each with installments[]
GET  /awards/{id}/                      → one award, full installment timeline
POST /awards/{id}/renew/                → multipart: cgpa, cgpa_scale, level, transcript(file)
POST /awards/{id}/appeal/               → multipart: reason, evidence(file)
```

**Staff (verifier/admin — same roles as the applications queue)**
```
GET  /awards/?status=&scheme=&cycle=&programme_type=   → paginated register
GET  /awards/renewals/?cycle=                          → verification queue
POST /awards/installments/{id}/verify/   → { action: "approve"|"reject"|"withhold", note }
POST /awards/installments/{id}/disburse/ → { disbursement_ref }        (admin only)
POST /awards/{id}/suspend/  /terminate/                             (admin only)
GET  /awards/appeals/                    → appeal queue
POST /awards/appeals/{id}/review/        → { decision: "upheld"|"rejected", note }
GET  /awards/export/?scheme=&cycle=&export=csv         → CSV blob
```

**Key shapes**
```js
// Award
{
  id, status,                       // "active" | "suspended" | "graduated" | "terminated"
  scheme: { id, name, award_type, provider: { name } },
  annual_amount, total_years, current_year_index,   // e.g. 2 of 4
  start_cycle: { id, name },        // "2026/2027"
  suspended_reason,                 // shown to student when suspended
  installments: [Installment]       // on detail endpoint
}

// Installment
{
  id, year_index,                   // 1-based payment year
  cycle: { id, name },
  status,                           // "pending_renewal" | "pending_verification" |
                                    // "approved" | "disbursed" | "withheld" | "cancelled"
  amount, threshold,                // min CGPA this installment is judged on (snapshot)
  submitted_cgpa, submitted_level, transcript,      // renewal submission
  verifier_note, disbursed_at, disbursement_ref
}
```

**Status meanings you must render correctly**
- `pending_renewal` — student's turn: renewal form should be open.
- `pending_verification` — submitted, waiting on staff. Read-only for student.
- `approved` — verified, awaiting disbursement. Admin sees "Mark as paid".
- `disbursed` — paid. Terminal. Show date + ref.
- `withheld` — CGPA below threshold (or quality reject exhausted). Award goes `suspended`; student sees appeal CTA.
- `cancelled` — never submitted within the grace window. Award `suspended`.

---

## 2. Services layer (first task)

**New file `src/services/awards.js`**, mirroring the style of `applications.js`:

```js
import api from "./axiosInstance";

// ── Student ──
export const getMyAwards = () => api.get("/awards/mine/");
export const getMyAward = (id) => api.get(`/awards/${id}/`);
export const renewAward = (id, body) =>
  api.post(`/awards/${id}/renew/`, body, { headers: { "Content-Type": "multipart/form-data" } });
export const submitAwardAppeal = (id, body) =>
  api.post(`/awards/${id}/appeal/`, body, { headers: { "Content-Type": "multipart/form-data" } });

// ── Staff ──
export const getAwards = (page = 1, params = {}) =>
  api.get("/awards/", { params: { page, ...params } });
export const getRenewalQueue = (params = {}) => api.get("/awards/renewals/", { params });
export const verifyInstallment = (id, body) => api.post(`/awards/installments/${id}/verify/`, body);
export const disburseInstallment = (id, body) => api.post(`/awards/installments/${id}/disburse/`, body);
export const suspendAward = (id) => api.post(`/awards/${id}/suspend/`);
export const terminateAward = (id) => api.post(`/awards/${id}/terminate/`);
export const getAppeals = () => api.get("/awards/appeals/");
export const reviewAppeal = (id, body) => api.post(`/awards/appeals/${id}/review/`, body);
export const downloadAwardsCsv = (params) =>
  api.get("/awards/export/", { params: { ...params, export: "csv" }, responseType: "blob" });
```

Export from `src/services/index.js`.

---

## 3. Student-facing work

### 3.1 Nav + dashboard banner

- `src/app/dashboard/layout.js` — add **"My Scholarship"** nav item → `/dashboard/awards`, icon `GraduationCap` (already used elsewhere) or `Repeat`. Place after "Applications".
- `src/app/dashboard/page.js` — when any award has an installment in `pending_renewal`, show a banner above the programmes section: "Your {scheme name} renewal for {cycle name} is due — submit your latest CGPA." with a CTA to `/dashboard/awards/{id}`. Amber/warning styling (see the unverified-account banner already on this page for the pattern). Data comes from `getMyAwards()` — fetch alongside the existing dashboard calls, fail silently (banner just doesn't appear).

### 3.2 `src/app/dashboard/awards/page.js` — list

Card per award (grid, same card language as `programmes/page.js`):
- Scheme name + provider name, category chip.
- Progress: **"Year 2 of 4"** + thin progress bar (`current_year_index / total_years`).
- Annual amount formatted ₦.
- Status chip: Active (green) / Suspended (red) / Graduated (blue) / Terminated (grey).
- Next-action line: e.g. "Renewal open for 2027/2028" (when an installment is `pending_renewal`) → primary button "Renew now"; "Under review" (when `pending_verification`); "Suspended — appeal open" → "Submit appeal".
- Empty state: "No multi-year scholarships yet" + copy pointing to Programmes. Loading: skeleton cards. Error: existing error-state pattern with retry.

### 3.3 `src/app/dashboard/awards/[id]/page.js` — detail (the main student page)

Back button (circular icon-only — the standardized pattern), header with scheme name, provider, status chip, annual amount.

**Timeline** — vertical list of installments, newest at bottom. Each row: cycle name, "Year N", amount, status pill, and depending on status: submitted CGPA + level, verifier note, disbursed date + ref, transcript link. Icons: `Clock` (pending), `FileSearch` (verifying), `CheckCircle2` (approved), `Banknote` (disbursed), `ShieldAlert` (withheld), `XCircle` (cancelled).

**Action area** above the timeline:

- If current installment is `pending_renewal` → **renewal form**:
  - CGPA input (number, step 0.01), CGPA scale select (default "5.0", options 5.0 / 4.0), Level select (the level they're *entering*; options from the scheme's allowed levels pattern — 100–500 + Postgraduate), transcript file input (PDF/JPG/PNG, reuse the upload styling from the apply page).
  - Show the threshold up front: "You need a CGPA of at least **{threshold}** to renew."
  - Soft-check: if entered CGPA < threshold, show an inline warning but still allow submit (the backend decides withhold; appeal flow handles it).
  - Submit via `renewAward` as FormData. On success: refetch award, toast/inline success, form collapses into a "Submitted — awaiting verification" state.
- If award is `suspended` → show `suspended_reason` in a red banner + **appeal form** (textarea `reason`, file `evidence`) → `submitAwardAppeal`. After submit: "Appeal under review" state.
- If `graduated` → congratulatory block, no actions.
- If `terminated` → muted block, link to Help.

Guard: `useRoleGuard(["student"])` if that's how dashboard pages do it — check siblings and match.

---

## 4. Admin-facing work

### 4.1 Nav

`src/app/admin/components/AdminSidebar.js` — add to the records group (alongside Beneficiaries/Disqualifications):
```js
{ label: "Awards", href: "/admin/awards", icon: Repeat, roles: ["admin", "superadmin", "verifier"] },
```

### 4.2 `src/app/admin/awards/page.js` — register

- Stats strip: **Active**, **Suspended**, **Graduating this year**, **Committed ₦/yr** (sum of `annual_amount` over active awards — compute client-side from the paginated list is wrong; show it only if the backend returns an aggregate, otherwise drop this stat and keep three. **Check with backend before shipping.**)
- Filter row: status select, scheme select (populate from `getSchemes()`), search by student name.
- Table: Student (avatar + name, link to `/admin/students/{id}`), Scheme, Year progress ("2/4"), Annual amount, Cycle started, Status chip. Row click → `/admin/awards/{id}`.
- Pagination matching the applications page. Skeleton rows. CSV export button (`downloadAwardsCsv`) in the header, same blob pattern.

### 4.3 `src/app/admin/awards/renewals/page.js` — the verification queue (most important new screen)

This is the yearly work queue. Link it from a **"Renewals"** button on the awards page header (like "Send Approvals" on Applications), with a count badge of `pending_verification`.

- Table of installments from `getRenewalQueue()`, default filtered to `pending_verification`, tab/select to also show `pending_renewal` (waiting on students — read-only, maybe a "Remind" button later).
- Columns: Student, Scheme, Year (index/total), **Submitted CGPA vs threshold** — render as `3.85 / 3.50` with green/red color coding, Submitted level, Transcript (link opens in new tab), Submitted date.
- Row action → **verify panel** (inline expand or modal, your call — modals exist in cycles page):
  - **Approve** → `verifyInstallment(id, { action: "approve" })`. Two-tap confirm (green).
  - **Reject (resubmit)** → requires a note. Sends back to student. Show remaining resubmissions if returned.
  - **Withhold (below threshold)** → requires a note. Red. Confirm copy must say the award will be **suspended** and the student can appeal.
- After any action: refetch queue (mirrors the approvals page behavior).

### 4.4 `src/app/admin/awards/[id]/page.js` — award detail

- Back button to `/admin/awards`.
- Header: student (link to student page), scheme, status chip, annual amount, tenure summary ("4 payments · started 2026/2027 · ends 2029/2030").
- Installment timeline (same component style as student detail, plus admin actions per installment):
  - `approved` → **"Mark as paid"** → prompt for `disbursement_ref` (small inline form), `disburseInstallment`. Admin only.
  - `pending_verification` → same verify controls as the queue.
- Award-level actions (admin only, in a danger zone at the bottom): **Suspend**, **Terminate** — both two-tap confirm with copy explaining consequences (terminate = permanent, student removed from future payments).
- **Appeal panel**: when there's a pending appeal on this award, show reason + evidence link + **Uphold** (requires note; explains installment moves to approved) / **Reject** (requires note; explains award terminates). `reviewAppeal`.

### 4.5 Scheme form changes

`src/app/admin/schemes/new/page.js` and `src/app/admin/schemes/[id]/page.js`:

- New **"Recurring award"** block, rendered only when `award_type === "scholarship"`:
  - Toggle `is_recurring` (checkbox/switch).
  - When on: `min_renewal_cgpa` number input (prefill from `min_cgpa`, editable; helper text "Checked every year. Defaults to the application minimum if left blank."), and `applicable_programme_types` checkbox group: Undergraduate / HND / Postgraduate (taught) / Postgraduate (research).
  - On the edit page, if the scheme already has awards: show a warning line — "Changes to the threshold only affect future installments; existing awards keep their original terms." (Backend snapshots, so this is informational only.)
- Submit: send `is_recurring`, `min_renewal_cgpa`, `applicable_programme_types` as **flat top-level keys** in the same body — the serializer assembles them server-side, exactly like the eligibility keys already work (see `src/docs/Eligibility_Criteria.md`). `applicable_programme_types` goes as a comma-separated string, same convention as `allowed_levels`.
- Edit page detail view: when recurring, show a "Recurring · ₦X/yr · min CGPA Y.YY" InfoRow and a link to `/admin/awards?scheme={id}`.

### 4.6 Student profile — academic section

`src/app/dashboard/profile/page.js`: add to the academic area, all optional, saved through the existing `updateStudentProfile` PATCH (the backend serializer accepts them — confirm field names before wiring):
- **Faculty** (text), **Programme type** (select: Undergraduate / HND / Postgraduate — taught / Postgraduate — research), **Programme duration** (select, options depend on type: undergrad 4/5/6 — Medicine & Dentistry are 6, HND 2, PG taught 1/2, research 2/3/4), **Entry level** (select 100/200 — only when type is Undergraduate; label it "100 = regular admission, 200 = direct entry").
- Helper copy: "Used to calculate how many years a multi-year scholarship pays for."

### 4.7 Beneficiaries page touch-up

`src/app/admin/beneficiaries/[id]/page.js` — if the scheme is recurring, add a small "Recurring" chip next to the category chip in the header and a link "View awards →" to `/admin/awards?scheme={id}`. That's all; don't rebuild the page.

---

## 5. Build order (do them in this sequence)

1. **`src/services/awards.js`** + index export.
2. **Scheme forms** (§4.5) + **profile academic fields** (§4.6) — pure form work, unblocks data collection immediately.
3. **Student awards pages** (§3.2, §3.3) + nav item + dashboard banner.
4. **Admin register + renewal queue** (§4.2, §4.3) + sidebar entry.
5. **Admin award detail + appeals** (§4.4).
6. **Beneficiaries chip/link** (§4.7), CHANGELOG + docs entry.

## 6. Edge cases your UI must handle (don't skip these)

1. **Below-threshold CGPA entry** — warn but allow submit; backend withholds. Never hard-block client-side.
2. **Award suspended while renewal form open** — after refetch, swap form for the suspended banner + appeal form.
3. **Resubmission after a reject** — installment returns to `pending_renewal` with a verifier note; show the note and re-open the form. If the backend signals no resubmissions left, hide the form and show "Contact support".
4. **`graduated` mid-list** — a graduated award still shows in the list (blue chip), detail is read-only.
5. **Multiple awards** — a student can theoretically hold more than one recurring award; the list page must not assume one.
6. **Missing profile data** — if tenure couldn't be computed confidently the backend still creates the award; don't crash on `total_years: 1`.
7. **Permissions** — verifier sees renewals queue but **not** disburse/suspend/terminate buttons (role from `getMe()`; hide, don't just disable).
8. **Empty queues** — renewals page needs a proper empty state ("No renewals waiting — you're caught up").
9. **File inputs after failed submit** — files can't be re-persisted; on error keep the form open and tell the user to re-attach the transcript (same convention as the register page).
10. **Refetch-after-mutation everywhere** — verify/disburse/appeal actions must refresh the award/queue so status pills never go stale.

## 7. Definition of done

- Every endpoint in §1 has a corresponding service function and is used by a real page.
- Renewal happy path works end-to-end: student submits → verifier approves → admin marks paid → timeline shows disbursed.
- Breach path works: below-threshold submit → withhold → suspended → appeal → uphold (resumes) and reject (terminates).
- `npm run build` passes, no new lint errors.
- `src/CHANGELOG.md` + `src/docs/Recurring_Scholarships.md` written, matching the style of the existing docs.
