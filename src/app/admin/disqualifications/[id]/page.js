"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ShieldAlert, Search, ArrowLeft, ArrowRight, AlertCircle,
  GraduationCap, Briefcase, Banknote, Download,
} from "lucide-react";
import styles from "./page.module.css";
import { getApplicationsByScheme, getScheme } from "@/services";

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#4ade80", bg: "rgba(74,222,128,0.1)",  icon: GraduationCap },
  empowerment: { label: "Empowerment", color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  icon: Briefcase     },
  grant:       { label: "Grant",       color: "#a78bfa", bg: "rgba(167,139,250,0.1)", icon: Banknote      },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

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
      <div className={styles.skeletonCell} style={{ width: "38%" }} />
      <div className={styles.skeletonCell} style={{ width: "14%" }} />
      <div className={styles.skeletonCell} style={{ width: "10%" }} />
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function SchemeDisqualificationsPage() {
  const router = useRouter();
  const params = useParams();
  const schemeId = params.id;

  const [scheme,        setScheme]        = useState(null);
  const [schemeLoading, setSchemeLoading]  = useState(true);

  const [records, setRecords] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState("");

  // ── FETCH SCHEME (header title/category) ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadScheme() {
      try {
        const res = await getScheme(schemeId);
        if (!cancelled) setScheme(res.data);
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setSchemeLoading(false);
      }
    }
    if (schemeId) loadScheme();
    return () => { cancelled = true; };
  }, [schemeId]);

  // ── FETCH REJECTED APPLICATIONS ──────────────────────────────────────────
  async function loadRecords() {
    setLoading(true);
    setError(null);
    try {
      const res = await getApplicationsByScheme(schemeId, "rejected");
      setRecords(Array.isArray(res.data?.applications) ? res.data.applications : []);
    } catch {
      setError("Failed to load disqualification register.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (schemeId) loadRecords();
  }, [schemeId]);

  // ── FILTER (search only) ─────────────────────────────────────────────────
  const filtered = records.filter((d) => {
    if (search.trim() === "") return true;
    const q = search.toLowerCase();
    return (
      (d.student?.full_name || "").toLowerCase().includes(q) ||
      (d.student?.ward || "").toLowerCase().includes(q) ||
      (d.rejection_reason || "").toLowerCase().includes(q)
    );
  });

  // ── EXPORT CSV (client-side — no server export endpoint for this list) ────
  function handleExport() {
    const headers = ["#", "Full Name", "Ward", "Rejection Reason", "Date"];
    const rows = filtered.map((d, index) => [
      String(index + 1).padStart(3, "0"),
      d.student?.full_name || "Unknown",
      d.student?.ward || "",
      d.rejection_reason || "No reason recorded",
      formatDate(d.submission_date),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `disqualification-register-${scheme?.name || schemeId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const catKey   = (scheme?.award_type || "scholarship").toLowerCase();
  const category = categoryConfig[catKey] || categoryConfig.scholarship;
  const Icon     = category.icon;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/admin/disqualifications")}>
        <ArrowLeft size={16} strokeWidth={2} />
        Back
      </button>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.schemeIconWrap} style={{ background: category.bg, border: `1.5px solid ${category.color}30` }}>
            <Icon size={20} color={category.color} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>
              {schemeLoading ? "Loading…" : (scheme?.name || "Disqualifications")}
            </h1>
            <p className={styles.sub}>
              {!schemeLoading && scheme && (
                <span
                  className={styles.categoryChip}
                  style={{ color: category.color, background: category.bg, marginRight: 8 }}
                >
                  {category.label}
                </span>
              )}
              Permanent record of rejected applications. Read-only.
            </p>
          </div>
        </div>
        {!loading && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={styles.countPill}>
              <ShieldAlert size={13} strokeWidth={2} />
              {records.length} disqualified record{records.length !== 1 ? "s" : ""}
            </div>
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              className={styles.exportBtn}
              style={{ opacity: filtered.length === 0 ? 0.5 : 1, cursor: filtered.length === 0 ? "not-allowed" : "pointer" }}
            >
              <Download size={13} strokeWidth={2} /> Export CSV
            </button>
          </div>
        )}
      </div>

      {/* INFO BANNER */}
      <div className={styles.infoBanner}>
        <ShieldAlert size={14} color="#b45309" strokeWidth={2} style={{ flexShrink: 0 }} />
        <span>This register is read-only. Records are created automatically when an application is rejected and are permanently tied to the applicant's NIN.</span>
      </div>

      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* TOOLBAR */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, ward or rejection reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* TABLE HEADER */}
        <div className={`${styles.tableRow} ${styles.tableHeader}`}>
          <span>Student</span>
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
            <button className={styles.retryBtn} onClick={loadRecords}>
              Try again
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <ShieldAlert size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p className={styles.emptyTitle}>
              {search ? "No matching records" : "No disqualifications recorded"}
            </p>
            <p className={styles.emptySub}>
              {search ? "Try adjusting your search." : "Records appear here when applications for this scheme are rejected."}
            </p>
          </div>
        )}

        {/* TABLE ROWS */}
        {!loading && !error && filtered.map((d) => (
          <div key={d.id} className={styles.tableRowData}>

            {/* Student */}
            <div className={styles.tdStudent}>
              <div className={styles.studentAvatar}>{getInitials(d.student?.full_name)}</div>
              <div className={styles.studentInfo}>
                <span className={styles.studentName}>{d.student?.full_name || "Unknown"}</span>
                <span className={styles.studentMeta}>{d.student?.ward || "—"}</span>
              </div>
            </div>

            {/* Rejection Reason */}
            <div className={styles.tdReason}>
              {d.rejection_reason ? (
                <span className={styles.reasonText}>
                  {d.rejection_reason.length > 100
                    ? `${d.rejection_reason.slice(0, 100)}...`
                    : d.rejection_reason
                  }
                </span>
              ) : (
                <span className={styles.noReason}>No reason recorded</span>
              )}
            </div>

            {/* Date */}
            <span className={styles.tdDate}>{formatDate(d.submission_date)}</span>

            {/* View */}
            <button
              className={styles.viewBtn}
              onClick={() => router.push(`/admin/applications/${d.id}`)}
            >
              View <ArrowRight size={11} strokeWidth={2} />
            </button>

          </div>
        ))}

      </div>

    </div>
  );
}