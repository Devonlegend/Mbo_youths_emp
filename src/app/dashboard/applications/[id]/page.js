"use client";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  GraduationCap, Briefcase, Wrench, Banknote,
  ArrowLeft, CheckCircle2, Clock,
  XCircle, AlertCircle, FileText,
} from "lucide-react";
import styles from "./page.module.css";
import LoadingSpinner from "../../components/LoadingSpinner";
import { getApplication } from "@/services";

const statusMap = {
  submitted:          "pending",
  eligibility_check:  "pending",
  document_review:    "pending",
  shortlisted:        "pending",
  double_dip_flag:    "flagged",
  approved:           "approved",
  rejected:           "rejected",
  withdrawn:          "rejected",
  draft:              "pending",
};

const categoryConfig = {
  scholarship: { label: "Scholarship", color: "green",  icon: GraduationCap },
  vocational:  { label: "Training",    color: "blue",   icon: Wrench        },
  empowerment: { label: "Empowerment", color: "amber",  icon: Briefcase     },
  grant:       { label: "Grant",       color: "purple", icon: Banknote      },
};

const colorMap = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  amber:  { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce" },
};

const STEPS = ["Submitted", "Verified", "Review", "Decision"];

// ── Map form_data fields into display sections based on category ──────────────
function buildFields(schemeType, formData) {
  if (!formData || Object.keys(formData).length === 0) return [];

  const fd = formData;

  const declaration = {
    section: "Self-Declaration",
    items: [
      {
        label: "Received External Support",
        value: fd.declared_external === "yes"
          ? `Yes — ${fd.declaration_details || ""}`
          : "No",
      },
    ],
  };

  const bankDetails = (fd.bank_name || fd.account_number || fd.account_name) ? {
    section: "Bank Details",
    items: [
      { label: "Bank Name",       value: fd.bank_name       || "—" },
      { label: "Account Number",  value: fd.account_number  || "—" },
      { label: "Account Name",    value: fd.account_name    || "—" },
    ],
  } : null;

  if (schemeType === "scholarship") {
    return [
      {
        section: "Academic Information",
        items: [
          { label: "Institution Name",      value: fd.institution    || "—" },
          { label: "Level of Study",        value: fd.level          || "—" },
          { label: "Department / Course",   value: fd.department     || "—" },
          { label: "Current Level / Year",  value: fd.current_level  || "—" },
          { label: "Matriculation Number",  value: fd.matric_number  || "—" },
          { label: "CGPA / Last Score",     value: fd.cgpa           || "—" },
        ],
      },
      ...(bankDetails ? [bankDetails] : []),
      declaration,
    ];
  }

  if (schemeType === "grant") {
    return [
      {
        section: "Grant Details",
        items: [
          { label: "Grant Purpose",          value: fd.grant_purpose          || "—" },
          { label: "Business Plan Summary",  value: fd.business_plan_desc     || "—" },
          { label: "Amount Requested",       value: fd.amount_requested       || "—" },
          { label: "Expected Beneficiaries", value: fd.expected_beneficiaries || "—" },
        ],
      },
      ...(bankDetails ? [bankDetails] : []),
      declaration,
    ];
  }

  if (schemeType === "vocational") {
    return [
      {
        section: "Training Details",
        items: [
          { label: "Training Applied For",    value: fd.training_name    || "—" },
          { label: "Highest Education Level", value: fd.education_level  || "—" },
          { label: "Prior Experience",        value: fd.prior_experience || "—" },
          { label: "Career Goal",             value: fd.career_goal      || "—" },
          { label: "Availability",            value: fd.availability     || "—" },
        ],
      },
      declaration,
    ];
  }

  if (schemeType === "empowerment") {
    return [
      {
        section: "Business / Trade Information",
        items: [
          { label: "Trade / Skill",       value: fd.trade             || "—" },
          { label: "Current Status",      value: fd.current_status    || "—" },
          { label: "Support Needed",      value: fd.support_needed    || "—" },
          { label: "Equipment List",      value: fd.equipment         || "—" },
          { label: "Business Location",   value: fd.business_location || "—" },
        ],
      },
      declaration,
    ];
  }

  return [declaration];
}

function StatusBadge({ status }) {
  const map = {
    approved: { cls: styles.st_approved, icon: <CheckCircle2 size={12} strokeWidth={2.5} />, label: "Approved" },
    pending:  { cls: styles.st_pending,  icon: <Clock        size={12} strokeWidth={2.5} />, label: "Pending"  },
    flagged:  { cls: styles.st_flagged,  icon: <AlertCircle  size={12} strokeWidth={2.5} />, label: "Flagged"  },
    rejected: { cls: styles.st_rejected, icon: <XCircle      size={12} strokeWidth={2.5} />, label: "Rejected" },
  };
  const s = map[status] || map.pending;
  return <span className={`${styles.statusTag} ${s.cls}`}>{s.icon} {s.label}</span>;
}

