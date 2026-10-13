"use client";
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: AWARD DETAIL — one multi-year award, everything staff can do to it.
//
// Data:    GET  /awards/{id}/                       (award + installments + pending_appeal)
// Actions: POST /awards/installments/{id}/verify/   verifier + admin
//          POST /awards/installments/{id}/disburse/ ADMIN ONLY (mark a year as paid)
//          POST /awards/appeals/{id}/review/        verifier + admin
//          POST /awards/{id}/suspend/  and  /terminate/   ADMIN ONLY
//
// Rules this page follows:
//   * Admin-only buttons are HIDDEN for verifiers (not just disabled).
//   * Every action that changes money or status is a two-step confirm
//     (choose, then confirm), and the confirm text states the consequence.
//   * The server has the final say. If it refuses, its message is shown and
//     the panel stays open.
//   * After every action the award is re-fetched, so statuses are never stale.
//
// Layout copies the admin Scheme detail page (main column + side column).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Repeat, CheckCircle2, AlertCircle, ShieldAlert, XCircle, GraduationCap,
  Clock, FileSearch, Banknote, X, Loader2, Check, RotateCcw, type LucideIcon,
} from "lucide-react";
import { isAxiosError } from "axios";

import { useRoleGuard } from "@/hooks/useRoleGuard";
import styles from "./page.module.css";
import {
  getAward, verifyInstallment, disburseInstallment,
  suspendAward, terminateAward, reviewAppeal,
} from "@/services";
import type {
  Appeal, AppealDecision, Award, AwardStatus, Installment, InstallmentStatus, VerifyAction,
} from "@/types/award";

// After this many rejections the backend cancels the year and suspends the award.
const MAX_REJECTIONS = 2;

// ── Status looks ─────────────────────────────────────────────────────────────
const awardStatusConfig: Record<AwardStatus, { label: string; cls: string; icon: LucideIcon }> = {
  active:     { label: "Active",     cls: "st_active",     icon: CheckCircle2  },
  suspended:  { label: "Suspended",  cls: "st_suspended",  icon: ShieldAlert   },
  graduated:  { label: "Graduated",  cls: "st_graduated",  icon: GraduationCap },
  terminated: { label: "Terminated", cls: "st_terminated", icon: XCircle       },
};

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
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Turns whatever the API sent back into one readable message.
//   { error: "..." }   → business-rule problem (HTTP 400)
//   { note: ["..."] }  → field validation error from DRF
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

// Shared by the panels below: every panel reports success with a message.
interface PanelProps {
  onDone: (message: string) => void;
}

