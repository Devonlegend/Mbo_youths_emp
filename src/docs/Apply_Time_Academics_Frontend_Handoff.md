# Apply-Time Academics — Frontend Handoff

Backend done. Academics (`faculty`, `programme_type`, `programme_duration_years`, `entry_level`)
are now collected **at scholarship apply time**, not on the profile. Profile is read-only display.
Scope: **scholarship only** (empowerment/grant untouched). Sync: **last-submit-wins onto `Student`**.

## 1. API contract

### `GET /schemes/<id>/fields/` (scholarship) — 4 new defs in `Academic Information`
| field_name | field_label | field_type | is_required | options |
|---|---|---|---|---|
| `faculty` | Faculty | text | true | [] (placeholder `e.g. Engineering, Medicine`) |
| `programme_type` | Programme Type | select | true | `["undergraduate","hnd","postgraduate_taught","postgraduate_research"]` |
| `programme_duration_years` | Programme Duration (years) | select | true | `["1","2","3","4","5","6"]` (filter per type, see §2) |
| `entry_level` | Entry Level | select | **false** | `["100","200"]` (undergrad only, see §2) |

`entry_level.is_required=false` is deliberate: the generic required-check must not block
HND/PG. The submit serializer enforces the conditional rule.

### `POST /applications/submit/` — `programme_answers` additions
```json
{
  "scheme_id": "<uuid>",
  "programme_answers": {
    "institution_name": "University of Uyo",
    "course_of_study": "Computer Science",
    "current_level": "200",
    "cgpa": "3.50",
    "admission_year": 2024,
    "matric_number": "U2024/0001",
    "faculty": "Engineering",
    "programme_type": "undergraduate",
    "programme_duration_years": 5,
    "entry_level": 200
  },
  "bank_account_number": "1010101010",
  "bank_code": "033",
  "...": "bank/self-declaration/attestation unchanged"
}
```
Validation (400 `{"error":"Invalid application details","fields":{...}}`):
- `faculty`: required, non-blank (trimmed server-side).
- `programme_type`: one of the 4 values.
- `programme_duration_years`: must be in the per-type set —
  undergrad `[4,5,6]`, hnd `[2]`, taught `[1,2]`, research `[2,3,4]`.
- `entry_level`: required `100|200` when `programme_type==="undergraduate"`;
  must be omitted/null otherwise (server coerces to null).

On success the backend snapshots these 4 onto the application row **and**
`Student.faculty/programme_type/programme_duration_years/entry_level`
(atomically with the application). Tenure/eligibility read the fresh values.

### `GET /students/me/` — unchanged, use for prefill + read-only profile
Returns `faculty`, `programme_type` (`""` when unset), `programme_duration_years`
(`null`), `entry_level` (`null`). Do **not** `PATCH /students/me/` for academics
(no handler — 405). Prefill the apply form from these when present.

## 2. Frontend tasks

1. **`src/app/dashboard/programmes/apply/page.tsx`** (only when `scheme.award_type==="scholarship"`):
   - Fetch `getStudentProfile()` alongside scheme/fields/banks; prefill the 4 fields.
   - Render under `Academic Information` (or a new `Academic Tenure` section).
     The generic `DynamicField` renderer cannot do dependencies, so special-case:
     - `programme_type` select → on change, reset `programme_duration_years=""` and `entry_level=""`.
     - `programme_duration_years` select → options filtered by type using existing
       `src/constants/programme.ts:15-20` `DURATION_OPTIONS`.
     - `entry_level` select (`100 level (regular admission)` / `200 level (direct entry)`)
       → render **only** when `programme_type==="undergraduate"`; treat as required in that case.
     - Humanize `programme_type` labels via `programmeTypeLabel()`; submit raw values.
   - Extend `validate()`: faculty non-blank; programme_type set; duration in per-type set;
     entry_level `100|200` required iff undergrad. Extend `handleSubmit()` so all four go
     into `programme_answers` (`programme_duration_years`/`entry_level` as numbers).
   - Update `src/types/application.ts:53-60` `ScholarshipAnswers` with the 4 fields.
2. **`src/app/dashboard/profile/page.tsx:100-106,288-339,475-622`**:
   - Delete academic edit state/handlers (`handleAcademicEdit/Cancel/Type/Save`) and the
     `updateAcademicProfile` call. Render the card read-only (`ReadField`s) from
     `getStudentProfile()`. Change subtitle to e.g. `Last submitted via scholarship application`.
3. **`src/services/students.ts:23-24`**: remove/retire `updateAcademicProfile` (or leave unused).
4. **Detail views**: render the 4 new keys from `details` in
   `src/app/dashboard/applications/[id]/page.tsx` and
   `src/app/admin/applications/[id]/page.tsx` Academic Information blocks.
   `src/app/admin/students/[id]/page.tsx` may show the `Student` last-known values (read-only).
5. Staff-create (`staff_create`) accepts the same `programme_answers` — no frontend work unless
   you build an admin create form.

## 3. Ops / QA notes
- Per-scheme tables are `managed=False`: run
  `manage.py rebuild_application_tables --yes` (destructive — drops rows) on dev/staging,
  `--missing-only` for new schemes only. Then `rebuild_application_projection` if used.
  Migration `applications/0006_application_academics.py` covers the unified table.
- Old submits without the 4 fields now 400. There are no drafts — no migration of in-flight forms.
- Re-applies overwrite `Student` academics; per-application rows keep history.
- QA: undergrad 5yr/200-entry submit → profile shows values; HND submit with `entry_level`
  omitted → 201 and `entry_level:null`; bad duration (undergrad+2) → 400 with
  `fields.programme_duration_years`; non-undergrad detail pages show no entry level.
