# RMHCDT Youth Portal — Admin Panel Work Log

A summary of everything covered in this session, across the frontend (Next.js) and backend (Django/DRF).

---

## 1. Role-Based Access Control (RBAC)

A `useRoleGuard(allowedRoles, redirectTo)` hook already existed. It was wired into every admin page that handles schemes, cycles, and providers — pages not in this list (Applications, Students, etc.) were not touched.

**Pages protected with `useRoleGuard(["admin", "superadmin"])`** (verifier is redirected to `/admin`):
- `src/app/admin/schemes/page.js` (Schemes list) — also had its old manual `getMe()` + role-check `useEffect` removed and replaced with the hook
- `src/app/admin/schemes/new/page.js` (New Scheme)
- `src/app/admin/schemes/[id]/page.js` (Scheme Detail)
- `src/app/admin/cycles/page.js` (Cycles)
- `src/app/admin/providers/page.js` (Providers — new page, see §3)

**Pattern used on each page:**
```js
const { checking } = useRoleGuard(["admin", "superadmin"]);
...
if (checking) {
  return <div className={styles.centerState}><div className={styles.spinner} /></div>;
}
```

`.centerState` / `.spinner` CSS (spinner + centered layout) was added to each page's `page.module.css` where missing.

**Sidebar** (`AdminSidebar.jsx`): the `navMain` array already supported per-item `roles` filtering. A new entry for Providers needs adding (see §3) using the same `roles: ["admin", "superadmin"]` pattern as Cycles/Schemes, with the `Building2` icon.

---

## 2. Scheme Detail Page — Cycle Display

Added a **Cycle** info row to `src/app/admin/schemes/[id]/page.js`, in the read-only `infoGrid` section:

```jsx
<InfoRow icon={CalendarRange} label="Cycle" value={scheme.cycle?.name || "—"} />
```

Confirmed via a console log of the full scheme object that the real field is `scheme.cycle` (an object `{ id, name, start_year, end_year, is_active, created_at }`, or `null` if no cycle is assigned). Shows `"—"` correctly while no cycle has been created/activated yet.

---

## 3. Providers — New Feature (Frontend + Backend)

### Backend gap found
`SchemeProvider` model and `SchemeProviderSerializer` already existed, but:
- No `ProviderViewSet` and no route — `/schemes/providers/` did not exist at all.
- `ScholarshipSchemeSerializer.create()` **always** hardcoded the provider to `"Mbo LGA Council"` via `get_or_create()`, regardless of any input. There was no writable `provider_id` field — confirmed against the project's own OpenAPI schema, which only documented `cycle_id` as writable, not a provider equivalent.

### Backend changes made

**`schemes/views.py`** — added:
```python
class SchemeProviderViewSet(viewsets.ModelViewSet):
    queryset           = SchemeProvider.objects.all().order_by('name')
    serializer_class   = SchemeProviderSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAdmin()]
```

**`schemes/urls.py`** — added one router line:
```python
router.register(r'providers', views.SchemeProviderViewSet, basename='provider')
```

**`schemes/serializers.py`** (`ScholarshipSchemeSerializer`) — added a writable `provider_id` field (mirroring the existing `cycle_id` pattern):
```python
provider_id = serializers.PrimaryKeyRelatedField(
    queryset=SchemeProvider.objects.all(),
    source='provider',
    write_only=True,
    required=True,
)
```
— and **removed** the hardcoded `"Mbo LGA Council"` `get_or_create()` block from `create()` entirely (decided against keeping a fallback, since the database was being cleared and rebuilt from scratch). Provider is now a required choice on every scheme creation.

