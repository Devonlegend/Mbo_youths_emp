"use client";
import { useRouter, useParams } from "next/navigation";
import {
  GraduationCap, Briefcase, Wrench, Banknote,
  ArrowLeft, Download, CheckCircle2, Clock,
  XCircle, AlertCircle, ShieldCheck, FileText,
  Calendar, MapPin, User, Hash,
} from "lucide-react";
import styles from "./page.module.css";

/* ── MOCK DATA (mirrors applications list + full form fields) ── */
const applications = [
  {
    id: 1,
    title: "2026/2027 University Scholarship Award",
    category: "Scholarship",
    categoryColor: "green",
    icon: GraduationCap,
    date: "14 May 2026",
    refCode: "RMHCDT-SCH-2026-0014",
    status: "flagged",
    step: 2,
    flagNote: "Under admin review. No action needed from you at this time. You will be notified once a decision is made.",
    fields: [
      { section: "Academic Information", items: [
        { label: "Institution Name",        value: "University of Uyo" },
        { label: "Level of Study",          value: "Undergraduate (BSc)" },
        { label: "Department / Course",     value: "Computer Science" },
        { label: "Current Level / Year",    value: "300 Level" },
        { label: "Matriculation Number",    value: "UU/2022/001234" },
        { label: "CGPA / Last Score",       value: "4.21 / 5.0" },
      ]},
      { section: "Supporting Documents", items: [
        { label: "Last Academic Result",    value: "result_300l.pdf", type: "file" },
        { label: "Admission Letter",        value: "admission_2026.pdf", type: "file" },
      ]},
      { section: "Self-Declaration", items: [
        { label: "Received External Support", value: "No" },
      ]},
    ],
  },
  {
    id: 2,
    title: "2026 SME Business Startup Grant",
    category: "Grant",
    categoryColor: "purple",
    icon: Banknote,
    date: "2 Apr 2026",
    refCode: "RMHCDT-GRT-2026-0005",
    status: "approved",
    step: 4,
    certificateUrl: "#",
    fields: [
      { section: "Grant Details", items: [
        { label: "Grant Purpose",           value: "To purchase production equipment for a small-scale garment manufacturing business serving the Mbo LGA market." },
        { label: "Business Plan Summary",   value: "A garment manufacturing SME producing school uniforms and traditional attire. Revenue model based on local school contracts and retail. Projected break-even in 6 months." },
        { label: "Amount Requested",        value: "₦500,000" },
        { label: "Expected Beneficiaries",  value: "12 community members" },
      ]},
      { section: "Business Plan Document", items: [
        { label: "Business Plan",           value: "business_plan_2026.pdf", type: "file" },
      ]},
      { section: "Self-Declaration", items: [
        { label: "Received External Support", value: "No" },
      ]},
    ],
  },
  {
    id: 3,
    title: "Digital Skills Training 2026",
    category: "Training",
    categoryColor: "blue",
    icon: Wrench,
    date: "20 May 2026",
    refCode: "RMHCDT-TRN-2026-0031",
    status: "pending",
    step: 1,
    fields: [
      { section: "Training Details", items: [
        { label: "Training Applied For",    value: "Web Development" },
        { label: "Highest Education Level", value: "BSc / BA" },
        { label: "Prior Experience",        value: "Basic HTML and CSS from self-study. Built a personal portfolio site." },
        { label: "Career Goal",             value: "To become a full-stack developer and build digital products for local businesses in Akwa Ibom State." },
        { label: "Availability",            value: "Full-time" },
      ]},
      { section: "Self-Declaration", items: [
        { label: "Received External Support", value: "No" },
      ]},
    ],
  },
  {
    id: 4,
    title: "Youth Empowerment Starter Pack 2026",
    category: "Empowerment",
    categoryColor: "amber",
    icon: Briefcase,
    date: "10 Mar 2026",
    refCode: "RMHCDT-EMP-2026-0009",
    status: "rejected",
    step: 4,
    rejectionReason: "Applicant did not meet the residency requirement for Mbo LGA as of the 2026 cycle cut-off date. You may re-apply in the next cycle if eligibility conditions are met.",
    fields: [
      { section: "Business / Trade Information", items: [
        { label: "Trade / Skill",           value: "Tailoring" },
        { label: "Current Status",          value: "Just starting out" },
        { label: "Support Needed",          value: "Industrial sewing machine, overlocker, and initial fabric stock to begin production." },
        { label: "Equipment List",          value: "Industrial sewing machine, Overlocker, Cutting table" },
        { label: "Business Location",       value: "Eket Market, Mbo LGA" },
      ]},
      { section: "Self-Declaration", items: [
        { label: "Received External Support", value: "Yes — NDDC Grant, 2024" },
      ]},
    ],
  },
];

