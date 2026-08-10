"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Search, AlertCircle, Users,
  GraduationCap, Briefcase, Banknote, ArrowRight,
} from "lucide-react";
import styles from "./page.module.css";
import { getSchemesOverview } from "@/services";

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#4ade80", bg: "rgba(74,222,128,0.1)",  icon: GraduationCap },
  empowerment: { label: "Empowerment", color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  icon: Briefcase     },
  grant:       { label: "Grant",       color: "#a78bfa", bg: "rgba(167,139,250,0.1)", icon: Banknote      },
};

// ── SKELETON CARD ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className={styles.schemeCard}>
      <div className={styles.skeletonBlock} style={{ width: "60%", height: 18, borderRadius: 6 }} />
      <div className={styles.skeletonBlock} style={{ width: "40%", height: 14, borderRadius: 4, marginTop: 8 }} />
      <div className={styles.skeletonBlock} style={{ width: "100%", height: 40, borderRadius: 6, marginTop: 12 }} />
      <div className={styles.skeletonBlock} style={{ width: "40%", height: 34, borderRadius: 8, marginTop: 12 }} />
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function AdminApplicationsOverviewPage() {
  const router = useRouter();

  const [overview, setOverview] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState("");

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const res = await getSchemesOverview();
      setOverview(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Failed to load schemes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOverview(); }, []);

  // ── FILTER ────────────────────────────────────────────────────────────────
  const filtered = overview.filter((row) =>
    search.trim() === "" ? true :
    (row.scheme?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (row.scheme?.award_type || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalSchemes  = overview.length;
  const totalPending   = overview.reduce((sum, r) => sum + (r.pending_review || 0), 0);
  const totalUnpublished = overview.reduce((sum, r) => sum + (r.unpublished || 0), 0);

  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-primary-light)", border: "1.5px solid var(--color-primary-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ClipboardList size={20} color="var(--color-primary)" strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            <h1 className={styles.title}>Applications</h1>
            <p className={styles.sub}>Select a scheme to review its applications.</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search schemes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* SUMMARY STRIP */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Schemes",           value: totalSchemes,     color: "var(--color-text)" },
          { label: "Pending Review",    value: totalPending,     color: "#f59e0b" },
          { label: "Awaiting Notify",   value: totalUnpublished, color: "#3b82f6" },
        ].map((s) => (
          <div key={s.label} className={styles.summaryItem}>
            <span className={styles.summaryValue} style={{ color: s.color }}>
              {loading ? "—" : s.value}
            </span>
            <span className={styles.summaryLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ERROR */}
      {error && (
        <div className={styles.errorState}>
          <AlertCircle size={22} color="#f87171" strokeWidth={1.5} />
          <p style={{ color: "#ef4444" }}>{error}</p>
          <button className={styles.retryBtn} onClick={loadOverview}>Try again</button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className={styles.grid}>
          {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* EMPTY */}
      {!loading && !error && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <ClipboardList size={28} color="#cbd5e1" strokeWidth={1.5} />
          <p className={styles.emptyTitle}>No schemes with applications</p>
          <p className={styles.emptySub}>
            {search ? "Try a different search." : "No one has applied to any scheme yet."}
          </p>
        </div>
      )}

      {/* SCHEME CARDS GRID */}
      {!loading && !error && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((row) => {
            const catKey    = (row.scheme?.award_type || "scholarship").toLowerCase();
            const category  = categoryConfig[catKey] || categoryConfig.scholarship;
            const Icon      = category.icon;
            const hasPending = row.pending_review > 0;

            return (
              <div key={row.scheme.id} className={styles.schemeCard}>
                {/* Card top */}
                <div className={styles.schemeCardTop}>
                  <div className={styles.schemeIconWrap} style={{ background: category.bg }}>
                    <Icon size={18} color={category.color} strokeWidth={1.8} />
                  </div>
                  {hasPending && (
                    <span className={styles.pendingPill}>
                      {row.pending_review} pending
                    </span>
                  )}
                </div>

                {/* Scheme name */}
                <h3 className={styles.schemeName}>{row.scheme.name}</h3>

                {/* Category chip */}
                <span
                  className={styles.categoryChip}
                  style={{ color: category.color, background: category.bg }}
                >
                  {category.label}
                </span>

                {/* Meta info */}
                <div className={styles.schemeMeta}>
                  <div className={styles.metaItem}>
                    <Users size={12} strokeWidth={2} />
                    <span>{row.scheme.remaining_slots ?? "—"} / {row.scheme.total_slots ?? "—"} slots left</span>
                  </div>
                  {row.unpublished > 0 && (
                    <div className={styles.metaItem}>
                      <ClipboardList size={12} strokeWidth={2} />
                      <span>{row.unpublished} awaiting notification</span>
                    </div>
                  )}
                </div>

                {/* View button */}
                <div className={styles.schemeActions}>
                  <button
                    className={styles.viewBtn}
                    onClick={() => router.push(`/admin/applications/scheme/${row.scheme.id}`)}
                  >
                    View Applications <ArrowRight size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}