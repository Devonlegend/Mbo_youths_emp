"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert, Search, ArrowRight, AlertCircle,
  GraduationCap, Briefcase, Wrench, Banknote, Filter,
  XCircle,
} from "lucide-react";
import styles from "./page.module.css";
import { getApplications } from "@/services";

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#15803d", bg: "#f0fdf4", icon: GraduationCap },
  // vocational:  { label: "Training",    color: "#1d4ed8", bg: "#eff6ff", icon: Wrench        },
  empowerment: { label: "Empowerment", color: "#b45309", bg: "#fffbeb", icon: Briefcase     },
  grant:       { label: "Grant",       color: "#7e22ce", bg: "#faf5ff", icon: Banknote      },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// Backend only returns full_name (no firstname/lastname split) — derive initials from it.
function getInitials(fullName) {
  if (!fullName) return "—";
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last  = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// ── SKELETON ROW ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className={styles.tableRow}>
      <div className={styles.skeletonCell} style={{ width: "20%" }} />
      <div className={styles.skeletonCell} style={{ width: "26%" }} />
      <div className={styles.skeletonCell} style={{ width: "28%" }} />
      <div className={styles.skeletonCell} style={{ width: "12%" }} />
      <div className={styles.skeletonCell} style={{ width: "8%"  }} />
    </div>
  );
}

