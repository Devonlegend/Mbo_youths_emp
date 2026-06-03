"use client";

import { useState } from "react";
import { Search, Lock } from "lucide-react";
import { disqualifications } from "../mockdata";
import styles from "./disqualifications.module.css";

// ── HELPERS ───────────────────────────────────
function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── REJECTION REASON BADGE ────────────────────
function ReasonBadge({ reason }) {
  if (!reason) return <span className={styles.badgeCriteria}>—</span>;
  if (reason.toLowerCase().includes("duplication") ||
      reason.toLowerCase().includes("duplicate"))
    return <span className={styles.badgeDuplication}>Duplication</span>;
  if (reason.toLowerCase().includes("false"))
    return <span className={styles.badgeFalseDeclaration}>False Declaration</span>;
  return <span className={styles.badgeCriteria}>Does Not Meet Criteria</span>;
}

// ── PAGE ──────────────────────────────────────
export default function DisqualificationsPage() {
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("all");

  const filtered = disqualifications.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      d.student_name.toLowerCase().includes(q) ||
      d.scheme_name.toLowerCase().includes(q) ||
      d.student_id.toLowerCase().includes(q);

    const matchReason = (() => {
      if (reasonFilter === "all") return true;
      const r = (d.rejection_reason || "").toLowerCase();
      if (reasonFilter === "duplication") return r.includes("duplication") || r.includes("duplicate");
      if (reasonFilter === "false") return r.includes("false");
      if (reasonFilter === "criteria") return !r.includes("duplication") && !r.includes("duplicate") && !r.includes("false");
      return true;
    })();

    return matchSearch && matchReason;
  });

  const duplicationCount = disqualifications.filter((d) => {
    const r = (d.rejection_reason || "").toLowerCase();
    return r.includes("duplication") || r.includes("duplicate");
  }).length;

  const otherCount = disqualifications.length - duplicationCount;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Disqualification Register</h1>
          <p className={styles.pageSubtitle}>
            Read-only record of all disqualified applicants
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
            <div className={styles.statPillValue}>{disqualifications.length}</div>
            <div className={styles.statPillLabel}>Total Disqualified</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotDuplication}`} />
          <div>
            <div className={styles.statPillValue}>{duplicationCount}</div>
            <div className={styles.statPillLabel}>Duplication</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotOther}`} />
          <div>
            <div className={styles.statPillValue}>{otherCount}</div>
            <div className={styles.statPillLabel}>Other Reasons</div>
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
              placeholder="Search by name or scheme..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={styles.filterSelect}
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
          >
            <option value="all">All Reasons</option>
            <option value="duplication">Duplication</option>
            <option value="false">False Declaration</option>
            <option value="criteria">Does Not Meet Criteria</option>
          </select>

          <div className={styles.toolbarRight}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No disqualifications found</div>
            <div className={styles.emptySubtitle}>
              Try adjusting your search or filter
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableThead}>
                <tr>
                  <th className={styles.tableTh}>Student</th>
                  <th className={styles.tableTh}>Scheme</th>
                  <th className={styles.tableTh}>Reason</th>
                  <th className={styles.tableTh}>Notes</th>
                  <th className={styles.tableTh}>Disqualified</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className={styles.tableTr}>
                    <td className={styles.tdStudent}>
                      <div className={styles.tdStudentName}>{d.student_name}</div>
                      <div className={styles.tdStudentMeta}>{d.student_id}</div>
                    </td>
                    <td className={styles.tdScheme}>
                      <div className={styles.tdSchemeText}>{d.scheme_name}</div>
                    </td>
                    <td className={styles.tdCell}>
                      <ReasonBadge reason={d.rejection_reason} />
                    </td>
                    <td className={styles.tdNote}>
                      <div className={styles.tdNoteText}>
                        {d.reviewer_notes || "—"}
                      </div>
                    </td>
                    <td className={styles.tdMuted}>
                      {formatDate(d.disqualified_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {filtered.length} of {disqualifications.length} records
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