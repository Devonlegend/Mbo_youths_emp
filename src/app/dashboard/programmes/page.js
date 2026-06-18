"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  GraduationCap, Briefcase, Banknote,
  Clock, CheckCircle2, ArrowRight, Search, Filter,
  AlertCircle, LayoutGrid, ShieldAlert,
} from "lucide-react";
import styles from "./page.module.css";
import LoadingSpinner from "../components/LoadingSpinner";
import { getSchemes, getStudentProfile } from "@/services";

const categoryConfig = {
  scholarship: {
    label:    "Scholarship",
    color:    "green",
    icon:     GraduationCap,
    applyPath: "/dashboard/programmes/apply",
  },
  empowerment: {
    label:    "Empowerment",
    color:    "amber",
    icon:     Briefcase,
    applyPath: "/dashboard/programmes/apply",
  },
  grant: {
    label:    "Grant",
    color:    "purple",
    icon:     Banknote,
    applyPath: "/dashboard/programmes/apply",
  },
};

const colorMap = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  amber:  { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce" },
};

const categories = ["All", "Scholarship", "Empowerment", "Grant"];

function mapScheme(scheme) {
  const config = categoryConfig[scheme.award_type] || categoryConfig.scholarship;
  const closeDate = new Date(scheme.application_close_date);
  const today     = new Date();
  const daysLeft  = Math.ceil((closeDate - today) / (1000 * 60 * 60 * 24));

  let status = "open";
  if (!scheme.is_published || !scheme.is_active) status = "closed";
  if (daysLeft < 0) status = "closed";

  const deadline = closeDate.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return {
    id:        scheme.id,
    title:     scheme.name,
    category:  config.label,
    color:     config.color,
    icon:      config.icon,
    desc:      scheme.description,
    deadline,
    daysLeft:  Math.max(daysLeft, 0),
    slots:     scheme.remaining_slots,
    status,
    applyPath: config.applyPath,
    schemeId:  scheme.id,
  };
}

function StatusBadge({ status, daysLeft }) {
  if (status === "awarded") return (
    <span className={`${styles.badge} ${styles.badgeAwarded}`}>
      <CheckCircle2 size={11} strokeWidth={2.5} /> Awarded
    </span>
  );
  if (status === "applied") return (
    <span className={`${styles.badge} ${styles.badgeApplied}`}>
      <Clock size={11} strokeWidth={2.5} /> Applied
    </span>
  );
  if (status === "closed") return (
    <span className={`${styles.badge} ${styles.badgeClosed}`}>Closed</span>
  );
  if (daysLeft <= 7) return (
    <span className={`${styles.badge} ${styles.badgeUrgent}`}>
      <Clock size={11} strokeWidth={2.5} /> {daysLeft} days left
    </span>
  );
  return (
    <span className={`${styles.badge} ${styles.badgeOpen}`}>Open</span>
  );
}