const FILTERS = ["All", "Scholarship", "Empowerment", "Grant"];

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function DisqualificationRegisterPage() {
  const router = useRouter();

  const [disqualifications, setDisqualifications] = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(null);
  const [search,            setSearch]            = useState("");
  const [activeFilter,      setActiveFilter]      = useState("All");
  const [filterOpen,        setFilterOpen]        = useState(false);

  // ── FETCH — filter rejected from all applications ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await getApplications();
        if (cancelled) return;
        const all = Array.isArray(res.data?.results) ? res.data.results : [];
        // Rejected and withdrawn both count as disqualified
        const rejected = all.filter((a) =>
          ["rejected", "withdrawn"].includes(a.status)
        );
        setDisqualifications(rejected);
      } catch {
        if (!cancelled) setError("Failed to load disqualification register.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── FILTER + SEARCH ───────────────────────────────────────────────────────
  // NOTE: student/scheme are nested objects (student.full_name, scheme.name,
  // scheme.award_type) — not flat fields. d.rejection_reason will be empty
  // for every row until the backend adds it to serialize_application_list
  // (it currently only exists in the single-application detail serializer).
  const filtered = disqualifications.filter((d) => {
    const fullName   = (d.student?.full_name || "").toLowerCase();
    const schemeName = (d.scheme?.name || "").toLowerCase();
    const reason      = (d.rejection_reason || "").toLowerCase();

    const matchSearch = search.trim() === "" ? true :
      fullName.includes(search.toLowerCase()) ||
      schemeName.includes(search.toLowerCase()) ||
      reason.includes(search.toLowerCase());

    const catKey   = (d.scheme?.award_type || "scholarship").toLowerCase();
    const catLabel = categoryConfig[catKey]?.label || "Scholarship";
    const matchFilter = activeFilter === "All" ? true : catLabel === activeFilter;

    return matchSearch && matchFilter;
  });

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <ShieldAlert size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>Disqualification Register</h1>
            <p className={styles.sub}>
              Permanent record of all rejected applications this cycle. Read-only.
            </p>
          </div>
        </div>
        {!loading && !error && (
          <div className={styles.countPill}>
            <XCircle size={13} strokeWidth={2} />
            {disqualifications.length} disqualified record{disqualifications.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* INFO BANNER */}
      <div className={styles.infoBanner}>
        <ShieldAlert size={14} color="#b45309" strokeWidth={2} style={{ flexShrink: 0 }} />
        <span>This register is read-only. Disqualification records are created automatically when an application is rejected and are permanently tied to the applicant's NIN.</span>
      </div>

      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* TOOLBAR */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, scheme or rejection reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ position: "relative" }}>
            <button
              className={`${styles.filterBtn} ${activeFilter !== "All" ? styles.filterBtnActive : ""}`}
              onClick={() => setFilterOpen((o) => !o)}
            >
              <Filter size={13} strokeWidth={2} />
              {activeFilter === "All" ? "All Categories" : activeFilter}
            </button>
            {filterOpen && (
              <div className={styles.filterDropdown}>
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    className={`${styles.filterOption} ${activeFilter === f ? styles.filterOptionActive : ""}`}
                    onClick={() => { setActiveFilter(f); setFilterOpen(false); }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TABLE HEADER */}
        <div className={`${styles.tableRow} ${styles.tableHeader}`}>
          <span>Student</span>
          <span>Scheme</span>
          <span>Rejection Reason</span>
          <span>Date</span>
          <span></span>
        </div>

        {/* LOADING */}
        {loading && [1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}

        {/* ERROR */}
        {!loading && error && (
          <div className={styles.emptyState}>
            <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
            <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {/* EMPTY */}
        {!loading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <ShieldAlert size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p className={styles.emptyTitle}>
              {search || activeFilter !== "All"
                ? "No matching records"
                : "No disqualifications recorded"
              }
            </p>
            <p className={styles.emptySub}>
              {search || activeFilter !== "All"
                ? "Try adjusting your search or filter."
                : "Records appear here when applications are rejected."
              }
            </p>
          </div>
        )}

        {/* TABLE ROWS */}
        {!loading && !error && filtered.map((d, index) => {
          const catKey   = (d.scheme?.award_type || "scholarship").toLowerCase();
          const category = categoryConfig[catKey] || categoryConfig.scholarship;
          const Icon     = category.icon;

          return (
            <div key={d.id} className={styles.tableRowData}>

              {/* Student */}
              <div className={styles.tdStudent}>
                <div className={styles.studentAvatar}>{getInitials(d.student?.full_name)}</div>
                <div className={styles.studentInfo}>
                  <span className={styles.studentName}>
                    {d.student?.full_name || "Unknown"}
                  </span>
                  <span className={styles.studentMeta}>
                    {d.student?.ward || "—"}
                  </span>
                </div>
              </div>

              {/* Scheme */}
              <div className={styles.tdScheme}>
                <div className={styles.schemeIconWrap} style={{ background: category.bg }}>
                  <Icon size={12} color={category.color} strokeWidth={2} />
                </div>
                <div className={styles.schemeInfo}>
                  <span className={styles.schemeName}>{d.scheme?.name || "—"}</span>
                  <span
                    className={styles.categoryChip}
                    style={{ color: category.color, background: category.bg }}
                  >
                    {category.label}
                  </span>
                </div>
              </div>

              {/* Rejection reason — will read "No reason recorded" for every
                  row until the backend adds rejection_reason to the list
                  serializer (see note above the filtered() function) */}
              <div className={styles.tdReason}>
                {d.rejection_reason ? (
                  <span className={styles.reasonText}>
                    {d.rejection_reason.length > 80
                      ? `${d.rejection_reason.slice(0, 80)}...`
                      : d.rejection_reason
                    }
                  </span>
                ) : (
                  <span className={styles.noReason}>No reason recorded</span>
                )}
              </div>

              {/* Date */}
              <span className={styles.tdDate}>
                {formatDate(d.submission_date)}
              </span>

              {/* View */}
              <button
                className={styles.viewBtn}
                onClick={() => router.push(`/admin/applications/${d.id}`)}
              >
                View <ArrowRight size={11} strokeWidth={2} />
              </button>

            </div>
          );
        })}

        {/* FOOTER */}
        {!loading && !error && (
          <div className={styles.tableFooter}>
            Showing {filtered.length} of {disqualifications.length} records
          </div>
        )}

      </div>

    </div>
  );
}