### Frontend — Providers page (new)
`src/app/admin/providers/page.js` + `page.module.css` — built to match the Cycles page's visual pattern exactly:
- Header with icon, title, refresh button, "New Provider" toggle
- Summary strip (Total Providers, Types In Use)
- Status banner: green "X providers available" when non-empty, amber "No providers yet" warning when empty (mirrors the Cycles active/inactive banner pattern, but providers have no `is_active` concept — banner state is purely list-empty vs not)
- Create form: name + provider type dropdown (`lga`, `state`, `corporate`, `ngo`, `federal` — these are a fixed backend `choices` enum, not user-creatable)
- Table: Provider name (with icon), Type (colored chip), Created date, Delete action
- Delete confirm modal — added because deleting a provider **cascades and deletes every scheme attached to it** (`on_delete=models.CASCADE`); the modal explicitly warns about this
- Wrapped in `useRoleGuard(["admin", "superadmin"])`

**Services added** (`schemes.js`):
```js
export const getProviders    = () => api.get("/schemes/providers/");
export const createProvider  = (body) => api.post("/schemes/providers/", body);
export const deleteProvider  = (id) => api.delete(`/schemes/providers/${id}/`);
```

### Frontend — New Scheme page
Added a **Provider** card (above the existing Cycle card) to `src/app/admin/schemes/new/page.js`:
- Fetches providers on mount via `getProviders()`
- Required `<select>` dropdown; shows "No providers yet — create one first" if the list is empty
- `provider_id` added to form state and to `validate()` (blocks submit with "Provider is required." if empty)
- Submitted automatically via the existing `...form` spread in `createScheme()` — no extra wiring needed there

### Cleanup along the way
- The old auto-created `"Mbo LGA Council"` provider row was manually deleted via Django shell once schemes/providers were cleared for a fresh test run:
  ```bash
  python manage.py shell -c "from schemes.models import SchemeProvider; SchemeProvider.objects.all().delete()"
  ```

---

## 4. Audit Logging — Expanded Coverage

**Before this session**, only three actions were logged: publish scheme, close scheme, activate cycle.

**Added** (`schemes/views.py`), using DRF's `perform_create` / `perform_update` / `perform_destroy` hooks:

| ViewSet | Hook added | Logs |
|---|---|---|
| `CycleViewSet` | `perform_create` | "Created cycle '{name}'" |
| `SchemeProviderViewSet` | `perform_create` | "Created provider '{name}'" |
| `SchemeProviderViewSet` | `perform_destroy` | "Deleted provider '{name}'" |
| `ScholarshipSchemeViewSet` | `perform_create` | "Created scheme '{name}'" |
| `ScholarshipSchemeViewSet` | `perform_update` | "Updated scheme '{name}'" |
| `ScholarshipSchemeViewSet` | `perform_destroy` | "Deleted scheme '{name}'" |

**Known gap (by design, not a bug):** there is no Edit/Delete UI for Cycles yet, so `CycleViewSet` has no `perform_update`/`perform_destroy` override — nothing exists yet to log.

**`SchemeProviderSerializer`** — recommended adding `created_at` to the `fields` list so the Providers table's "Created" column shows real dates instead of "—" (not yet confirmed applied).

### Audit log page size limit — resolved with real pagination
`AuditLogView` originally hardcoded `[:100]` (only the 100 most recent entries, ever, with no way to see older history). Two options were discussed (bump the hardcoded slice to `[:500]`, or switch to real pagination); **pagination was the one actually implemented.**

**`audit/views.py`** — rewritten from a plain `APIView` with a slice to a paginated `ListAPIView`:
```python
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination

class AuditLogPagination(PageNumberPagination):
    page_size = 100

class AuditLogView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin | IsSuperAdmin]
    serializer_class   = AuditLogSerializer
    pagination_class   = AuditLogPagination
    queryset            = AuditLog.objects.select_related('admin').all()
```
This changes the response shape from a flat array to `{ count, next, previous, results }` — same convention already used by `/schemes/` and `/students/`.

### Frontend — Audit Log page updated to match
`src/app/admin/audit-log/page.js` needed several fixes once the backend shape changed:

