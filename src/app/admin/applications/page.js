"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList, Search,
  ArrowRight, AlertCircle, CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import styles from "./page.module.css";
import { getApplications } from "@/services";

// ── STATUS MAPPING ────────────────────────────────────────────────────────────
const statusConfig = {
  submitted:         { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  eligibility_check: { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  document_review:   { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  shortlisted:       { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  draft:             { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  double_dip_flag:   { label: "Flagged",  color: "#ef4444", bg: "#fef2f2" },
  approved:          { label: "Approved", color: "#15803d", bg: "#f0fdf4" },
  rejected:          { label: "Rejected", color: "#64748b", bg: "#f8fafc" },
  withdrawn:         { label: "Rejected", color: "#64748b", bg: "#f8fafc" },
};

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#15803d", bg: "#f0fdf4" },
  empowerment: { label: "Empowerment", color: "#b45309", bg: "#fffbeb" },
  grant:       { label: "Grant",       color: "#7e22ce", bg: "#faf5ff" },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── SKELETON ROW ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className={styles.tableRow}>
      <div className={styles.skeletonCell} style={{ width: "20%" }} />
      <div className={styles.skeletonCell} style={{ width: "28%" }} />
      <div className={styles.skeletonCell} style={{ width: "12%" }} />
      <div className={styles.skeletonCell} style={{ width: "10%" }} />
      <div className={styles.skeletonCell} style={{ width: "8%"  }} />
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "all",     label: "All"     },
  { key: "pending", label: "Pending" },
  { key: "flagged", label: "Flagged" },
];

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function AdminApplicationsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get("tab") || "all";

  const [applications, setApplications] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [activeTab,    setActiveTab]    = useState(initialTab);
  const [search,       setSearch]       = useState("");

  // ── FETCH ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res  = await getApplications();
        if (cancelled) return;
        const data = Array.isArray(res.data?.results) ? res.data.results : [];
        setApplications(data);
      } catch {
        if (!cancelled) setError("Failed to load applications. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── DERIVED COUNTS ────────────────────────────────────────────────────────
  const counts = {
    total:    applications.length,
    pending:  applications.filter((a) =>
      ["submitted", "eligibility_check", "document_review",
       "shortlisted", "draft"].includes(a.status)
    ).length,
    flagged:  applications.filter((a) => a.status === "double_dip_flag").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) =>
      ["rejected", "withdrawn"].includes(a.status)
    ).length,
  };

  // ── FILTER BY TAB + SEARCH ────────────────────────────────────────────────
  const filtered = applications.filter((app) => {
    const tabMatch =
      activeTab === "all"     ? true :
      activeTab === "pending" ? ["submitted", "eligibility_check", "document_review",
                                 "shortlisted", "draft"].includes(app.status) :
      activeTab === "flagged" ? app.status === "double_dip_flag" : true;

    const studentName = (app.student?.full_name || "").toLowerCase();
    const schemeName  = (app.scheme?.name || "").toLowerCase();
    const searchMatch = search.trim() === "" ? true :
      studentName.includes(search.toLowerCase()) ||
      schemeName.includes(search.toLowerCase());

    return tabMatch && searchMatch;
  });

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ClipboardList size={20} color="#15803d" strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            <h1 className={styles.title}>Applications</h1>
            <p className={styles.sub}>Review and manage all programme applications.</p>
          </div>
        </div>
      </div>

      {/* SUMMARY STRIP */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Total",    value: counts.total,    key: "all"     },
          { label: "Pending",  value: counts.pending,  key: "pending", color: "#f59e0b" },
          { label: "Flagged",  value: counts.flagged,  key: "flagged", color: "#ef4444" },
          { label: "Approved", value: counts.approved, key: null,      color: "#15803d" },
          { label: "Rejected", value: counts.rejected, key: null,      color: "#64748b" },
        ].map((s) => (
          <button
            key={s.label}
            className={`${styles.summaryItem} ${activeTab === s.key ? styles.summaryItemActive : ""}`}
            onClick={() => s.key && setActiveTab(s.key)}
            style={{ cursor: s.key ? "pointer" : "default" }}
          >
            <span className={styles.summaryValue} style={{ color: s.color || "#0f172a" }}>
              {loading ? "—" : s.value}
            </span>
            <span className={styles.summaryLabel}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* TABS + TOOLBAR */}
        <div className={styles.cardTop}>
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.key === "flagged" && counts.flagged > 0 && (
                  <span className={styles.tabBadge}>{counts.flagged}</span>
                )}
              </button>
            ))}
          </div>

          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Search by student or scheme..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className={styles.tableWrap}>

          {/* Header */}
          <div className={`${styles.tableRow} ${styles.tableHeader}`}>
            <span>Student</span>
            <span>Scheme</span>
            <span>Submitted</span>
            <span>Status</span>
            <span></span>
          </div>

          {/* Loading */}
          {loading && [1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}

          {/* Error */}
          {!loading && error && (
            <div className={styles.emptyState}>
              <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
              <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
              <button
                className={styles.retryBtn}
                onClick={() => { setError(null); setLoading(true); }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty — flagged queue clear */}
          {!loading && !error && activeTab === "flagged" && filtered.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap} style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
                <CheckCircle2 size={24} color="#15803d" strokeWidth={1.8} />
              </div>
              <p className={styles.emptyTitle} style={{ color: "#15803d" }}>Flagged queue is clear</p>
              <p className={styles.emptySub}>No conflict or false declaration flags at this time.</p>
            </div>
          )}

          {/* Empty — pending queue clear */}
          {!loading && !error && activeTab === "pending" && filtered.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap} style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
                <CheckCircle2 size={24} color="#15803d" strokeWidth={1.8} />
              </div>
              <p className={styles.emptyTitle} style={{ color: "#15803d" }}>All caught up</p>
              <p className={styles.emptySub}>No pending applications waiting for review.</p>
            </div>
          )}

          {/* Empty — no results */}
          {!loading && !error && filtered.length === 0 &&
           activeTab !== "flagged" && activeTab !== "pending" && (
            <div className={styles.emptyState}>
              <ClipboardList size={28} color="#cbd5e1" strokeWidth={1.5} />
              <p className={styles.emptyTitle}>No applications found</p>
              <p className={styles.emptySub}>
                {search ? "Try a different search term." : "No applications this cycle yet."}
              </p>
            </div>
          )}

          {/* TABLE ROWS */}
          {!loading && !error && filtered.map((app) => {
            const status     = statusConfig[app.status] || statusConfig.submitted;
            const catKey     = (app.scheme?.award_type || "").toLowerCase();
            const category   = categoryConfig[catKey] || categoryConfig.scholarship;
            const isConflict = app.status === "double_dip_flag";
            const fullName   = app.student?.full_name || "Unknown";
            const initials   = fullName
              .split(" ")
              .map((n) => n[0] || "")
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div
                key={app.id}
                className={`${styles.tableRow} ${styles.tableRowData} ${isConflict ? styles.tableRowFlagged : ""}`}
              >
                {/* Student */}
                <div className={styles.tdStudent}>
                  <div className={styles.studentAvatar}>{initials}</div>
                  <div className={styles.studentInfo}>
                    <span className={styles.studentName}>{fullName}</span>
                    <span className={styles.studentMeta}>{app.student?.ward || "—"}</span>
                  </div>
                </div>

                {/* Scheme */}
                <div className={styles.tdScheme}>
                  <span className={styles.schemeName}>{app.scheme?.name || "—"}</span>
                  <span
                    className={styles.categoryChip}
                    style={{ color: category.color, background: category.bg }}
                  >
                    {category.label}
                  </span>
                </div>

                {/* Date */}
                <span className={styles.tdDate}>{formatDate(app.submission_date)}</span>

                {/* Status */}
                <div className={styles.tdStatus}>
                  <span
                    className={styles.statusBadge}
                    style={{ color: status.color, background: status.bg }}
                  >
                    {status.label}
                  </span>
                  {isConflict && (
                    <span className={styles.conflictChip}>
                      <ShieldAlert size={10} strokeWidth={2} />
                      Conflict
                    </span>
                  )}
                </div>

                {/* Action */}
                <button
                  className={styles.viewBtn}
                  onClick={() => router.push(`/admin/applications/${app.id}`)}
                >
                  Review <ArrowRight size={11} strokeWidth={2} />
                </button>
              </div>
            );
          })}

        </div>

        {/* Row count */}
        {!loading && !error && (
          <div className={styles.tableFooter}>
            Showing {filtered.length} of {applications.length} applications
          </div>
        )}

      </div>

    </div>
  );
}