"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  GraduationCap, Briefcase, Wrench, Banknote,
  CheckCircle2, Clock, XCircle, AlertCircle,
  ArrowRight, Search, Filter, ChevronDown,
} from "lucide-react";
import styles from "./page.module.css";

const applications = [
  {
    id: 1,
    title: "2026/2027 University Scholarship Award",
    category: "Scholarship",
    categoryColor: "green",
    icon: GraduationCap,
    date: "14 May 2026",
    status: "flagged",
    step: 2,
    flagNote: "Under admin review. No action needed from you at this time.",
  },
  {
    id: 2,
    title: "2026 SME Business Startup Grant",
    category: "Grant",
    categoryColor: "purple",
    icon: Banknote,
    date: "2 Apr 2026",
    status: "approved",
    step: 4,
    certificateUrl: "#",
  },
  {
    id: 3,
    title: "Digital Skills Training 2026",
    category: "Training",
    categoryColor: "blue",
    icon: Wrench,
    date: "20 May 2026",
    status: "pending",
    step: 1,
  },
  {
    id: 4,
    title: "Youth Empowerment Starter Pack 2026",
    category: "Empowerment",
    categoryColor: "amber",
    icon: Briefcase,
    date: "10 Mar 2026",
    status: "rejected",
    step: 4,
    rejectionReason:
      "Applicant did not meet the residency requirement for Mbo LGA as of the 2026 cycle cut-off date. You may re-apply in the next cycle if eligibility conditions are met.",
  },
];

const FILTERS = ["All", "Pending", "Flagged", "Approved", "Rejected"];

const colorMap = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  amber:  { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce" },
};

function StatusBadge({ status }) {
  const map = {
    approved: { cls: styles.st_approved, icon: <CheckCircle2 size={11} strokeWidth={2.5} />, label: "Approved" },
    pending:  { cls: styles.st_pending,  icon: <Clock size={11} strokeWidth={2.5} />,        label: "Pending"  },
    flagged:  { cls: styles.st_flagged,  icon: <AlertCircle size={11} strokeWidth={2.5} />,  label: "Flagged"  },
    rejected: { cls: styles.st_rejected, icon: <XCircle size={11} strokeWidth={2.5} />,      label: "Rejected" },
  };
  const s = map[status];
  return (
    <span className={`${styles.statusTag} ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = applications.filter((a) => {
    const matchFilter =
      activeFilter === "All" ||
      a.status.toLowerCase() === activeFilter.toLowerCase();
    const matchSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Applications</h1>
          <p className={styles.sub}>Track the status of all your submitted applications.</p>
        </div>
        <div className={styles.countPill}>{applications.length} total</div>
      </div>

      {/* TOOLBAR */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search applications..."
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
            <ChevronDown size={13} strokeWidth={2.5} />
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

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>No applications found.</p>
        </div>
      ) : (
        <div className={styles.appList}>
          {filtered.map((app) => {
            const c = colorMap[app.categoryColor];
            const Icon = app.icon;
            return (
              <div
                key={app.id}
                className={`${styles.appCard} ${styles[`card_${app.status}`]}`}
              >
                {/* CARD HEAD */}
                <div className={styles.appHead}>
                  <div
                    className={styles.appIconWrap}
                    style={{ background: c.bg, border: `0.5px solid ${c.border}` }}
                  >
                    <Icon size={17} color={c.text} strokeWidth={1.8} />
                  </div>
                  <div className={styles.appLeft}>
                    <div className={styles.appTitle}>{app.title}</div>
                    <div className={styles.appMeta}>
                      <span
                        className={styles.catTag}
                        style={{ background: c.bg, color: c.text, borderColor: c.border }}
                      >
                        {app.category}
                      </span>
                      <span className={styles.appDate}>Submitted {app.date}</span>
                    </div>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                {/* STATUS NOTES */}
                {app.status === "flagged" && (
                  <div className={styles.flagNote}>
                    <AlertCircle size={14} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{app.flagNote}</span>
                  </div>
                )}
                {app.status === "rejected" && app.rejectionReason && (
                  <div className={styles.rejectNote}>
                    <XCircle size={14} color="#b91c1c" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div className={styles.rejectLabel}>Reason for rejection</div>
                      <div className={styles.rejectText}>{app.rejectionReason}</div>
                    </div>
                  </div>
                )}

                {/* FOOTER */}
                <div className={styles.appFoot}>
                  <span className={`${styles.footNote} ${styles[`fn_${app.status}`]}`}>
                    {app.status === "approved" && "Confirmed beneficiary"}
                    {app.status === "pending"  && "Awaiting review"}
                    {app.status === "flagged"  && "Under admin review"}
                    {app.status === "rejected" && "Application unsuccessful"}
                  </span>
                  <div className={styles.footBtns}>
                    <button
                      className={styles.btnSm}
                      onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                    >
                      View <ArrowRight size={12} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}