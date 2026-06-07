"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, GraduationCap, Briefcase,
  Wrench, Banknote, AlertCircle, CheckCircle2,
  Loader2, Plus,
} from "lucide-react";
import styles from "./page.module.css";
import { createScheme } from "@/services";

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#15803d", bg: "#f0fdf4", icon: GraduationCap },
  vocational:  { label: "Training",    color: "#1d4ed8", bg: "#eff6ff", icon: Wrench        },
  empowerment: { label: "Empowerment", color: "#b45309", bg: "#fffbeb", icon: Briefcase     },
  grant:       { label: "Grant",       color: "#7e22ce", bg: "#faf5ff", icon: Banknote      },
};

// ── FIELD COMPONENT ───────────────────────────────────────────────────────────
function Field({ label, hint, error, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <label className={styles.fieldLabel}>{label}</label>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      {children}
      {error && (
        <span className={styles.fieldError}>
          <AlertCircle size={11} strokeWidth={2} />
          {error}
        </span>
      )}
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function NewSchemePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name:                   "",
    award_type:             "scholarship",
    description:            "",
    academic_year:          "2026/2027",
    award_amount:           "",
    total_slots:            "",
    application_open_date:  "",
    application_close_date: "",
    stacking_policy:        "major_only",
  });

  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success,  setSuccess]  = useState(false);

  const category = categoryConfig[form.award_type] || categoryConfig.scholarship;
  const CatIcon  = category.icon;

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setApiError("");
  }

  function validate() {
    const e = {};
    if (!form.name.trim())               e.name = "Scheme name is required.";
    if (!form.description.trim())        e.description = "Description is required.";
    if (!form.award_amount)              e.award_amount = "Award amount is required.";
    if (isNaN(parseFloat(form.award_amount)) || parseFloat(form.award_amount) <= 0)
                                         e.award_amount = "Enter a valid amount.";
    if (!form.total_slots)               e.total_slots = "Total slots is required.";
    if (isNaN(parseInt(form.total_slots)) || parseInt(form.total_slots) <= 0)
                                         e.total_slots = "Enter a valid number of slots.";
    if (!form.application_open_date)     e.application_open_date = "Open date is required.";
    if (!form.application_close_date)    e.application_close_date = "Close date is required.";
    if (form.application_open_date && form.application_close_date &&
        form.application_close_date <= form.application_open_date)
                                         e.application_close_date = "Close date must be after open date.";
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setLoading(true);
    setApiError("");

    try {
      await createScheme({
        ...form,
        award_amount:    parseFloat(form.award_amount),
        total_slots:     parseInt(form.total_slots),
        remaining_slots: parseInt(form.total_slots),
        is_published:    false,
        is_active:       true,
      });
      setSuccess(true);
      setTimeout(() => router.push("/admin/schemes"), 1200);
    } catch (err) {
      setApiError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to create scheme. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/admin/schemes")}>
        <ArrowLeft size={14} strokeWidth={2} /> Back to Schemes
      </button>

      {/* PAGE HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div
            className={styles.headerIcon}
            style={{ background: category.bg, border: `1.5px solid ${category.color}30` }}
          >
            <CatIcon size={22} color={category.color} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>
              {form.name.trim() || "New Scheme"}
            </h1>
            <p className={styles.sub}>
              {form.academic_year} · {category.label}
            </p>
          </div>
        </div>
      </div>

      {/* SUCCESS BANNER */}
      {success && (
        <div className={styles.successBanner}>
          <CheckCircle2 size={16} color="#15803d" strokeWidth={2} />
          Scheme created successfully. Redirecting...
        </div>
      )}

      {/* API ERROR */}
      {apiError && (
        <div className={styles.errorBanner}>
          <AlertCircle size={14} color="#dc2626" strokeWidth={2} />
          {apiError}
        </div>
      )}

      {/* FORM BODY */}
      <div className={styles.body}>

        {/* LEFT — main fields */}
        <div className={styles.leftCol}>

          {/* Basic Info */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Basic Information</h2>

            <Field label="Scheme Name" error={errors.name}>
              <input
                className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                placeholder="e.g. 2026/2027 University Scholarship Award"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>

            <Field label="Category">
              <div className={styles.categoryGrid}>
                {Object.entries(categoryConfig).map(([key, cat]) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.categoryOption} ${form.award_type === key ? styles.categoryOptionActive : ""}`}
                      style={form.award_type === key ? { borderColor: cat.color, background: cat.bg } : {}}
                      onClick={() => set("award_type", key)}
                    >
                      <Icon size={16} color={form.award_type === key ? cat.color : "#94a3b8"} strokeWidth={1.8} />
                      <span style={{ color: form.award_type === key ? cat.color : "#374151" }}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Description" error={errors.description}>
              <textarea
                className={`${styles.textarea} ${errors.description ? styles.inputError : ""}`}
                rows={3}
                placeholder="Describe the purpose and scope of this scheme..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>

          </div>

          {/* Dates */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Application Period</h2>
            <div className={styles.twoCol}>
              <Field label="Open Date" error={errors.application_open_date}>
                <input
                  type="date"
                  className={`${styles.input} ${errors.application_open_date ? styles.inputError : ""}`}
                  value={form.application_open_date}
                  onChange={(e) => set("application_open_date", e.target.value)}
                />
              </Field>
              <Field label="Close Date" error={errors.application_close_date}>
                <input
                  type="date"
                  className={`${styles.input} ${errors.application_close_date ? styles.inputError : ""}`}
                  value={form.application_close_date}
                  onChange={(e) => set("application_close_date", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Academic Year">
              <input
                className={styles.input}
                placeholder="e.g. 2026/2027"
                value={form.academic_year}
                onChange={(e) => set("academic_year", e.target.value)}
              />
            </Field>
          </div>

        </div>

        {/* RIGHT — slots, amount, policy */}
        <div className={styles.rightCol}>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Award Details</h2>

            <Field label="Award Amount (₦)" error={errors.award_amount}>
              <input
                type="number"
                className={`${styles.input} ${errors.award_amount ? styles.inputError : ""}`}
                placeholder="e.g. 500000"
                value={form.award_amount}
                onChange={(e) => set("award_amount", e.target.value)}
              />
            </Field>

            <Field label="Total Slots" hint="Max applicants to approve" error={errors.total_slots}>
              <input
                type="number"
                className={`${styles.input} ${errors.total_slots ? styles.inputError : ""}`}
                placeholder="e.g. 50"
                value={form.total_slots}
                onChange={(e) => set("total_slots", e.target.value)}
              />
            </Field>

            <Field
              label="Stacking Policy"
              hint="Can this be combined with other awards?"
            >
              <select
                className={styles.input}
                value={form.stacking_policy}
                onChange={(e) => set("stacking_policy", e.target.value)}
              >
                <option value="exclusive">Exclusive — no other active awards</option>
                <option value="major_only">Major Only — no other major awards</option>
                <option value="open">Open — can stack with any award</option>
              </select>
            </Field>
          </div>

          {/* Preview card */}
          <div className={styles.previewCard}>
            <p className={styles.previewLabel}>Preview</p>
            <div className={styles.previewTop}>
              <div className={styles.previewIcon} style={{ background: category.bg }}>
                <CatIcon size={16} color={category.color} strokeWidth={1.8} />
              </div>
              <span className={styles.previewPill} style={{ color: "#f59e0b", background: "#fffbeb", border: "1px solid #fde68a" }}>
                Draft
              </span>
            </div>
            <p className={styles.previewName}>{form.name || "Scheme name"}</p>
            <span className={styles.previewChip} style={{ color: category.color, background: category.bg }}>
              {category.label}
            </span>
            <div className={styles.previewMeta}>
              <span>₦{form.award_amount ? Number(form.award_amount).toLocaleString() : "—"}</span>
              <span>·</span>
              <span>{form.total_slots || "—"} slots</span>
              <span>·</span>
              <span>{form.academic_year}</span>
            </div>
          </div>

          {/* Submit */}
          <div className={styles.submitWrap}>
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading || success}
            >
              {loading
                ? <><Loader2 size={15} strokeWidth={2} className={styles.spin} /> Creating...</>
                : <><Plus size={15} strokeWidth={2} /> Create Scheme</>
              }
            </button>
            <p className={styles.submitNote}>
              The scheme will be saved as a draft. You can publish it from the schemes page.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}