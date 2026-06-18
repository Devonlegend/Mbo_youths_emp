"use client";
import { useState, useEffect } from "react";
import {
  ScrollText, Search, AlertCircle, Filter,
  ClipboardList, Users, BookOpen, Shield,
  Settings, RefreshCw,
} from "lucide-react";
import styles from "./page.module.css";
import { getAuditLogs } from "@/services";

// ── ENTITY TYPE CONFIG ────────────────────────────────────────────────────────
const entityConfig = {
  Application: { icon: ClipboardList, color: "#3b82f6", bg: "#eff6ff" },
  Student:     { icon: Users,         color: "#15803d", bg: "#f0fdf4" },
  Scheme:      { icon: BookOpen,      color: "#7e22ce", bg: "#faf5ff" },
  System:      { icon: Settings,      color: "#64748b", bg: "#f8fafc" },
};

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = new Date() - new Date(dateStr);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return formatDateTime(dateStr);
}

// ── SKELETON ROW ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className={styles.tableRow}>
      <div className={styles.skeletonCell} style={{ width: "18%" }} />
      <div className={styles.skeletonCell} style={{ width: "36%" }} />
      <div className={styles.skeletonCell} style={{ width: "14%" }} />
      <div className={styles.skeletonCell} style={{ width: "18%" }} />
    </div>
  );
}

const ENTITY_FILTERS = ["All", "Application", "Student", "Scheme", "System"];

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [logs,         setLogs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [filterOpen,   setFilterOpen]   = useState(false);

  // ── FETCH ─────────────────────────────────────────────────────────────────
  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const res  = await getAuditLogs();
      const data = Array.isArray(res.data) ? res.data : [];
      setLogs(data);
    } catch (err) {
      const status = err?.response?.status;
      setError("Failed to load audit log. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLogs(); }, []);

  // ── FILTER + SEARCH ───────────────────────────────────────────────────────
  const filtered = logs.filter((log) => {
    const matchSearch = search.trim() === "" ? true :
      (log.action     || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.admin_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.entity_type || "").toLowerCase().includes(search.toLowerCase());

    const matchFilter = activeFilter === "All" ? true :
      log.entity_type === activeFilter;

    return matchSearch && matchFilter;
  });

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ScrollText size={20} color="#3b82f6" strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            <h1 className={styles.title}>Audit Log</h1>
            <p className={styles.sub}>Complete record of all administrative actions. Read-only.</p>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={loadLogs} disabled={loading}>
          <RefreshCw size={13} strokeWidth={2} className={loading ? styles.spin : ""} />
          Refresh
        </button>
      </div>

      {/* INFO BANNER */}
      <div className={styles.infoBanner}>
        <Shield size={14} color="#3b82f6" strokeWidth={2} style={{ flexShrink: 0 }} />
        <span>
          Every administrative action is permanently recorded here for accountability and audit purposes. Records areretained for a minimum of 5 years.
        </span>
      </div>

      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* TOOLBAR */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by action, admin or entity type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ position: "relative" }}>
            <button
              className={`${styles.filterBtn} ${activeFilter !== "All" ? styles.filterBtnActive : ""}`}
              onClick={() => setFilterOpen((o) => !o)}
            >
              <Filter size={13} strokeWidth={2} />
              {activeFilter === "All" ? "All Types" : activeFilter}
            </button>
            {filterOpen && (
              <div className={styles.filterDropdown}>
                {ENTITY_FILTERS.map((f) => (
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

          {!loading && !error && logs.length > 0 && (
          <span className={styles.logCount}>
            {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
          </span>
        )}
        </div>

        {/* TABLE HEADER */}
        <div className={`${styles.tableRow} ${styles.tableHeader}`}>
          <span>Admin</span>
          <span>Action</span>
          <span>Type</span>
          <span>Time</span>
        </div>

        {/* LOADING */}
        {loading && [1,2,3,4,5,6].map((i) => <SkeletonRow key={i} />)}

        {/* ERROR */}
        {!loading && error && (
          <div className={styles.emptyState}>
            <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
            <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
            <button className={styles.retryBtn} onClick={loadLogs}>
              Try again
            </button>
          </div>
        )}

        {/* EMPTY — endpoint exists but no logs yet */}
        {!loading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <ScrollText size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p className={styles.emptyTitle}>
              {search || activeFilter !== "All"
                ? "No matching entries"
                : "No audit entries yet"
              }
            </p>
            <p className={styles.emptySub}>
              {search || activeFilter !== "All"
                ? "Try adjusting your search or filter."
                : "Admin actions will appear here as they happen."
              }
            </p>
          </div>
        )}

        {/* TABLE ROWS */}
        {!loading && !error && filtered.map((log) => {
          const entConfig = entityConfig[log.entity_type] || entityConfig.System;
          const Icon      = entConfig.icon;
          const adminInitials = (log.admin_name || "SY")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <div key={log.id} className={styles.tableRowData}>

              {/* Admin */}
              <div className={styles.tdAdmin}>
                <div className={styles.adminAvatar}>{adminInitials}</div>
                <span className={styles.adminName}>
                  {log.admin_name || "System"}
                </span>
              </div>

              {/* Action */}
              <span className={styles.tdAction}>{log.action || "—"}</span>

              {/* Entity type */}
              <div className={styles.tdType}>
                <div
                  className={styles.typeChip}
                  style={{ background: entConfig.bg }}
                >
                  <Icon size={11} strokeWidth={2} style={{ color: entConfig.color }} />
                  <span style={{ color: entConfig.color }}>
                    {log.entity_type || "—"}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className={styles.tdTime}>
                <span className={styles.timeAgo}>
                  {formatTimeAgo(log.timestamp)}
                </span>
                <span className={styles.timeAbsolute}>
                  {formatDateTime(log.timestamp)}
                </span>
              </div>

            </div>
          );
        })}

        {/* FOOTER */}
        {!loading && !error && logs.length > 0 && (
          <div className={styles.tableFooter}>
            Showing {filtered.length} of {logs.length} entries · Last 100 actions
          </div>
        )}

      </div>

    </div>
  );
}