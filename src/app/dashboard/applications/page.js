"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  GraduationCap, Briefcase, Banknote,
  CheckCircle2, Clock, XCircle, AlertCircle,
  ArrowRight, Search, Filter, FolderOpen, ChevronDown,
} from "lucide-react";
import styles from "./page.module.css";
import LoadingSpinner from "../components/LoadingSpinner";
import { getMyApplications } from "@/services";

const statusMap = {
  submitted:         "pending",
  eligibility_check: "pending",
  document_review:   "pending",
  shortlisted:       "pending",
  double_dip_flag:   "flagged",
  approved:          "approved",
  rejected:          "rejected",
  withdrawn:         "rejected",
  draft:             "pending",
};

const categoryConfig = {
  scholarship: { label: "Scholarship", color: "green",  icon: GraduationCap },
  empowerment: { label: "Empowerment", color: "amber",  icon: Briefcase     },
  grant:       { label: "Grant",       color: "purple", icon: Banknote      },
};

const colorMap = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  amber:  { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce" },
};

const FILTERS = ["All", "Pending", "Flagged", "Approved", "Rejected"];

function mapApplication(app) {
  const uiStatus = statusMap[app.status] || "pending";
  const catKey   = (app.scheme?.award_type || "scholarship").toLowerCase();
  const config   = categoryConfig[catKey] || categoryConfig.scholarship;

  const date = app.submission_date
    ? new Date(app.submission_date).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "—";

  const flagNote = app.has_conflict
    ? "A conflict was detected with an existing award. Under admin review — no action needed from you at this time."
    : "Under admin review. No action needed from you at this time.";

  return {
    id:               app.id,
    title:            app.scheme?.name || "Programme Application",
    category:         config.label,
    categoryColor:    config.color,
    icon:             config.icon,
    date,
    status:           uiStatus,
    flagNote,
    rejectionReason:  app.rejection_reason  || "",
    reviewerNotes:    app.reviewer_notes    || "",
    waiversSubmitted: app.waiver_submitted  || false,
  };
}

function StatusBadge({ status }) {
  const map = {
    approved: { cls: styles.st_approved, icon: <CheckCircle2 size={11} strokeWidth={2.5} />, label: "Approved" },
    pending:  { cls: styles.st_pending,  icon: <Clock        size={11} strokeWidth={2.5} />, label: "Pending"  },
    flagged:  { cls: styles.st_flagged,  icon: <AlertCircle  size={11} strokeWidth={2.5} />, label: "Flagged"  },
    rejected: { cls: styles.st_rejected, icon: <XCircle      size={11} strokeWidth={2.5} />, label: "Rejected" },
  };
  const s = map[status] || map.pending;
  return <span className={`${styles.statusTag} ${s.cls}`}>{s.icon} {s.label}</span>;
}

export default function ApplicationsPage() {
  const router = useRouter();

  const [applications, setApplications] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [search,       setSearch]       = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res  = await getMyApplications();
        if (cancelled) return;
        const apps = Array.isArray(res.data?.results) ? res.data.results : [];
        setApplications(apps.map(mapApplication));
      } catch {
        if (!cancelled) setError("Failed to load applications. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = applications.filter((a) => {
    const matchFilter = activeFilter === "All" || a.status.toLowerCase() === activeFilter.toLowerCase();
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
                        a.category.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <FolderOpen size={20} color="#15803d" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>My Applications</h1>
            <p className={styles.sub}>Track the status of all your submitted applications.</p>
          </div>
        </div>
        {!loading && !error && (
          <div className={styles.countPill}>{applications.length} total</div>
        )}
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

      {/* LOADING */}
      {loading && <LoadingSpinner fullPage />}

      {/* ERROR */}
      {!loading && error && (
        <div className={styles.empty}>
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

      {/* EMPTY — no applications */}
      {!loading && !error && applications.length === 0 && (
        <div className={styles.empty}>
          <p style={{ color: "#64748b", fontWeight: 600 }}>No applications yet</p>
          <p style={{ color: "#94a3b8", fontSize: 13 }}>
            Browse open programmes and submit your first application.
          </p>
          <button
            onClick={() => router.push("/dashboard/programmes")}
            style={{
              marginTop: 4, padding: "8px 20px", borderRadius: 8,
              border: "1px solid #bbf7d0", background: "#f0fdf4",
              fontSize: 13, cursor: "pointer", color: "#15803d", fontWeight: 600,
            }}
          >
            Browse Programmes
          </button>
        </div>
      )}

      {/* EMPTY — filter/search */}
      {!loading && !error && applications.length > 0 && filtered.length === 0 && (
        <div className={styles.empty}>
          <p>No applications match your search.</p>
        </div>
      )}

      {/* APPLICATION CARDS */}
      {!loading && !error && filtered.length > 0 && (
        <div className={styles.appList}>
          {filtered.map((app) => {
            const c    = colorMap[app.categoryColor] || colorMap.green;
            const Icon = app.icon;
            return (
              <div key={app.id} className={`${styles.appCard} ${styles[`card_${app.status}`]}`}>
                <div className={styles.appHead}>
                  <div className={styles.appIconWrap} style={{ background: c.bg, border: `0.5px solid ${c.border}` }}>
                    <Icon size={17} color={c.text} strokeWidth={1.8} />
                  </div>
                  <div className={styles.appLeft}>
                    <div className={styles.appTitle}>{app.title}</div>
                    <div className={styles.appMeta}>
                      <span className={styles.catTag} style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                        {app.category}
                      </span>
                      <span className={styles.appDate}>Submitted {app.date}</span>
                    </div>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

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

                <div className={styles.appFoot}>
                  <span className={`${styles.footNote} ${styles[`fn_${app.status}`]}`}>
                    {app.status === "approved" && "Confirmed beneficiary"}
                    {app.status === "pending"  && "Awaiting review"}
                    {app.status === "flagged"  && "Under admin review"}
                    {app.status === "rejected" && "Application unsuccessful"}
                  </span>
                  <div className={styles.footBtns}>
                    <button className={styles.btnSm} onClick={() => router.push(`/dashboard/applications/${app.id}`)}>
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