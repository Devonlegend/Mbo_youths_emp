"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Plus, Search, AlertCircle, Users,
  GraduationCap, Briefcase, Wrench, Banknote,
  Calendar, ArrowRight,
} from "lucide-react";
import styles from "./page.module.css";
import { getSchemes, getMe } from "@/services";

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#15803d", bg: "#f0fdf4", icon: GraduationCap },
  empowerment: { label: "Empowerment", color: "#b45309", bg: "#fffbeb", icon: Briefcase     },
  grant:       { label: "Grant",       color: "#7e22ce", bg: "#faf5ff", icon: Banknote      },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

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
export default function AdminSchemesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  const [schemes,  setSchemes]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState("");

  // ── FETCH ─────────────────────────────────────────────────────────────────
  async function loadSchemes() {
    try {
      setLoading(true);
      const res = await getSchemes();
      setSchemes(Array.isArray(res.data?.results) ? res.data.results : []);
    } catch {
      setError("Failed to load schemes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  async function checkRole() {
    try {
      const { getMe } = await import("@/services/auth");
      const res = await getMe();
      if (res.data.role === "verifier") {
        router.replace("/admin");
      } else {
        setUser(res.data);
      }
    } catch {
      router.replace("/login");
    }
  }
  checkRole();
  loadSchemes();
}, []);

  // ── FILTER ────────────────────────────────────────────────────────────────
  const filtered = schemes.filter((s) =>
    search.trim() === "" ? true :
    (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.award_type || "").toLowerCase().includes(search.toLowerCase())
  );

  const openCount   = schemes.filter((s) => s.is_active && s.is_published).length;
  const draftCount  = schemes.filter((s) => !s.is_published).length;
  const closedCount = schemes.filter((s) => !s.is_active).length;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BookOpen size={20} color="#15803d" strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            <h1 className={styles.title}>Schemes</h1>
            <p className={styles.sub}>Manage all programme offerings for the current cycle.</p>
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
          {/* New Scheme → goes to /admin/schemes/new */}
          <button className={styles.createBtn} onClick={() => router.push("/admin/schemes/new")}>
            <Plus size={15} strokeWidth={2.5} />
            New Scheme
          </button>
        </div>
      </div>

      {/* SUMMARY STRIP */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Total Schemes", value: schemes.length, color: "#0f172a" },
          { label: "Open",          value: openCount,       color: "#15803d" },
          { label: "Draft",         value: draftCount,      color: "#f59e0b" },
          { label: "Closed",        value: closedCount,     color: "#64748b" },
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
          <BookOpen size={28} color="#cbd5e1" strokeWidth={1.5} />
          <p className={styles.emptyTitle}>No schemes found</p>
          <p className={styles.emptySub}>
            {search ? "Try a different search." : "Create your first scheme to get started."}
          </p>
          {!search && (
            <button className={styles.createBtn} onClick={() => router.push("/admin/schemes/new")}>
              <Plus size={14} strokeWidth={2.5} /> New Scheme
            </button>
          )}
        </div>
      )}

      {/* SCHEME CARDS GRID */}
      {!loading && !error && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((scheme) => {
            const catKey   = (scheme.award_type || "scholarship").toLowerCase();
            const category = categoryConfig[catKey] || categoryConfig.scholarship;
            const Icon     = category.icon;
            const isOpen   = scheme.is_active && scheme.is_published;
            const isDraft  = !scheme.is_published;
            const isClosed = !scheme.is_active;

            return (
              <div
                key={scheme.id}
                className={`${styles.schemeCard} ${isClosed ? styles.schemeCardClosed : ""}`}
              >
                {/* Card top */}
                <div className={styles.schemeCardTop}>
                  <div className={styles.schemeIconWrap} style={{ background: category.bg }}>
                    <Icon size={18} color={category.color} strokeWidth={1.8} />
                  </div>
                  <span className={`${styles.schemePill} ${
                    isOpen   ? styles.pillOpen   :
                    isDraft  ? styles.pillDraft  :
                    styles.pillClosed
                  }`}>
                    {isOpen ? "Open" : isDraft ? "Draft" : "Closed"}
                  </span>
                </div>

                {/* Scheme name */}
                <h3 className={styles.schemeName}>{scheme.name}</h3>

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
                    <span>{scheme.remaining_slots ?? scheme.total_slots ?? "—"} slots remaining</span>
                  </div>
                  <div className={styles.metaItem}>
                    <Calendar size={12} strokeWidth={2} />
                    <span>Closes {formatDate(scheme.application_close_date)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <BookOpen size={12} strokeWidth={2} />
                    <span>{scheme.academic_year || "—"}</span>
                  </div>
                </div>

                {/* View button → goes to /admin/schemes/[id] */}
                <div className={styles.schemeActions}>
                  <button
                    className={styles.viewBtn}
                    onClick={() => router.push(`/admin/schemes/${scheme.id}`)}
                  >
                    View Details <ArrowRight size={13} strokeWidth={2} />
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