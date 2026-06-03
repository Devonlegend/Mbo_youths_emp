"use client";
import { useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { applications, students } from "../../mockdata";
import styles from "./detail.module.css";

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

// ── STEPPER ───────────────────────────────────
function Stepper({ status }) {
  const uiStatus = getUiStatus(status);
  const steps = [
    { key: "submitted", label: "Submitted" },
    { key: "review", label: "Under Review" },
    { key: "decision", label: "Decision Made" },
  ];

  function getStepState(stepKey) {
    if (uiStatus === "pending") {
      if (stepKey === "submitted") return "done";
      if (stepKey === "review") return "active";
      return "idle";
    }
    if (uiStatus === "flagged") {
      if (stepKey === "submitted") return "done";
      if (stepKey === "review") return "error";
      return "idle";
    }
    if (uiStatus === "approved" || uiStatus === "rejected") {
      return "done";
    }
    return "idle";
  }

  function circleClass(state) {
    if (state === "done") return styles.stepCircleDone;
    if (state === "active") return styles.stepCircleActive;
    if (state === "error") return styles.stepCircleError;
    return "";
  }

  function labelClass(state) {
    if (state === "done") return styles.stepLabelDone;
    if (state === "active") return styles.stepLabelActive;
    if (state === "error") return styles.stepLabelError;
    return "";
  }

  return (
    <div className={styles.stepper}>
      {steps.map((step, i) => {
        const state = getStepState(step.key);
        return (
          <div key={step.key} className={styles.stepItem}>
            <div className={`${styles.stepCircle} ${circleClass(state)}`}>
              {state === "done" ? (
                <CheckCircle size={14} />
              ) : state === "error" ? (
                <AlertTriangle size={14} />
              ) : (
                i + 1
              )}
            </div>
            <span className={`${styles.stepLabel} ${labelClass(state)}`}>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`${styles.stepConnector} ${
                  state === "done" ? styles.stepConnectorDone : ""
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── FORM DATA SECTION ─────────────────────────
// Renders form_data fields dynamically based on scheme_category
function FormDataSection({ app }) {
  const fd = app.form_data;
  if (!fd) return null;

  if (app.scheme_category === "scholarship") {
    return (
      <>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Academic Information</h2>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.infoGrid}>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>Institution</span>
                <span className={styles.infoValue}>{fd.institution || "—"}</span>
              </div>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>Level</span>
                <span className={styles.infoValue}>{fd.level || "—"}</span>
              </div>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>Department</span>
                <span className={styles.infoValue}>{fd.department || "—"}</span>
              </div>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>Current Level</span>
                <span className={styles.infoValue}>{fd.current_level ? `${fd.current_level} Level` : "—"}</span>
              </div>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>Matric Number</span>
                <span className={styles.infoValueMono}>{fd.matric_number || "—"}</span>
              </div>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>CGPA</span>
                <span className={styles.infoValue}>{fd.cgpa || "—"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Bank Details</h2>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.infoGrid}>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>Bank Name</span>
                <span className={styles.infoValue}>{fd.bank_name || "—"}</span>
              </div>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>Account Number</span>
                <span className={styles.infoValueMono}>{fd.account_number || "—"}</span>
              </div>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>Account Name</span>
                <span className={styles.infoValue}>{fd.account_name || "—"}</span>
              </div>
              <div className={styles.infoField}>
                <span className={styles.infoLabel}>External Declaration</span>
                <span className={styles.infoValue}>
                  {fd.declared_external === "yes"
                    ? `Yes — ${fd.declaration_details}`
                    : "None declared"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (app.scheme_category === "vocational") {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Training Information</h2>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.infoGrid}>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Training Name</span>
              <span className={styles.infoValue}>{fd.training_name || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Education Level</span>
              <span className={styles.infoValue}>{fd.education_level || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Availability</span>
              <span className={styles.infoValue}>{fd.availability || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>External Declaration</span>
              <span className={styles.infoValue}>
                {fd.declared_external === "yes"
                  ? `Yes — ${fd.declaration_details}`
                  : "None declared"}
              </span>
            </div>
            <div className={`${styles.infoField} ${styles.infoFieldFull}`}>
              <span className={styles.infoLabel}>Prior Experience</span>
              <span className={styles.infoValue}>{fd.prior_experience || "—"}</span>
            </div>
            <div className={`${styles.infoField} ${styles.infoFieldFull}`}>
              <span className={styles.infoLabel}>Career Goal</span>
              <span className={styles.infoValue}>{fd.career_goal || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (app.scheme_category === "empowerment") {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Empowerment Details</h2>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.infoGrid}>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Trade</span>
              <span className={styles.infoValue}>{fd.trade || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Current Status</span>
              <span className={styles.infoValue}>{fd.current_status || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Business Location</span>
              <span className={styles.infoValue}>{fd.business_location || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>External Declaration</span>
              <span className={styles.infoValue}>
                {fd.declared_external === "yes"
                  ? `Yes — ${fd.declaration_details}`
                  : "None declared"}
              </span>
            </div>
            <div className={`${styles.infoField} ${styles.infoFieldFull}`}>
              <span className={styles.infoLabel}>Support Needed</span>
              <span className={styles.infoValue}>{fd.support_needed || "—"}</span>
            </div>
            <div className={`${styles.infoField} ${styles.infoFieldFull}`}>
              <span className={styles.infoLabel}>Equipment</span>
              <span className={styles.infoValue}>{fd.equipment || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (app.scheme_category === "grant") {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Grant Details</h2>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.infoGrid}>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Amount Requested</span>
              <span className={styles.infoValue}>₦{fd.amount_requested || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Expected Beneficiaries</span>
              <span className={styles.infoValue}>{fd.expected_beneficiaries || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Bank Name</span>
              <span className={styles.infoValue}>{fd.bank_name || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Account Number</span>
              <span className={styles.infoValueMono}>{fd.account_number || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>Account Name</span>
              <span className={styles.infoValue}>{fd.account_name || "—"}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoLabel}>External Declaration</span>
              <span className={styles.infoValue}>
                {fd.declared_external === "yes"
                  ? `Yes — ${fd.declaration_details}`
                  : "None declared"}
              </span>
            </div>
            <div className={`${styles.infoField} ${styles.infoFieldFull}`}>
              <span className={styles.infoLabel}>Grant Purpose</span>
              <span className={styles.infoValue}>{fd.grant_purpose || "—"}</span>
            </div>
            <div className={`${styles.infoField} ${styles.infoFieldFull}`}>
              <span className={styles.infoLabel}>Business Plan</span>
              <span className={styles.infoValue}>{fd.business_plan_desc || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── DECISION PANEL ────────────────────────────
function DecisionPanel({ app }) {
  const [note, setNote] = useState("");
  const [rejectionType, setRejectionType] = useState("");
  const [noteError, setNoteError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [decision, setDecision] = useState(null);

  const uiStatus = getUiStatus(app.status);
  const isDecided = uiStatus === "approved" || uiStatus === "rejected" || submitted;

  function handleApprove() {
    if (note.trim().length < 10) { setNoteError(true); return; }
    setNoteError(false);
    setDecision("approved");
    setSubmitted(true);
  }

  function handleReject() {
    if (note.trim().length < 10) { setNoteError(true); return; }
    if (!rejectionType) return;
    setNoteError(false);
    setDecision("rejected");
    setSubmitted(true);
  }

  if (isDecided) {
    const finalStatus = decision || uiStatus;
    const finalNote = note || app.reviewer_notes;
    const isApproved = finalStatus === "approved";

    return (
      <div className={styles.decisionCard}>
        <div className={styles.decisionHeader}>
          <h3 className={styles.decisionTitle}>Decision</h3>
          <p className={styles.decisionSubtitle}>This application has been decided</p>
        </div>
        <div className={styles.decisionBody}>
          <div
            className={`${styles.resultBanner} ${
              isApproved ? styles.resultBannerApproved : styles.resultBannerRejected
            }`}
          >
            <div
              className={`${styles.resultBannerLabel} ${
                isApproved ? styles.resultBannerLabelApproved : styles.resultBannerLabelRejected
              }`}
            >
              {isApproved ? "✓ Approved" : "✕ Rejected"}
            </div>
            {app.rejection_reason && (
              <div className={styles.resultBannerNote}>
                Reason: {app.rejection_reason}
              </div>
            )}
            {finalNote && (
              <div className={styles.resultBannerNote}>{finalNote}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.decisionCard}>
      <div className={styles.decisionHeader}>
        <h3 className={styles.decisionTitle}>Admin Decision</h3>
        <p className={styles.decisionSubtitle}>
          Review the application and make a decision
        </p>
      </div>
      <div className={styles.decisionBody}>
        <div>
          <label className={styles.decisionLabel}>
            Rejection Type{" "}
            <span style={{ color: "#94a3b8", fontWeight: 400 }}>
              (required if rejecting)
            </span>
          </label>
          <select
            className={styles.rejectionSelect}
            value={rejectionType}
            onChange={(e) => setRejectionType(e.target.value)}
          >
            <option value="">— Select reason —</option>
            <option value="Duplication">Duplication</option>
            <option value="False Declaration">False Declaration</option>
            <option value="Does Not Meet Criteria">Does Not Meet Criteria</option>
          </select>
        </div>

        <div className={styles.divider} />

        <div>
          <label className={styles.decisionLabel}>
            Admin Note{" "}
            <span style={{ color: "#94a3b8", fontWeight: 400 }}>
              (min. 10 characters)
            </span>
          </label>
          <textarea
            className={`${styles.noteTextarea} ${noteError ? styles.noteError : ""}`}
            placeholder="Add a note explaining your decision..."
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (e.target.value.trim().length >= 10) setNoteError(false);
            }}
          />
          <div className={`${styles.noteHint} ${noteError ? styles.noteHintError : ""}`}>
            {noteError
              ? "Note must be at least 10 characters"
              : `${note.trim().length} / 10 minimum`}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.decisionButtons}>
          <button
            className={styles.btnApprove}
            onClick={handleApprove}
            disabled={note.trim().length < 10}
          >
            Approve Application
          </button>
          <button
            className={styles.btnReject}
            onClick={handleReject}
            disabled={note.trim().length < 10 || !rejectionType}
          >
            Reject Application
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────
export default function ApplicationDetailPage({ params }) {
  const { id } = use(params);
  const app = applications.find((a) => a.id === id);

  // Get full student record for NIN and extra fields
  const student = students.find((s) => s.id === app?.student?.id);

  if (!app) {
    return (
      <div className={styles.page}>
        <Link href="/admin/applications" className={styles.backLink}>
          <ArrowLeft size={14} />
          Back to Applications
        </Link>
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <div className={styles.emptyTitle}>Application not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* Back */}
      <Link href="/admin/applications" className={styles.backLink}>
        <ArrowLeft size={14} />
        Back to Applications
      </Link>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>{app.id}</h1>
          <div className={styles.pageMeta}>
            <span>{app.student.firstname} {app.student.lastname}</span>
            <span className={styles.pageMetaDot}>·</span>
            <span>{app.scheme_name}</span>
            <span className={styles.pageMetaDot}>·</span>
            <span>Submitted {formatDate(app.submission_date)}</span>
          </div>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {/* Stepper */}
      <Stepper status={app.status} />

      {/* Flag banner */}
      {app.has_conflict && (
        <div className={styles.flagBanner}>
          <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className={styles.flagBannerLabel}>Conflict Detected</div>
            <div className={styles.flagBannerText}>
              This application has been flagged for a double-dip conflict.
              {app.form_data?.declared_external === "yes" &&
                ` Declared external award: ${app.form_data.declaration_details}`}
            </div>
          </div>
        </div>
      )}

      {/* Body grid */}
      <div className={styles.bodyGrid}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Personal Info */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Personal Information</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoGrid}>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Full Name</span>
                  <span className={styles.infoValue}>
                    {app.student.firstname} {app.student.lastname}
                  </span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>NIN Hash</span>
                  <span className={styles.infoValueMono}>
                    {student?.nin_hash || "—"}
                  </span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>LGA</span>
                  <span className={styles.infoValue}>{app.student.lga}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Ward</span>
                  <span className={styles.infoValue}>{app.student.ward}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{app.student.email}</span>
                </div>
                <div className={styles.infoField}>
                  <span className={styles.infoLabel}>Gender</span>
                  <span className={styles.infoValue}>
                    {student?.gender
                      ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic form data */}
          <FormDataSection app={app} />

        </div>

        {/* Right — decision panel */}
        <DecisionPanel app={app} />
      </div>
    </div>
  );
}