import Link from "next/link";
import { TrendingUp } from "lucide-react";
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  BookOpen,
} from "lucide-react";
import {
  overviewStats,
  recentActivity,
  applications,
  schemes,
} from "../mockdata";
import styles from "./overview.module.css";

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
  return "#64748b";
}

function StatCard({ label, value, icon: Icon, accent, bg, trend }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statCardTop}>
        <div className={styles.statIconBox} style={{ backgroundColor: bg }}>
          <Icon size={16} color={accent} strokeWidth={2} />
        </div>
        {trend && (
          <div className={styles.statTrend}>
            <TrendingUp size={9} />
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const uiStatus =
    status === "submitted" ||
    status === "eligibility_check" ||
    status === "document_review" ||
    status === "shortlisted"
      ? "pending"
      : status === "double_dip_flag"
      ? "flagged"
      : status;

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
      {labels[uiStatus] || "Pending"}
    </span>
  );
}

export default function OverviewPage() {
  const stats = [
    {
      label: "Total Applications",
      value: overviewStats.total_applications,
      icon: FileText,
      accent: "#3b82f6",
      bg: "#eff6ff",
      trend: "+12%",
    },
    {
      label: "Pending Review",
      value: overviewStats.pending,
      icon: Clock,
      accent: "#d97706",
      bg: "#fffbeb",
    },
    {
      label: "Flagged",
      value: overviewStats.flagged,
      icon: AlertTriangle,
      accent: "#ef4444",
      bg: "#fef2f2",
    },
    {
      label: "Approved",
      value: overviewStats.approved,
      icon: CheckCircle,
      accent: "#15803d",
      bg: "#f0fdf4",
    },
    {
      label: "Rejected",
      value: overviewStats.rejected,
      icon: XCircle,
      accent: "#64748b",
      bg: "#f8fafc",
    },
    {
      label: "Total Students",
      value: overviewStats.total_students,
      icon: Users,
      accent: "#8b5cf6",
      bg: "#f5f3ff",
    },
    {
      label: "Open Schemes",
      value: overviewStats.open_schemes,
      icon: BookOpen,
      accent: "#15803d",
      bg: "#f0fdf4",
      trend: "Active",
    },
  ];

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.submission_date) - new Date(a.submission_date))
    .slice(0, 5);

  return (
    <div className={styles.page}>

      {/* Stat cards */}
      <div className={styles.statsGrid}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Bottom row */}
      <div className={styles.bottomRow}>

        {/* Recent Applications */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Recent Applications</h2>
              <p className={styles.cardSubtitle}>Last 5 submitted</p>
            </div>
            <Link href="/admin/applications" className={styles.cardLink}>
              View all
            </Link>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableThead}>
                <tr>
                  {["ID", "Student", "Scheme", "Submitted", "Status"].map((h) => (
                    <th key={h} className={styles.tableTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentApps.map((app) => (
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
                    </td>
                    <td className={styles.tdDate}>
                      {formatDate(app.submission_date)}
                    </td>
                    <td className={styles.tdStatus}>
                      <StatusBadge status={app.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Recent Activity</h2>
              <p className={styles.cardSubtitle}>Latest admin actions</p>
            </div>
          </div>
          <div className={styles.feedList}>
            {recentActivity.map((log, i) => (
              <div key={log.id} className={styles.feedItem}>
                <div className={styles.feedDotCol}>
                  <div
                    className={styles.feedDot}
                    style={{ backgroundColor: actionDotColor(log.action) }}
                  />
                  {i < recentActivity.length - 1 && (
                    <div className={styles.feedLine} />
                  )}
                </div>
                <div className={styles.feedContent}>
                  <div className={styles.feedAction}>{log.action}</div>
                  <div className={styles.feedMeta}>
                    <span className={styles.feedMetaText}>
                      {formatDate(log.timestamp)}
                    </span>
                    <span className={styles.feedMetaDot}>·</span>
                    <span className={styles.feedMetaText}>
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Schemes Summary */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Schemes Summary</h2>
            <p className={styles.cardSubtitle}>All active and closed schemes</p>
          </div>
          <Link href="/admin/schemes" className={styles.cardLink}>
            Manage schemes
          </Link>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead className={styles.tableThead}>
              <tr>
                {["Scheme", "Status", "Deadline", "Slots", "Applicants"].map((h) => (
                  <th key={h} className={styles.tableTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schemes.map((scheme) => (
                <tr key={scheme.id} className={styles.tableTr}>
                  <td className={styles.tdCell}>
                    <div className={styles.tdSchemeTitle}>{scheme.name}</div>
                    <div className={styles.tdSchemeId}>{scheme.id}</div>
                  </td>
                  <td className={styles.tdCell}>
                    <span
                      className={
                        scheme.is_active && scheme.is_published
                          ? styles.schemeStatusOpen
                          : styles.schemeStatusClosed
                      }
                    >
                      {scheme.is_active && scheme.is_published ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className={`${styles.tdCell} ${styles.tdDate}`}>
                    {formatDate(scheme.application_close_date)}
                  </td>
                  <td className={`${styles.tdCell} ${styles.tdSlots}`}>
                    {scheme.total_slots}
                  </td>
                  <td className={styles.tdCell}>
                    <div className={styles.applicantsCell}>
                      <span className={styles.applicantsCount}>
                        {scheme.total_slots - scheme.remaining_slots}
                      </span>
                      <div className={styles.fillBarTrack}>
                        <div
                          className={`${styles.fillBarFill} ${
                            scheme.total_slots - scheme.remaining_slots >= scheme.total_slots
                              ? styles.fillBarRed
                              : styles.fillBarGreen
                          }`}
                          style={{
                            width: `${Math.min(
                              ((scheme.total_slots - scheme.remaining_slots) /
                                scheme.total_slots) *
                                100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}