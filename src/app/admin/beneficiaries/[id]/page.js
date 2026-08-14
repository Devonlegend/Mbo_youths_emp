"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  BadgeCheck, Search, ArrowLeft, ArrowRight, AlertCircle,
  GraduationCap, Briefcase, Banknote, Download, Loader2,
} from "lucide-react";
import styles from "./page.module.css";
import { getApprovedList, downloadApprovedListCsv } from "@/services";
import { getScheme } from "@/services";

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

function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const match = header.match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
}

// ── SKELETON ROW ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className={styles.tableRow}>
      <div className={styles.skeletonCell} style={{ width: "22%" }} />
      <div className={styles.skeletonCell} style={{ width: "16%" }} />
      <div className={styles.skeletonCell} style={{ width: "20%" }} />
      <div className={styles.skeletonCell} style={{ width: "14%" }} />
      <div className={styles.skeletonCell} style={{ width: "14%" }} />
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function SchemeBeneficiariesPage() {
  const router = useRouter();
  const params = useParams();
  const schemeId = params.id;

  const [scheme,        setScheme]        = useState(null);
  const [schemeLoading, setSchemeLoading]  = useState(true);

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [count,         setCount]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [search,        setSearch]        = useState("");
  const [exporting,     setExporting]     = useState(false);

  // ── FETCH SCHEME (header title/category) ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadScheme() {
      try {
        const res = await getScheme(schemeId);
        if (!cancelled) setScheme(res.data);
      } catch {
        // non-fatal — header falls back to a generic title
      } finally {
        if (!cancelled) setSchemeLoading(false);
      }
    }
    if (schemeId) loadScheme();
    return () => { cancelled = true; };
  }, [schemeId]);

  // ── FETCH APPROVED LIST ──────────────────────────────────────────────────
  async function loadBeneficiaries() {
    setLoading(true);
    setError(null);
    try {
      const res = await getApprovedList(schemeId);
      setBeneficiaries(Array.isArray(res.data?.applications) ? res.data.applications : []);
      setCount(res.data?.count ?? 0);
    } catch {
      setError("Failed to load beneficiary register.");
      setBeneficiaries([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (schemeId) loadBeneficiaries();
  }, [schemeId]);

  // ── FILTER (search only) ─────────────────────────────────────────────────
  const filtered = beneficiaries.filter((b) => {
    if (search.trim() === "") return true;
    const q = search.toLowerCase();
    return (
      (b.full_name || "").toLowerCase().includes(q) ||
      (b.ward || "").toLowerCase().includes(q) ||
      (b.email || "").toLowerCase().includes(q) ||
      (b.phone_number || "").toLowerCase().includes(q)
    );
  });

  // ── EXPORT CSV ────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      const res = await downloadApprovedListCsv(schemeId);
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = filenameFromDisposition(
        res.headers?.["content-disposition"],
        `approved-list-${scheme?.name || schemeId}-${new Date().toISOString().slice(0, 10)}.csv`
      );
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  }

  const catKey   = (scheme?.award_type || "scholarship").toLowerCase();
  const category = categoryConfig[catKey] || categoryConfig.scholarship;
  const Icon     = category.icon;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/admin/beneficiaries")}>
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
              {schemeLoading ? "Loading…" : (scheme?.name || "Beneficiaries")}
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
              Permanent record of approved beneficiaries. Read-only.
            </p>
          </div>
        </div>
        {!loading && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={styles.countPill}>
              <BadgeCheck size={13} strokeWidth={2} />
              {count} confirmed beneficiar{count !== 1 ? "ies" : "y"}
            </div>
            <button
              onClick={handleExport}
              disabled={filtered.length === 0 || exporting}
              className={styles.exportBtn}
              style={{ opacity: filtered.length === 0 ? 0.5 : 1, cursor: filtered.length === 0 ? "not-allowed" : "pointer" }}
            >
              {exporting
                ? <><Loader2 size={13} strokeWidth={2} className={styles.spin} /> Exporting...</>
                : <><Download size={13} strokeWidth={2} /> Export CSV</>
              }
            </button>
          </div>
        )}
      </div>

      {/* INFO BANNER */}
      <div className={styles.infoBanner}>
        <BadgeCheck size={14} color="#15803d" strokeWidth={2} style={{ flexShrink: 0 }} />
        <span>This register is read-only. Records are created automatically when an application is approved and are retained permanently.</span>
      </div>

      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* TOOLBAR */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, ward, phone or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* TABLE HEADER */}
        <div className={`${styles.tableRow} ${styles.tableHeader}`}>
          <span>Beneficiary</span>
          <span>Phone</span>
          <span>Email</span>
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
            <button className={styles.retryBtn} onClick={loadBeneficiaries}>
              Try again
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <BadgeCheck size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p className={styles.emptyTitle}>
              {search ? "No matching beneficiaries" : "No approved beneficiaries yet"}
            </p>
            <p className={styles.emptySub}>
              {search
                ? "Try adjusting your search."
                : "Beneficiaries appear here once applications for this scheme are approved."
              }
            </p>
          </div>
        )}

        {/* TABLE ROWS */}
        {!loading && !error && filtered.map((b, index) => (
          <div key={b.application_id} className={styles.tableRowData}>

            {/* Beneficiary */}
            <div className={styles.tdStudent}>
              <div className={styles.studentAvatar}>{getInitials(b.full_name)}</div>
              <div className={styles.studentInfo}>
                <span className={styles.studentName}>{b.full_name || "Unknown"}</span>
                <span className={styles.studentMeta}>#{String(index + 1).padStart(3, "0")}</span>
              </div>
            </div>

            {/* Phone */}
            <span className={`${styles.wardText} ${styles.tdPhone}`}>{b.phone_number || "—"}</span>

            {/* Email */}
            <span className={`${styles.wardText} ${styles.tdEmail}`} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {b.email || "—"}
            </span>

            {/* Ward */}
            <div className={styles.tdLocation}>
              <span className={styles.wardText}>{b.ward || "—"}</span>
            </div>

            {/* Account Details */}
            <div className={styles.tdBank}>
              {b.account_number ? (
                <>
                  <span className={styles.lgaText}>{b.bank_name || "—"}</span>
                  <span className={styles.wardText}>{b.account_number}</span>
                </>
              ) : (
                <span className={styles.wardText}>No bank on file</span>
              )}
            </div>

            {/* Approved date */}
            <span className={styles.tdDate}>{formatDate(b.approved_at)}</span>

            {/* View */}
            <button
              className={styles.viewBtn}
              onClick={() => router.push(`/admin/applications/${b.application_id}`)}
            >
              View <ArrowRight size={11} strokeWidth={2} />
            </button>

          </div>
        ))}

      </div>

    </div>
  );
}