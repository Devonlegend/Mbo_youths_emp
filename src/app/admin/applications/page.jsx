"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { applications, overviewStats } from "../mockdata";
import styles from "./applications.module.css";

// ── HELPERS ───────────────────────────────────
function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getUiStatus(status) {
  if (["submitted", "eligibility_check", "document_review", "shortlisted"].includes(status))
    return "pending";
  if (status === "double_dip_flag") return "flagged";
  return status;
}

function StatusBadge({ status }) {
  const uiStatus = getUiStatus(status);
  const map = {
    pending: styles.badgePending,
    flagged: styles.badgeFlagged,
    approved: styles.badgeApproved,
    rejected: styles.badgeRejected,
  };
  const labels = {
    pending: "Pending",
    flagged: "Flagged",
    approved: "Approved",
    rejected: "Rejected",
  };
  return (
    <span className={`${styles.badge} ${map[uiStatus] || styles.badgePending}`}>
      {labels[uiStatus] || uiStatus}
    </span>
  );
}

export default function ApplicationsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [schemeFilter, setSchemeFilter] = useState("all");

  const tabFiltered = applications.filter((a) => {
    const uiStatus = getUiStatus(a.status);
    if (activeTab === "clean") return uiStatus === "pending";
    if (activeTab === "flagged") return uiStatus === "flagged";
    return true;
  });

  const searched = tabFiltered.filter((a) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      `${a.student.firstname} ${a.student.lastname}`.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.scheme_name.toLowerCase().includes(q)
    );
  });

  const filtered = searched.filter((a) => {
    if (schemeFilter === "all") return true;
    return a.scheme_name === schemeFilter;
  });

  const uniqueSchemes = [
    ...new Map(
      applications.map((a) => [a.scheme_name, { id: a.scheme_name, title: a.scheme_name }])
    ).values(),
  ];

  const tabs = [
    { key: "all", label: "All Applications", count: applications.length },
    {
      key: "clean",
      label: "Clean Queue",
      count: applications.filter((a) => getUiStatus(a.status) === "pending").length,
    },
    {
      key: "flagged",
      label: "Flagged Queue",
      count: applications.filter((a) => getUiStatus(a.status) === "flagged").length,
    },
  ];

  return (
    <div className={styles.page}>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Applications</h1>
          <p className={styles.pageSubtitle}>
            Review, flag and decide on all submitted applications
          </p>
        </div>
      </div>

      <div className={styles.statsRow}>
        {[
          { dot: styles.statPillDotPending, value: overviewStats.pending, label: "Pending Review" },
          { dot: styles.statPillDotFlagged, value: overviewStats.flagged, label: "Flagged" },
          { dot: styles.statPillDotApproved, value: overviewStats.approved, label: "Approved" },
          { dot: styles.statPillDotRejected, value: overviewStats.rejected, label: "Rejected" },
        ].map((s) => (
          <div key={s.label} className={styles.statPill}>
            <div className={`${styles.statPillDot} ${s.dot}`} />
            <div>
              <div className={styles.statPillValue}>{s.value}</div>
              <div className={styles.statPillLabel}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.tabBar}>
          <div className={styles.tabs}>
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
                <span
                  className={`${styles.tabCount} ${
                    activeTab === t.key ? styles.tabCountActive : ""
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>
              <Search size={14} color="#94a3b8" />
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, ID or scheme..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={styles.filterSelect}
            value={schemeFilter}
            onChange={(e) => setSchemeFilter(e.target.value)}
          >
            <option value="all">All Schemes</option>
            {uniqueSchemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <div className={styles.toolbarRight}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No applications found</div>
            <div className={styles.emptySubtitle}>
              Try adjusting your search or filter
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableThead}>
                <tr>
                  <th className={styles.tableTh}>ID</th>
                  <th className={styles.tableTh}>Student</th>
                  <th className={styles.tableTh}>Scheme</th>
                  <th className={styles.tableTh}>Submitted</th>
                  <th className={styles.tableTh}>Status</th>
                  {activeTab === "flagged" && (
                    <th className={styles.tableTh}>Conflict</th>
                  )}
                  <th className={styles.tableTh}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => {
                  const uiStatus = getUiStatus(app.status);
                  return (
                    <tr key={app.id} className={styles.tableTr}>
                      <td className={styles.tdId}>{app.id}</td>
                      <td className={styles.tdStudent}>
                        <div className={styles.tdStudentName}>
                          {app.student.firstname} {app.student.lastname}
                        </div>
                        <div className={styles.tdStudentMeta}>
                          {app.student.lga}, {app.student.ward}
                        </div>
                      </td>
                      <td className={styles.tdScheme}>
                        <div className={styles.tdSchemeText}>{app.scheme_name}</div>
                        <div className={styles.tdSchemeId}>{app.scheme_category}</div>
                      </td>
                      <td className={styles.tdCell}>
                        {formatDate(app.submission_date)}
                      </td>
                      <td className={styles.tdCell}>
                        <StatusBadge status={app.status} />
                      </td>
                      {activeTab === "flagged" && (
                        <td className={styles.tdFlagReason}>
                          <div className={styles.tdFlagText}>
                            {app.has_conflict ? "Double dip conflict detected" : "—"}
                          </div>
                        </td>
                      )}
                      <td className={styles.tdActions}>
                        <div className={styles.actionRow}>
                          <Link
                            href={`/admin/applications/${app.id}`}
                            className={styles.btnView}
                          >
                            View
                          </Link>
                          {(uiStatus === "pending" || uiStatus === "flagged") && (
                            <>
                              <button className={styles.btnApprove}>Approve</button>
                              <button className={styles.btnReject}>Reject</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {filtered.length} of {applications.length} applications
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