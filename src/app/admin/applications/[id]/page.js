"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertCircle,
  ShieldAlert, FileText, User, MapPin,
  GraduationCap, Briefcase, Banknote,
  ShieldCheck, AlertTriangle, Loader2,
} from "lucide-react";
import styles from "./page.module.css";
import { getApplication, reviewApplication, getSchemeFields } from "@/services";

// ── STATUS MAPPING ────────────────────────────────────────────────────────────
const statusConfig = {
  submitted:         { label: "Pending",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  eligibility_check: { label: "Pending",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  document_review:   { label: "Pending",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  shortlisted:       { label: "Shortlisted", color: "#3b82f6", bg: "rgba(59,130,246,0.1)"  },
  draft:             { label: "Pending",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  double_dip_flag:   { label: "Flagged",     color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  approved:          { label: "Approved",    color: "#4ade80", bg: "rgba(74,222,128,0.1)"  },
  rejected:          { label: "Rejected",    color: "#64748b", bg: "rgba(100,116,139,0.1)" },
  withdrawn:         { label: "Rejected",    color: "#64748b", bg: "rgba(100,116,139,0.1)" },
};
// NOTE: "shortlisted" entry above is left in place intentionally. Existing
// applications that were shortlisted before this change (if any) still need
// a valid label/color to render. Going forward, no new application can reach
// this status since the Shortlist button below is disabled.

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#4ade80", bg: "rgba(74,222,128,0.1)",  icon: GraduationCap },
  empowerment: { label: "Empowerment", color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  icon: Briefcase     },
  grant:       { label: "Grant",       color: "#a78bfa", bg: "rgba(167,139,250,0.1)", icon: Banknote      },
};

// ── STEPPER ───────────────────────────────────────────────────────────────────
const STEPS = ["Submitted", "Verified", "Review", "Decision"];

const stepFromStatus = {
  submitted:         1,
  eligibility_check: 1,
  document_review:   2,
  shortlisted:       3,
  double_dip_flag:   2,
  approved:          4,
  rejected:          4,
  withdrawn:         4,
  draft:             1,
};

function Stepper({ step, uiStatus }) {
  const stepIcons = [CheckCircle2, ShieldCheck, FileText, CheckCircle2];

  return (
    <div className={styles.stepper}>
      {STEPS.map((label, i) => {
        const done       = i < step - 1 || uiStatus === "approved" || uiStatus === "rejected";
        const current    = i === step - 1;
        const isApproved = current && uiStatus === "approved";
        const isRejected = current && uiStatus === "rejected";
        const isFlagged  = current && uiStatus === "flagged";
        const Icon       = stepIcons[i];

        return (
          <div key={label} className={styles.stepWrap}>
            <div className={`${styles.stepPill}
              ${done                                                 ? styles.pillDone     : ""}
              ${current && !isApproved && !isRejected && !isFlagged ? styles.pillCurrent  : ""}
              ${isApproved                                           ? styles.pillApproved : ""}
              ${isRejected                                           ? styles.pillRejected : ""}
              ${isFlagged                                            ? styles.pillFlagged  : ""}
              ${!done && !current                                    ? styles.pillPending  : ""}
            `}>
              <Icon size={13} strokeWidth={2} />
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <span className={`${styles.stepConnector} ${done ? styles.connectorDone : ""}`}>
                —
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── BUILD FORM FIELDS from details ────────────────────────────────────────────
function buildFields(schemeCategory, details, app) {
  if (!details || Object.keys(details).length === 0) return [];

  const fd = details;

  // self_declaration_received_support / self_declaration_details live on the
  // application itself, NOT inside `details` (see serialize_application() in
  // applications/serializers.py — they're top-level, sibling fields to `details`).
  const declaration = {
    section: "Self-Declaration",
    items: [{
      label: "Received External Support",
      value: app?.self_declaration_received_support
        ? `Yes — ${(app?.self_declaration_details || [])
            .map((d) => `${d.organisation} (${d.category}, ${d.year})`)
            .join(", ") || "No details provided"}`
        : "No",
    }],
  };

  const bankDetails = (fd.bank_name || fd.account_number) ? {
    section: "Bank Details",
    items: [
      { label: "Bank Name",      value: fd.bank_name      || "—" },
      { label: "Account Number", value: fd.account_number || "—" },
      { label: "Account Name",   value: fd.account_name   || "—" },
    ],
  } : null;

  if (schemeCategory === "scholarship") {
    return [
      {
        section: "Academic Information",
        items: [
          { label: "Institution Name",     value: fd.institution_name  || "—" },
          { label: "Course of Study",      value: fd.course_of_study   || "—" },
          { label: "Current Level",        value: fd.current_level     || "—" },
          { label: "CGPA",                 value: fd.cgpa              || "—" },
          { label: "Admission Year",       value: fd.admission_year    || "—" },
          { label: "Matriculation Number", value: fd.matric_number     || "—" },
        ],
      },
      ...(bankDetails ? [bankDetails] : []),
      declaration,
    ];
  }

  if (schemeCategory === "grant") {
    return [
      {
        section: "Grant Details",
        items: [
          { label: "Business Name",        value: fd.business_name        || "—" },
          { label: "Business Stage",       value: fd.business_stage       || "—" },
          { label: "Business Description", value: fd.business_description || "—" },
          { label: "Amount Requested",     value: fd.requested_amount     || "—" },
          { label: "Intended Use",         value: fd.intended_use         || "—" },
        ],
      },
      ...(bankDetails ? [bankDetails] : []),
      declaration,
    ];
  }

  if (schemeCategory === "empowerment") {
    return [
      {
        section: "Business / Trade Information",
        items: [
          { label: "Trade / Skill",     value: fd.trade_or_skill              || "—" },
          { label: "Training Provider", value: fd.training_provider           || "—" },
          { label: "Training Duration", value: fd.training_duration_months
              ? `${fd.training_duration_months} months` : "—" },
          { label: "Prior Experience",  value: fd.prior_experience            || "—" },
        ],
      },
      ...(bankDetails ? [bankDetails] : []),
      declaration,
    ];
  }

  return [declaration];
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function AdminApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [app,         setApp]         = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Decision panel state
  const [note,        setNote]        = useState("");
  const [noteError,   setNoteError]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [actionError, setActionError] = useState("");
  const [decided,     setDecided]     = useState(false);
  const [confirmModal,setConfirmModal]= useState(null); // "approved" | "rejected" | null
  // "shortlisted" removed from the possible values above — the Shortlist
  // button that used to set this is commented out below.

  const [schemeFields, setSchemeFields] = useState([]);

  // ── FETCH APPLICATION ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await getApplication(params.id);
        if (cancelled) return;
        setApp(res.data);

        const schemeId = res.data?.scheme?.id;
        if (schemeId) {
          try {
            const fieldsRes = await getSchemeFields(schemeId);
            if (!cancelled) setSchemeFields(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
          } catch {
            // non-fatal — Documents section just won't render
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load application.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id]);

  // ── DECISION ACTION ──────────────────────────────────────────────────────
  async function handleDecision(decision) {
    if (note.trim().length < 10) {
      setNoteError("Decision note must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    setActionError("");
    setNoteError("");

    try {
      await reviewApplication(params.id, {
        decision,
        notes: note.trim(),
      });
      setDecided(true);
      const res = await getApplication(params.id);
      setApp(res.data);
    } catch (err) {
      setActionError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Action failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────────
  if (error || !app) {
    return (
      <div className={styles.centerState}>
        <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
        <p style={{ color: "#ef4444", fontWeight: 600 }}>
          {error || "Application not found."}
        </p>
        <button
          className={styles.backBtn}
          onClick={() => router.push("/admin/applications")}
        >
          <ArrowLeft size={14} strokeWidth={2} /> Back to Applications
        </button>
      </div>
    );
  }

  // ── DERIVE DISPLAY DATA ──────────────────────────────────────────────────
  const catKey   = (app.scheme?.award_type || "scholarship").toLowerCase();
  const category = categoryConfig[catKey] || categoryConfig.scholarship;
  const Icon     = category.icon;
  const status   = statusConfig[app.status] || statusConfig.submitted;
  const uiStatus = status.label.toLowerCase();
  const step     = stepFromStatus[app.status] || 1;
  const fields   = buildFields(catKey, app.details || {}, app);
  const documentFields = schemeFields.filter((f) => f.field_type === "file");

  const isDecidable = [
    "submitted", "eligibility_check", "document_review",
    "shortlisted", "double_dip_flag",
  ].includes(app.status);

  const submissionDate = app.submission_date
    ? new Date(app.submission_date).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/admin/applications")}>
        <ArrowLeft size={14} strokeWidth={2} /> Back to Applications
      </button>

      {/* PAGE HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div
            className={styles.schemeIcon}
            style={{ background: category.bg, border: `1.5px solid ${category.color}30` }}
          >
            <Icon size={20} color={category.color} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>{app.scheme?.name || "Application"}</h1>
            <p className={styles.sub}>Submitted {submissionDate}</p>
          </div>
        </div>
        <span
          className={styles.statusBadge}
          style={{ color: status.color, background: status.bg }}
        >
          {status.label}
        </span>
      </div>

      {/* STEPPER */}
      <Stepper step={step} uiStatus={uiStatus} />

      {/* FLAG BANNER */}
      {app.status === "double_dip_flag" && (
        <div className={styles.flagBanner}>
          <ShieldAlert size={16} color="#ef4444" strokeWidth={2} style={{ flexShrink: 0 }} />
          <div>
            <p className={styles.flagBannerTitle}>Conflict Detected</p>
            <p className={styles.flagBannerSub}>
              This application has been flagged by the eligibility engine.
              A duplicate benefit conflict was detected for this NIN in the current cycle.
              Review carefully before making a decision.
            </p>
          </div>
        </div>
      )}

      {/* MAIN BODY */}
      <div className={styles.body}>

        {/* LEFT — student info + submitted fields */}
        <div className={styles.leftCol}>

          {/* Student Card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Student Information</h2>
            <div className={styles.studentGrid}>
              <div className={styles.studentField}>
                <User size={13} color="#94a3b8" strokeWidth={2} />
                <div>
                  <span className={styles.fieldLabel}>Full Name</span>
                  <span className={styles.fieldValue}>{app.student?.full_name || "—"}</span>
                </div>
              </div>
              <div className={styles.studentField}>
                <MapPin size={13} color="#94a3b8" strokeWidth={2} />
                <div>
                  <span className={styles.fieldLabel}>Ward</span>
                  <span className={styles.fieldValue}>{app.student?.ward || "—"}</span>
                </div>
              </div>
              <div className={styles.studentField}>
                <ShieldCheck size={13} color="#94a3b8" strokeWidth={2} />
                <div>
                  <span className={styles.fieldLabel}>NIN Verified</span>
                  <span
                    className={styles.fieldValue}
                    style={{ color: app.student?.nimc_verified ? "#15803d" : "#ef4444" }}
                  >
                    {app.student?.nimc_verified ? "Verified" : "Not verified"}
                  </span>
                </div>
              </div>
              <div className={styles.studentField}>
                <ShieldCheck size={13} color="#94a3b8" strokeWidth={2} />
                <div>
                  <span className={styles.fieldLabel}>Eligibility Check</span>
                  <span
                    className={styles.fieldValue}
                    style={{ color: app.eligibility_passed ? "#15803d" : "#ef4444" }}
                  >
                    {app.eligibility_passed ? "Passed" : "Failed"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submitted Fields */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Submitted Information</h2>
            <p className={styles.cardSub}>Read-only. Exactly as submitted by the applicant.</p>

            {fields.length === 0 ? (
              <div className={styles.noFormData}>
                <FileText size={22} color="#cbd5e1" strokeWidth={1.5} />
                <p>No form data available for this application.</p>
              </div>
            ) : (
              <div className={styles.sections}>
                {fields.map((sec, si) => (
                  <div key={si} className={styles.section}>
                    <div className={styles.sectionHead}>
                      <span className={styles.sectionNum}>{si + 1}</span>
                      <h3 className={styles.sectionTitle}>{sec.section}</h3>
                    </div>
                    <div className={styles.fieldGrid}>
                      {sec.items.map((item, ii) => (
                        <div
                          key={ii}
                          className={`${styles.fieldItem} ${
                            (item.value?.length || 0) > 60 ? styles.fieldItemFull : ""
                          }`}
                        >
                          <span className={styles.fieldLabel}>{item.label}</span>
                          <span className={styles.fieldValue}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Documents — only rendered when the scheme actually has file fields */}
                {documentFields.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionHead}>
                      <span className={styles.sectionNum}>{fields.length + 1}</span>
                      <h3 className={styles.sectionTitle}>Documents</h3>
                    </div>
                    <div className={styles.fieldGrid}>
                      {documentFields.map((docField) => {
                        const url = app.documents?.[docField.field_name];
                        return (
                          <div key={docField.field_name} className={styles.fieldItem}>
                            <span className={styles.fieldLabel}>{docField.field_label}</span>
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.fieldValue}
                                style={{ color: "#15803d", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                              >
                                <FileText size={13} strokeWidth={2} /> View document
                              </a>
                            ) : (
                              <span
                                className={styles.fieldValue}
                                style={{ color: docField.is_required ? "#ef4444" : "#94a3b8" }}
                              >
                                {docField.is_required ? "Not uploaded (required)" : "Not provided"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={styles.attestConfirm}>
              <CheckCircle2 size={13} color="#15803d" strokeWidth={2} />
              <span>Applicant confirmed accuracy of all information at time of submission.</span>
            </div>
          </div>

        </div>

        {/* RIGHT — decision panel */}
        <div className={styles.rightCol}>
          <div className={`${styles.card} ${styles.decisionCard}`}>

            <h2 className={styles.cardTitle}>Admin Decision</h2>
            <p className={styles.cardSub}>
              Your decision is final and will be permanently recorded.
            </p>

            {/* Already decided */}
            {!isDecidable ? (
              <div className={styles.alreadyDecided}>
                <div
                  className={styles.alreadyDecidedIcon}
                  style={{
                    background: uiStatus === "approved" ? "#f0fdf4" : "#f8fafc",
                    border: `1.5px solid ${uiStatus === "approved" ? "#bbf7d0" : "#e2e8f0"}`,
                  }}
                >
                  {uiStatus === "approved"
                    ? <CheckCircle2 size={22} color="#15803d" strokeWidth={1.8} />
                    : <XCircle size={22} color="#64748b" strokeWidth={1.8} />
                  }
                </div>
                <p className={styles.alreadyDecidedTitle}>
                  {uiStatus === "approved" ? "Application Approved" : "Application Rejected"}
                </p>
                {app.reviewer_notes && (
                  <div className={styles.reviewerNotes}>
                    <p className={styles.reviewerNotesLabel}>Decision note</p>
                    <p className={styles.reviewerNotesText}>{app.reviewer_notes}</p>
                  </div>
                )}
                {app.rejection_reason && uiStatus === "rejected" && (
                  <div className={styles.rejectionReason}>
                    <p className={styles.reviewerNotesLabel}>Rejection reason</p>
                    <p className={styles.reviewerNotesText}>{app.rejection_reason}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {decided && (
                  <div className={styles.successBanner}>
                    <CheckCircle2 size={14} color="#15803d" strokeWidth={2} />
                    Decision recorded successfully.
                  </div>
                )}

                {actionError && (
                  <div className={styles.errorBanner}>
                    <AlertCircle size={14} color="#dc2626" strokeWidth={2} />
                    {actionError}
                  </div>
                )}

                {/* Decision note */}
                <div className={styles.noteWrap}>
                  <label className={styles.noteLabel}>
                    Decision Note
                    <span className={styles.noteRequired}>Required · min 10 characters</span>
                  </label>
                  <textarea
                    className={`${styles.noteInput} ${noteError ? styles.noteInputError : ""}`}
                    rows={6}
                    placeholder="Provide a clear reason for your decision. This note is permanently recorded for audit purposes..."
                    value={note}
                    onChange={(e) => { setNote(e.target.value); setNoteError(""); }}
                  />
                  <div className={styles.noteFooter}>
                    {noteError && <span className={styles.noteError}>{noteError}</span>}
                    <span className={`${styles.noteCount} ${note.length >= 10 ? styles.noteCountOk : ""}`}>
                      {note.length} / 10 min
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className={styles.actions}>
                  <button
                    className={styles.approveBtn}
                    onClick={() => {
                      if (note.trim().length < 10) { setNoteError("Decision note must be at least 10 characters."); return; }
                      setConfirmModal("approved");
                    }}
                    disabled={submitting}
                  >
                    {submitting
                      ? <Loader2 size={15} strokeWidth={2} className={styles.spin} />
                      : <CheckCircle2 size={15} strokeWidth={2} />
                    }
                    Approve
                  </button>

                  {/* Shortlist option removed — not part of the intended design.
                  <button
                    className={styles.shortlistBtn}
                    onClick={() => {
                      if (note.trim().length < 10) { setNoteError("Decision note must be at least 10 characters."); return; }
                      setConfirmModal("shortlisted");
                    }}
                    disabled={submitting}
                  >
                    Shortlist
                  </button>
                  */}

                  <button
                    className={styles.rejectBtn}
                    onClick={() => {
                      if (note.trim().length < 10) { setNoteError("Decision note must be at least 10 characters."); return; }
                      setConfirmModal("rejected");
                    }}
                    disabled={submitting}
                  >
                    {submitting
                      ? <Loader2 size={15} strokeWidth={2} className={styles.spin} />
                      : <XCircle size={15} strokeWidth={2} />
                    }
                    Reject
                  </button>
                </div>

                <div className={styles.decisionWarning}>
                  <AlertTriangle size={12} color="#f59e0b" strokeWidth={2} />
                  <span>
                    Approved applications create a permanent beneficiary record.
                    Rejected applications are logged against the student's NIN.
                  </span>
                </div>
              </>
            )}

          </div>
        </div>

      </div>

      {/* CONFIRM MODAL */}
      {confirmModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
        }}>
          <div style={{
            background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 32, maxWidth: 400, width: "90%",
          }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--color-text)" }}>
              {confirmModal === "approved" ? "Approve Application?" : "Reject Application?"}
              {/* "shortlisted" branch removed along with the Shortlist button above */}
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 24 }}>
              This action is permanent and cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  border: "1px solid var(--color-border)", background: "var(--color-subtle)",
                  fontSize: 13, cursor: "pointer", color: "var(--color-text-secondary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { const d = confirmModal; setConfirmModal(null); handleDecision(d); }}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                  background: confirmModal === "approved" ? "#15803d" : "#ef4444",
                  /* "shortlisted" branch removed along with the Shortlist button above */
                  fontSize: 13, cursor: "pointer", color: "#fff", fontWeight: 600,
                }}
              >
                {confirmModal === "approved" ? "Yes, Approve" : "Yes, Reject"}
                {/* "shortlisted" branch removed along with the Shortlist button above */}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}