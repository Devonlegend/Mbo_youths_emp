"use client";
// ─────────────────────────────────────────────────────────────────────────────
// MY SCHOLARSHIP — the student's list of multi-year (recurring) awards.
//
// Data:  GET /awards/mine/  → plain array (not paginated). Each award already
//        includes its installments and `pending_appeal`, so no second call.
// Links: every card goes to /dashboard/awards/[id], where the student renews
//        or appeals. This page only shows status and points to the next step.
//
// Styling follows the Programmes and My Applications pages (same card look,
// same fonts, same hard-coded light colours used across /dashboard).
// ─────────────────────────────────────────────────────────────────────────────
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  GraduationCap, CheckCircle2, ShieldAlert, XCircle,
  AlertCircle, ArrowRight, Calendar, type LucideIcon,
} from "lucide-react";
import styles from "./page.module.css";
import LoadingSpinner from "../components/LoadingSpinner";
import { getMyAwards } from "@/services";
import type { Award, AwardStatus } from "@/types/award";

// ── Status chip (top right of each card) ─────────────────────────────────────
const statusConfig: Record<AwardStatus, { label: string; cls: string; icon: LucideIcon }> = {
  active:     { label: "Active",     cls: "st_active",     icon: CheckCircle2  },
  suspended:  { label: "Suspended",  cls: "st_suspended",  icon: ShieldAlert   },
  graduated:  { label: "Graduated",  cls: "st_graduated",  icon: GraduationCap },
  terminated: { label: "Terminated", cls: "st_terminated", icon: XCircle       },
};

// ── Small formatting helpers ─────────────────────────────────────────────────
function formatNaira(amount: string | number): string {
  return `₦${Number(amount).toLocaleString()}`;
}

function yearsWord(n: number): string {
  return n === 1 ? "year" : "years";
}

// ── Progress ─────────────────────────────────────────────────────────────────
// IMPORTANT: `current_year_index` counts years already PAID (0 until year 1 is
// paid), so the year in progress is `current_year_index + 1`.
function progressOf(award: Award): { label: string; pct: number } {
  const total = Math.max(award.total_years, 1);
  const paid  = award.current_year_index;

  if (award.status === "graduated") {
    return { label: `Completed all ${total} ${yearsWord(total)}`, pct: 100 };
  }
  if (award.status === "terminated") {
    return {
      label: `${paid} of ${total} ${yearsWord(total)} paid`,
      pct:   Math.round((paid / total) * 100),
    };
  }
  const year = Math.min(paid + 1, total); // never show "Year 5 of 4"
  return { label: `Year ${year} of ${total}`, pct: Math.round((year / total) * 100) };
}

// ── Next step shown at the bottom of each card ───────────────────────────────
type NoteTone = "action" | "waiting" | "done" | "danger" | "muted";

interface NextAction {
  text: string;
  tone: NoteTone;
  cta: string;      // button label
  primary: boolean; // true = the student has something to do (green button)
}

function nextActionOf(award: Award): NextAction {
  // Installments come ordered by year, so the last one is the current year.
  const latest    = award.installments[award.installments.length - 1];
  const cycleName = latest?.cycle?.name ?? "";

  if (award.status === "graduated") {
    return { text: "Congratulations. You have completed this scholarship.", tone: "done", cta: "View details", primary: false };
  }
  if (award.status === "terminated") {
    return { text: "This scholarship has ended.", tone: "muted", cta: "View details", primary: false };
  }

  // Suspended: the student can appeal, unless an appeal is already pending.
  if (award.status === "suspended") {
    if (award.pending_appeal) {
      return { text: "Your appeal is under review.", tone: "waiting", cta: "View details", primary: false };
    }
    return { text: "Your scholarship is suspended. You can submit an appeal.", tone: "danger", cta: "Submit appeal", primary: true };
  }

  // Active: what to do depends on the current year's installment.
  switch (latest?.status) {
    case "pending_renewal":
      return { text: `Renewal open for ${cycleName}. Submit your latest CGPA.`, tone: "action", cta: "Renew now", primary: true };
    case "pending_verification":
      return { text: `Your ${cycleName} renewal is under review.`, tone: "waiting", cta: "View details", primary: false };
    case "approved":
      return { text: `${cycleName} payment approved. Waiting for disbursement.`, tone: "done", cta: "View details", primary: false };
    case "disbursed":
      return { text: `${cycleName} payment made. Your next renewal opens with the next cycle.`, tone: "done", cta: "View details", primary: false };
    default:
      return { text: "Nothing to do right now.", tone: "muted", cta: "View details", primary: false };
  }
}

