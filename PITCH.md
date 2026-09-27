# RMHCDT Youth Portal — Pitch & Demo Guide

One-page pitch narrative, a strict 3-minute script, and the live-demo click path.
Built from the actual codebase — accurate to what is implemented today.

---

## 1. Elevator pitch (30 seconds)

> RMHCDT Youth Portal is a NIN-anchored digital pipeline that lets the Royal Mbo
> Host Community Development Trust disburse PIA host-community funds to Mbo
> youths transparently — replacing paper forms, duplicate beneficiaries and
> manual records with one verified, auditable, self-service system for
> **Scholarships, Empowerment and Grants**.

---

## 2. The problem

- Mbo LGA is a PIA 2021 host community. Community development funds must reach
  real youth — fairly.
- Manual intake means **duplicate identities** (no unique anchor), **no audit
  trail**, and **no way to enforce the rules** (one award per category per
  cycle, ward eligibility, CGPA/age thresholds).
- Fraud is expensive and reputationally fatal for a Trust.

---

## 3. The solution — four pillars that map to the code

1. **Identity you can't fake** — registration requires an 11-digit NIN, hashed
   with a server-side pepper (`accounts/utils.py`), unique per account.
   One NIN = one account.
2. **Rules enforced by an engine, not a clerk** — `EligibilityEngine` checks
   slots, application window, ward restriction, prior awards, CGPA, academic
   level, age and trades — and **detects double-dipping** across schemes in the
   same cycle.
3. **Money that lands with the right person** — applicants link a bank account,
   verified via Paystack name-matching (≥60% match) before submission.
4. **Accountability by default** — append-only status history, an immutable
   **Beneficiary Register** (server-side CSV export), a **Disqualification
   Register**, and an **Audit Log** of every admin action.

---

## 4. Roles

| Role | Can do |
|---|---|
| **Student** | Register → OTP verify → profile → apply → track status → notifications |
| **Verifier** | Verify student documents, review applications, approve/reject with a mandatory note |
| **Admin / Superadmin** | Schemes, award amounts, slots, cycles, eligibility criteria, bulk "publish" approval emails, audit log |

---

## 5. Differentiators

| Claim | Backing in code |
|---|---|
| No duplicate beneficiaries | NIN hash + unique constraint |
| Rules, not discretion | Eligibility engine w/ ward, CGPA, age, level, trade, prior-award checks |
| Fraud detection | Cross-scheme double-dip flagging, same-cycle conflict detection |
| Transparent money | Paystack bank name-match before application |
| Real accountability | Append-only history + audit log + CSV beneficiary register |
| Secure by design | httpOnly JWT cookies, 2FA OTP, throttling, NDPA/PIA framing |

---

## 6. Strict 3-minute script

**0:00–0:25 — Hook**
"Every year, host-community funds are meant to reach Mbo's young people. Today
that happens on paper. Paper can't stop one person registering twice, and it
can't prove a naira reached the right student. We fixed that."

**0:25–0:55 — What it is**
"The RMHCDT Youth Portal is the Trust's digital pipeline: students apply
themselves, a rules engine checks eligibility automatically, and every decision
is auditable. Three award types — Scholarship, Empowerment, Grant."

**0:55–1:10 — The anchor**
"The anchor is identity. One NIN, one account — hashed server-side. No NIN, no
application. That single rule kills the duplicate-beneficiary problem."

**1:10–2:30 — Live demo (see Section 7).** Talk while you click:
- Register wizard → "here's the NIN and ward gate."
- Dashboard → "their cycle, their status, their money."
- Apply → "bank account verified against the name — money goes to the right person."
- Admin → "mandatory decision note, then bulk approval emails; and here's the
  audit log and beneficiary export."

**2:30–2:50 — Why it's defensible**
"This isn't a form. It's an eligibility engine, a double-dip detector, and an
immutable record — PIA and NDPA aligned."

**2:50–3:00 — Ask**
"Fund the 2026/2027 rollout: NIMC verification, automated disbursement, and SMS —
so every naira of Mbo's fund is traceable from application to bank account."

---

## 7. Live demo click path (~6 min)

1. **Landing** — Hero + programme cards + trust signals (NIN-Verified, PIA
   Governed, 100% Transparent). Scroll How It Works (5 steps) and Eligibility
   (one NIN one account, one per category per cycle, **cycle resets 1 April**).
2. **Register** — 4-step wizard: Personal → Identity (NIN, DOB ≥18, **10 Mbo
   wards**) → Documents (passport, certificate of origin, NIN slip) → Security.
   Show the draft auto-save persistence.
3. **Login** — password + **email OTP** (2FA). Call out role-based redirect.
4. **Dashboard** — pending-verification banner, active cycle (2026/2027),
   stats, quick-apply scheme cards.
5. **Apply** — dynamic scheme fields, **Paystack bank verification**,
   self-declaration of prior support, attestation.
6. **Admin** — switch to admin: KPI dashboard, review an application, the
   **mandatory decision note**, then **Send Approvals** (bulk email publish).
   Finish on **Beneficiaries CSV export** and the **Audit Log**.

---

## 8. Honest status (say this before they ask)

- **Live and deployable** — Next.js 16 + Django REST + Postgres + Celery/Redis +
  Cloudinary, Docker/Coolify. Working auth, applications, admin, email.
- **Deliberately scoped next steps:** real NIMC/NIN lookup, automated payouts
  (currently CSV export for manual disbursement), SMS notifications.

---

## 9. Prep for hard questions

| Question | Answer |
|---|---|
| "Is the NIN checked with NIMC?" | Not yet — we enforce format + uniqueness + pepper-hash today; NIMC integration is roadmap. |
| "How do you know it's not the same person twice?" | NIN uniqueness + bank name-match + double-dip detection. |
| "Can two people share a bank account?" | The name-match gate flags mismatches; ownership review is manual. |
| "What if there's no internet at the venue?" | Demo-failure risk — have screenshots or a recorded run ready. |
| "Training category?" | Backend award types are Scholarship / Empowerment (Vocational Training) / Grant. Training is delivered under the Empowerment award type — land it cleanly: "Training is our fourth programme area; it's administered under the Empowerment / Vocational Training award type." |

---

## 10. The close

> Fund the rollout for the full 2026/2027 cycle: NIMC verification, automated
> disbursement, and SMS notifications — so every naira of Mbo's host-community
> fund is traceable from application to bank account.
