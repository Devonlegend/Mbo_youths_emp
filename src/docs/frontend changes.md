# RMHCDT Youth Portal — Frontend Changes Summary

A record of everything covered in this session, across the Login, Register, and Admin Applications flows.

---

## 1. Login Page

- **Fixed `.forgotLink`** — was undefined in CSS, falling back to default browser link styling. Added proper green, no-underline styling matching the brand.
- **Added "Remember me"** — saves the user's email (never the password) to `localStorage` on successful login, auto-fills it on return visits. Password autofill is left to the browser's native password manager instead, which is the safer, purpose-built tool for that.
- **Fixed a duplicate `otpSend()` call** in `handleSubmit` that was sending two OTP emails per login attempt.

---

## 2. Register Page — Multi-Step Wizard

Converted the single long form into a 4-step wizard: **Personal → Identity → Documents → Security**.

- **Stepper component** — numbered circles + connecting lines, shows current/completed steps.
- **Per-step validation** — `Next` only advances once the current step's fields are valid.
- **Draft persistence to `localStorage`** — non-sensitive form fields (name, email, NIN, DOB, etc.) auto-save on every change and restore if the page is refreshed or a network request fails mid-fill.
  - **Password is never persisted** — excluded from the draft entirely.
  - **Files (passport photo, certificate) are never persisted** — they can't survive a refresh. If the user reloads after reaching step 3+, they're bounced back to step 3 with a small notice to re-upload, rather than silently losing that data.
  - Draft is cleared automatically the moment registration succeeds.
- **"Already have an account?" link** — now only shows on step 1, since the point of stepping the form is to keep each screen focused.

---

## 3. Passport Capture Component

- **Mobile layout fix** — the captured-photo preview row (photo + status + "Retake Photo") was cramped on small screens. Added a `@media (max-width: 480px)` rule to stack it vertically with a full-width Retake button instead of forcing everything into one row.

---

## 4. Branding / Logo

- **Fixed the "boxy" halo around the circular logo** — caused by combining Cloudinary's `r_max` (pre-circled PNG) with CSS `border-radius` + `box-shadow`. Removed `r_max` from the URL and let CSS handle the circular clipping, so the shadow now follows the actual circle.
- **Decided against using the full legal name** ("Royal Mbo Host Community Development Trust") inline next to the logo — the card is capped at 560px wide, so it either wraps badly or shrinks illegibly. Kept the short "RMHCDT / Youth Portal" lockup for the header; the full name still lives in `metadata.description` for search engines/tab tooltips.
- **Fixed a layout bug on the Register page's `Logo` component** — `logoText` had been accidentally moved outside the `<Link>` wrapper (breaking the gap/alignment), while Login kept it correctly inside. Register was brought back in line with Login.
- **Image loading/prefetching:**
  - Used React's `ReactDOM.preconnect()` / `ReactDOM.preload()` (called directly in the root layout's Server Component body) instead of manual `<head>` `<link>` tags — this is Next.js's documented pattern, avoids clashing with Next's own head injection, and auto-dedupes.
  - Reserved logo dimensions + a placeholder background color to prevent layout shift while it loads.
  - Decided **not** to blanket-preload all future Cloudinary images — only specific, known-ahead-of-time assets (like this logo, used on every page) should get `preload`; a global `preconnect` to `res.cloudinary.com` is the one thing worth keeping site-wide.

---

## 5. Back Button — Standardized Across Admin Pages

Replaced the old text-based back button (`← Back to X`) with a compact circular icon-only button on:
- Application Detail page
- Student Detail page
- Scheme Detail page
- New Scheme page

```css
.backBtn {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.15s;
  flex-shrink: 0;
}
.backBtn:hover { background: var(--color-subtle); }
```

Icon size bumped from `14` to `16`, trailing label text removed.

---

## 6. Admin — Send Approvals Feature

New page: **`/admin/applications/approvals`**, linked from a "Send Approvals" button on the Applications page header (inline with the title on desktop, drops below it on mobile).

**Backend constraint this was built around:** the `publish` endpoint sends *all* unsent approval emails for a scheme — no way to select individual students or batch a subset. The page was scoped honestly around that limit rather than faking a feature the backend can't support.

**What it shows:**
- Stats strip: total pending count + breakdown by award type (Scholarship / Empowerment / Grant), sourced from the `schemes-overview` endpoint.
- Scheme cards — one per scheme with pending notifications, showing name, category chip, and pending count.
- Two-tap send confirmation (`Send Approval Emails` → `Confirm — Send N Emails`) instead of a full modal, since it's a real "emails students" action.
- Toast feedback after sending, then refetches the overview so counts update or the card disappears once everything's sent.
- **No student-level table** — confirmed via `serializers.py` that `StudentNestedSerializer` has no `email` field, and there's no backend endpoint that lists *which* specific students are still pending (only an aggregate count). Scoped the UI to what the backend actually supports rather than building against a gap.
- Confirm button color: uses the accent green (not red) since it's the primary/intended action; the cancel (X) button carries the red/danger tone instead, since it's the one aborting.

---

## Known Open Items (not built, flagged for later)

- **Cloudinary rate limiting** — a `429 RateLimited` error surfaced during testing when uploading the passport photo during registration. Not a frontend bug; likely tied to free-tier upload limits from repeated test submissions. Worth checking the Cloudinary dashboard's Usage tab if it recurs.
- **Draft expiry** — the registration draft in `localStorage` currently persists indefinitely if a user abandons the form entirely. Not addressed — worth adding a timestamp-based expiry (e.g. discard after 24h) if stale data on shared/public computers becomes a concern.
- **Row-level pending notifications** — decided not to pursue for now. Would need a new backend endpoint returning which specific students are awaiting an approval email (not just the count), which would also unlock partial/batch sending. Deprioritized as unnecessary for the current scope.