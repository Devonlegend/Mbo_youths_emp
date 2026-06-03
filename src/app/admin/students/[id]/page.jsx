"use client";

import { useState, use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { students, applications } from "../../mockdata";
import styles from "./student-detail.module.css";

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

// ── STATUS BADGE ──────────────────────────────
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

// ── PAGE ──────────────────────────────────────
export default function StudentDetailPage({ params }) {
  const { id } = use(params);
  const student = students.find((s) => s.id === id);

  const [isVerified, setIsVerified] = useState(student?.is_verified || false);

  // Get all applications belonging to this student
  const studentApps = applications.filter((a) => a.student.id === id);

  if (!student) {
    return (
      <div className={styles.page}>
        <Link href="/admin/students" className={styles.backLink}>
          <ArrowLeft size={14} />
          Back to Students
        </Link>
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <div className={styles.emptyTitle}>Student not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* Back */}
      <Link href="/admin/students" className={styles.backLink}>
        <ArrowLeft size={14} />
        Back to Students
      </Link>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>
            {student.firstname} {student.lastname}
          </h1>
          <div className={styles.pageMeta}>
            <span>{student.email}</span>
            <span className={styles.pageMetaDot}>·</span>
            <span>{student.lga}</span>
            <span className={styles.pageMetaDot}>·</span>
            <span>Registered {formatDate(student.created_at)}</span>
          </div>
        </div>
        <span className={isVerified ? styles.badgeVerified : styles.badgeUnverified}>
          {isVerified ? "✓ Verified" : "⚠ Unverified"}
        </span>
      </div>

      {/* Body grid */}
      <div className={styles.bodyGrid}>

        {/* Left col */}
        <div className={styles.leftCol}>

          {/* Personal Information */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Personal Information</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoGrid}>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>First Name</span>
                  <span className={styles.infoValue}>{student.firstname}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Last Name</span>
                  <span className={styles.infoValue}>{student.lastname}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Gender</span>
                  <span className={styles.infoValue}>
                    {student.gender
                      ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1)
                      : "—"}
                  </span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Date of Birth</span>
                  <span className={styles.infoValue}>
                    {student.date_of_birth ? formatDate(student.date_of_birth) : "—"}
                  </span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Phone</span>
                  <span className={styles.infoValueMono}>{student.phone_number}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{student.email}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>NIN Hash</span>
                  <span className={styles.infoValueMono}>{student.nin_hash}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Registered</span>
                  <span className={styles.infoValue}>{formatDate(student.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Location</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoGrid}>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>LGA</span>
                  <span className={styles.infoValue}>{student.lga}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Ward</span>
                  <span className={styles.infoValue}>{student.ward}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Academic */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Academic Information</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoGrid}>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Level</span>
                  <span className={styles.infoValue}>{student.level} Level</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>CGPA</span>
                  <span className={styles.infoValue}>{student.cgpa}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Active Award</span>
                  <span className={styles.infoValue}>
                    {student.has_active_award ? student.active_award : "None"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Application History */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Application History</h2>
            </div>
            {studentApps.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>No applications found</div>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead className={styles.tableThead}>
                    <tr>
                      <th className={styles.tableTh}>Scheme</th>
                      <th className={styles.tableTh}>Category</th>
                      <th className={styles.tableTh}>Submitted</th>
                      <th className={styles.tableTh}>Status</th>
                      <th className={styles.tableTh}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentApps.map((app) => (
                      <tr key={app.id} className={styles.tableTr}>
                        <td className={styles.tdScheme}>
                          <div className={styles.tdSchemeText}>{app.scheme_name}</div>
                          <div className={styles.tdSchemeSub}>{app.id}</div>
                        </td>
                        <td className={styles.tdMuted}>{app.scheme_category}</td>
                        <td className={styles.tdMuted}>
                          {formatDate(app.submission_date)}
                        </td>
                        <td className={styles.tdCell}>
                          <StatusBadge status={app.status} />
                        </td>
                        <td className={styles.tdLink}>
                          <Link
                            href={`/admin/applications/${app.id}`}
                            className={styles.viewLink}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right — side panel */}
        <div className={styles.sidePanel}>

          {/* Verification toggle */}
          <div className={styles.verifyCard}>
            <div className={styles.verifyHeader}>
              <h3 className={styles.verifyTitle}>Verification Status</h3>
              <p className={styles.verifySubtitle}>
                Toggle the student's verification status
              </p>
            </div>
            <div className={styles.verifyBody}>
              <div className={styles.verifyStatus}>
                <span className={styles.verifyStatusLabel}>Current Status</span>
                <span
                  className={`${styles.verifyStatusValue} ${
                    isVerified
                      ? styles.verifyStatusVerified
                      : styles.verifyStatusUnverified
                  }`}
                >
                  {isVerified ? "Verified" : "Unverified"}
                </span>
              </div>
              {isVerified ? (
                <button
                  className={styles.btnUnverify}
                  onClick={() => setIsVerified(false)}
                >
                  Remove Verification
                </button>
              ) : (
                <button
                  className={styles.btnVerify}
                  onClick={() => setIsVerified(true)}
                >
                  Mark as Verified
                </button>
              )}
              <p className={styles.verifyNote}>
                This action will be logged in the audit trail.
                When backend is connected, this will call{" "}
                <code>PATCH /students/{student.id}/</code>
              </p>
            </div>
          </div>

          {/* Quick info */}
          <div className={styles.quickInfoCard}>
            <div className={styles.quickInfoHeader}>
              <h3 className={styles.quickInfoTitle}>Quick Info</h3>
            </div>
            <div className={styles.quickInfoList}>
              <div className={styles.quickInfoItem}>
                <span className={styles.quickInfoItemLabel}>Student ID</span>
                <span className={styles.quickInfoItemValue}>{student.id}</span>
              </div>
              <div className={styles.quickInfoItem}>
                <span className={styles.quickInfoItemLabel}>Applications</span>
                <span className={styles.quickInfoItemValue}>{studentApps.length}</span>
              </div>
              <div className={styles.quickInfoItem}>
                <span className={styles.quickInfoItemLabel}>Active Award</span>
                <span className={styles.quickInfoItemValue}>
                  {student.has_active_award ? "Yes" : "None"}
                </span>
              </div>
              <div className={styles.quickInfoItem}>
                <span className={styles.quickInfoItemLabel}>CGPA</span>
                <span className={styles.quickInfoItemValue}>{student.cgpa}</span>
              </div>
              <div className={styles.quickInfoItem}>
                <span className={styles.quickInfoItemLabel}>Level</span>
                <span className={styles.quickInfoItemValue}>{student.level} Level</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}