const STEPS = ["Submitted", "Verified", "Review", "Decision"];

const colorMap = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  amber:  { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce" },
};

function StatusBadge({ status }) {
  const map = {
    approved: { cls: styles.st_approved, icon: <CheckCircle2 size={12} strokeWidth={2.5} />, label: "Approved"  },
    pending:  { cls: styles.st_pending,  icon: <Clock size={12} strokeWidth={2.5} />,        label: "Pending"   },
    flagged:  { cls: styles.st_flagged,  icon: <AlertCircle size={12} strokeWidth={2.5} />,  label: "Flagged"   },
    rejected: { cls: styles.st_rejected, icon: <XCircle size={12} strokeWidth={2.5} />,      label: "Rejected"  },
  };
  const s = map[status];
  return <span className={`${styles.statusTag} ${s.cls}`}>{s.icon} {s.label}</span>;
}

function Stepper({ step, status }) {
  return (
    <div className={styles.stepper}>
      {STEPS.map((label, i) => {
        const done    = status === "approved" || i < step;
        const active  = i === step - 1 && status !== "approved";
        const flagged = active && status === "flagged";
        const rejected = i === step - 1 && status === "rejected";
        return (
          <div key={label} className={styles.stepWrap}>
            <div className={styles.stepRow}>
              <div className={`${styles.stepDot}
                ${done ? styles.dotDone : ""}
                ${flagged ? styles.dotFlag : ""}
                ${rejected ? styles.dotReject : ""}
              `}>
                {done ? "✓" : flagged ? "!" : rejected ? "✕" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`${styles.stepLine} ${done ? styles.lineDone : ""}`} />
              )}
            </div>
            <div className={`${styles.stepLabel}
              ${done ? styles.labelDone : ""}
              ${flagged ? styles.labelFlag : ""}
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
  const app = applications.find((a) => a.id === Number(params.id));

  if (!app) {
    return (
      <div className={styles.notFound}>
        <p>Application not found.</p>
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/applications")}>
          <ArrowLeft size={15} strokeWidth={2} /> Back to Applications
        </button>
      </div>
    );
  }

  const c = colorMap[app.categoryColor];
  const Icon = app.icon;

  return (
  <div className={styles.page}>

    {/* BACK */}
<button className={styles.backBtn} onClick={() => router.push("/dashboard/applications")}>
  <ArrowLeft size={15} strokeWidth={2} /> Back to Applications
</button>

{/* SIMPLE HEADER */}
<div className={styles.pageHeader}>
  <div className={styles.iconWrap} style={{ background: c.bg, border: `1.5px solid ${c.border}` }}>
    <Icon size={20} color={c.text} strokeWidth={1.8} />
  </div>
  <div>
    <h1 className={styles.title}>{app.title}</h1>
    <p className={styles.sub}>Submitted {app.date} · Ref: {app.refCode}</p>
  </div>
</div>

    {/* STEPPER */}

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

    {/* DOWNLOAD */}
    {app.status === "approved" && (
      <div className={styles.actionsRow}>
        <button className={styles.downloadBtn}>
          <Download size={14} strokeWidth={2} /> Download Certificate
        </button>
      </div>
    )}

    {/* SUBMITTED FIELDS */}
    <div className={styles.fieldsWrap}>
      <h2 className={styles.fieldsTitle}>Submitted Information</h2>
      <p className={styles.fieldsSub}>Read-only. This is exactly what was submitted on {app.date}.</p>

      <div className={styles.sections}>
        {app.fields.map((sec, si) => (
          <div key={si} className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>{si + 1}</span>
              <h3 className={styles.sectionTitle}>{sec.section}</h3>
            </div>
            <div className={styles.fieldGrid}>
              {sec.items.map((item, ii) => (
                <div key={ii} className={`${styles.fieldItem} ${item.value?.length > 80 ? styles.fieldItemFull : ""}`}>
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

      <div className={styles.attestConfirm}>
        <CheckCircle2 size={14} color="#15803d" />
        <span>Applicant confirmed the accuracy of all information at time of submission.</span>
      </div>
    </div>

  </div>
);
}