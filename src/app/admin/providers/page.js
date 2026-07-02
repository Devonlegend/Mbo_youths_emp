"use client";
import { useState, useEffect } from "react";
import {
  Building2, Plus, AlertCircle, CheckCircle2,
  Loader2, X, RefreshCw, Trash2,
} from "lucide-react";
import styles from "./page.module.css";
import { getProviders, createProvider, deleteProvider } from "@/services";
import { useRoleGuard } from "@/hooks/useRoleGuard";

const providerTypeConfig = {
  lga:       { label: "LGA Council",        color: "#4ade80", bg: "rgba(74,222,128,0.1)"  },
  state:     { label: "State Government",   color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  corporate: { label: "Corporate / CSR",     color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  ngo:       { label: "NGO / Foundation",    color: "#fbbf24", bg: "rgba(251,191,36,0.1)"  },
  federal:   { label: "Federal Government",  color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};

// ── DELETE CONFIRM MODAL ──────────────────────────────────────────────────────
function DeleteModal({ provider, onConfirm, onCancel, loading, error }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalIcon}>
          <Trash2 size={22} color="#dc2626" strokeWidth={1.8} />
        </div>
        <h2 className={styles.modalTitle}>Delete this provider?</h2>
        <p className={styles.modalBody}>
          <strong>{provider.name}</strong> will be permanently removed.
          Any scheme currently using this provider will also be deleted — this cannot be undone.
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
              ? <><Loader2 size={13} strokeWidth={2} className={styles.spin} /> Deleting...</>
              : <><Trash2 size={13} strokeWidth={2} /> Yes, delete</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProvidersPage() {
  const { checking } = useRoleGuard(["admin", "superadmin"]);

  const [providers,    setProviders]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);

  const [deleteFor,    setDeleteFor]    = useState(null);   
  
  // provider pending delete confirm
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState("");

  const [form, setForm] = useState({ name: "", provider_type: "lga" });
  const [formErrors, setFormErrors] = useState({});

  // ── FETCH ────────────────────────────────────────────────────────────────
  async function loadProviders() {
    try {
      setLoading(true);
      setError(null);
      const res = await getProviders();
      const data = res.data;
      setProviders(Array.isArray(data) ? data : (data?.results ?? []));
    } catch {
      setError("Failed to load providers. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProviders(); }, []);

  // ── CREATE ────────────────────────────────────────────────────────────────
  function validateForm() {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required.";
    return e;
  }

  async function handleCreate() {
    const e = validateForm();
    if (Object.keys(e).length > 0) { setFormErrors(e); return; }

    setCreating(true);
    setCreateError("");
    try {
      const res = await createProvider({
        name: form.name.trim(),
        provider_type: form.provider_type,
      });
      setProviders((prev) => [res.data, ...prev]);
      setCreateSuccess(true);
      setForm({ name: "", provider_type: "lga" });
      setFormErrors({});
      setTimeout(() => { setShowCreate(false); setCreateSuccess(false); }, 1500);
    } catch (err) {
      setCreateError(
        err?.response?.data?.name?.[0] ||
        err?.response?.data?.error ||
        "Failed to create provider."
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

  // ── DELETE ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteFor) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteProvider(deleteFor.id);
      setProviders((prev) => prev.filter((p) => p.id !== deleteFor.id));
      setDeleteFor(null);
    } catch {
      setDeleteError("Failed to delete provider. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  // ── COUNTS ───────────────────────────────────────────────────────────────
  const totalProviders = providers.length;
  const typesInUse = new Set(providers.map((p) => p.provider_type)).size;

  if (checking) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* DELETE MODAL */}
      {deleteFor && (
        <DeleteModal
          provider={deleteFor}
          loading={deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteFor(null); setDeleteError(""); }}
        />
      )}

      {/* HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className={styles.headerIcon}>
            <Building2 size={20} color="#15803d" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>Providers</h1>
            <p className={styles.sub}>Organizations that fund or sponsor schemes.</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.refreshBtn} onClick={loadProviders} disabled={loading} title="Refresh">
            <RefreshCw size={14} strokeWidth={2} className={loading ? styles.spin : ""} />
          </button>
          <button
            className={styles.createBtn}
            onClick={() => { setShowCreate((v) => !v); setCreateError(""); setFormErrors({}); }}
          >
            {showCreate
              ? <><X size={14} strokeWidth={2} /> Cancel</>
              : <><Plus size={14} strokeWidth={2.5} /> New Provider</>
            }
          </button>
        </div>
      </div>

      {/* PROVIDERS BANNER */}
      {!loading && (
        providers.length > 0 ? (
          <div className={styles.activeBanner}>
            <div className={styles.activeBannerLeft}>
              <div className={styles.activePulse} />
              <div>
                <p className={styles.activeBannerTitle}>
                  <strong>{providers.length}</strong> provider{providers.length !== 1 ? "s" : ""} available
                </p>
                <p className={styles.activeBannerSub}>
                  Schemes can be created using any of these providers.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.noActiveBanner}>
            <AlertCircle size={16} color="#f59e0b" strokeWidth={2} />
            <p>No providers yet. You won't be able to create a new scheme until at least one provider exists. Create one below.</p>
          </div>
        )
      )}

      {/* SUMMARY STRIP */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Total Providers", value: totalProviders, color: "var(--color-text)"    },
          { label: "Types In Use",    value: typesInUse,      color: "var(--color-primary)" },
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
          <h2 className={styles.createTitle}>New Provider</h2>

          {createSuccess && (
            <div className={styles.successBanner}>
              <CheckCircle2 size={14} strokeWidth={2} /> Provider created successfully.
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
                Provider Name
                {formErrors.name && <span className={styles.fieldError}>{formErrors.name}</span>}
              </label>
              <input
                className={`${styles.createInput} ${formErrors.name ? styles.inputError : ""}`}
                placeholder="e.g. Mbo LGA Council"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className={styles.createField}>
              <label className={styles.createLabel}>Provider Type</label>
              <select
                className={styles.createInput}
                value={form.provider_type}
                onChange={(e) => setField("provider_type", e.target.value)}
              >
                {Object.entries(providerTypeConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.createField} style={{ justifyContent: "flex-end" }}>
              <button
                className={styles.createSubmitBtn}
                onClick={handleCreate}
                disabled={creating || createSuccess}
              >
                {creating
                  ? <><Loader2 size={13} strokeWidth={2} className={styles.spin} /> Creating...</>
                  : <><Plus size={13} strokeWidth={2} /> Create Provider</>
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
          <button className={styles.retryBtn} onClick={loadProviders}>Try again</button>
        </div>
      )}

      {/* MAIN CARD — PROVIDERS TABLE */}
      <div className={styles.card}>

        <div className={`${styles.tableRow} ${styles.tableHeader}`}>
          <span>Provider</span>
          <span>Type</span>
          <span>Created</span>
          <span></span>
        </div>

        {loading && [1, 2, 3].map((i) => (
          <div key={i} className={styles.tableRow}>
            {[50, 30, 25, 10].map((w, j) => (
              <div key={j} className={styles.skeletonCell} style={{ width: `${w}%` }} />
            ))}
          </div>
        ))}

        {!loading && !error && providers.length === 0 && (
          <div className={styles.emptyState}>
            <Building2 size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p className={styles.emptyTitle}>No providers yet</p>
            <p className={styles.emptySub}>Create your first provider to start assigning schemes.</p>
          </div>
        )}

        {!loading && !error && providers.map((provider) => {
          const cfg = providerTypeConfig[provider.provider_type] || providerTypeConfig.lga;
          return (
            <div key={provider.id} className={`${styles.tableRow} ${styles.tableRowData}`}>
              <div className={styles.tdName}>
                <div className={styles.providerIcon}>
                  <Building2 size={14} color={cfg.color} strokeWidth={2} />
                </div>
                <span className={styles.providerName}>{provider.name}</span>
              </div>

              <div>
                <span className={styles.typeChip} style={{ color: cfg.color, background: cfg.bg }}>
                  {cfg.label}
                </span>
              </div>

              <span className={styles.tdDate}>
                {provider.created_at
                  ? new Date(provider.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })
                  : "—"
                }
              </span>

              <div className={styles.tdAction}>
                <button
                  className={styles.deleteBtn}
                  onClick={() => setDeleteFor(provider)}
                  title="Delete provider"
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}

      </div>

      {!loading && !error && providers.length > 0 && (
        <div className={styles.tableFooter}>
          {providers.length} provider{providers.length !== 1 ? "s" : ""} total
        </div>
      )}

    </div>
  );
}