function Stepper({ step, status }) {
  return (
    <div className={styles.stepper}>
      {STEPS.map((label, i) => {
        const done     = status === "approved" || i < step;
        const active   = i === step - 1 && status !== "approved";
        const flagged  = active && status === "flagged";
        const rejected = i === step - 1 && status === "rejected";
        return (
          <div key={label} className={styles.stepWrap}>
            <div className={styles.stepRow}>
              <div className={`${styles.stepDot}
                ${done     ? styles.dotDone   : ""}
                ${flagged  ? styles.dotFlag   : ""}
                ${rejected ? styles.dotReject : ""}
              `}>
                {done ? "✓" : flagged ? "!" : rejected ? "✕" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`${styles.stepLine} ${done ? styles.lineDone : ""}`} />
              )}
            </div>
            <div className={`${styles.stepLabel}
              ${done     ? styles.labelDone   : ""}
              ${flagged  ? styles.labelFlag   : ""}
              ${rejected ? styles.labelReject : ""}
            `}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [app,     setApp]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res  = await getApplication(params.id);
        if (cancelled) return;
        const data = res.data;

        const catKey  = (data.scheme_type || "scholarship").toLowerCase();
        const config  = categoryConfig[catKey] || categoryConfig.scholarship;
        const uiStatus = statusMap[data.status] || "pending";

        const date = data.submission_date
          ? new Date(data.submission_date).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })
          : "—";

        // Step position based on status
        const stepMap = {
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

        setApp({
          id:              data.id,
          title:           data.scheme_name   || "Programme Application",
          category:        config.label,
          categoryColor:   config.color,
          icon:            config.icon,
          date,
          status:          uiStatus,
          step:            stepMap[data.status] || 1,
          flagNote:        data.has_conflict
            ? "A conflict was detected with an existing award. Under admin review — no action needed from you at this time."
            : "Under admin review. No action needed from you at this time.",
          rejectionReason: data.rejection_reason  || "",
          reviewerNotes:   data.reviewer_notes    || "",
          fields:          buildFields(catKey, data.form_data || {}),
        });

      } catch {
        if (!cancelled) setError("Failed to load application. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id]);

  if (loading) return <LoadingSpinner fullPage />;

  if (error) return (
    <div className={styles.notFound}>
      <AlertCircle size={24} color="#f87171" strokeWidth={1.5} />
      <p style={{ color: "#ef4444" }}>{error}</p>
      <button className={styles.backBtn} onClick={() => router.push("/dashboard/applications")}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to Applications
      </button>
    </div>
  );

  if (!app) return (
    <div className={styles.notFound}>
      <p>Application not found.</p>
      <button className={styles.backBtn} onClick={() => router.push("/dashboard/applications")}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to Applications
      </button>
    </div>
  );

  const c    = colorMap[app.categoryColor] || colorMap.green;
  const Icon = app.icon;

  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/dashboard/applications")}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to Applications
      </button>

      {/* HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.iconWrap} style={{ background: c.bg, border: `1.5px solid ${c.border}` }}>
          <Icon size={20} color={c.text} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className={styles.title}>{app.title}</h1>
          <p className={styles.sub}>Submitted {app.date}</p>
        </div>
      </div>

      {/* STEPPER */}
      <Stepper step={app.step} status={app.status} />

      {/* STATUS NOTES */}
      {app.status === "flagged" && (
        <div className={styles.flagNote}>
          <AlertCircle size={15} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{app.flagNote}</span>
        </div>
      )}
      {app.status === "rejected" && app.rejectionReason && (
        <div className={styles.rejectNote}>
          <XCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div className={styles.rejectLabel}>Reason for rejection</div>
            <div className={styles.rejectText}>{app.rejectionReason}</div>
          </div>
        </div>
      )}

      {/* SUBMITTED FIELDS */}
      <div className={styles.fieldsWrap}>
        <h2 className={styles.fieldsTitle}>Submitted Information</h2>
        <p className={styles.fieldsSub}>
          Read-only. This is exactly what was submitted on {app.date}.
        </p>

        {app.fields.length === 0 ? (
          <div style={{ padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>
            Form data not yet available. Check back once the backend stores submitted fields.
          </div>
        ) : (
          <div className={styles.sections}>
            {app.fields.map((sec, si) => (
              <div key={si} className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionNum}>{si + 1}</span>
                  <h3 className={styles.sectionTitle}>{sec.section}</h3>
                </div>
                <div className={styles.fieldGrid}>
                  {sec.items.map((item, ii) => (
                    <div
                      key={ii}
                      className={`${styles.fieldItem} ${item.value?.length > 80 ? styles.fieldItemFull : ""}`}
                    >
                      <div className={styles.fieldLabel}>{item.label}</div>
                      {item.type === "file" ? (
                        <div className={styles.fileChip}>
                          <FileText size={14} color="#15803d" />
                          <span className={styles.fileName}>{item.value}</span>
                        </div>
                      ) : (
                        <div className={styles.fieldValue}>{item.value}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.attestConfirm}>
          <CheckCircle2 size={14} color="#15803d" />
          <span>Applicant confirmed the accuracy of all information at time of submission.</span>
        </div>
      </div>

    </div>
  );
}