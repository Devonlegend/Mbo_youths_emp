"use client";
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: RENEWALS QUEUE — the yearly work list for verifiers.
//
// Data:   GET  /awards/renewals/?status=&page=
//         → paginated installments. Each row already carries an `award` block
//           (student, scheme, total_years) so no extra lookups are needed.
// Action: POST /awards/installments/{id}/verify/   { action, note }
//           approve  → year moves to "approved" (admin then marks it paid)
//           reject   → sent back to the student to resubmit (max 2 times, then
//                      the year is cancelled and the scholarship suspended)
//           withhold → CGPA below the minimum: scholarship is SUSPENDED and the
//                      student can appeal
//
// Safety: every decision is a two-step confirm (pick the action, then confirm),
//         and reject / withhold need a note because the student sees it.
//         The backend re-checks the CGPA on approve, so this screen only warns.
//
// Style:  copies the Send Approvals page (tabs, toast, confirm buttons) and the
//         Cycles page (table in a card). Theme tokens keep dark mode working.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ClipboardCheck, CheckCircle2, AlertCircle, X, Loader2,
  ChevronDown, Check, RotateCcw, ShieldAlert,
} from "lucide-react";
import { isAxiosError } from "axios";

import { useRoleGuard } from "@/hooks/useRoleGuard";
import Pagination from "../../components/pagination/Pagination";
import styles from "./page.module.css";
import { getRenewalQueue, verifyInstallment } from "@/services";
import type { RenewalQueueItem, RenewalQueueParams, VerifyAction } from "@/types/award";

// Backend page size (API_PAGE_SIZE defaults to 50). Only used to draw the pager.
const PAGE_SIZE = 50;

// After this many rejections the backend cancels the year and suspends the award.
const MAX_REJECTIONS = 2;

type TabKey = NonNullable<RenewalQueueParams["status"]>;

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending_verification", label: "Awaiting review"  },
  { key: "pending_renewal",      label: "Awaiting student" },
  { key: "all",                  label: "All open"         },
];