// ── PAY FORM: mark an approved year as paid (admin only) ─────────────────────
function PayForm({ installment, studentName, onDone }: PanelProps & { installment: Installment; studentName: string }) {
  const [open,       setOpen]       = useState(false);
  const [reference,  setReference]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  async function confirmPayment() {
    setSubmitting(true);
    setError("");
    try {
      await disburseInstallment(installment.id, { disbursement_ref: reference.trim() });
      onDone(`Marked ${formatNaira(installment.amount)} as paid to ${studentName} for ${installment.cycle.name}.`);
    } catch (err) {
      setError(getApiMessage(err, "Could not mark this payment. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  // Step 1: just a button
  if (!open) {
    return (
      <div className={styles.actionBox}>
        <button className={styles.primaryBtn} onClick={() => setOpen(true)}>
          <Banknote size={14} strokeWidth={2} /> Mark as paid
        </button>
      </div>
    );
  }

  // Step 2: reference + confirm
  return (
    <div className={styles.actionBox}>
      <label className={styles.noteLabel}>
        Payment reference <span className={styles.noteHint}>(optional, for your records)</span>
      </label>
      <input
        className={styles.input}
        placeholder="e.g. transfer or receipt number"
        value={reference}
        disabled={submitting}
        onChange={(e) => setReference(e.target.value)}
      />
      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}
      <div className={styles.confirmBox}>
        <p className={styles.confirmText}>
          Confirm that {formatNaira(installment.amount)} has been paid to {studentName} for {installment.cycle.name}.
          A payment cannot be edited afterwards.
        </p>
        <div className={styles.confirmRow}>
          <button className={styles.confirmBtn} onClick={confirmPayment} disabled={submitting}>
            {submitting ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Saving...</> : "Confirm: mark as paid"}
          </button>
          <button className={styles.cancelBtn} onClick={() => setOpen(false)} disabled={submitting} aria-label="Cancel">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── VERIFY PANEL: approve / send back / withhold a submitted renewal ─────────
// Same rules as the Renewals queue page.
function VerifyPanel({ installment, studentName, onDone }: PanelProps & { installment: Installment; studentName: string }) {
  const [note,       setNote]       = useState("");
  const [noteError,  setNoteError]  = useState("");
  const [confirm,    setConfirm]    = useState<VerifyAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  // The backend compares the 5.0-scale value with the threshold; 0 = no minimum.
  const norm      = installment.submitted_cgpa_normalized !== null ? Number(installment.submitted_cgpa_normalized) : null;
  const threshold = Number(installment.threshold);
  const below     = norm !== null && threshold > 0 && norm < threshold;

  function confirmCopy(action: VerifyAction): string {
    if (action === "approve") {
      return `Approve ${studentName}'s renewal for ${installment.cycle.name}? It will be queued for payment.`;
    }
    if (action === "reject") {
      const isLast = installment.resubmission_count + 1 >= MAX_REJECTIONS;
      return isLast
        ? `This is the last rejection allowed. The year will be CANCELLED and the scholarship SUSPENDED (the student can appeal). Continue?`
        : `Send this renewal back to ${studentName}? They will be asked to resubmit. This counts toward the limit of ${MAX_REJECTIONS}.`;
    }
    return `Withhold this year? ${studentName}'s scholarship will be SUSPENDED and they can submit an appeal.`;
  }

  function askConfirm(action: VerifyAction) {
    setError("");
    if ((action === "reject" || action === "withhold") && !note.trim()) {
      setNoteError("A note is required. The student will see it.");
      return;
    }
    setNoteError("");
    setConfirm(action);
  }

  async function submit() {
    if (!confirm) return;
    setSubmitting(true);
    setError("");
    try {
      await verifyInstallment(installment.id, { action: confirm, note: note.trim() });
      const messages: Record<VerifyAction, string> = {
        approve:  `Approved ${studentName}'s renewal for ${installment.cycle.name}. It is now waiting for payment.`,
        reject:   `Sent ${studentName}'s renewal back for correction.`,
        withhold: `Withheld ${studentName}'s renewal. Their scholarship is now suspended and they can appeal.`,
      };
      onDone(messages[confirm]);
    } catch (err) {
      setError(getApiMessage(err, "Could not save your decision. Please try again."));
      setConfirm(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.actionBox}>
      {below && (
        <div className={styles.warnBanner}>
          <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            This CGPA is below the minimum, so the server will refuse an approval. Use <strong>Withhold</strong>,
            or <strong>Send back</strong> if the numbers look wrong.
          </span>
        </div>
      )}

      <label className={styles.noteLabel}>
        Note to the student <span className={styles.noteHint}>(required to send back or withhold)</span>
      </label>
      <textarea
        className={`${styles.noteInput} ${noteError ? styles.noteInputError : ""}`}
        rows={3}
        placeholder="e.g. The transcript is unreadable. Please upload a clear copy."
        value={note}
        disabled={!!confirm || submitting}
        onChange={(e) => { setNote(e.target.value); setNoteError(""); }}
      />
      {noteError && <span className={styles.fieldError}>{noteError}</span>}

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {confirm ? (
        <div className={styles.confirmBox}>
          <p className={styles.confirmText}>{confirmCopy(confirm)}</p>
          <div className={styles.confirmRow}>
            <button
              className={confirm === "approve" ? styles.confirmBtn : confirm === "reject" ? styles.confirmBtnAmber : styles.confirmBtnRed}
              onClick={submit}
              disabled={submitting}
            >
              {submitting
                ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Saving...</>
                : confirm === "approve" ? "Confirm: approve" : confirm === "reject" ? "Confirm: send back" : "Confirm: withhold"}
            </button>
            <button className={styles.cancelBtn} onClick={() => setConfirm(null)} disabled={submitting} aria-label="Cancel">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actionRow}>
          <button className={styles.approveBtn} onClick={() => askConfirm("approve")}>
            <Check size={14} strokeWidth={2.5} /> Approve
          </button>
          <button className={styles.rejectBtn} onClick={() => askConfirm("reject")}>
            <RotateCcw size={14} strokeWidth={2} /> Send back
          </button>
          <button className={styles.withholdBtn} onClick={() => askConfirm("withhold")}>
            <ShieldAlert size={14} strokeWidth={2} /> Withhold
          </button>
        </div>
      )}
    </div>
  );
}

// ── APPEAL PANEL: uphold or reject the student's appeal ──────────────────────
function AppealPanel({ appeal, studentName, onDone }: PanelProps & { appeal: Appeal; studentName: string }) {
  const [note,       setNote]       = useState("");
  const [noteError,  setNoteError]  = useState("");
  const [confirm,    setConfirm]    = useState<AppealDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const year      = appeal.installment.year_index;
  const wasCancel = appeal.installment.status === "cancelled";

  function confirmCopy(decision: AppealDecision): string {
    if (decision === "upheld") {
      return wasCancel
        ? `Uphold this appeal? Year ${year} reopens so ${studentName} can submit their renewal again, and the scholarship becomes active.`
        : `Uphold this appeal? Year ${year} is approved WITHOUT the CGPA minimum (you are waiving the rule) and the scholarship becomes active.`;
    }
    return `Reject this appeal? The scholarship will be TERMINATED. This is permanent.`;
  }

  // Both decisions need a note: it records why, and the student is told.
  function askConfirm(decision: AppealDecision) {
    setError("");
    if (!note.trim()) {
      setNoteError("A note is required. It records why you decided this.");
      return;
    }
    setNoteError("");
    setConfirm(decision);
  }

  async function submit() {
    if (!confirm) return;
    setSubmitting(true);
    setError("");
    try {
      await reviewAppeal(appeal.id, { decision: confirm, note: note.trim() });
      onDone(
        confirm === "upheld"
          ? `Appeal upheld. ${studentName}'s scholarship is reinstated.`
          : `Appeal rejected. ${studentName}'s scholarship is terminated.`
      );
    } catch (err) {
      setError(getApiMessage(err, "Could not save your decision. Please try again."));
      setConfirm(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Appeal waiting for a decision</h2>
        <span className={styles.pendingPill}>Pending</span>
      </div>
      <p className={styles.cardSub}>
        Submitted {formatDate(appeal.created_at)} about year {year} ({appeal.installment.status}).
      </p>

      <div className={styles.quoteBox}>{appeal.reason}</div>
      {appeal.evidence ? (
        <a className={styles.link} href={appeal.evidence} target="_blank" rel="noopener noreferrer">
          Open the supporting document
        </a>
      ) : (
        <span className={styles.cellSub}>No supporting document was attached.</span>
      )}

      <label className={styles.noteLabel}>
        Your note <span className={styles.noteHint}>(required)</span>
      </label>
      <textarea
        className={`${styles.noteInput} ${noteError ? styles.noteInputError : ""}`}
        rows={3}
        placeholder="Explain your decision."
        value={note}
        disabled={!!confirm || submitting}
        onChange={(e) => { setNote(e.target.value); setNoteError(""); }}
      />
      {noteError && <span className={styles.fieldError}>{noteError}</span>}

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {confirm ? (
        <div className={styles.confirmBox}>
          <p className={styles.confirmText}>{confirmCopy(confirm)}</p>
          <div className={styles.confirmRow}>
            <button
              className={confirm === "upheld" ? styles.confirmBtn : styles.confirmBtnRed}
              onClick={submit}
              disabled={submitting}
            >
              {submitting
                ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Saving...</>
                : confirm === "upheld" ? "Confirm: uphold appeal" : "Confirm: reject appeal"}
            </button>
            <button className={styles.cancelBtn} onClick={() => setConfirm(null)} disabled={submitting} aria-label="Cancel">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actionRow}>
          <button className={styles.approveBtn} onClick={() => askConfirm("upheld")}>
            <Check size={14} strokeWidth={2.5} /> Uphold
          </button>
          <button className={styles.withholdBtn} onClick={() => askConfirm("rejected")}>
            <X size={14} strokeWidth={2} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ── DANGER ZONE: suspend or terminate the whole award (admin only) ───────────
function DangerZone({ award, studentName, onDone }: PanelProps & { award: Award; studentName: string }) {
  const [pending,    setPending]    = useState<"suspend" | "terminate" | null>(null);
  const [reason,     setReason]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  // The backend refuses to suspend a non-active award, or to terminate one that has ended.
  const canSuspend   = award.status === "active";
  const canTerminate = award.status === "active" || award.status === "suspended";
  if (!canSuspend && !canTerminate) return null;

  function cancel() {
    setPending(null);
    setReason("");
    setError("");
  }

  async function confirmAction() {
    if (!pending) return;
    setSubmitting(true);
    setError("");
    try {
      if (pending === "suspend") {
        await suspendAward(award.id, { reason: reason.trim() });
        onDone(`${studentName}'s scholarship is now suspended.`);
      } else {
        await terminateAward(award.id, { reason: reason.trim() });
        onDone(`${studentName}'s scholarship has been terminated.`);
      }
    } catch (err) {
      setError(getApiMessage(err, "Could not complete this action. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${styles.card} ${styles.dangerCard}`}>
      <h2 className={styles.cardTitle}>Admin actions</h2>
      <p className={styles.cardSub}>Use these only when the normal renewal steps do not fit.</p>

      {!pending ? (
        <div className={styles.actionRow}>
          {canSuspend && (
            <button className={styles.rejectBtn} onClick={() => setPending("suspend")}>
              Suspend
            </button>
          )}
          {canTerminate && (
            <button className={styles.withholdBtn} onClick={() => setPending("terminate")}>
              Terminate
            </button>
          )}
        </div>
      ) : (
        <div className={styles.confirmBox}>
          <label className={styles.noteLabel}>
            Reason <span className={styles.noteHint}>(optional)</span>
          </label>
          <textarea
            className={styles.noteInput}
            rows={3}
            placeholder="Why are you doing this?"
            value={reason}
            disabled={submitting}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className={styles.confirmText}>
            {pending === "suspend"
              ? `Suspend ${studentName}'s scholarship? Its status becomes Suspended.`
              : `TERMINATE ${studentName}'s scholarship? This is permanent: the student is removed from all future payments.`}
          </p>
          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}
          <div className={styles.confirmRow}>
            <button
              className={pending === "suspend" ? styles.confirmBtnAmber : styles.confirmBtnRed}
              onClick={confirmAction}
              disabled={submitting}
            >
              {submitting
                ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Saving...</>
                : pending === "suspend" ? "Confirm: suspend" : "Confirm: terminate"}
            </button>
            <button className={styles.cancelBtn} onClick={cancel} disabled={submitting} aria-label="Cancel">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TIMELINE ROW (one payment year, with room for actions underneath) ────────
function InstallmentRow({ inst, current, children }: { inst: Installment; current: boolean; children?: ReactNode }) {
  const cfg  = installmentConfig[inst.status];
  const Icon = cfg.icon;

  const norm      = inst.submitted_cgpa_normalized !== null ? Number(inst.submitted_cgpa_normalized) : null;
  const threshold = Number(inst.threshold);

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

        <div className={styles.cellSub}>{formatNaira(inst.amount)}</div>

        {/* what the student submitted */}
        {inst.submitted_cgpa && (
          <div className={styles.tlLine}>
            CGPA {inst.submitted_cgpa} out of {inst.submitted_cgpa_scale || "5.0"}
            {norm !== null ? ` (${norm.toFixed(2)} on the 5.0 scale` : ""}
            {norm !== null ? (threshold > 0 ? `, minimum ${threshold.toFixed(2)})` : ", no minimum)") : ""}
            {inst.submitted_level ? ` · Level ${inst.submitted_level}` : ""}
          </div>
        )}

        {inst.transcript && (
          <a className={styles.link} href={inst.transcript} target="_blank" rel="noopener noreferrer">
            View transcript
          </a>
        )}

        {inst.resubmission_count > 0 && (
          <div className={styles.tlLine}>Returned {inst.resubmission_count} time{inst.resubmission_count !== 1 ? "s" : ""}.</div>
        )}

        {inst.verified_at && (
          <div className={styles.tlLine}>Reviewed on {formatDate(inst.verified_at)}.</div>
        )}

        {inst.status === "disbursed" && (
          <div className={styles.tlLine}>
            Paid{inst.disbursed_at ? ` on ${formatDate(inst.disbursed_at)}` : ""}
            {inst.disbursement_ref ? ` · Ref ${inst.disbursement_ref}` : ""}
          </div>
        )}

        {inst.verifier_note && (
          <div className={styles.tlNote}><strong>Note:</strong> {inst.verifier_note}</div>
        )}

        {children}
      </div>
    </div>
  );
}

// ── SMALL INFO LINE (side card) ──────────────────────────────────────────────
function InfoLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.infoLine}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{children}</span>
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────
export default function AdminAwardDetailPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const awardId = params.id;

  const { user, checking } = useRoleGuard(["admin", "superadmin", "verifier"]);
  // Money and status-override actions are for admins only.
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [award,     setAward]     = useState<Award | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  // Bumping this number re-fetches the award (after every action).
  const [reloadKey, setReloadKey] = useState(0);
  const [toast,     setToast]     = useState("");

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
        setError(notFound ? "Award not found." : "Failed to load this award. Please try again.");
      } finally {
        // `loading` only starts true, so later re-fetches do not flash the full-page spinner.
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [awardId, reloadKey]);

  // Called by every panel after a successful action
  function handleDone(message: string) {
    setToast(message);
    setReloadKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (checking || loading) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error || !award) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => router.push("/admin/awards")}>
          <ArrowLeft size={16} strokeWidth={2} /> Back to Awards
        </button>
        <div className={styles.centerState}>
          <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
          <p style={{ color: "#ef4444", fontWeight: 600 }}>{error || "Award not found."}</p>
          <button className={styles.retryBtn} onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const status      = awardStatusConfig[award.status];
  const StatusIcon  = status.icon;
  const studentName = award.student.full_name;
  // Installments arrive ordered by year, so the last one is the current year.
  const latest      = award.installments[award.installments.length - 1];
  const tenureCheck = award.tenure_confidence !== "confirmed";

  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/admin/awards")}>
        <ArrowLeft size={16} strokeWidth={2} /> Back to Awards
      </button>

      {/* HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Repeat size={22} color="var(--color-primary)" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>{studentName}</h1>
            <p className={styles.sub}>
              {award.scheme?.name ?? "Scholarship"}
              {award.scheme?.provider?.name ? ` · ${award.scheme.provider.name}` : ""}
            </p>
          </div>
        </div>
        <span className={`${styles.statusPill} ${styles[status.cls]}`}>
          <StatusIcon size={12} strokeWidth={2.5} /> {status.label}
        </span>
      </div>

      {/* TOAST (green, after an action) */}
      {toast && (
        <div className={styles.toastSuccess}>
          <CheckCircle2 size={16} strokeWidth={2} />
          <span>{toast}</span>
          <button className={styles.toastClose} onClick={() => setToast("")} aria-label="Dismiss">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* SUSPENDED: why, and whether an appeal is waiting */}
      {award.status === "suspended" && (
        <div className={styles.errorBanner}>
          <ShieldAlert size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Suspended.</strong> {award.suspended_reason || "No reason was recorded."}
            {award.suspended_at ? ` (${formatDate(award.suspended_at)})` : ""}
            {award.pending_appeal ? " An appeal is waiting for a decision below." : ""}
          </span>
        </div>
      )}

      {/* TENURE: the backend was not sure how many years this award runs for */}
      {tenureCheck && (
        <div className={styles.warnBanner}>
          <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Check the length of this award.</strong> It is set to {award.total_years} {award.total_years === 1 ? "year" : "years"},
            but the system is only {award.tenure_confidence === "degraded" ? "guessing" : "inferring"} this
            {award.tenure_flags.length > 0 ? ` (${award.tenure_flags.join("; ")})` : ""}. A wrong number means
            the student is paid for the wrong number of years. It can be corrected in the Django admin.
          </span>
        </div>
      )}

      {/* BODY: main column + side column (same layout as the Scheme detail page) */}
      <div className={styles.body}>

        {/* LEFT: appeal (if any), then the payment timeline */}
        <div className={styles.leftCol}>

          {award.pending_appeal && (
            <AppealPanel appeal={award.pending_appeal} studentName={studentName} onDone={handleDone} />
          )}

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Payment years</h2>
            <p className={styles.cardSub}>One entry for each year of this scholarship.</p>

            {award.installments.length === 0 ? (
              <p className={styles.cardSub}>No payment years yet.</p>
            ) : (
              <div className={styles.timeline}>
                {award.installments.map((inst) => (
                  <InstallmentRow key={inst.id} inst={inst} current={inst.id === latest?.id}>

                    {/* Submitted renewal: verifiers and admins can decide it here */}
                    {inst.status === "pending_verification" && (
                      <VerifyPanel installment={inst} studentName={studentName} onDone={handleDone} />
                    )}

                    {/* Approved: only an admin can mark it as paid */}
                    {inst.status === "approved" && isAdmin && (
                      <PayForm installment={inst} studentName={studentName} onDone={handleDone} />
                    )}
                    {inst.status === "approved" && !isAdmin && (
                      <span className={styles.cellSub}>Waiting for an admin to mark this year as paid.</span>
                    )}

                  </InstallmentRow>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: summary, then admin-only actions */}
        <div className={styles.rightCol}>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Award summary</h2>
            <div className={styles.infoGrid}>
              <InfoLine label="Student">
                <Link href={`/admin/students/${award.student.id}`} className={styles.link}>{studentName}</Link>
              </InfoLine>
              <InfoLine label="Contact">{award.student.email || "—"}</InfoLine>
              <InfoLine label="Ward">{award.student.ward || "—"}</InfoLine>
              <InfoLine label="Yearly amount">{formatNaira(award.annual_amount)}</InfoLine>
              <InfoLine label="Years paid">
                {award.current_year_index} of {award.total_years}
              </InfoLine>
              <InfoLine label="Started">{award.start_cycle?.name ?? "—"}</InfoLine>
              <InfoLine label="Length confirmed">
                {award.tenure_confidence === "confirmed" ? "Yes" : `No (${award.tenure_confidence})`}
              </InfoLine>
            </div>
          </div>

          {/* Hidden (not just disabled) for verifiers */}
          {isAdmin && <DangerZone award={award} studentName={studentName} onDone={handleDone} />}

        </div>
      </div>

    </div>
  );
}