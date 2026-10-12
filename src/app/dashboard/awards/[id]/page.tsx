"use client";
// ─────────────────────────────────────────────────────────────────────────────
// SCHOLARSHIP DETAIL — one multi-year award, seen by the student.
//
// Data:    GET  /awards/{id}/          (award + installments + pending_appeal)
// Actions: POST /awards/{id}/renew/    (multipart: cgpa, cgpa_scale, level, transcript)
//          POST /awards/{id}/appeal/   (multipart: reason, evidence)
//
// What the student sees depends on the award and its CURRENT (latest) year:
//   active    + year is pending_renewal      → renewal form
//   active    + any other year status        → a short status notice
//   suspended + appeal already pending       → "appeal under review"
//   suspended + no appeal yet                → reason banner + appeal form
//   graduated / terminated                   → read-only message
// The timeline of all years is always shown below.
//
// After every successful submit we RE-FETCH the award so the page never shows
// a stale status.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, GraduationCap, CheckCircle2, ShieldAlert, XCircle, AlertCircle,
  Clock, FileSearch, Banknote, UploadCloud, FileText, Trash2, Loader2, Send,
  type LucideIcon,
} from "lucide-react";
import { isAxiosError } from "axios";
import styles from "./page.module.css";
import LoadingSpinner from "../../components/LoadingSpinner";
import { getAward, renewAward, submitAwardAppeal } from "@/services";
import type { UUID } from "@/types/common";
import type { Award, AwardStatus, CgpaScale, Installment, InstallmentStatus } from "@/types/award";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, same limit as the application form

// Level the student is ENTERING this year (the verifier sees this).
const LEVEL_OPTIONS = ["100", "200", "300", "400", "500", "600", "Postgraduate"];

// After this many rejected renewals the year is cancelled (backend rule).
const MAX_RESUBMISSIONS = 2;

// ── Award status chip ────────────────────────────────────────────────────────
const awardStatusConfig: Record<AwardStatus, { label: string; cls: string; icon: LucideIcon }> = {
  active:     { label: "Active",     cls: "st_active",     icon: CheckCircle2  },
  suspended:  { label: "Suspended",  cls: "st_suspended",  icon: ShieldAlert   },
  graduated:  { label: "Graduated",  cls: "st_graduated",  icon: GraduationCap },
  terminated: { label: "Terminated", cls: "st_terminated", icon: XCircle       },
};

