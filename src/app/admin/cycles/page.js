"use client";
import { useState, useEffect } from "react";
import {
  RefreshCw, Plus, CheckCircle2, AlertCircle,
  Loader2, CalendarRange, Zap, X, BookOpen,
  ChevronRight, Clock,
} from "lucide-react";

import { useRoleGuard } from "@/hooks/useRoleGuard";

import styles from "./page.module.css";
import api from "@/services/axiosInstance";

// ── HELPERS ───────────────────────────────────────────────────────────────────
function formatYear(y) { return y ?? "—"; }

function CycleBadge({ isActive }) {
  return isActive ? (
    <span className={styles.badgeActive}>
      <span className={styles.badgeDot} /> Active
    </span>
  ) : (
    <span className={styles.badgeInactive}>Inactive</span>
  );
}

// ── CONFIRM MODAL ─────────────────────────────────────────────────────────────
function ActivateModal({ cycle, onConfirm, onCancel, loading, error }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalIcon}>
          <Zap size={22} color="#15803d" strokeWidth={1.8} />
        </div>
        <h2 className={styles.modalTitle}>Activate this cycle?</h2>
        <p className={styles.modalBody}>
          <strong>{cycle.name}</strong> will become the active cycle.
          All other cycles will be deactivated. Students will see this change immediately.
        </p>
        {error && (
          <div className={styles.errorBanner} style={{ width: "100%" }}>
            <AlertCircle size={14} strokeWidth={2} /> {error}
          </div>
        )}
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={styles.modalConfirm} onClick={onConfirm} disabled={loading}>
            {loading
              ? <><Loader2 size={13} strokeWidth={2} className={styles.spin} /> Activating...</>
              : <><Zap size={13} strokeWidth={2} /> Yes, activate</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function AdminCyclesPage() {
  const { checking } = useRoleGuard(["admin", "superadmin"]);


  const [cycles,      setCycles]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activating,  setActivating]  = useState(null);   // cycle being activated
  const [confirmFor,  setConfirmFor]  = useState(null);   // cycle pending confirm
  const [showCreate,  setShowCreate]  = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);

  const [form, setForm] = useState({ name: "", start_year: "", end_year: "" });
  const [formErrors, setFormErrors] = useState({});

  const activeCycle = cycles.find((c) => c.is_active) || null;

  // ── FETCH ────────────────────────────────────────────────────────────────
  async function loadCycles() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/schemes/cycles/");
      const data = res.data;
      setCycles(Array.isArray(data) ? data : (data?.results ?? []));
    } catch {
      setError("Failed to load cycles. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCycles(); }, []);

  // ── ACTIVATE ─────────────────────────────────────────────────────────────
  async function handleActivate() {
    if (!confirmFor) return;
    setActivating(confirmFor.id);
    try {
      await api.post(`/schemes/cycles/${confirmFor.id}/activate/`);
      setCycles((prev) =>
        prev.map((c) => ({ ...c, is_active: c.id === confirmFor.id }))
      );
      setConfirmFor(null);
    } catch {
      setError("Failed to activate cycle. Please try again.");
    } finally {
      setActivating(null);
    }
  }

  // ── CREATE ────────────────────────────────────────────────────────────────
function validateForm() {
  const e = {};
  const yearPattern = /^\d{4}\/\d{4}$/;

  if (!form.name.trim()) {
    e.name = "Name is required.";
  } else if (!yearPattern.test(form.name.trim())) {
    e.name = "Name must be in the format YYYY/YYYY, e.g. 2026/2027.";
  }

  if (!form.start_year)    e.start_year = "Start year is required.";
  if (!form.end_year)      e.end_year   = "End year is required.";
  if (form.start_year && form.end_year &&
      Number(form.end_year) <= Number(form.start_year))
    e.end_year = "End year must be after start year.";
  return e;
}

  async function handleCreate() {
    const e = validateForm();
    if (Object.keys(e).length > 0) { setFormErrors(e); return; }

    setCreating(true);
    setCreateError("");
    try {
      const res = await api.post("/schemes/cycles/", {
        name:       form.name.trim(),
        start_year: Number(form.start_year),
        end_year:   Number(form.end_year),
      });
      setCycles((prev) => [res.data, ...prev]);
      setCreateSuccess(true);
      setForm({ name: "", start_year: "", end_year: "" });
      setFormErrors({});
      setTimeout(() => { setShowCreate(false); setCreateSuccess(false); }, 1500);
    } catch (err) {
      setCreateError(
        err?.response?.data?.name?.[0] ||
        err?.response?.data?.error ||
        "Failed to create cycle."
      );
    } finally {
      setCreating(false);
    }
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: "" }));
    setCreateError("");
  }

  // ── COUNTS ────────────────────────────────────────────────────────────────
  const totalCycles   = cycles.length;
  const inactiveCycles = cycles.filter((c) => !c.is_active).length;

  // ── RENDER ────────────────────────────────────────────────────────────────
