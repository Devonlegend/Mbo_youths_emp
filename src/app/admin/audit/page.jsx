"use client";

import { useState } from "react";
import { Search, Lock } from "lucide-react";
import { auditLog } from "../mockdata";
import styles from "./audit.module.css";

// ── HELPERS ───────────────────────────────────
function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionDotColor(action) {
  const a = action.toLowerCase();
  if (a.includes("approved")) return "#15803d";
  if (a.includes("rejected")) return "#ef4444";
  if (a.includes("flagged")) return "#f59e0b";
  if (a.includes("published")) return "#3b82f6";
  if (a.includes("closed")) return "#64748b";
  if (a.includes("created")) return "#8b5cf6";
  if (a.includes("verified")) return "#f59e0b";
  return "#94a3b8";
}

// ── ENTITY BADGE ──────────────────────────────
function EntityBadge({ type }) {
  const map = {
    Application: styles.badgeApplication,
    Scheme: styles.badgeScheme,
    Student: styles.badgeStudent,
  };
  return (
    <span className={map[type] || styles.badgeApplication}>{type}</span>
  );
}

// ── PAGE ──────────────────────────────────────
export default function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = auditLog.filter((log) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      log.action.toLowerCase().includes(q) ||
      log.admin_name.toLowerCase().includes(q) ||
      log.entity_id.toLowerCase().includes(q);

    const matchEntity =
      entityFilter === "all" || log.entity_type === entityFilter;

    const logDate = new Date(log.timestamp);
    const matchFrom = !dateFrom || logDate >= new Date(dateFrom);
    const matchTo = !dateTo || logDate <= new Date(dateTo + "T23:59:59");

    return matchSearch && matchEntity && matchFrom && matchTo;
  });

  // Sort newest first
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const applicationCount = auditLog.filter(
    (l) => l.entity_type === "Application"
  ).length;
  const schemeCount = auditLog.filter(
    (l) => l.entity_type === "Scheme"
  ).length;
  const studentCount = auditLog.filter(
    (l) => l.entity_type === "Student"
  ).length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Audit Log</h1>
          <p className={styles.pageSubtitle}>
            Complete record of all admin actions
          </p>
        </div>
        <span className={styles.readOnlyBadge}>
          <Lock size={10} />
          Read Only
        </span>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotTotal}`} />
          <div>
            <div className={styles.statPillValue}>{auditLog.length}</div>
            <div className={styles.statPillLabel}>Total Actions</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotApplication}`} />
          <div>
            <div className={styles.statPillValue}>{applicationCount}</div>
            <div className={styles.statPillLabel}>Application Actions</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotScheme}`} />
          <div>
            <div className={styles.statPillValue}>{schemeCount}</div>
            <div className={styles.statPillLabel}>Scheme Actions</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotStudent}`} />
          <div>
            <div className={styles.statPillValue}>{studentCount}</div>
            <div className={styles.statPillLabel}>Student Actions</div>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>
              <Search size={14} color="#94a3b8" />
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by action or admin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={styles.filterSelect}
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="all">All Entities</option>
            <option value="Application">Application</option>
            <option value="Scheme">Scheme</option>
            <option value="Student">Student</option>
          </select>

          <input
            type="date"
            className={styles.dateInput}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />

          <input
            type="date"
            className={styles.dateInput}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
          />

          <div className={styles.toolbarRight}>
            {sorted.length} result{sorted.length !== 1 ? "s" : ""}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No log entries found</div>
            <div className={styles.emptySubtitle}>
              Try adjusting your search or date filter
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableThead}>
                <tr>
                  <th className={styles.tableTh}>Action</th>
                  <th className={styles.tableTh}>Admin</th>
                  <th className={styles.tableTh}>Entity</th>
                  <th className={styles.tableTh}>Entity ID</th>
                  <th className={styles.tableTh}>Date</th>
                  <th className={styles.tableTh}>Time</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((log) => (
                  <tr key={log.id} className={styles.tableTr}>
                    <td className={styles.tdAction}>
                      <div className={styles.tdActionText}>
                        <span
                          className={styles.actionDot}
                          style={{ backgroundColor: actionDotColor(log.action) }}
                        />
                        {log.action}
                      </div>
                    </td>
                    <td className={styles.tdAdmin}>
                      <div className={styles.tdAdminName}>{log.admin_name}</div>
                      <div className={styles.tdAdminId}>{log.admin_id}</div>
                    </td>
                    <td className={styles.tdCell}>
                      <EntityBadge type={log.entity_type} />
                    </td>
                    <td className={styles.tdMuted}>{log.entity_id}</td>
                    <td className={styles.tdMuted}>
                      {formatDate(log.timestamp)}
                    </td>
                    <td className={styles.tdMuted}>
                      {formatTime(log.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {sorted.length} of {auditLog.length} entries
          </div>
          <div className={styles.paginationButtons}>
            <button className={styles.paginationBtn}>Previous</button>
            <button
              className={`${styles.paginationBtn} ${styles.paginationBtnActive}`}
            >
              1
            </button>
            <button className={styles.paginationBtn}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}