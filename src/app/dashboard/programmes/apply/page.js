"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap, Briefcase, Wrench, Banknote,
  ArrowLeft, ArrowRight, AlertCircle, Check,
  UploadCloud, FileText, Trash2, Loader2,
} from "lucide-react";
import styles from "./apply-form.module.css";
import { getScheme, getSchemeFields, submitApplication } from "@/services";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", icon: GraduationCap },
  empowerment: { color: "#b45309", bg: "#fffbeb", border: "#fde68a", icon: Briefcase     },
  grant:       { color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff", icon: Banknote      },
};

// ── GROUP FIELDS BY SECTION ───────────────────────────────────────────────────
function groupBySection(fields) {
  const sections = [];
  const seen = {};
  for (const field of fields) {
    const sec = field.section || "Other";
    if (!seen[sec]) {
      seen[sec] = { title: sec, fields: [] };
      sections.push(seen[sec]);
    }
    seen[sec].fields.push(field);
  }
  return sections;
}

// ── DYNAMIC FIELD RENDERER ────────────────────────────────────────────────────
function DynamicField({ field, value, onChange, error, fileValue, onFileChange, onFileRemove }) {
  const { field_name, field_label, field_type, placeholder, is_required, options } = field;

  const label = (
    <label className={styles.label}>
      {field_label}
      {is_required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
    </label>
  );

  if (field_type === "textarea") {
    return (
      <div className={styles.field}>
        {label}
        <textarea
          name={field_name}
          value={value || ""}
          onChange={onChange}
          placeholder={placeholder || ""}
          rows={3}
          className={`${styles.textarea} ${error ? styles.inputError : ""}`}
        />
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }

  if (field_type === "select") {
    return (
      <div className={styles.field}>
        {label}
        <select
          name={field_name}
          value={value || ""}
          onChange={onChange}
          className={`${styles.input} ${error ? styles.inputError : ""}`}
        >
          <option value="">Select an option</option>
          {(options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }

  if (field_type === "radio") {
    return (
      <div className={styles.field}>
        {label}
        <div className={styles.radioGroup}>
          {(options || []).map((opt) => (
            <label
              key={opt}
              className={`${styles.radioCard} ${value === opt ? styles.radioCardActive : ""}`}
            >
              <input
                type="radio"
                name={field_name}
                value={opt}
                checked={value === opt}
                onChange={onChange}
              />
              <span className={styles.radioLabel}>{opt}</span>
            </label>
          ))}
        </div>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }

  if (field_type === "checkbox") {
    return (
      <div className={styles.field}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            name={field_name}
            checked={!!value}
            onChange={onChange}
            className={styles.checkbox}
          />
          <span className={styles.checkLabel}>{field_label}</span>
        </label>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }

  if (field_type === "file") {
    return (
      <div className={styles.field}>
        {label}
        {!fileValue ? (
          <label className={`${styles.uploadArea} ${error ? styles.uploadError : ""}`}>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => onFileChange(field_name, e.target.files[0])}
              style={{ display: "none" }}
            />
            <UploadCloud size={22} color="#94a3b8" />
            <span className={styles.uploadTitle}>Click to upload</span>
            <span className={styles.uploadHint}>PDF, JPG or PNG · Max 5MB</span>
          </label>
        ) : (
          <div className={styles.filePreview}>
            <FileText size={18} color="#15803d" />
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{fileValue.name}</span>
              <span className={styles.fileSize}>{(fileValue.size / 1024).toFixed(1)} KB</span>
            </div>
            <button
              type="button"
              onClick={() => onFileRemove(field_name)}
              className={styles.fileRemove}
            >
              <Trash2 size={14} color="#ef4444" />
            </button>
          </div>
        )}
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }

  // Default: text / number
  return (
    <div className={styles.field}>
      {label}
      <input
        type={field_type === "number" ? "number" : "text"}
        name={field_name}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder || ""}
        className={`${styles.input} ${error ? styles.inputError : ""}`}
      />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function DynamicApplyPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const schemeId     = searchParams.get("scheme_id");

  const [scheme,    setScheme]    = useState(null);
  const [fields,    setFields]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Form state
  const [values,    setValues]    = useState({});       // text/select/radio/checkbox
  const [files,     setFiles]     = useState({});       // file fields
  const [errors,    setErrors]    = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [apiError,   setApiError]   = useState("");

  // Declaration state (always shown)
  const [declaredExternal,    setDeclaredExternal]    = useState("");
  const [declarationDetails,  setDeclarationDetails]  = useState("");
  const [attested,            setAttested]            = useState(false);

  // ── FETCH SCHEME + FIELDS ─────────────────────────────────────────────────
  useEffect(() => {
    if (!schemeId) { setFetchError("No scheme selected."); setLoading(false); return; }

    async function load() {
      try {
        const [schemeRes, fieldsRes] = await Promise.all([
          getScheme(schemeId),
          getSchemeFields(schemeId),
        ]);
        setScheme(schemeRes.data);
        setFields(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
      } catch {
        setFetchError("Failed to load application form. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [schemeId]);

  // ── HANDLERS ─────────────────────────────────────────────────────────────
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === "checkbox" ? checked : value }));
    setErrors((er) => ({ ...er, [name]: "" }));
    setApiError("");
  }

  function handleFileChange(fieldName, file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { alert("File must not exceed 5MB."); return; }
    setFiles((f) => ({ ...f, [fieldName]: file }));
    setErrors((er) => ({ ...er, [fieldName]: "" }));
  }

  function handleFileRemove(fieldName) {
    setFiles((f) => { const next = { ...f }; delete next[fieldName]; return next; });
  }

  // ── VALIDATION ────────────────────────────────────────────────────────────
  function validate() {
    const e = {};

    for (const field of fields) {
      if (!field.is_required) continue;
      if (field.field_type === "file") {
        if (!files[field.field_name]) e[field.field_name] = "This document is required.";
      } else if (field.field_type === "checkbox") {
        if (!values[field.field_name]) e[field.field_name] = "Required.";
      } else {
        if (!values[field.field_name]?.toString().trim()) e[field.field_name] = "Required.";
      }
    }

    // Declaration
    if (!declaredExternal) e.declared_external = "Please select an option.";
    if (declaredExternal === "yes" && !declarationDetails.trim())
      e.declaration_details = "Please provide details.";

    // Attestation
    if (!attested) e.attested = "You must agree to the declaration.";

    return e;
  }

  // ── SUBMIT ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    setApiError("");

    try {
      const formData = new FormData();
      formData.append("scheme_id", schemeId);
      formData.append("category",  scheme.award_type);

      // Dynamic fields
      for (const field of fields) {
        if (field.field_type === "file") {
          if (files[field.field_name]) formData.append(field.field_name, files[field.field_name]);
        } else {
          formData.append(field.field_name, values[field.field_name] ?? "");
        }
      }

      // Declaration + attestation
      formData.append("declared_external",   declaredExternal);
      formData.append("declaration_details", declarationDetails);
      formData.append("attested",            attested);

      await submitApplication(formData);
      setSubmitted(true);

    } catch (err) {
      setApiError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Submission failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <Loader2 size={28} color="#15803d" style={{ animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  // ── FETCH ERROR ───────────────────────────────────────────────────────────
  if (fetchError || !scheme) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/programmes")}>
          <ArrowLeft size={15} strokeWidth={2} /> Back to Programmes
        </button>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, padding: "48px 0", textAlign: "center",
        }}>
          <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
          <p style={{ color: "#ef4444", fontWeight: 600, fontSize: 14 }}>
            {fetchError || "Scheme not found."}
          </p>
        </div>
      </div>
    );
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className={styles.successPage}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <Check size={28} strokeWidth={2.5} color="#15803d" />
          </div>
          <h1 className={styles.successTitle}>Application Submitted</h1>
          <p className={styles.successDesc}>
            Your application for <strong>{scheme.name}</strong> has been submitted and is under review.
            You will be notified of the outcome.
          </p>
          <button className={styles.successBtn} onClick={() => router.push("/dashboard/applications")}>
            View My Applications <ArrowRight size={14} strokeWidth={2} />
          </button>
          <button className={styles.successBack} onClick={() => router.push("/dashboard/programmes")}>
            Back to Programmes
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  const catKey   = (scheme.award_type || "scholarship").toLowerCase();
  const cat      = categoryConfig[catKey] || categoryConfig.scholarship;
  const CatIcon  = cat.icon;
  const sections = groupBySection(fields);
  const totalSections = sections.length + 2; // +Self-Declaration +Attestation

  return (
    <div className={styles.page}>

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/dashboard/programmes")}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to Programmes
      </button>

      {/* HEADER */}
      <div className={styles.formHeader}>
        <div className={styles.formHeaderIcon} style={{ background: cat.color }}>
          <CatIcon size={22} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div className={styles.formCat} style={{ color: cat.color, background: cat.bg, borderColor: cat.border }}>
            {scheme.award_type?.charAt(0).toUpperCase() + scheme.award_type?.slice(1)}
          </div>
          <h1 className={styles.formTitle}>{scheme.name}</h1>
          <p className={styles.formSub}>Complete all fields accurately. Submission is final.</p>
        </div>
      </div>

      {/* API ERROR */}
      {apiError && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 10, padding: "12px 16px",
          fontSize: 13, color: "#dc2626",
        }}>
          <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{apiError}</span>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>

        {/* DYNAMIC SECTIONS */}
        {sections.map((section, sIndex) => (
          <div key={section.title} className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>{sIndex + 1}</span>
              <div>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
              </div>
            </div>

            {/* Pair fields into rows of 2 where possible */}
            {(() => {
              const rows = [];
              const sFields = section.fields;
              let i = 0;
              while (i < sFields.length) {
                const curr = sFields[i];
                const next = sFields[i + 1];
                // Full-width: textarea, file, radio, checkbox
                const isFullWidth = ["textarea", "file", "radio", "checkbox"].includes(curr.field_type);
                // Next field full-width too
                const nextFullWidth = next && ["textarea", "file", "radio", "checkbox"].includes(next.field_type);

                if (!isFullWidth && next && !nextFullWidth) {
                  // Pair two inline fields side by side
                  rows.push(
                    <div key={curr.field_name} className={styles.grid2}>
                      <DynamicField
                        field={curr}
                        value={values[curr.field_name]}
                        onChange={handleChange}
                        error={errors[curr.field_name]}
                        fileValue={files[curr.field_name]}
                        onFileChange={handleFileChange}
                        onFileRemove={handleFileRemove}
                      />
                      <DynamicField
                        field={next}
                        value={values[next.field_name]}
                        onChange={handleChange}
                        error={errors[next.field_name]}
                        fileValue={files[next.field_name]}
                        onFileChange={handleFileChange}
                        onFileRemove={handleFileRemove}
                      />
                    </div>
                  );
                  i += 2;
                } else {
                  // Full width
                  rows.push(
                    <DynamicField
                      key={curr.field_name}
                      field={curr}
                      value={values[curr.field_name]}
                      onChange={handleChange}
                      error={errors[curr.field_name]}
                      fileValue={files[curr.field_name]}
                      onFileChange={handleFileChange}
                      onFileRemove={handleFileRemove}
                    />
                  );
                  i += 1;
                }
              }
              return rows;
            })()}
          </div>
        ))}

        {/* SELF-DECLARATION — always shown */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>{sections.length + 1}</span>
            <div>
              <h2 className={styles.sectionTitle}>Self-Declaration</h2>
              <p className={styles.sectionSub}>
                Have you received support from any HCDT, NGO, or government programme in the past 1 year?
              </p>
            </div>
          </div>

          <div className={styles.radioGroup}>
            <label className={`${styles.radioCard} ${declaredExternal === "no" ? styles.radioCardActive : ""}`}>
              <input type="radio" name="declared_external" value="no"
                onChange={(e) => { setDeclaredExternal("no"); setErrors((er) => ({ ...er, declared_external: "" })); }} />
              <span className={styles.radioLabel}>No, I have not received any external support</span>
            </label>
            <label className={`${styles.radioCard} ${declaredExternal === "yes" ? styles.radioCardActive : ""}`}>
              <input type="radio" name="declared_external" value="yes"
                onChange={(e) => { setDeclaredExternal("yes"); setErrors((er) => ({ ...er, declared_external: "" })); }} />
              <span className={styles.radioLabel}>Yes, I have received external support</span>
            </label>
          </div>
          {errors.declared_external && <span className={styles.error}>{errors.declared_external}</span>}

          {declaredExternal === "yes" && (
            <div className={styles.field}>
              <label className={styles.label}>Provide details (organisation, category, year)</label>
              <textarea
                value={declarationDetails}
                onChange={(e) => { setDeclarationDetails(e.target.value); setErrors((er) => ({ ...er, declaration_details: "" })); }}
                rows={3}
                placeholder="e.g. NDDC Grant, 2025"
                className={`${styles.textarea} ${errors.declaration_details ? styles.inputError : ""}`}
              />
              {errors.declaration_details && <span className={styles.error}>{errors.declaration_details}</span>}
            </div>
          )}
        </div>

        {/* ATTESTATION — always shown */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>{sections.length + 2}</span>
            <div>
              <h2 className={styles.sectionTitle}>Attestation</h2>
            </div>
          </div>

          <div className={styles.attestBox}>
            <AlertCircle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
            <p className={styles.attestText}>
              I confirm that all information provided in this application is true, accurate,
              and complete to the best of my knowledge. I understand that providing false or
              misleading information will result in the rejection of this application and may
              result in my disqualification from programmes administered by RMHCDT.
            </p>
          </div>

          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => { setAttested(e.target.checked); setErrors((er) => ({ ...er, attested: "" })); }}
              className={styles.checkbox}
            />
            <span className={styles.checkLabel}>I have read and I agree to the above declaration</span>
          </label>
          {errors.attested && <span className={styles.error}>{errors.attested}</span>}
        </div>

        {/* SUBMIT */}
        <div className={styles.formFooter}>
          <button type="submit" className={styles.submitBtn} disabled={submitting || !schemeId}>
            {submitting
              ? "Submitting..."
              : <> Submit Application <ArrowRight size={15} strokeWidth={2} /></>
            }
          </button>
        </div>

      </form>
    </div>
  );
}