// ── PAGE ─────────────────────────────────────────────────────────────────────
export default function MyAwardsPage() {
  const router = useRouter();

  const [awards,    setAwards]    = useState<Award[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  // Bumping this number re-runs the load effect (used by "Try again").
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await getMyAwards();
        if (cancelled) return;
        setAwards(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setError("Failed to load your scholarships. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  function retry() {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <GraduationCap size={20} color="#15803d" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>My Scholarship</h1>
            <p className={styles.sub}>Track your multi year scholarships and renew them each year.</p>
          </div>
        </div>
        {!loading && !error && awards.length > 0 && (
          <div className={styles.countPill}>{awards.length} total</div>
        )}
      </div>

      {/* LOADING */}
      {loading && <LoadingSpinner fullPage />}

      {/* ERROR */}
      {!loading && error && (
        <div className={styles.empty}>
          <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
          <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
          <button className={styles.retryBtn} onClick={retry}>Try again</button>
        </div>
      )}

      {/* EMPTY — a student can have no multi-year scholarship yet */}
      {!loading && !error && awards.length === 0 && (
        <div className={styles.empty}>
          <p style={{ color: "#64748b", fontWeight: 600 }}>No multi-year scholarships yet</p>
          <p style={{ color: "#94a3b8", fontSize: 13, maxWidth: 360 }}>
            When you are awarded a scholarship that pays every year, it will appear here.
          </p>
          <button className={styles.browseBtn} onClick={() => router.push("/dashboard/programmes")}>
            Browse Programmes
          </button>
        </div>
      )}

      {/* AWARD CARDS — a student can hold more than one, so this is a grid */}
      {!loading && !error && awards.length > 0 && (
        <div className={styles.grid}>
          {awards.map((award) => {
            const status   = statusConfig[award.status];
            const StatusIcon = status.icon;
            const progress = progressOf(award);
            const next     = nextActionOf(award);

            return (
              <div key={award.id} className={styles.card}>

                {/* top strip: icon + status chip */}
                <div className={styles.cardTop}>
                  <div className={styles.cardIconWrap}>
                    <GraduationCap size={20} color="#fff" strokeWidth={2} />
                  </div>
                  <span className={`${styles.statusTag} ${styles[status.cls]}`}>
                    <StatusIcon size={11} strokeWidth={2.5} /> {status.label}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.catTag}>Multi-year scholarship</div>
                  <h2 className={styles.cardTitle}>{award.scheme?.name ?? "Scholarship"}</h2>
                  {award.scheme?.provider?.name && (
                    <p className={styles.cardProvider}>{award.scheme.provider.name}</p>
                  )}

                  {/* progress: "Year 2 of 4" + bar + yearly amount */}
                  <div className={styles.progress}>
                    <div className={styles.progressHead}>
                      <span className={styles.progressLabel}>{progress.label}</span>
                      <span className={styles.progressAmount}>{formatNaira(award.annual_amount)} / year</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${progress.pct}%` }} />
                    </div>
                  </div>

                  {award.start_cycle?.name && (
                    <span className={styles.metaItem}>
                      <Calendar size={12} strokeWidth={2} />
                      Started {award.start_cycle.name}
                    </span>
                  )}

                  {/* what happens next */}
                  <div className={`${styles.note} ${styles[`note_${next.tone}`]}`}>
                    {next.text}
                  </div>

                  <button
                    className={next.primary ? styles.cardBtnPrimary : styles.cardBtn}
                    onClick={() => router.push(`/dashboard/awards/${award.id}`)}
                  >
                    {next.cta} <ArrowRight size={14} strokeWidth={2} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}