interface ToastState {
  type: "success" | "error";
  message: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatNaira(amount: string | number): string {
  return `₦${Number(amount).toLocaleString()}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Turns whatever the API sent back into one readable message.
//   { error: "..." }   → business-rule problem (HTTP 400), e.g. "use withhold"
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

// The CGPA check for one row. The backend compares the 5.0-scale value
// (`submitted_cgpa_normalized`) with `threshold`; a threshold of 0 means no minimum.
function cgpaCheck(item: RenewalQueueItem) {
  const norm      = item.submitted_cgpa_normalized !== null ? Number(item.submitted_cgpa_normalized) : null;
  const threshold = Number(item.threshold);
  const below     = norm !== null && threshold > 0 && norm < threshold;
  return { norm, threshold, below };
}

function successMessage(action: VerifyAction, item: RenewalQueueItem): string {
  const name = item.award.student.full_name;
  if (action === "approve") return `Approved ${name}'s renewal for ${item.cycle.name}. It is now waiting for payment.`;
  if (action === "reject")  return `Sent ${name}'s renewal back for correction.`;
  return `Withheld ${name}'s renewal. Their scholarship is now suspended and they can appeal.`;
}

// What the confirm step tells the reviewer before the final tap.
function confirmCopy(action: VerifyAction, item: RenewalQueueItem): string {
  const name = item.award.student.full_name;
  if (action === "approve") {
    return `Approve ${name}'s renewal for ${item.cycle.name}? It will be queued for payment.`;
  }
  if (action === "reject") {
    // This rejection makes the count go up by one; at the cap the year is cancelled.
    const isLast = item.resubmission_count + 1 >= MAX_REJECTIONS;
    return isLast
      ? `This is the last rejection allowed. ${name}'s year will be CANCELLED and their scholarship SUSPENDED (they can appeal). Continue?`
      : `Send this renewal back to ${name}? They will be asked to resubmit. This rejection counts toward the limit of ${MAX_REJECTIONS}.`;
  }
  return `Withhold this year? ${name}'s scholarship will be SUSPENDED and they can submit an appeal.`;
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoLine}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className={styles.tableRow}>
      {[60, 55, 40, 45, 35, 30, 50].map((w, i) => (
        <div key={i} className={styles.skeletonCell} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────
export default function RenewalsQueuePage() {
  const router = useRouter();
  const { checking } = useRoleGuard(["admin", "superadmin", "verifier"]);

  // Queue data
  const [tab,         setTab]         = useState<TabKey>("pending_verification");
  const [page,        setPage]        = useState(1);
  const [items,       setItems]       = useState<RenewalQueueItem[]>([]);
  const [count,       setCount]       = useState(0);
  const [hasNext,     setHasNext]     = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  // Bumping this number re-fetches the queue (after a decision, or "Try again").
  const [reloadKey,   setReloadKey]   = useState(0);
  const [toast,       setToast]       = useState<ToastState | null>(null);

  // The review panel that is open under one row (only one at a time)
  const [openId,      setOpenId]      = useState<string | null>(null);
  const [note,        setNote]        = useState("");
  const [noteError,   setNoteError]   = useState("");
  const [confirm,     setConfirm]     = useState<VerifyAction | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [actionError, setActionError] = useState("");

  // ── Load the queue whenever the tab or page changes ────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getRenewalQueue(page, { status: tab });
        if (cancelled) return;
        const results = res.data.results ?? [];

        // We approved the last row of a later page: step back one page.
        if (results.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }

        setItems(results);
        setCount(res.data.count ?? 0);
        setHasNext(!!res.data.next);
        setHasPrevious(!!res.data.previous);
      } catch {
        if (!cancelled) setError("Failed to load renewals. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tab, page, reloadKey]);

  // ── Review panel helpers ───────────────────────────────────────────────────
  function resetPanel() {
    setNote("");
    setNoteError("");
    setConfirm(null);
    setActionError("");
  }

  function closePanel() {
    setOpenId(null);
    resetPanel();
  }

  function togglePanel(id: string) {
    if (openId === id) { closePanel(); return; }
    resetPanel();
    setOpenId(id);
  }

  function changeTab(key: TabKey) {
    setTab(key);
    setPage(1);
    closePanel();
  }

  // First tap on a decision button. Reject and withhold need a note first,
  // because the student reads it.
  function askConfirm(action: VerifyAction) {
    setActionError("");
    if ((action === "reject" || action === "withhold") && !note.trim()) {
      setNoteError("A note is required. The student will see it.");
      return;
    }
    setNoteError("");
    setConfirm(action);
  }

  // Second tap: really send the decision.
  async function submitDecision(item: RenewalQueueItem) {
    if (!confirm) return;
    setSubmitting(true);
    setActionError("");
    try {
      await verifyInstallment(item.id, { action: confirm, note: note.trim() });
      setToast({ type: "success", message: successMessage(confirm, item) });
      closePanel();
      setReloadKey((k) => k + 1); // refresh so the row disappears from this tab
    } catch (err) {
      // Keep the panel open so the reviewer can read the reason and choose again
      setActionError(getApiMessage(err, "Could not save your decision. Please try again."));
      setConfirm(null);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Role check in progress ─────────────────────────────────────────────────
  if (checking) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/admin/awards")}>
        <ArrowLeft size={16} strokeWidth={2} />
        Back to Awards
      </button>

      {/* HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className={styles.headerIcon}>
            <ClipboardCheck size={20} color="var(--color-primary)" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>Renewals</h1>
            <p className={styles.sub}>Check each student&apos;s yearly renewal before it can be paid.</p>
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={toast.type === "success" ? styles.toastSuccess : styles.toastError}>
          {toast.type === "success"
            ? <CheckCircle2 size={16} strokeWidth={2} />
            : <AlertCircle size={16} strokeWidth={2} />}
          <span>{toast.message}</span>
          <button className={styles.toastClose} onClick={() => setToast(null)} aria-label="Dismiss">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* TABS */}
        <div className={styles.cardTop}>
          <div className={styles.tabs}>
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
                onClick={() => changeTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {!loading && !error && (
            <span className={styles.countText}>{count} renewal{count !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* ERROR */}
        {error && (
          <div className={styles.emptyState}>
            <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
            <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
            <button className={styles.retryBtn} onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
          </div>
        )}

        {/* TABLE */}
        {!error && (
          <>
            <div className={`${styles.tableRow} ${styles.tableHeader}`}>
              <span>Student</span>
              <span>Scheme</span>
              <span>Year</span>
              <span>CGPA / minimum</span>
              <span>Level and transcript</span>
              <span>Opened</span>
              <span></span>
            </div>

            {/* loading */}
            {loading && [1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}

            {/* empty */}
            {!loading && items.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconWrap}>
                  <CheckCircle2 size={24} color="#4ade80" strokeWidth={1.8} />
                </div>
                <p className={styles.emptyTitle}>No renewals waiting</p>
                <p className={styles.emptySub}>
                  {tab === "pending_verification"
                    ? "You are all caught up. New renewals appear here as students submit them."
                    : "Nothing in this list right now."}
                </p>
              </div>
            )}

            {/* rows */}
            {!loading && items.map((item) => {
              const isOpen    = openId === item.id;
              const canReview = item.status === "pending_verification";
              const { norm, threshold, below } = cgpaCheck(item);

              return (
                <div key={item.id} className={styles.rowWrap}>

                  {/* ── the row itself ── */}
                  <div className={`${styles.tableRow} ${styles.tableRowData} ${isOpen ? styles.tableRowOpen : ""}`}>

                    <div className={styles.cellStack}>
                      <Link href={`/admin/students/${item.award.student.id}`} className={styles.studentName}>
                        {item.award.student.full_name}
                      </Link>
                      <span className={styles.cellSub}>{item.award.student.ward || item.award.student.email}</span>
                    </div>

                    <div className={styles.cellStack}>
                      <span className={styles.cellMain}>{item.award.scheme?.name ?? "—"}</span>
                      <span className={styles.cellSub}>{item.award.scheme?.provider?.name ?? ""}</span>
                    </div>

                    <div className={styles.cellStack}>
                      <span className={styles.cellMain}>{item.year_index} / {item.award.total_years}</span>
                      <span className={styles.cellSub}>{item.cycle.name}</span>
                    </div>

                    {/* CGPA on the 5.0 scale against the minimum: green passes, red is below */}
                    <div className={styles.cellStack}>
                      {norm !== null ? (
                        <>
                          <span className={below ? styles.cgpaBad : styles.cgpaOk}>
                            {norm.toFixed(2)} / {threshold > 0 ? threshold.toFixed(2) : "no minimum"}
                          </span>
                          <span className={styles.cellSub}>
                            Entered {item.submitted_cgpa} out of {item.submitted_cgpa_scale || "5.0"}
                          </span>
                        </>
                      ) : (
                        <span className={styles.cellSub}>Not submitted yet</span>
                      )}
                    </div>

                    <div className={styles.cellStack}>
                      <span className={styles.cellMain}>{item.submitted_level ? `Level ${item.submitted_level}` : "—"}</span>
                      {item.transcript ? (
                        <a className={styles.link} href={item.transcript} target="_blank" rel="noopener noreferrer">
                          View transcript
                        </a>
                      ) : (
                        <span className={styles.cellSub}>No transcript</span>
                      )}
                    </div>

                    {/* `created_at` is when this year was opened for the student, not when they submitted */}
                    <span className={styles.cellSub}>{formatDate(item.created_at)}</span>

                    <div className={styles.tdAction}>
                      {canReview ? (
                        <button className={styles.reviewBtn} onClick={() => togglePanel(item.id)}>
                          {isOpen ? "Close" : "Review"}
                          <ChevronDown size={13} strokeWidth={2} className={isOpen ? styles.chevronUp : ""} />
                        </button>
                      ) : (
                        <span className={styles.waitPill}>
                          {item.resubmission_count > 0 ? `Returned ${item.resubmission_count}x` : "Waiting"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── the review panel (only for rows waiting on staff) ── */}
                  {isOpen && canReview && (
                    <div className={styles.panel}>

                      {/* Below the minimum: approving will be refused by the server */}
                      {below && (
                        <div className={styles.warnBanner}>
                          <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>
                            This CGPA is below the minimum. The server will refuse an approval. Use
                            <strong> Withhold</strong> (the scholarship is suspended and the student can appeal),
                            or <strong>Reject</strong> if the numbers look wrong and should be resubmitted.
                          </span>
                        </div>
                      )}

                      <div className={styles.panelGrid}>

                        {/* what was submitted */}
                        <div className={styles.panelInfo}>
                          <InfoLine
                            label="CGPA entered"
                            value={`${item.submitted_cgpa ?? "—"} out of ${item.submitted_cgpa_scale || "5.0"}`}
                          />
                          <InfoLine label="On the 5.0 scale" value={norm !== null ? norm.toFixed(2) : "—"} />
                          <InfoLine label="Minimum required" value={threshold > 0 ? threshold.toFixed(2) : "None"} />
                          <InfoLine label="Level entering" value={item.submitted_level || "—"} />
                          <InfoLine label="Payment" value={`${formatNaira(item.amount)} for ${item.cycle.name}`} />
                          <InfoLine
                            label="Returned before"
                            value={`${item.resubmission_count} of ${MAX_REJECTIONS} allowed`}
                          />
                          {item.verifier_note && <InfoLine label="Earlier note" value={item.verifier_note} />}
                          {item.transcript ? (
                            <a className={styles.link} href={item.transcript} target="_blank" rel="noopener noreferrer">
                              Open transcript in a new tab
                            </a>
                          ) : (
                            <span className={styles.warnText}>No transcript was attached.</span>
                          )}
                        </div>

                        {/* the decision */}
                        <div className={styles.panelDecide}>
                          <label className={styles.noteLabel}>
                            Note to the student
                            <span className={styles.noteHint}> (required to reject or withhold)</span>
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

                          {actionError && (
                            <div className={styles.errorBanner}>
                              <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                              <span>{actionError}</span>
                            </div>
                          )}

                          {confirm ? (
                            /* step 2: confirm */
                            <div className={styles.confirmBox}>
                              <p className={styles.confirmText}>{confirmCopy(confirm, item)}</p>
                              <div className={styles.confirmRow}>
                                <button
                                  className={
                                    confirm === "approve" ? styles.confirmBtn
                                    : confirm === "reject" ? styles.confirmBtnAmber
                                    : styles.confirmBtnRed
                                  }
                                  onClick={() => submitDecision(item)}
                                  disabled={submitting}
                                >
                                  {submitting
                                    ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Saving...</>
                                    : confirm === "approve" ? "Confirm: approve"
                                    : confirm === "reject"  ? "Confirm: send back"
                                    : "Confirm: withhold"}
                                </button>
                                <button
                                  className={styles.cancelBtn}
                                  onClick={() => setConfirm(null)}
                                  disabled={submitting}
                                  aria-label="Cancel"
                                >
                                  <X size={14} strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* step 1: choose */
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

                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* PAGINATION (hides itself when everything fits on one page) */}
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={count}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
              loading={loading}
              onPageChange={(p) => { setPage(p); closePanel(); }}
            />
          </>
        )}

      </div>
    </div>
  );
}