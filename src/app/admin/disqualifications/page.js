"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert, Search, AlertCircle, XCircle,
  GraduationCap, Briefcase, Banknote, ArrowRight,
} from "lucide-react";
import styles from "./page.module.css";
import { getSchemes, getApplicationsByScheme } from "@/services";

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
export default function DisqualificationOverviewPage() {
  const router = useRouter();

  const [schemes, setSchemes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState("");

  async function loadSchemes() {
    setLoading(true);
    setError(null);
    try {
      const res = await getSchemes();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);

      // Pull each scheme's rejected-application count in parallel.
      const withCounts = await Promise.all(
        list.map(async (s) => {
          try {
            const rejRes = await getApplicationsByScheme(s.id, "rejected");
            const apps = Array.isArray(rejRes.data?.applications) ? rejRes.data.applications : [];
            return { ...s, disqualified_count: apps.length };
          } catch {
            return { ...s, disqualified_count: 0 };
          }
        })
      );

      setSchemes(withCounts);
    } catch {
      setError("Failed to load schemes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSchemes(); }, []);

  // ── FILTER ────────────────────────────────────────────────────────────────
  const filtered = schemes.filter((s) =>
    search.trim() === "" ? true :
    (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.award_type || "").toLowerCase().includes(search.toLowerCase())
  );

  // ── STATS ─────────────────────────────────────────────────────────────────
  const schemesWithDisqualifications = schemes.filter((s) => (s.disqualified_count || 0) > 0).length;
  const totalDisqualified = schemes.reduce((sum, s) => sum + (s.disqualified_count || 0), 0);

  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-primary-light)", border: "1.5px solid var(--color-primary-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldAlert size={20} color="var(--color-primary)" strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            <h1 className={styles.title}>Disqualification Register</h1>
            <p className={styles.sub}>Select a scheme to view its disqualified applicants.</p>
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
          { label: "Schemes",       value: schemesWithDisqualifications, color: "var(--color-text)" },
          { label: "Disqualified",  value: totalDisqualified,            color: "#b45309" },
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
          <button className={styles.retryBtn} onClick={loadSchemes}>Try again</button>
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
          <ShieldAlert size={28} color="#cbd5e1" strokeWidth={1.5} />
          <p className={styles.emptyTitle}>No schemes found</p>
          <p className={styles.emptySub}>
            {search ? "Try a different search." : "Create a scheme to start tracking applications."}
          </p>
        </div>
      )}

      {/* SCHEME CARDS GRID */}
      {!loading && !error && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((s) => {
            const catKey   = (s.award_type || "scholarship").toLowerCase();
            const category = categoryConfig[catKey] || categoryConfig.scholarship;
            const Icon     = category.icon;

            return (
              <div key={s.id} className={styles.schemeCard}>
                <div className={styles.schemeCardTop}>
                  <div className={styles.schemeIconWrap} style={{ background: category.bg }}>
                    <Icon size={18} color={category.color} strokeWidth={1.8} />
                  </div>
                  {s.disqualified_count > 0 && (
                    <span className={styles.disqualifiedPill}>
                      {s.disqualified_count} disqualified
                    </span>
                  )}
                </div>

                <h3 className={styles.schemeName}>{s.name}</h3>

                <span
                  className={styles.categoryChip}
                  style={{ color: category.color, background: category.bg }}
                >
                  {category.label}
                </span>

                <div className={styles.schemeActions}>
                  <button
                    className={styles.viewBtn}
                    onClick={() => router.push(`/admin/disqualifications/${s.id}`)}
                  >
                    View Register <ArrowRight size={13} strokeWidth={2} />
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