"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, Search, ArrowRight, AlertCircle,
  GraduationCap, Briefcase, Wrench, Banknote, Filter, Download,
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
  // NOTE: student and scheme are nested objects from the API
  // (student.full_name / student.ward, scheme.name / scheme.award_type) —
  // not flat fields. student.email and student.lga are not returned by the
  // backend's StudentNestedSerializer yet, so those show as "—" until added.
  const filtered = beneficiaries.filter((b) => {
    const fullName   = (b.student?.full_name || "").toLowerCase();
    const schemeName = (b.scheme?.name || "").toLowerCase();

    const matchSearch = search.trim() === "" ? true :
      fullName.includes(search.toLowerCase()) ||
      schemeName.includes(search.toLowerCase()) ||
      (b.student?.ward || "").toLowerCase().includes(search.toLowerCase());

    const catKey   = (b.scheme?.award_type || "scholarship").toLowerCase();
    const catLabel = categoryConfig[catKey]?.label || "Scholarship";
    const matchFilter = activeFilter === "All" ? true : catLabel === activeFilter;

    return matchSearch && matchFilter;
  });

  // ── EXPORT — must come after filtered is declared ─────────────────────────
  function handleExport() {
    const headers = ["#", "Full Name", "Scheme", "Category", "Ward", "Bank Name", "Account Number", "Account Name", "Approved Date"];
    const rows = filtered.map((b, index) => [
      String(index + 1).padStart(3, "0"),
      b.student?.full_name || "Unknown",
      b.scheme?.name || "",
      categoryConfig[(b.scheme?.award_type || "scholarship").toLowerCase()]?.label || "",
      b.student?.ward || "",
      b.details?.bank_name || "",
      b.details?.account_number || "",
      b.details?.account_name || "",
      formatDate(b.submission_date),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `beneficiary-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={styles.countPill}>
              <BadgeCheck size={13} strokeWidth={2} />
              {beneficiaries.length} confirmed beneficiar{beneficiaries.length !== 1 ? "ies" : "y"}
            </div>
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 9,
                border: "1px solid #bbf7d0", background: "#f0fdf4",
                color: "#15803d", fontSize: 13, fontWeight: 600,
                cursor: filtered.length === 0 ? "not-allowed" : "pointer",
                opacity: filtered.length === 0 ? 0.5 : 1,
              }}
            >
              <Download size={13} strokeWidth={2} /> Export CSV
            </button>
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
              placeholder="Search by name, scheme or ward..."
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
          <span>Ward</span>
          <span>Account Details</span>
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
          const catKey   = (b.scheme?.award_type || "scholarship").toLowerCase();
          const category = categoryConfig[catKey] || categoryConfig.scholarship;
          const Icon     = category.icon;

          return (
            <div key={b.id} className={styles.tableRowData}>

              {/* Beneficiary */}
              <div className={styles.tdStudent}>
                <div className={styles.studentAvatar}>{getInitials(b.student?.full_name)}</div>
                <div className={styles.studentInfo}>
                  <span className={styles.studentName}>
                    {b.student?.full_name || "Unknown"}
                  </span>
                  <span className={styles.studentMeta}>
                    #{String(index + 1).padStart(3, "0")}
                  </span>
                </div>
              </div>

              {/* Scheme */}
              <div className={styles.tdScheme}>
                <div className={styles.schemeIconWrap} style={{ background: category.bg }}>
                  <Icon size={12} color={category.color} strokeWidth={2} />
                </div>
                <div className={styles.schemeInfo}>
                  <span className={styles.schemeName}>{b.scheme?.name || "—"}</span>
                  <span
                    className={styles.categoryChip}
                    style={{ color: category.color, background: category.bg }}
                  >
                    {category.label}
                  </span>
                </div>
              </div>

              {/* Ward — LGA not in this endpoint's response, removed for now */}
              <div className={styles.tdLocation}>
                <span className={styles.wardText}>{b.student?.ward || "—"}</span>
              </div>

                {/* Account Details */}
                <div className={styles.tdBank}>
                  {b.details?.account_number ? (
                    <>
                      <span className={styles.lgaText}>{b.details.bank_name || "—"}</span>
                      <span className={styles.wardText}>{b.details.account_number}</span>
                    </>
                  ) : (
                    <span className={styles.wardText}>No bank on file</span>
                  )}
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