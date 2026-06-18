"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, User, Mail, Phone, MapPin,
  Calendar, Shield, ShieldCheck, ShieldAlert,
  ClipboardList, CheckCircle2, Clock, XCircle,
  AlertCircle, ArrowRight, Loader2, GraduationCap,
  Briefcase, Wrench, Banknote, Fingerprint, 
  FileText, Image as ImageIcon,
} from "lucide-react";
import styles from "./page.module.css";
import { getStudentById, getApplications, verifyStudent } from "@/services";

// ── STATUS CONFIG ─────────────────────────────────────────────────────────────
const statusConfig = {
  submitted:         { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  eligibility_check: { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  document_review:   { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  shortlisted:       { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  draft:             { label: "Pending",  color: "#f59e0b", bg: "#fffbeb" },
  double_dip_flag:   { label: "Flagged",  color: "#ef4444", bg: "#fef2f2" },
  approved:          { label: "Approved", color: "#15803d", bg: "#f0fdf4" },
  rejected:          { label: "Rejected", color: "#64748b", bg: "#f8fafc" },
  withdrawn:         { label: "Rejected", color: "#64748b", bg: "#f8fafc" },
};

// ── CATEGORY ICON ─────────────────────────────────────────────────────────────
const categoryIcons = {
  scholarship: GraduationCap,
  // vocational:  Wrench,
  empowerment: Briefcase,
  grant:       Banknote,
};

function getFileUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── INFO ROW ──────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className={styles.infoRow}>
      <div className={styles.infoIcon}>
        <Icon size={14} strokeWidth={1.8} />
      </div>
      <div className={styles.infoContent}>
        <span className={styles.infoLabel}>{label}</span>
        <span className={styles.infoValue}>{value || "—"}</span>
      </div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [student,       setStudent]       = useState(null);
  const [applications,  setApplications]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  // const [verifying,     setVerifying]     = useState(false);
  // const [verifyError,   setVerifyError]   = useState("");

  // ── FETCH ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Fetch student and all applications in parallel
        const [studentRes, appsRes] = await Promise.allSettled([
          getStudentById(params.id),
          getApplications(),
        ]);

        if (cancelled) return;

        if (studentRes.status === "fulfilled") {
          setStudent(studentRes.value.data);
        } else {
          setError("Failed to load student profile.");
          return;
        }

        // Filter applications belonging to this student
        if (appsRes.status === "fulfilled") {
          const allApps = Array.isArray(appsRes.value.data) ? appsRes.value.data : [];
          const studentApps = allApps.filter((a) =>
          String(a.student?.user_id) === String(params.id)
          );
          setApplications(studentApps);
        }

      } catch {
        if (!cancelled) setError("Failed to load student.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id]);

  // ── TOGGLE VERIFICATION 
// async function handleToggleVerification() {
//   setVerifying(true);
//   setVerifyError("");
//   try {
//     const res = await verifyStudent(params.id);
//     setStudent((s) => ({ ...s, is_verified: res.data.is_verified }));
//   } catch {
//     setVerifyError("Failed to update verification status.");
//   } finally {
//     setVerifying(false);
//   }
// }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (error || !student) {
    return (
      <div className={styles.centerState}>
        <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
        <p style={{ color: "#ef4444", fontWeight: 600 }}>{error || "Student not found."}</p>
        <button className={styles.backBtn} onClick={() => router.push("/admin/students")}>
          <ArrowLeft size={14} strokeWidth={2} /> Back to Students
        </button>
      </div>
    );
  }

  const initials =
    (student.firstname?.[0] || "").toUpperCase() +
    (student.lastname?.[0]  || "").toUpperCase();

  const fullName = `${student.firstname} ${student.lastname}`;

  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/admin/students")}>
        <ArrowLeft size={14} strokeWidth={2} /> Back to Students
      </button>

      {/* PAGE HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.bigAvatar}>{initials}</div>
          <div>
            <h1 className={styles.title}>{fullName}</h1>
            <p className={styles.sub}>{student.email || "—"}</p>
          </div>
        </div>

        {/* Verification toggle */}
        <div className={styles.verifyWrap}>
          <span className={`${styles.verifyBtn} ${student.is_verified ? styles.verifyBtnVerified : styles.verifyBtnUnverified}`}>
            {student.is_verified ? (
              <ShieldCheck size={14} strokeWidth={2} />
            ) : (
              <ShieldAlert size={14} strokeWidth={2} />
            )}
            {student.is_verified ? "Verified" : "Not Verified"}
          </span>
        </div>
        </div>

      {/* BODY */}
      <div className={styles.body}>

        {/* LEFT — profile details */}
        <div className={styles.leftCol}>

          {/* Personal Info Card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Personal Information</h2>
            <div className={styles.infoGrid}>
              <InfoRow icon={User}     label="Full Name"    value={fullName} />
              <InfoRow icon={Mail}     label="Email"        value={student.email} />
              <InfoRow icon={Phone}    label="Phone"        value={student.phone_number} />
              <InfoRow icon={MapPin}   label="LGA"          value={student.lga} />
              <InfoRow icon={MapPin}   label="Ward"         value={student.ward} />
              <InfoRow icon={Calendar} label="Gender"       value={
                student.gender
                  ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1)
                  : "—"
              } />
              <InfoRow icon={Fingerprint} label="NIN" value="****-****-****" />
            </div>
          </div>

          {/* Documents Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Documents</h2>
              <div className={styles.infoGrid}>

                <div className={styles.infoRow}>
                  <div className={styles.infoIcon}>
                    <FileText size={14} strokeWidth={1.8} />
                  </div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Certificate</span>
                    {student.certificate ? (
                      <a href={getFileUrl(student.certificate)} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                        View Certificate
                      </a>
                    ) : (
                      <span className={styles.infoValue}>—</span>
                    )}
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <div className={styles.infoIcon}>
                    <ImageIcon size={14} strokeWidth={1.8} />
                  </div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Passport Photo</span>
                    {student.passport ? (
                      <a href={getFileUrl(student.passport)} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                        View Passport
                      </a>
                    ) : (
                      <span className={styles.infoValue}>—</span>
                    )}
                  </div>
                </div>

              </div>
            </div>

          {/* Status Card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Account Status</h2>
            <div className={styles.infoGrid}>
              <InfoRow icon={Shield} label="Active Award" value={
                student.has_active_award ? student.active_award : "None"
              } />
              <InfoRow icon={ShieldCheck} label="Verification Status" value={
                student.is_verified ? "Verified" : "Not Verified"
              } />
            </div>
          </div>

        </div>

        {/* RIGHT — application history */}
        <div className={styles.rightCol}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>Application History</h2>
                <p className={styles.cardSub}>
                  {applications.length} application{applications.length !== 1 ? "s" : ""} this cycle
                </p>
              </div>
              <ClipboardList size={16} color="#94a3b8" strokeWidth={1.8} />
            </div>

            {applications.length === 0 ? (
              <div className={styles.emptyApps}>
                <ClipboardList size={24} color="#cbd5e1" strokeWidth={1.5} />
                <p>No applications submitted yet.</p>
              </div>
            ) : (
              <div className={styles.appList}>
                {applications.map((app) => {
                  const status   = statusConfig[app.status] || statusConfig.submitted;
                  const catKey   = (app.scheme_category || "scholarship").toLowerCase();
                  const Icon     = categoryIcons[catKey] || GraduationCap;

                  return (
                    <div key={app.id} className={styles.appItem}>
                      <div className={styles.appItemLeft}>
                        <div className={styles.appIcon}>
                          <Icon size={14} strokeWidth={1.8} color="#64748b" />
                        </div>
                        <div className={styles.appInfo}>
                          <span className={styles.appName}>
                            {app.scheme_name || "—"}
                          </span>
                          <span className={styles.appDate}>
                            {formatDate(app.submission_date)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.appItemRight}>
                        <span
                          className={styles.statusBadge}
                          style={{ color: status.color, background: status.bg }}
                        >
                          {status.label}
                        </span>
                        <button
                          className={styles.appViewBtn}
                          onClick={() => router.push(`/admin/applications/${app.id}`)}
                        >
                          <ArrowRight size={12} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}