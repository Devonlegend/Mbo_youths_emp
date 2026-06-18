"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, Search, ArrowRight, AlertCircle,
  GraduationCap, Briefcase, Wrench, Banknote, Filter,
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

// ── SKELETON ROW ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className={styles.tableRow}>
      <div className={styles.skeletonCell} style={{ width: "22%" }} />
      <div className={styles.skeletonCell} style={{ width: "28%" }} />
      <div className={styles.skeletonCell} style={{ width: "14%" }} />
      <div className={styles.skeletonCell} style={{ width: "14%" }} />
      <div className={styles.skeletonCell} style={{ width: "10%" }} />
    </div>
  );
}

const FILTERS = ["All", "Scholarship", "Empowerment", "Grant"];

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function BeneficiaryRegisterPage() {
  const router = useRouter();

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [search,        setSearch]        = useState("");
  const [activeFilter,  setActiveFilter]  = useState("All");
  const [filterOpen,    setFilterOpen]    = useState(false);

  // ── FETCH — filter approved from all applications ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res  = await getApplications();
        if (cancelled) return;
        const all  = Array.isArray(res.data?.results) ? res.data.results : [];
        // Only approved applications become beneficiaries
        const approved = all.filter((a) => a.status === "approved");
        setBeneficiaries(approved);
      } catch {
        if (!cancelled) setError("Failed to load beneficiary register.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── FILTER + SEARCH ───────────────────────────────────────────────────────
  const filtered = beneficiaries.filter((b) => {
    const fullName   = b.student
      ? `${b.student.firstname} ${b.student.lastname}`.toLowerCase()
      : "";
    const schemeName = (b.scheme_name || "").toLowerCase();

    const matchSearch = search.trim() === "" ? true :
      fullName.includes(search.toLowerCase()) ||
      schemeName.includes(search.toLowerCase()) ||
      (b.student?.lga || "").toLowerCase().includes(search.toLowerCase());

    const catKey   = (b.scheme_category || "scholarship").toLowerCase();
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
            <BadgeCheck size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>Beneficiary Register</h1>
            <p className={styles.sub}>
              Permanent record of all approved beneficiaries this cycle. Read-only.
            </p>
          </div>
        </div>
        {!loading && !error && (
          <div className={styles.countPill}>
            <BadgeCheck size={13} strokeWidth={2} />
            {beneficiaries.length} confirmed beneficiar{beneficiaries.length !== 1 ? "ies" : "y"}
          </div>
        )}
      </div>

      {/* INFO BANNER */}
      <div className={styles.infoBanner}>
        <BadgeCheck size={14} color="#15803d" strokeWidth={2} style={{ flexShrink: 0 }} />
        <span> This register is read-only. Records are created automatically when an application is approved and are retained permanently.</span>
      </div>

      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* TOOLBAR */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, scheme or LGA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter */}
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
          <span>Beneficiary</span>
          <span>Scheme</span>
          <span>LGA / Ward</span>
          <span>Approved</span>
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
            <BadgeCheck size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p className={styles.emptyTitle}>
              {search || activeFilter !== "All"
                ? "No matching beneficiaries"
                : "No approved beneficiaries yet"
              }
            </p>
            <p className={styles.emptySub}>
              {search || activeFilter !== "All"
                ? "Try adjusting your search or filter."
                : "Beneficiaries appear here once applications are approved."
              }
            </p>
          </div>
        )}

        {/* TABLE ROWS */}
        {!loading && !error && filtered.map((b, index) => {
          const catKey   = (b.scheme_category || "scholarship").toLowerCase();
          const category = categoryConfig[catKey] || categoryConfig.scholarship;
          const Icon     = category.icon;
          const initials =
            (b.student?.firstname?.[0] || "").toUpperCase() +
            (b.student?.lastname?.[0]  || "").toUpperCase();

          return (
            <div key={b.id} className={styles.tableRowData}>

              {/* Beneficiary */}
              <div className={styles.tdStudent}>
                <div className={styles.studentAvatar}>{initials || "—"}</div>
                <div className={styles.studentInfo}>
                  <span className={styles.studentName}>
                    {b.student
                      ? `${b.student.firstname} ${b.student.lastname}`
                      : "Unknown"
                    }
                  </span>
                  <span className={styles.studentMeta}>
                    #{String(index + 1).padStart(3, "0")} · {b.student?.email || "—"}
                  </span>
                </div>
              </div>

              {/* Scheme */}
              <div className={styles.tdScheme}>
                <div className={styles.schemeIconWrap} style={{ background: category.bg }}>
                  <Icon size={12} color={category.color} strokeWidth={2} />
                </div>
                <div className={styles.schemeInfo}>
                  <span className={styles.schemeName}>{b.scheme_name || "—"}</span>
                  <span
                    className={styles.categoryChip}
                    style={{ color: category.color, background: category.bg }}
                  >
                    {category.label}
                  </span>
                </div>
              </div>

              {/* LGA / Ward */}
              <div className={styles.tdLocation}>
                <span className={styles.lgaText}>{b.student?.lga || "—"}</span>
                <span className={styles.wardText}>{b.student?.ward || "—"}</span>
              </div>

              {/* Approved date */}
              <span className={styles.tdDate}>
                {formatDate(b.submission_date)}
              </span>

              {/* View application */}
              <button
                className={styles.viewBtn}
                onClick={() => router.push(`/admin/applications/${b.id}`)}
              >
                View <ArrowRight size={11} strokeWidth={2} />
              </button>

            </div>
          );
        })}

        {/* FOOTER */}
        {!loading && !error && (
          <div className={styles.tableFooter}>
            Showing {filtered.length} of {beneficiaries.length} beneficiaries
          </div>
        )}

      </div>

    </div>
  );
}