export default function ProgrammesPage() {
  const router = useRouter();

  const [programmes,   setProgrammes]  = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [filterOpen,   setFilterOpen]  = useState(false);
  const [search,       setSearch]      = useState("");
  const [isVerified,   setIsVerified]  = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [schemesRes, profileRes] = await Promise.all([
          getSchemes(),
          getStudentProfile(),
        ]);
        const mapped = (schemesRes.data?.results || []).map(mapScheme);
        setProgrammes(mapped);
        setIsVerified(profileRes.data.is_verified);
      } catch {
        setError("Failed to load programmes. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = programmes.filter((p) => {
    const matchCat    = activeFilter === "All" || p.category === activeFilter;
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
                        p.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function handleApply(prog) {
    if (prog.status === "awarded" || prog.status === "applied" || prog.status === "closed") return;
    router.push(`${prog.applyPath}?scheme_id=${prog.schemeId}`);
  }

  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <LayoutGrid size={20} color="#15803d" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>Programmes</h1>
            <p className={styles.sub}>Browse and apply for open programmes this cycle.</p>
          </div>
        </div>
        <div className={styles.cyclePill}>
          <span className={styles.cycleDot} />
          Cycle 2026 – 2027
        </div>
      </div>

      {/* SEARCH + FILTER */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search programmes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ position: "relative" }}>
          <button
            className={`${styles.filterBtn} ${activeFilter !== "All" ? styles.filterActive : ""}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <Filter size={14} strokeWidth={2} />
            {activeFilter === "All" ? "Filter" : activeFilter}
          </button>
          {filterOpen && (
            <div className={styles.filterDropdown}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.filterOption} ${activeFilter === cat ? styles.filterOptionActive : ""}`}
                  onClick={() => { setActiveFilter(cat); setFilterOpen(false); }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LOADING */}
      {loading && <LoadingSpinner fullPage />}

      {/* ERROR */}
      {!loading && error && (
        <div className={styles.empty} style={{ gap: 12 }}>
          <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
          <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); }}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid #e2e8f0",
              background: "#fff", fontSize: 13, cursor: "pointer", color: "#374151",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* UNVERIFIED */}
      {!loading && !error && isVerified === false && (
        <div className={styles.empty}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#fef9c3", display: "flex",
            alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}>
            <ShieldAlert size={28} color="#ca8a04" strokeWidth={1.5} />
          </div>
          <p style={{ color: "#92400e", fontWeight: 600, fontSize: 15 }}>
            Account pending verification
          </p>
          <p style={{ color: "#a16207", fontSize: 13, textAlign: "center", maxWidth: 320 }}>
            An admin needs to verify your account before you can apply for any programme.
            Please check back soon.
          </p>
        </div>
      )}

      {/* VERIFIED — show programmes */}
      {!loading && !error && isVerified === true && (
        <>
          {programmes.length === 0 && (
            <div className={styles.empty}>
              <p style={{ color: "#94a3b8", fontWeight: 600 }}>No programmes available</p>
              <p style={{ color: "#cbd5e1", fontSize: 13 }}>
                Check back when the next cycle opens.
              </p>
            </div>
          )}

          {programmes.length > 0 && filtered.length === 0 && (
            <div className={styles.empty}>
              <p>No programmes match your search.</p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className={styles.grid}>
              {filtered.map((prog) => {
                const Icon     = prog.icon;
                const c        = colorMap[prog.color];
                const disabled = prog.status === "awarded" ||
                                 prog.status === "applied" ||
                                 prog.status === "closed";

                return (
                  <div
                    key={prog.id}
                    className={styles.card}
                    style={{ borderColor: c.border }}
                  >
                    <div className={styles.cardTop} style={{ background: c.bg }}>
                      <div className={styles.cardIconWrap} style={{ background: c.text }}>
                        <Icon size={20} color="#fff" strokeWidth={2} />
                      </div>
                      <StatusBadge status={prog.status} daysLeft={prog.daysLeft} />
                    </div>
                    <div className={styles.cardBody}>
                      <div
                        className={styles.catTag}
                        style={{ background: c.bg, color: c.text, borderColor: c.border }}
                      >
                        {prog.category}
                      </div>
                      <h2 className={styles.cardTitle}>{prog.title}</h2>
                      <p className={styles.cardDesc}>{prog.desc}</p>
                      <div className={styles.cardMeta}>
                        <span className={styles.metaItem}>
                          <Clock size={12} strokeWidth={2} />
                          Closes {prog.deadline}
                        </span>
                        <span className={styles.metaItem}>
                          {prog.slots} slots available
                        </span>
                      </div>
                      <button
                        className={`${styles.applyBtn} ${disabled ? styles.applyBtnDisabled : ""}`}
                        style={!disabled ? { color: c.text, borderColor: c.border, background: c.bg } : {}}
                        onClick={() => handleApply(prog)}
                        disabled={disabled}
                      >
                        {prog.status === "awarded" && "Already Awarded"}
                        {prog.status === "applied" && "Application Pending"}
                        {prog.status === "closed"  && "Closed"}
                        {prog.status === "open"    && (
                          <>{`Apply for ${prog.category}`} <ArrowRight size={14} strokeWidth={2} /></>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

    </div>
  );
}