"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mail, ArrowLeft, AlertCircle, CheckCircle2, Send, X, Loader2,
} from "lucide-react";
import styles from "./page.module.css";
import { getSchemesOverview, publishSchemeApprovals } from "@/services";

// ── CATEGORY CONFIG — matches Applications page ─────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#15803d", bg: "rgba(74,222,128,0.12)" },
  empowerment: { label: "Empowerment", color: "#b45309", bg: "rgba(251,191,36,0.12)" },
  grant:       { label: "Grant",       color: "#7c3aed", bg: "rgba(167,139,250,0.12)" },
};

const FILTERS = [
  { key: "all",         label: "All"         },
  { key: "scholarship", label: "Scholarship" },
  { key: "empowerment", label: "Empowerment" },
  { key: "grant",       label: "Grant"       },
];

function SkeletonCard() {
  return (
    <div className={styles.schemeCard}>
      <div className={styles.skeletonLine} style={{ width: "60%", height: 16 }} />
      <div className={styles.skeletonLine} style={{ width: "40%", height: 12, marginTop: 8 }} />
      <div className={styles.skeletonLine} style={{ width: "100%", height: 36, marginTop: 16 }} />
    </div>
  );
}

export default function ApprovalsPage() {
  const router = useRouter();

  const [overview, setOverview] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const [confirmId, setConfirmId] = useState(null);   // scheme currently in "are you sure" state
  const [sendingId, setSendingId] = useState(null);   // scheme currently being published
  const [toast, setToast]         = useState(null);   // { type: 'success'|'error', message }

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const res = await getSchemesOverview();
      setOverview(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Failed to load schemes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  // Only schemes with something actually waiting to be sent.
  const pending = overview.filter((row) => row.unpublished > 0);

  const filtered = pending.filter((row) =>
    activeFilter === "all" ? true : row.scheme.award_type === activeFilter
  );

  // ── Stats ───────────────────────────────────────────────────────────────
  const totalPending = pending.reduce((sum, row) => sum + row.unpublished, 0);
  const byType = { scholarship: 0, empowerment: 0, grant: 0 };
  pending.forEach((row) => {
    if (byType[row.scheme.award_type] !== undefined) {
      byType[row.scheme.award_type] += row.unpublished;
    }
  });

  function askConfirm(schemeId) {
    setConfirmId(schemeId);
  }

  function cancelConfirm() {
    setConfirmId(null);
  }

  async function handlePublish(schemeId, schemeName) {
    setSendingId(schemeId);
    setConfirmId(null);
    setToast(null);
    try {
      const res = await publishSchemeApprovals(schemeId);
      const sentCount = res.data?.sent ?? 0;
      setToast({
        type: "success",
        message: sentCount > 0
          ? `Sent ${sentCount} approval email${sentCount === 1 ? "" : "s"} for ${schemeName}.`
          : `No new approvals to send for ${schemeName}.`,
      });
      // Refresh counts so the card either updates or drops off the pending list.
      await loadOverview();
    } catch {
      setToast({
        type: "error",
        message: `Failed to send approvals for ${schemeName}. Please try again.`,
      });
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className={styles.page}>
      
        <button className={styles.backBtn} onClick={() => router.push("/admin/applications")}>
            <ArrowLeft size={16} strokeWidth={2} />
        </button>

      {/* HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-primary-light)", border: "1.5px solid var(--color-primary-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Mail size={20} color="var(--color-primary)" strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            <h1 className={styles.title}>Send Approvals</h1>
            <p className={styles.sub}>Publish approval emails to students by scheme.</p>
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={toast.type === "success" ? styles.toastSuccess : styles.toastError}>
          {toast.type === "success"
            ? <CheckCircle2 size={16} strokeWidth={2} />
            : <AlertCircle size={16} strokeWidth={2} />
          }
          <span>{toast.message}</span>
          <button className={styles.toastClose} onClick={() => setToast(null)}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* SUMMARY STRIP */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Total Pending", value: totalPending,          key: "all"         },
          { label: "Scholarship",   value: byType.scholarship,    key: "scholarship", color: "#15803d" },
          { label: "Empowerment",   value: byType.empowerment,    key: "empowerment", color: "#b45309" },
          { label: "Grant",         value: byType.grant,          key: "grant",       color: "#7c3aed" },
        ].map((s) => (
          <button
            key={s.label}
            className={`${styles.summaryItem} ${activeFilter === s.key ? styles.summaryItemActive : ""}`}
            onClick={() => setActiveFilter(s.key)}
          >
            <span className={styles.summaryValue} style={{ color: s.color || "var(--color-text)" }}>
              {loading ? "—" : s.value}
            </span>
            <span className={styles.summaryLabel}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* MAIN CARD */}
      <div className={styles.card}>

        <div className={styles.cardTop}>
          <div className={styles.tabs}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`${styles.tab} ${activeFilter === f.key ? styles.tabActive : ""}`}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.grid}>

          {/* Loading */}
          {loading && [1, 2, 3].map((i) => <SkeletonCard key={i} />)}

          {/* Error */}
          {!loading && error && (
            <div className={styles.emptyState}>
              <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
              <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
              <button className={styles.retryBtn} onClick={loadOverview}>
                Try again
              </button>
            </div>
          )}

          {/* Empty — nothing pending anywhere */}
          {!loading && !error && filtered.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap} style={{ background: "rgba(74,222,128,0.1)", border: "1.5px solid rgba(74,222,128,0.2)" }}>
                <CheckCircle2 size={24} color="#4ade80" strokeWidth={1.8} />
              </div>
              <p className={styles.emptyTitle} style={{ color: "#4ade80" }}>All caught up</p>
              <p className={styles.emptySub}>
                {activeFilter === "all"
                  ? "No approval emails are waiting to be sent."
                  : "No pending approvals for this category."}
              </p>
            </div>
          )}

          {/* SCHEME CARDS */}
          {!loading && !error && filtered.map((row) => {
            const category = categoryConfig[row.scheme.award_type] || categoryConfig.scholarship;
            const isConfirming = confirmId === row.scheme.id;
            const isSending    = sendingId === row.scheme.id;

            return (
              <div key={row.scheme.id} className={styles.schemeCard}>
                <div className={styles.schemeCardTop}>
                  <span className={styles.schemeCardName}>{row.scheme.name}</span>
                  <span
                    className={styles.categoryChip}
                    style={{ color: category.color, background: category.bg }}
                  >
                    {category.label}
                  </span>
                </div>

                <div className={styles.schemeCardStats}>
                  <span className={styles.pendingCount}>{row.unpublished}</span>
                  <span className={styles.pendingLabel}>
                    approved student{row.unpublished === 1 ? "" : "s"} awaiting notification
                  </span>
                </div>

                {isConfirming ? (
                  <div className={styles.confirmRow}>
                    <button
                      className={styles.confirmBtn}
                      onClick={() => handlePublish(row.scheme.id, row.scheme.name)}
                    >
                      Confirm — Send {row.unpublished} Email{row.unpublished === 1 ? "" : "s"}
                    </button>
                    <button className={styles.cancelBtn} onClick={cancelConfirm}>
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.sendBtn}
                    onClick={() => askConfirm(row.scheme.id)}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Sending…</>
                    ) : (
                      <><Send size={14} strokeWidth={2} /> Send Approval Emails</>
                    )}
                  </button>
                )}
              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}