// ── Installment (one year) status, used by the timeline ──────────────────────
const installmentConfig: Record<InstallmentStatus, { label: string; cls: string; icon: LucideIcon }> = {
  pending_renewal:      { label: "Renewal due",  cls: "ist_due",       icon: Clock        },
  pending_verification: { label: "Under review", cls: "ist_review",    icon: FileSearch   },
  approved:             { label: "Approved",     cls: "ist_approved",  icon: CheckCircle2 },
  disbursed:            { label: "Paid",         cls: "ist_paid",      icon: Banknote     },
  withheld:             { label: "Withheld",     cls: "ist_withheld",  icon: ShieldAlert  },
  cancelled:            { label: "Cancelled",    cls: "ist_cancelled", icon: XCircle      },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatNaira(amount: string | number): string {
  return `₦${Number(amount).toLocaleString()}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function yearsWord(n: number): string {
  return n === 1 ? "year" : "years";
}

// `current_year_index` counts years already PAID, so the year in progress is +1.
function yearLabel(award: Award): string {
  const total = Math.max(award.total_years, 1);
  if (award.status === "graduated")  return `Completed all ${total} ${yearsWord(total)}`;
  if (award.status === "terminated") return `${award.current_year_index} of ${total} ${yearsWord(total)} paid`;
  return `Year ${Math.min(award.current_year_index + 1, total)} of ${total}`;
}

// Turns whatever the API sent back into one readable message.
//   { error: "..." }           → business-rule problem (HTTP 400)
//   { cgpa: ["..."] }          → field validation error from DRF
function getApiMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback;
  const data: unknown = err.response?.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string")   return d.error;
    if (typeof d.detail === "string")  return d.detail;
    if (typeof d.message === "string") return d.message;
    const firstField = Object.entries(d).find(([, v]) => Array.isArray(v) && v.length > 0);
    if (firstField) return `${firstField[0]}: ${String((firstField[1] as unknown[])[0])}`;
  }
  return fallback;
}

// ── FILE PICKER (shared by the renewal and appeal forms) ─────────────────────
// Same look as the upload field on the application form.
interface FilePickerProps {
  file: File | null;
  onPick: (file?: File) => void;
  onRemove: () => void;
  hasError?: boolean;
}

function FilePicker({ file, onPick, onRemove, hasError }: FilePickerProps) {
  if (!file) {
    return (
      <label className={`${styles.uploadArea} ${hasError ? styles.uploadError : ""}`}>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => onPick(e.target.files?.[0])}
          style={{ display: "none" }}
        />
        <UploadCloud size={22} color="#94a3b8" />
        <span className={styles.uploadTitle}>Click to upload</span>
        <span className={styles.uploadHint}>PDF, JPG or PNG · Max 5MB</span>
      </label>
    );
  }
  return (
    <div className={styles.filePreview}>
      <FileText size={18} color="#15803d" />
      <div className={styles.fileInfo}>
        <span className={styles.fileName}>{file.name}</span>
        <span className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</span>
      </div>
      <button type="button" onClick={onRemove} className={styles.fileRemove} aria-label="Remove file">
        <Trash2 size={14} color="#ef4444" />
      </button>
    </div>
  );
}

// ── RENEWAL FORM ─────────────────────────────────────────────────────────────
// Shown only when the award is active AND the current year is pending_renewal.
interface RenewalFormProps {
  awardId: UUID;
  installment: Installment;
  onSubmitted: () => void;
}

function RenewalForm({ awardId, installment, onSubmitted }: RenewalFormProps) {
  const [cgpa,       setCgpa]       = useState("");
  const [scale,      setScale]      = useState<CgpaScale>("5.0");
  const [level,      setLevel]      = useState("");
  const [file,       setFile]       = useState<File | null>(null);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState("");

  // The minimum CGPA is always on the 5.0 scale. If the student picks a 4.0
  // scale we convert their CGPA before comparing, exactly like the backend.
  const threshold  = Number(installment.threshold);
  const cgpaNum    = Number(cgpa);
  const cgpaValid  = cgpa.trim() !== "" && !Number.isNaN(cgpaNum) && cgpaNum >= 0 && cgpaNum <= Number(scale);
  const normalized = cgpaValid ? (cgpaNum * 5) / Number(scale) : null;

  // SOFT check only: we warn but never block. The backend decides (it may
  // withhold the year), and the student can then appeal.
  const belowThreshold = normalized !== null && threshold > 0 && normalized < threshold;

  // This year was sent back by a verifier (resubmission_count goes up on each).
  const wasReturned   = installment.resubmission_count > 0;
  const attemptsLeft  = Math.max(MAX_RESUBMISSIONS - installment.resubmission_count, 0);

  function pickFile(f?: File) {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setErrors((er) => ({ ...er, transcript: "File must not exceed 5MB." }));
      return;
    }
    setFile(f);
    setErrors((er) => ({ ...er, transcript: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!cgpaValid)  e.cgpa = `Enter a CGPA between 0 and ${scale}.`;
    if (!level)      e.level = "Select the level you are entering.";
    if (!file)       e.transcript = "Please attach your transcript.";
    return e;
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    setApiError("");
    try {
      // multipart: the backend reads these four parts by name
      const body = new FormData();
      body.append("cgpa", cgpa.trim());
      body.append("cgpa_scale", scale);
      body.append("level", level);
      if (file) body.append("transcript", file);

      await renewAward(awardId, body);
      onSubmitted(); // parent re-fetches; this form disappears when the year becomes pending_verification
    } catch (err) {
      // Keep the form open (and the chosen file in memory) so nothing is lost.
      setApiError(getApiMessage(err, "Could not submit your renewal. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Renew for {installment.cycle?.name}</h2>
      <p className={styles.cardSub}>
        {threshold > 0
          ? `You need a CGPA of at least ${installment.threshold} (on a 5.0 scale) to renew.`
          : "There is no minimum CGPA for this renewal."}
      </p>

      {/* Returned by a verifier: show why, and how many tries are left */}
      {wasReturned && (
        <div className={`${styles.note} ${styles.note_action}`}>
          {/* one <span> so the flex layout of .note keeps this as a single block of text */}
          <span>
            <strong>Your last submission was returned.</strong>{" "}
            {installment.verifier_note || "Please check your details and submit again."}{" "}
            You have {attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"} left.
          </span>
        </div>
      )}

      {apiError && (
        <div className={`${styles.note} ${styles.note_danger}`}>
          <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{apiError}</span>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>
              CGPA <span className={styles.req}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={`${styles.input} ${errors.cgpa ? styles.inputError : ""}`}
              placeholder="e.g. 3.85"
              value={cgpa}
              onChange={(e) => { setCgpa(e.target.value); setErrors((er) => ({ ...er, cgpa: "" })); }}
            />
            {errors.cgpa && <span className={styles.error}>{errors.cgpa}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>CGPA scale</label>
            <select
              className={styles.input}
              value={scale}
              onChange={(e) => { setScale(e.target.value as CgpaScale); setErrors((er) => ({ ...er, cgpa: "" })); }}
            >
              <option value="5.0">Out of 5.0</option>
              <option value="4.0">Out of 4.0</option>
            </select>
          </div>
        </div>

        {/* Helper: shows the converted value when the 4.0 scale is chosen */}
        {normalized !== null && scale === "4.0" && (
          <span className={styles.hint}>
            That is {normalized.toFixed(2)} on the 5.0 scale used for the minimum.
          </span>
        )}

        {/* Soft warning: below the minimum, but submitting is still allowed */}
        {belowThreshold && (
          <div className={`${styles.note} ${styles.note_action}`}>
            <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Your CGPA is below the minimum of {installment.threshold} (5.0 scale). You can still
              submit, but this renewal may be withheld and your scholarship suspended. You would then
              be able to appeal.
            </span>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>
            Level you are entering <span className={styles.req}>*</span>
          </label>
          <select
            className={`${styles.input} ${errors.level ? styles.inputError : ""}`}
            value={level}
            onChange={(e) => { setLevel(e.target.value); setErrors((er) => ({ ...er, level: "" })); }}
          >
            <option value="">Select level</option>
            {LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>{l === "Postgraduate" ? l : `${l} level`}</option>
            ))}
          </select>
          {errors.level && <span className={styles.error}>{errors.level}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Latest transcript <span className={styles.req}>*</span>
          </label>
          <FilePicker
            file={file}
            onPick={pickFile}
            onRemove={() => setFile(null)}
            hasError={!!errors.transcript}
          />
          {errors.transcript && <span className={styles.error}>{errors.transcript}</span>}
        </div>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting
            ? <><Loader2 size={15} className={styles.spin} /> Submitting...</>
            : <>Submit renewal <Send size={14} strokeWidth={2} /></>}
        </button>
      </form>
    </div>
  );
}

// ── APPEAL FORM ──────────────────────────────────────────────────────────────
// Shown only when the award is suspended and no appeal is pending.
interface AppealFormProps {
  awardId: UUID;
  onSubmitted: () => void;
}

function AppealForm({ awardId, onSubmitted }: AppealFormProps) {
  const [reason,     setReason]     = useState("");
  const [file,       setFile]       = useState<File | null>(null);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState("");

  function pickFile(f?: File) {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setErrors((er) => ({ ...er, evidence: "File must not exceed 5MB." }));
      return;
    }
    setFile(f);
    setErrors((er) => ({ ...er, evidence: "" }));
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!reason.trim()) { setErrors({ reason: "Please explain why you are appealing." }); return; }

    setSubmitting(true);
    setApiError("");
    try {
      const body = new FormData();
      body.append("reason", reason.trim());
      if (file) body.append("evidence", file); // evidence is optional
      await submitAwardAppeal(awardId, body);
      onSubmitted(); // parent re-fetches; pending_appeal becomes non-null
    } catch (err) {
      setApiError(getApiMessage(err, "Could not submit your appeal. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Submit an appeal</h2>
      <p className={styles.cardSub}>
        Explain what happened and attach any document that supports you. Staff will review it and
        you will be notified of the decision.
      </p>

      {apiError && (
        <div className={`${styles.note} ${styles.note_danger}`}>
          <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{apiError}</span>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>
            Reason <span className={styles.req}>*</span>
          </label>
          <textarea
            className={`${styles.textarea} ${errors.reason ? styles.inputError : ""}`}
            rows={5}
            placeholder="Tell us why your scholarship should be reinstated..."
            value={reason}
            onChange={(e) => { setReason(e.target.value); setErrors((er) => ({ ...er, reason: "" })); }}
          />
          {errors.reason && <span className={styles.error}>{errors.reason}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Supporting document (optional)</label>
          <FilePicker
            file={file}
            onPick={pickFile}
            onRemove={() => setFile(null)}
            hasError={!!errors.evidence}
          />
          {errors.evidence && <span className={styles.error}>{errors.evidence}</span>}
        </div>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting
            ? <><Loader2 size={15} className={styles.spin} /> Submitting...</>
            : <>Submit appeal <Send size={14} strokeWidth={2} /></>}
        </button>
      </form>
    </div>
  );
}

// ── TIMELINE ROW (one year) ──────────────────────────────────────────────────
function InstallmentRow({ inst, current }: { inst: Installment; current: boolean }) {
  const cfg  = installmentConfig[inst.status];
  const Icon = cfg.icon;

  // Label for the reviewer note depends on what happened to the year
  const noteLabel =
    inst.status === "pending_renewal" ? "Returned for correction"
    : inst.status === "withheld" || inst.status === "cancelled" ? "Reviewer note"
    : "Note";

  return (
    <div className={`${styles.tlItem} ${current ? styles.tlCurrent : ""}`}>
      <div className={`${styles.tlIcon} ${styles[cfg.cls]}`}>
        <Icon size={15} strokeWidth={2} />
      </div>

      <div className={styles.tlBody}>
        <div className={styles.tlHead}>
          <span className={styles.tlTitle}>Year {inst.year_index} · {inst.cycle?.name}</span>
          <span className={`${styles.tlStatus} ${styles[cfg.cls]}`}>{cfg.label}</span>
        </div>

        <div className={styles.tlMeta}>{formatNaira(inst.amount)}</div>

        {/* what the student submitted */}
        {inst.submitted_cgpa && (
          <div className={styles.tlLine}>
            Submitted CGPA {inst.submitted_cgpa} (out of {inst.submitted_cgpa_scale || "5.0"})
            {inst.submitted_level ? ` · Level ${inst.submitted_level}` : ""}
          </div>
        )}

        {inst.transcript && (
          <a className={styles.tlLink} href={inst.transcript} target="_blank" rel="noopener noreferrer">
            View transcript
          </a>
        )}

        {inst.status === "withheld" && (
          <div className={styles.tlLine}>
            Your CGPA was below the minimum of {inst.threshold} (5.0 scale).
          </div>
        )}

        {inst.status === "disbursed" && (
          <div className={styles.tlLine}>
            Paid{inst.disbursed_at ? ` on ${formatDate(inst.disbursed_at)}` : ""}
            {inst.disbursement_ref ? ` · Ref ${inst.disbursement_ref}` : ""}
          </div>
        )}

        {inst.verifier_note && (
          <div className={styles.tlNote}>
            <strong>{noteLabel}:</strong> {inst.verifier_note}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────
export default function AwardDetailPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const awardId = params.id;

  const [award,     setAward]     = useState<Award | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  // Bumping this number re-fetches the award (used after every submit).
  const [reloadKey, setReloadKey] = useState(0);
  // Green message shown after a successful renewal or appeal.
  const [notice,    setNotice]    = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await getAward(awardId);
        if (cancelled) return;
        setAward(res.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const notFound = isAxiosError(err) && err.response?.status === 404;
        setError(notFound ? "Scholarship not found." : "Failed to load this scholarship. Please try again.");
      } finally {
        // `loading` only starts true, so later re-fetches do not flash the full-page spinner.
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [awardId, reloadKey]);

  function handleSubmitted(message: string) {
    setNotice(message);
    setReloadKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── LOADING / ERROR ────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner fullPage />;

  if (error || !award) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/awards")}>
          <ArrowLeft size={15} strokeWidth={2} /> Back to My Scholarship
        </button>
        <div className={styles.empty}>
          <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
          <p style={{ color: "#ef4444", fontWeight: 600 }}>{error || "Scholarship not found."}</p>
        </div>
      </div>
    );
  }

  // ── DERIVED VALUES ─────────────────────────────────────────────────────────
  const status     = awardStatusConfig[award.status];
  const StatusIcon = status.icon;
  // Installments arrive ordered by year, so the last one is the current year.
  const latest     = award.installments[award.installments.length - 1];
  const cycleName  = latest?.cycle?.name ?? "";

  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/dashboard/awards")}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to My Scholarship
      </button>

      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <GraduationCap size={22} color="#fff" strokeWidth={2} />
        </div>
        <div className={styles.headerBody}>
          <div className={styles.headerTop}>
            <div className={styles.catTag}>Multi-year scholarship</div>
            <span className={`${styles.statusTag} ${styles[status.cls]}`}>
              <StatusIcon size={11} strokeWidth={2.5} /> {status.label}
            </span>
          </div>
          <h1 className={styles.title}>{award.scheme?.name ?? "Scholarship"}</h1>
          <p className={styles.sub}>
            {award.scheme?.provider?.name ? `${award.scheme.provider.name} · ` : ""}
            {yearLabel(award)} · {formatNaira(award.annual_amount)} / year
          </p>
        </div>
      </div>

      {/* SUCCESS MESSAGE after a submit */}
      {notice && (
        <div className={`${styles.note} ${styles.note_done}`}>
          <CheckCircle2 size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{notice}</span>
        </div>
      )}

      {/* ── ACTION AREA ── */}

      {/* ACTIVE: renewal form when this year is waiting on the student */}
      {award.status === "active" && latest?.status === "pending_renewal" && (
        <RenewalForm
          awardId={award.id}
          installment={latest}
          onSubmitted={() => handleSubmitted("Renewal submitted. We will let you know once it has been reviewed.")}
        />
      )}

      {/* ACTIVE: nothing to do, just explain where things stand */}
      {award.status === "active" && latest?.status === "pending_verification" && (
        <div className={`${styles.note} ${styles.note_waiting}`}>
          Your {cycleName} renewal is under review. You will be notified once it has been decided.
        </div>
      )}
      {award.status === "active" && latest?.status === "approved" && (
        <div className={`${styles.note} ${styles.note_done}`}>
          Your {cycleName} payment has been approved and is waiting for disbursement.
        </div>
      )}
      {award.status === "active" && latest?.status === "disbursed" && (
        <div className={`${styles.note} ${styles.note_done}`}>
          Your {cycleName} payment has been made. Your next renewal opens when the next academic year starts.
        </div>
      )}

      {/* SUSPENDED: reason first, then either "under review" or the appeal form */}
      {award.status === "suspended" && (
        <>
          <div className={`${styles.note} ${styles.note_danger}`}>
            <ShieldAlert size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong>Your scholarship is suspended.</strong>{" "}
              {award.suspended_reason || "Please contact support for details."}
              {award.suspended_at ? ` (${formatDate(award.suspended_at)})` : ""}
            </span>
          </div>

          {award.pending_appeal ? (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Appeal under review</h2>
              <p className={styles.cardSub}>
                Submitted on {formatDate(award.pending_appeal.created_at)}. You will be notified of the decision.
              </p>
              <div className={styles.appealReason}>{award.pending_appeal.reason}</div>
              {award.pending_appeal.evidence && (
                <a className={styles.tlLink} href={award.pending_appeal.evidence} target="_blank" rel="noopener noreferrer">
                  View your supporting document
                </a>
              )}
            </div>
          ) : (
            <AppealForm
              awardId={award.id}
              onSubmitted={() => handleSubmitted("Appeal submitted. Staff will review it and you will be notified.")}
            />
          )}
        </>
      )}

      {/* GRADUATED */}
      {award.status === "graduated" && (
        <div className={`${styles.note} ${styles.note_done}`}>
          Congratulations. You have completed this scholarship.
        </div>
      )}

      {/* TERMINATED */}
      {award.status === "terminated" && (
        <div className={`${styles.note} ${styles.note_muted}`}>
          <span>
            This scholarship has ended.
            {award.suspended_reason ? ` ${award.suspended_reason}` : ""}{" "}
            <button className={styles.inlineLink} onClick={() => router.push("/dashboard/help")}>
              Contact support
            </button>{" "}
            if you have questions.
          </span>
        </div>
      )}

      {/* ── TIMELINE ── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Payment years</h2>
        <p className={styles.cardSub}>One entry for each year of this scholarship.</p>

        {award.installments.length === 0 ? (
          <p className={styles.cardSub}>No payment years yet.</p>
        ) : (
          <div className={styles.timeline}>
            {award.installments.map((inst) => (
              <InstallmentRow key={inst.id} inst={inst} current={inst.id === latest?.id} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}