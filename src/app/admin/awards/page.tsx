"use client";

import { useState, useEffect, useRef, Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Repeat, Search, AlertCircle, Download, Loader2, ClipboardCheck, Shield, Layers,
} from "lucide-react";

import { useRoleGuard } from "@/hooks/useRoleGuard";
import Pagination from "../components/pagination/Pagination";
import styles from "./page.module.css";
import { getAwards, getRenewalQueue, downloadAwardsCsv, getSchemes } from "@/services";
import type { Scheme } from "@/types/scheme";
import type {
  AwardListItem, AwardListParams, AwardsExportParams, AwardsSummary, AwardStatus,
} from "@/types/award";

// Backend page size (API_PAGE_SIZE defaults to 50). Only used to draw the pager.
const PAGE_SIZE = 50;

// ── Status chip ──────────────────────────────────────────────────────────────
const statusConfig: Record<AwardStatus, { label: string; cls: string }> = {
  active:     { label: "Active",     cls: "st_active"     },
  suspended:  { label: "Suspended",  cls: "st_suspended"  },
  graduated:  { label: "Graduated",  cls: "st_graduated"  },
  terminated: { label: "Terminated", cls: "st_terminated" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatNaira(amount: string | number): string {
  return `₦${Number(amount).toLocaleString()}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ── Skeleton row (shown while loading) ───────────────────────────────────────
function SkeletonRow() {
  return (
    <div className={styles.tableRow}>
      {[60, 55, 30, 45, 35, 40].map((w, i) => (
        <div key={i} className={styles.skeletonCell} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ── Filter dropdown (same look as the Students page filter) ──────────────────
function FilterDropdown({
  icon, value, onChange, options,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { key: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={`${styles.filterBtn} ${value ? styles.filterBtnActive : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        <span className={styles.filterBtnLabel}>{current.label}</span>
      </button>
      {open && (
        <div className={styles.filterDropdown}>
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`${styles.filterOption} ${value === o.key ? styles.filterOptionActive : ""}`}
              onClick={() => { onChange(o.key); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────
// The page is wrapped in <Suspense> because it now reads the address bar
// (?scheme=...) with useSearchParams. Next.js requires this for pages that
// can be pre-built, and a missing wrapper breaks `npm run build`.
export default function AdminAwardsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.centerState}>
          <div className={styles.spinner} />
        </div>
      }
    >
      <AdminAwardsContent />
    </Suspense>
  );
}

function AdminAwardsContent() {
  const router = useRouter();
  // Lets another page open this register already filtered, e.g. /admin/awards?scheme=<id>
  const searchParams = useSearchParams();
  const { checking } = useRoleGuard(["admin", "superadmin", "verifier"]);

  // Table data (all of it comes from the one GET /awards/ call)
  const [awards,      setAwards]      = useState<AwardListItem[]>([]);
  const [summary,     setSummary]     = useState<AwardsSummary | null>(null);
  const [count,       setCount]       = useState(0);
  const [hasNext,     setHasNext]     = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  // Bumping this number re-runs the load effect (used by "Try again").
  const [reloadKey,   setReloadKey]   = useState(0);

  // Filters. `searchInput` is what the admin types; `search` is the debounced
  // value that is actually sent to the server.
  const [page,         setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState<AwardStatus | "">("");
  const [schemeFilter, setSchemeFilter] = useState(searchParams.get("scheme") ?? ""); // starts from ?scheme= when present
  const [searchInput,  setSearchInput]  = useState("");
  const [search,       setSearch]       = useState("");

  // Extras: scheme dropdown options, renewal-queue badge, CSV export state
  const [schemes,         setSchemes]         = useState<Scheme[]>([]);
  const [renewalsPending, setRenewalsPending] = useState(0);
  const [exporting,       setExporting]       = useState(false);
  const [exportError,     setExportError]     = useState("");

  // ── Debounce the search box (wait 350ms after the last keystroke) ──────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── One-time extras. Both fail silently: the page works without them. ──────
  useEffect(() => {
    let cancelled = false;
    async function loadExtras() {
      try {
        const res = await getSchemes();
        // Only recurring schemes can have awards
        if (!cancelled) setSchemes((res.data?.results ?? []).filter((s) => s.is_recurring));
      } catch {
        /* dropdown stays empty */
      }
      try {
        const res = await getRenewalQueue(1, { status: "pending_verification" });
        if (!cancelled) setRenewalsPending(res.data?.count ?? 0);
      } catch {
        /* no badge */
      }
    }
    loadExtras();
    return () => { cancelled = true; };
  }, []);

  // ── Load the awards whenever page, filters or search change ────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params: AwardListParams = {};
        if (statusFilter) params.status = statusFilter;
        if (schemeFilter) params.scheme = schemeFilter;
        if (search)       params.search = search;

        const res = await getAwards(page, params);
        if (cancelled) return;
        setAwards(res.data.results ?? []);
        setSummary(res.data.summary ?? null);
        setCount(res.data.count ?? 0);
        setHasNext(!!res.data.next);
        setHasPrevious(!!res.data.previous);
      } catch {
        if (!cancelled) setError("Failed to load awards. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, statusFilter, schemeFilter, search, reloadKey]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  // The export endpoint understands status and scheme (not the name search).
  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      const params: AwardsExportParams = {};
      if (statusFilter) params.status = statusFilter;
      if (schemeFilter) params.scheme = schemeFilter;

      const res = await downloadAwardsCsv(params);

      // Turn the blob into a file download. The file name is made here because
      // the /api/proxy route does not pass the Content-Disposition header on.
      const url = window.URL.createObjectURL(res.data);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `awards-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setExportError("Failed to export. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // ── Role check in progress ─────────────────────────────────────────────────
  if (checking) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const filtersActive = !!(statusFilter || schemeFilter || search);

  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className={styles.headerIcon}>
            <Repeat size={20} color="var(--color-primary)" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>Awards</h1>
            <p className={styles.sub}>Multi-year scholarships: progress, renewals and payments.</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by student name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {/* Renewal queue, with the number waiting for verification */}
          <button className={styles.secondaryBtn} onClick={() => router.push("/admin/awards/renewals")}>
            <ClipboardCheck size={14} strokeWidth={2} />
            Renewals
            {renewalsPending > 0 && <span className={styles.countBadge}>{renewalsPending}</span>}
          </button>

          <button
            className={styles.primaryBtn}
            onClick={handleExport}
            disabled={exporting}
            title="Exports the current status and scheme filters"
          >
            {exporting
              ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Exporting...</>
              : <><Download size={14} strokeWidth={2} /> Export CSV</>}
          </button>
        </div>
      </div>

      {exportError && (
        <div className={styles.errorBanner}>
          <AlertCircle size={14} strokeWidth={2} /> {exportError}
        </div>
      )}

      {/* SUMMARY STRIP — numbers come straight from the backend `summary` */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Active",                value: summary?.active,                  color: "var(--color-primary)" },
          { label: "Suspended",             value: summary?.suspended,               color: "var(--color-error)"   },
          { label: "Graduating this year",  value: summary?.graduating_this_year,    color: "#3b82f6"              },
          { label: "Committed / year",
            value: summary ? formatNaira(summary.committed_annual) : undefined,
            color: "var(--color-text)" },
        ].map((s) => (
          <div key={s.label} className={styles.summaryItem}>
            <span className={styles.summaryValue} style={{ color: s.color }}>
              {loading || s.value === undefined ? "—" : s.value}
            </span>
            <span className={styles.summaryLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className={styles.filters}>
        <FilterDropdown
          icon={<Shield size={13} strokeWidth={2} />}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as AwardStatus | ""); setPage(1); }}
          options={[
            { key: "",           label: "All statuses" },
            { key: "active",     label: "Active" },
            { key: "suspended",  label: "Suspended" },
            { key: "graduated",  label: "Graduated" },
            { key: "terminated", label: "Terminated" },
          ]}
        />

        <FilterDropdown
          icon={<Layers size={13} strokeWidth={2} />}
          value={schemeFilter}
          onChange={(v) => { setSchemeFilter(v); setPage(1); }}
          options={[
            { key: "", label: "All recurring schemes" },
            ...schemes.map((s) => ({ key: String(s.id), label: s.name })),
          ]}
        />

        {filtersActive && (
          <button
            className={styles.clearBtn}
            onClick={() => {
              setStatusFilter("");
              setSchemeFilter("");
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <div className={styles.errorState}>
          <AlertCircle size={22} color="#f87171" strokeWidth={1.5} />
          <p style={{ color: "#ef4444" }}>{error}</p>
          <button className={styles.retryBtn} onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}

      {/* TABLE */}
      {!error && (
        <div className={styles.card}>

          <div className={`${styles.tableRow} ${styles.tableHeader}`}>
            <span>Student</span>
            <span>Scheme</span>
            <span>Years paid</span>
            <span>Annual amount</span>
            <span>Started</span>
            <span>Status</span>
          </div>

          {/* loading */}
          {loading && [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}

          {/* empty */}
          {!loading && awards.length === 0 && (
            <div className={styles.emptyState}>
              <Repeat size={28} color="#cbd5e1" strokeWidth={1.5} />
              <p className={styles.emptyTitle}>No awards found</p>
              <p className={styles.emptySub}>
                {filtersActive
                  ? "Try different filters."
                  : "An award is created when a recurring scholarship application is approved."}
              </p>
            </div>
          )}

          {/* rows (click anywhere on a row to open the award) */}
          {!loading && awards.map((a) => {
            const status = statusConfig[a.status];
            const needsTenureCheck = a.tenure_confidence !== "confirmed";

            return (
              <div
                key={a.id}
                className={`${styles.tableRow} ${styles.tableRowData}`}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/admin/awards/${a.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter") router.push(`/admin/awards/${a.id}`); }}
              >
                {/* Student: avatar, name (links to the student), ward */}
                <div className={styles.tdStudent}>
                  <div className={styles.avatar}>{initialsOf(a.student.full_name)}</div>
                  <div className={styles.studentText}>
                    <Link
                      href={`/admin/students/${a.student.id}`}
                      className={styles.studentName}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.student.full_name}
                    </Link>
                    <span className={styles.cellSub}>{a.student.ward || a.student.email}</span>
                  </div>
                </div>

                {/* Scheme + provider */}
                <div className={styles.cellStack}>
                  <span className={styles.cellMain}>{a.scheme?.name ?? "—"}</span>
                  <span className={styles.cellSub}>{a.scheme?.provider?.name ?? ""}</span>
                </div>

                {/* Years paid so far, out of the total. The amber icon means the
                    backend was not sure how many years this award runs for, so
                    a person should check it (hover to see why). */}
                <div className={styles.yearsCell}>
                  <span className={styles.cellMain}>{a.current_year_index}/{a.total_years}</span>
                  {needsTenureCheck && (
                    <span
                      className={styles.tenureWarn}
                      title={`Length ${a.tenure_confidence}: ${a.tenure_flags.join("; ") || "please verify"}`}
                    >
                      <AlertCircle size={13} strokeWidth={2} />
                    </span>
                  )}
                </div>

                <span className={styles.cellMain}>{formatNaira(a.annual_amount)}</span>

                <span className={styles.cellSub}>{a.start_cycle?.name ?? "—"}</span>

                <div>
                  <span className={`${styles.statusChip} ${styles[status.cls]}`}>{status.label}</span>
                </div>
              </div>
            );
          })}

          {/* PAGINATION (hides itself when everything fits on one page) */}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={count}
            hasNext={hasNext}
            hasPrevious={hasPrevious}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      )}

      {!loading && !error && awards.length > 0 && (
        <div className={styles.tableFooter}>
          {count} award{count !== 1 ? "s" : ""} {filtersActive ? "match" : "total"}
        </div>
      )}

    </div>
  );
}