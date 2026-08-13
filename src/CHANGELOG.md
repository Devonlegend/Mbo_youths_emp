# Changelog

## Unreleased

## v1.0.0 (2026-08-13)

### Beneficiary Register (Admin)

Integrated the new backend `GET /applications/approved-list/` endpoint.

- **`src/services/applications.js`** — added `getApprovedList(schemeId)` and `downloadApprovedListCsv(schemeId)`
- Split beneficiary register into two pages, matching the Applications overview pattern:
  - `src/app/admin/beneficiaries/page.js` — scheme-card grid with a stats strip (Schemes, Beneficiaries, Slots Filled)
  - `src/app/admin/beneficiaries/[id]/page.js` — per-scheme table (Phone/Email columns, search, server-side CSV export, back button)
- Removed the old cross-scheme paginated beneficiary list and its client-built CSV export

### Disqualification Register (Admin)

Restructured to match the new Beneficiaries pattern for consistency 

- `src/app/admin/disqualifications/page.js` — scheme-card grid with a stats strip (Schemes, Disqualified)
- `src/app/admin/disqualifications/[id]/page.js` — per-scheme table (rejection reasons, client-side CSV export — no server export endpoint exists for rejected applications)