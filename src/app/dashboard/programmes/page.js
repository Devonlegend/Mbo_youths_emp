"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  GraduationCap, Briefcase, Wrench, Banknote,
  Clock, CheckCircle2, ArrowRight, Search, Filter,
} from "lucide-react";
import styles from "./page.module.css";

const programmes = [
  {
    id: 1,
    title: "2026/2027 University Scholarship Award",
    category: "Scholarship",
    color: "green",
    icon: GraduationCap,
    desc: "Financial support for secondary, tertiary, vocational, and professional studies. Covers tuition, exam fees, and educational materials.",
    deadline: "Jun 15, 2026",
    daysLeft: 19,
    slots: 50,
    status: "open",
    applyPath: "/dashboard/programmes/apply/scholarship",
  },
  {
    id: 2,
    title: "Youth Empowerment Starter Pack 2026",
    category: "Empowerment",
    color: "amber",
    icon: Briefcase,
    desc: "Direct support to individuals or small groups to establish or expand income-generating activities. Includes starter packs and equipment.",
    deadline: "Jun 1, 2026",
    daysLeft: 58,
    slots: 30,
    status: "open",
    applyPath: "/dashboard/programmes/apply/empowerment",
  },
  {
    id: 3,
    title: "Digital Skills Training 2026",
    category: "Training",
    color: "blue",
    icon: Wrench,
    desc: "Structured skill development programme covering digital skills, vocational training, and capacity building for youth in the community.",
    deadline: "Jul 5, 2026",
    daysLeft: 39,
    slots: 100,
    status: "open",
    applyPath: "/dashboard/programmes/apply/training",
  },
  {
    id: 4,
    title: "2026 SME Business Startup Grant",
    category: "Grant",
    color: "purple",
    icon: Banknote,
    desc: "Financial awards for business start-up capital, project funding, research support, and other targeted financial assistance.",
    deadline: "May 31, 2026",
    daysLeft: 58,
    slots: 20,
    status: "open",
    applyPath: "/dashboard/programmes/apply/grant",
  },
];

const categories = ["All", "Scholarship", "Empowerment", "Training", "Grant"];

const colorMap = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", iconBg: "#f0fdf4" },
  amber:  { bg: "#fffbeb", border: "#fde68a", text: "#b45309", iconBg: "#fffbeb" },
  blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", iconBg: "#eff6ff" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce", iconBg: "#faf5ff" },
};

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
  const [activeFilter, setActiveFilter] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = programmes.filter((p) => {
    const matchCat = activeFilter === "All" || p.category === activeFilter;
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
                        p.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function handleApply(prog) {
    if (prog.status === "awarded" || prog.status === "applied" || prog.status === "closed") return;
    router.push(prog.applyPath);
  }

  return (
    <div className={styles.page}>

      {/* ── HEADER ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Programmes</h1>
          <p className={styles.sub}>Browse and apply for open programmes this cycle.</p>
        </div>
        <div className={styles.cyclePill}>
          <span className={styles.cycleDot} />
          Cycle 2026 – 2027
        </div>
      </div>

      {/* ── SEARCH + FILTER ── */}
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

      {/* ── PROGRAMME CARDS ── */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>No programmes found.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((prog) => {
            const Icon = prog.icon;
            const c = colorMap[prog.color];
            const disabled = prog.status === "awarded" || prog.status === "applied" || prog.status === "closed";

            return (
              <div
                key={prog.id}
                className={styles.card}
                style={{ borderColor: c.border }}
              >
                {/* CARD TOP */}
                <div className={styles.cardTop} style={{ background: c.bg }}>
                  <div className={styles.cardIconWrap} style={{ background: c.text }}>
                    <Icon size={20} color="#fff" strokeWidth={2} />
                  </div>
                  <StatusBadge status={prog.status} daysLeft={prog.daysLeft} />
                </div>

                {/* CARD BODY */}
                <div className={styles.cardBody}>
                  <div
                    className={styles.catTag}
                    style={{ background: c.bg, color: c.text, borderColor: c.border }}
                  >
                    {prog.category}
                  </div>
                  <h2 className={styles.cardTitle}>{prog.title}</h2>
                  <p className={styles.cardDesc}>{prog.desc}</p>

                  {/* META */}
                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>
                      <Clock size={12} strokeWidth={2} />
                      Closes {prog.deadline}
                    </span>
                    <span className={styles.metaItem}>
                      {prog.slots} slots available
                    </span>
                  </div>

                  {/* BUTTON */}
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

    </div>
  );
}