if (checking) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* CONFIRM MODAL */}
      {confirmFor && (
        <ActivateModal
          cycle={confirmFor}
          loading={activating === confirmFor.id}
          error={error}
          onConfirm={handleActivate}
          onCancel={() => { setConfirmFor(null); setError(null); }}
        />
      )}

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className={styles.headerIcon}>
            <CalendarRange size={20} color="#15803d" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>Cycles</h1>
            <p className={styles.sub}>Manage academic programme cycles. Only one cycle is active at a time.</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.refreshBtn}
            onClick={loadCycles}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={14} strokeWidth={2} className={loading ? styles.spin : ""} />
          </button>
          <button
            className={styles.createBtn}
            onClick={() => { setShowCreate((v) => !v); setCreateError(""); setFormErrors({}); }}
          >
            {showCreate
              ? <><X size={14} strokeWidth={2} /> Cancel</>
              : <><Plus size={14} strokeWidth={2.5} /> New Cycle</>
            }
          </button>
        </div>
      </div>

      {/* ACTIVE CYCLE BANNER */}
      {!loading && (
        activeCycle ? (
          <div className={styles.activeBanner}>
            <div className={styles.activeBannerLeft}>
              <div className={styles.activePulse} />
              <div>
                <p className={styles.activeBannerTitle}>
                  Active cycle — <strong>{activeCycle.name}</strong>
                </p>
                <p className={styles.activeBannerSub}>
                  {formatYear(activeCycle.start_year)} – {formatYear(activeCycle.end_year)} · Students and programmes are scoped to this cycle.
                </p>
              </div>
            </div>
            {/* <BookOpen size={18} color="#15803d" strokeWidth={1.5} style={{ flexShrink: 0 }} /> */}
          </div>
        ) : (
          <div className={styles.noActiveBanner}>
            <AlertCircle size={16} color="#f59e0b" strokeWidth={2} />
            <p>No active cycle. Students will see <strong>"No active cycle"</strong> on their dashboard. Activate a cycle below.</p>
          </div>
        )
      )}

      {/* SUMMARY STRIP */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Total Cycles",    value: totalCycles,    color: "#0f172a" },
          { label: "Active",          value: activeCycle ? 1 : 0, color: "#15803d" },
          { label: "Inactive",        value: inactiveCycles, color: "#64748b" },
        ].map((s) => (
          <div key={s.label} className={styles.summaryItem}>
            <span className={styles.summaryValue} style={{ color: s.color }}>
              {loading ? "—" : s.value}
            </span>
            <span className={styles.summaryLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* CREATE FORM */}
      {showCreate && (
        <div className={styles.createCard}>
          <h2 className={styles.createTitle}>New Cycle</h2>

          {createSuccess && (
            <div className={styles.successBanner}>
              <CheckCircle2 size={14} strokeWidth={2} /> Cycle created successfully.
            </div>
          )}
          {createError && (
            <div className={styles.errorBanner}>
              <AlertCircle size={14} strokeWidth={2} /> {createError}
            </div>
          )}

          <div className={styles.createFormRow}>
            <div className={styles.createField}>
              <label className={styles.createLabel}>
                Cycle Name
                {formErrors.name && <span className={styles.fieldError}>{formErrors.name}</span>}
              </label>
              <input
                className={`${styles.createInput} ${formErrors.name ? styles.inputError : ""}`}
                placeholder="e.g. 2027/2028"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className={styles.createField}>
              <label className={styles.createLabel}>
                Start Year
                {formErrors.start_year && <span className={styles.fieldError}>{formErrors.start_year}</span>}
              </label>
              <input
                type="number"
                className={`${styles.createInput} ${formErrors.start_year ? styles.inputError : ""}`}
                placeholder="e.g. 2027"
                value={form.start_year}
                onChange={(e) => setField("start_year", e.target.value)}
              />
            </div>
            <div className={styles.createField}>
              <label className={styles.createLabel}>
                End Year
                {formErrors.end_year && <span className={styles.fieldError}>{formErrors.end_year}</span>}
              </label>
              <input
                type="number"
                className={`${styles.createInput} ${formErrors.end_year ? styles.inputError : ""}`}
                placeholder="e.g. 2028"
                value={form.end_year}
                onChange={(e) => setField("end_year", e.target.value)}
              />
            </div>
            <div className={styles.createField} style={{ justifyContent: "flex-end" }}>
              <button
                className={styles.createSubmitBtn}
                onClick={handleCreate}
                disabled={creating || createSuccess}
              >
                {creating
                  ? <><Loader2 size={13} strokeWidth={2} className={styles.spin} /> Creating...</>
                  : <><Plus size={13} strokeWidth={2} /> Create Cycle</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className={styles.errorState}>
          <AlertCircle size={22} color="#f87171" strokeWidth={1.5} />
          <p style={{ color: "#ef4444" }}>{error}</p>
          <button className={styles.retryBtn} onClick={loadCycles}>Try again</button>
        </div>
      )}

      {/* MAIN CARD — CYCLES TABLE */}
      <div className={styles.card}>

        {/* TABLE HEADER */}
        <div className={`${styles.tableRow} ${styles.tableHeader}`}>
          <span>Cycle</span>
          <span>Years</span>
          <span>Status</span>
          <span>Created</span>
          <span></span>
        </div>

        {/* LOADING */}
        {loading && [1, 2, 3].map((i) => (
          <div key={i} className={styles.tableRow}>
            {[40, 28, 14, 18, 10].map((w, j) => (
              <div key={j} className={styles.skeletonCell} style={{ width: `${w}%` }} />
            ))}
          </div>
        ))}

        {/* EMPTY */}
        {!loading && !error && cycles.length === 0 && (
          <div className={styles.emptyState}>
            <CalendarRange size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p className={styles.emptyTitle}>No cycles yet</p>
            <p className={styles.emptySub}>Create your first cycle to start assigning schemes.</p>
            {/* <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
              <Plus size={14} strokeWidth={2.5} /> New Cycle
            </button> */}
          </div>
        )}

        {/* ROWS */}
        {!loading && !error && cycles.map((cycle) => (
          <div
            key={cycle.id}
            className={`${styles.tableRow} ${styles.tableRowData} ${cycle.is_active ? styles.tableRowActive : ""}`}
          >
            {/* Name */}
            <div className={styles.tdName}>
              <div className={styles.cycleIcon}>
                <Clock size={14} color={cycle.is_active ? "#15803d" : "#94a3b8"} strokeWidth={2} />
              </div>
              <span className={styles.cycleName}>{cycle.name}</span>
            </div>

            {/* Years */}
            <span className={styles.tdYears}>
              {formatYear(cycle.start_year)} – {formatYear(cycle.end_year)}
            </span>

            {/* Status */}
            <div>
              <CycleBadge isActive={cycle.is_active} />
            </div>

            {/* Created */}
            <span className={styles.tdDate}>
              {cycle.created_at
                ? new Date(cycle.created_at).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })
                : "—"
              }
            </span>

            {/* Action */}
            <div className={styles.tdAction}>
              {cycle.is_active ? (
                <span className={styles.currentLabel}>Current</span>
              ) : (
                <button
                  className={styles.activateBtn}
                  onClick={() => setConfirmFor(cycle)}
                  disabled={activating === cycle.id}
                >
                  {activating === cycle.id
                    ? <Loader2 size={12} strokeWidth={2} className={styles.spin} />
                    : <Zap size={12} strokeWidth={2} />
                  }
                  Activate
                </button>
              )}
            </div>
          </div>
        ))}

      </div>

      {/* ROW COUNT */}
      {!loading && !error && cycles.length > 0 && (
        <div className={styles.tableFooter}>
          {cycles.length} cycle{cycles.length !== 1 ? "s" : ""} total
        </div>
      )}

    </div>
  );
}