1. **Critical fix — the fetch was reading the wrong key.** `loadLogs()` originally did `Array.isArray(res.data) ? res.data : []`, which silently returned an empty array against the new paginated shape (the page looked like "no audit entries yet" even with real data in the database). Fixed to:
   ```js
   const data = Array.isArray(res.data?.results) ? res.data.results : [];
   ```
2. **`entityConfig` was missing `Cycle` and `SchemeProvider`** — entries with those `entity_type` values (from the new logging added in §4 above) were silently falling back to the generic gray `System` icon. Added:
   ```js
   Cycle:          { icon: CalendarRange, color: "#0891b2", bg: "#ecfeff" },
   SchemeProvider: { icon: Building2,     color: "#b45309", bg: "#fffbeb" },
   ```
   (with matching `CalendarRange`, `Building2` icon imports added)
3. **`ENTITY_FILTERS` updated** to include `"Cycle"` and `"SchemeProvider"` so they're selectable in the filter dropdown.
4. **Footer text fixed** — was hardcoded `"Last 100 actions"`, no longer accurate once pagination replaced the fixed slice. Changed to `Showing {filtered.length} of {logs.length} loaded`.

**Known gap, not yet built:** there is currently no "Load more" button or page-number control on the frontend, so only the first page (100 most recent entries) is ever fetched/shown — the backend pagination exists but isn't fully reachable from the UI yet. Flagged in §6 below.

### Investigated — an old "RMHDCT" cycle entry appearing in the log
A log entry "Activated cycle 'RMHDCT'" appeared even after that cycle had been deleted from the Cycles page. Confirmed this is correct behavior, not a bug: each `AuditLog.action` is a plain-text snapshot frozen at the moment the action happened (`f"Activated cycle '{cycle.name}'"`) — it does not re-fetch the cycle's current name or check whether the cycle still exists. This is intentional: audit logs are meant to be a permanent, immutable record, so they shouldn't change or disappear just because the underlying object was later edited or deleted. If a specific log line genuinely needs removing (e.g. clearing test data), it has to be done directly via Django shell — there's no "delete log entry" UI, by design:
```bash
python manage.py shell -c "from audit.models import AuditLog; AuditLog.objects.filter(action__icontains='RMHDCT').delete()"
```

---

## 5. Unrelated Bug Investigated — Dynamic Per-Scheme Tables

While testing student deletion in Django admin, hit:
```
django.db.utils.ProgrammingError: relation "app_29328b87d1ee4557802ec2c9f6460f43" does not exist
```

**Root cause identified:** `ScholarshipScheme.table_name` (e.g. `app_<uuid>`) is set in `save()`, but the actual `CREATE TABLE` for it happens separately via a `post_save` signal (per a comment in `models.py` referencing `applications/dynamic.py`). That signal either didn't fire or failed silently for at least one scheme, leaving a model reference pointing at a table that was never created — breaking any cascade-delete check (admin delete, bulk delete) that touches that scheme.

**Not fixed in this session** — flagged for the backend dev. Resolved practically by clearing test data via Django shell rather than the broken admin delete flow.

---

## 6. Outstanding / Recommended Next Steps

- [ ] Frontend: build a "Load more" button or page-number control on the Audit Log page — backend pagination exists but only page 1 is ever fetched right now
- [ ] Backend: add `created_at` to `SchemeProviderSerializer` fields (cosmetic, Providers page "Created" column)
- [ ] Backend: investigate why the per-scheme dynamic table creation signal silently failed for at least one scheme
- [ ] Frontend: bring the Schemes List page's card view to also display `scheme.provider?.name`, if not already shown there
- [ ] Decide whether Cycles should ever get edit/delete UI — if so, audit logging hooks slot in using the same pattern already used for Schemes/Providers
- [ ] Confirm the Providers nav entry was actually added to `AdminSidebar.jsx` (flagged as needed in §1, not yet confirmed done)
