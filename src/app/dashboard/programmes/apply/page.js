"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap, Briefcase, Banknote,
  ArrowLeft, ArrowRight, AlertCircle, Check,
  UploadCloud, FileText, Trash2, Loader2, CheckCircle2,
} from "lucide-react";
import styles from "./apply-form.module.css";
import { getScheme, getSchemeFields, submitApplication, uploadDocument, getBanks, verifyBank, getBankDetail } from "@/services";

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
        ) : fileValue.uploading ? (
          <div className={styles.filePreview}>
            <Loader2 size={18} color="#15803d" style={{ animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 13, color: "#64748b" }}>Uploading...</span>
          </div>
        ) : (
          <div className={styles.filePreview}>
            <FileText size={18} color="#15803d" />
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{fileValue.file.name}</span>
              <span className={styles.fileSize}>{(fileValue.file.size / 1024).toFixed(1)} KB</span>
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

  const [scheme,     setScheme]     = useState(null);
  const [fields,     setFields]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Form state
  const [values,     setValues]     = useState({});
  const [files,      setFiles]      = useState({});
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [apiError,   setApiError]   = useState("");

  // Bank state
  const [banks,           setBanks]           = useState([]);
  const [bankCode,        setBankCode]        = useState("");
  const [bankName,        setBankName]        = useState("");
  const [accountNumber,   setAccountNumber]   = useState("");
  const [bankVerifying,   setBankVerifying]   = useState(false);
  const [bankResult,      setBankResult]      = useState(null); // { account_name, name_match }
  const [bankError,       setBankError]       = useState("");

  // Declaration state
  const [declaredExternal, setDeclaredExternal] = useState("");
  const [declarationRows,  setDeclarationRows]  = useState([
    { organisation: "", category: "", year: "" },
  ]);

  // Attestation
  const [attested, setAttested] = useState(false);

  // ── FETCH SCHEME + FIELDS + BANKS ────────────────────────────────────────
  useEffect(() => {
    if (!schemeId) { setFetchError("No scheme selected."); setLoading(false); return; }

    let cancelled = false;
    async function load() {
      try {
      const [schemeRes, fieldsRes, banksRes, bankDetailRes] = await Promise.all([
        getScheme(schemeId),
        getSchemeFields(schemeId),
        getBanks(),
        getBankDetail().catch(() => ({ data: null })),
      ]);

      const existing = bankDetailRes.data;
      if (existing?.account_number) {
        setBankCode(existing.bank_code || "");
        setBankName(existing.bank_name || "");
        setAccountNumber(existing.account_number || "");
        setBankResult({
          account_name: existing.account_name,
          name_match: { passed: true },
        });
      }
      if (cancelled) return;
      setScheme(schemeRes.data);
      setFields(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
      setBanks(Array.isArray(banksRes.data?.banks) ? banksRes.data.banks : []);
      } catch {
        if (!cancelled) setFetchError("Failed to load application form. Please go back and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [schemeId]);

  // ── HANDLERS ─────────────────────────────────────────────────────────────
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === "checkbox" ? checked : value }));
    setErrors((er) => ({ ...er, [name]: "" }));
    setApiError("");
  }

  async function handleFileChange(fieldName, file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { alert("File must not exceed 5MB."); return; }

    setFiles((f) => ({ ...f, [fieldName]: { file, uploading: true, url: null } }));
    setErrors((er) => ({ ...er, [fieldName]: "" }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadDocument(formData);
      setFiles((f) => ({ ...f, [fieldName]: { file, uploading: false, url: res.data.url } }));
    } catch {
      setFiles((f) => ({ ...f, [fieldName]: null }));
      setErrors((er) => ({ ...er, [fieldName]: "Upload failed. Please try again." }));
    }
  }

  function handleFileRemove(fieldName) {
    setFiles((f) => { const next = { ...f }; delete next[fieldName]; return next; });
  }

  // ── BANK HANDLERS ─────────────────────────────────────────────────────────
  function handleBankSelect(e) {
    const code = e.target.value;
    const selected = banks.find((b) => b.code === code);
    setBankCode(code);
    setBankName(selected?.name || "");
    setBankResult(null);
    setBankError("");
    setErrors((er) => ({ ...er, bank: "" }));
  }

  function handleAccountNumberChange(e) {
    setAccountNumber(e.target.value);
    setBankResult(null);
    setBankError("");
    setErrors((er) => ({ ...er, bank: "" }));
  }

  async function handleVerifyBank() {
    if (!bankCode) { setBankError("Please select a bank."); return; }
    if (accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
      setBankError("Account number must be exactly 10 digits.");
      return;
    }

    setBankVerifying(true);
    setBankError("");
    setBankResult(null);

    try {
      const res = await verifyBank({ account_number: accountNumber, bank_code: bankCode });
      setBankResult(res.data);
    } catch (err) {
      setBankError(
        err?.response?.data?.error || "Could not verify account. Please check the details and try again."
      );
    } finally {
      setBankVerifying(false);
    }
  }

  // ── DECLARATION ROWS ──────────────────────────────────────────────────────
  function handleDeclarationRowChange(index, field, value) {
    setDeclarationRows((rows) =>
      rows.map((row, i) => i === index ? { ...row, [field]: value } : row)
    );
  }

  function addDeclarationRow() {
    setDeclarationRows((rows) => [...rows, { organisation: "", category: "", year: "" }]);
  }

  function removeDeclarationRow(index) {
    setDeclarationRows((rows) => rows.filter((_, i) => i !== index));
  }

  // ── VALIDATION ────────────────────────────────────────────────────────────
  function validate() {
    const e = {};

    for (const field of fields) {
      if (!field.is_required) continue;
      if (field.field_type === "file") {
        if (!files[field.field_name]?.url) e[field.field_name] = "This document is required.";
      } else if (field.field_type === "checkbox") {
        if (!values[field.field_name]) e[field.field_name] = "Required.";
      } else {
        if (!values[field.field_name]?.toString().trim()) e[field.field_name] = "Required.";
      }
    }

    // Bank — must be verified before submit
    if (!bankResult) e.bank = "Please verify your bank account before submitting.";

    // Declaration
    if (!declaredExternal) e.declared_external = "Please select an option.";
    if (declaredExternal === "yes") {
      const hasEmpty = declarationRows.some(
        (r) => !r.organisation.trim() || !r.category.trim() || !r.year
      );
      if (hasEmpty) e.declaration_details = "Please complete all declaration rows.";
    }

    // Attestation
    if (!attested) e.attested = "You must agree to the declaration.";

    return e;
  }

  // ── SUBMIT ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const stillUploading = fields.some(
      (f) => f.field_type === "file" && files[f.field_name]?.uploading
    );
    if (stillUploading) {
      setApiError("Please wait for all files to finish uploading.");
      return;
    }

    setSubmitting(true);
    setApiError("");

    try {
      const programme_answers = {};
      for (const field of fields) {
        if (field.field_type !== "file") {
          programme_answers[field.field_name] = values[field.field_name] ?? "";
        }
      }

      const documents = {};
      for (const field of fields) {
        if (field.field_type === "file" && files[field.field_name]?.url) {
          documents[field.field_name] = files[field.field_name].url;
        }
      }

      const self_declaration_details = declaredExternal === "yes"
        ? declarationRows.map((r) => ({
            organisation: r.organisation.trim(),
            category:     r.category.trim(),
            year:         parseInt(r.year) || new Date().getFullYear(),
          }))
        : [];

      await submitApplication({
        scheme_id:                         schemeId,
        programme_answers,
        bank_account_number:               accountNumber,
        bank_code:                         bankCode,
        bank_name:                         bankName,
        bank_account_name:                 bankResult?.account_name || "",
        bank_name_match_passed:            bankResult?.name_match?.passed || false,
        self_declaration_received_support: declaredExternal === "yes",
        self_declaration_details,
        attestation_agreed:                attested,
        documents,
      });

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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

            {(() => {
              const rows = [];
              const sFields = section.fields;
              let i = 0;
              while (i < sFields.length) {
                const curr = sFields[i];
                const next = sFields[i + 1];
                const isFullWidth   = ["textarea", "file", "radio", "checkbox"].includes(curr.field_type);
                const nextFullWidth = next && ["textarea", "file", "radio", "checkbox"].includes(next.field_type);

                if (!isFullWidth && next && !nextFullWidth) {
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

        {/* BANK DETAILS */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>{sections.length + 1}</span>
            <div>
              <h2 className={styles.sectionTitle}>Bank Details</h2>
              <p className={styles.sectionSub}>
                Verify your bank account. This is where your award will be paid if approved.
              </p>
            </div>
          </div>

          <div className={styles.grid2}>
            {/* Bank dropdown */}
            <div className={styles.field}>
              <label className={styles.label}>
                Bank <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>
              </label>
              <select
                className={`${styles.input} ${errors.bank && !bankCode ? styles.inputError : ""}`}
                value={bankCode}
                onChange={handleBankSelect}
              >
                <option value="">Select your bank</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Account number */}
            <div className={styles.field}>
              <label className={styles.label}>
                Account Number <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>
              </label>
              <input
                className={`${styles.input} ${errors.bank && !bankResult ? styles.inputError : ""}`}
                placeholder="10-digit account number"
                value={accountNumber}
                onChange={handleAccountNumberChange}
                maxLength={10}
              />
            </div>
          </div>

          {/* Verify button */}
          {!bankResult && (
            <button
              type="button"
              onClick={handleVerifyBank}
              disabled={bankVerifying}
              style={{
                marginTop: 4, display: "flex", alignItems: "center", gap: 8,
                padding: "9px 20px", borderRadius: 9, border: "1px solid #bbf7d0",
                background: "#f0fdf4", color: "#15803d", fontSize: 13,
                fontWeight: 600, cursor: bankVerifying ? "not-allowed" : "pointer",
                opacity: bankVerifying ? 0.7 : 1,
              }}
            >
              {bankVerifying
                ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Verifying...</>
                : "Verify Account"
              }
            </button>
          )}

          {/* Bank error */}
          {bankError && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginTop: 10,
              fontSize: 13, color: "#dc2626",
            }}>
              <AlertCircle size={14} strokeWidth={2} />
              <span>{bankError}</span>
            </div>
          )}

          {/* Verification result */}
          {bankResult && (
            <div style={{
              marginTop: 12, padding: "12px 16px", borderRadius: 10,
              background: bankResult.name_match?.passed ? "#f0fdf4" : "#fffbeb",
              border: `1px solid ${bankResult.name_match?.passed ? "#bbf7d0" : "#fde68a"}`,
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2
                  size={15}
                  color={bankResult.name_match?.passed ? "#15803d" : "#b45309"}
                  strokeWidth={2}
                />
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: bankResult.name_match?.passed ? "#15803d" : "#b45309",
                }}>
                  {bankResult.account_name}
                </span>
              </div>
              {!bankResult.name_match?.passed && (
                <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
                  Name does not exactly match your profile. An admin will review this manually.
                </p>
              )}
              <button
                type="button"
                onClick={() => { setBankResult(null); setBankCode(""); setBankName(""); setAccountNumber(""); }}
                style={{
                  alignSelf: "flex-start", fontSize: 12, color: "#64748b",
                  background: "none", border: "none", cursor: "pointer",
                  padding: 0, textDecoration: "underline",
                }}
              >
                Use a different account
              </button>
            </div>
          )}

          {errors.bank && !bankResult && (
            <span className={styles.error} style={{ marginTop: 8, display: "block" }}>
              {errors.bank}
            </span>
          )}
        </div>

        {/* SELF-DECLARATION */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>{sections.length + 2}</span>
            <div>
              <h2 className={styles.sectionTitle}>Self-Declaration</h2>
              <p className={styles.sectionSub}>
                Have you received support from any HCDT, NGO, or government programme in the past 1 year?
              </p>
            </div>
          </div>

          <div className={styles.radioGroup}>
            <label className={`${styles.radioCard} ${declaredExternal === "no" ? styles.radioCardActive : ""}`}>
              <input
                type="radio"
                name="declared_external"
                value="no"
                onChange={() => { setDeclaredExternal("no"); setErrors((er) => ({ ...er, declared_external: "" })); }}
              />
              <span className={styles.radioLabel}>No, I have not received any external support</span>
            </label>
            <label className={`${styles.radioCard} ${declaredExternal === "yes" ? styles.radioCardActive : ""}`}>
              <input
                type="radio"
                name="declared_external"
                value="yes"
                onChange={() => { setDeclaredExternal("yes"); setErrors((er) => ({ ...er, declared_external: "" })); }}
              />
              <span className={styles.radioLabel}>Yes, I have received external support</span>
            </label>
          </div>
          {errors.declared_external && <span className={styles.error}>{errors.declared_external}</span>}

          {declaredExternal === "yes" && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: "#64748b" }}>
                List each organisation below. Add a new row for each one.
              </p>
              {declarationRows.map((row, index) => (
                <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px auto", gap: 8, alignItems: "start" }}>
                  <div className={styles.field} style={{ marginBottom: 0 }}>
                    {index === 0 && <label className={styles.label}>Organisation</label>}
                    <input
                      className={styles.input}
                      placeholder="e.g. NDDC"
                      value={row.organisation}
                      onChange={(e) => handleDeclarationRowChange(index, "organisation", e.target.value)}
                    />
                  </div>
                  <div className={styles.field} style={{ marginBottom: 0 }}>
                    {index === 0 && <label className={styles.label}>Category</label>}
                    <input
                      className={styles.input}
                      placeholder="e.g. Grant"
                      value={row.category}
                      onChange={(e) => handleDeclarationRowChange(index, "category", e.target.value)}
                    />
                  </div>
                  <div className={styles.field} style={{ marginBottom: 0 }}>
                    {index === 0 && <label className={styles.label}>Year</label>}
                    <input
                      className={styles.input}
                      placeholder="e.g. 2024"
                      value={row.year}
                      onChange={(e) => handleDeclarationRowChange(index, "year", e.target.value)}
                    />
                  </div>
                  <div style={{ paddingTop: index === 0 ? 22 : 0 }}>
                    {declarationRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDeclarationRow(index)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "#ef4444", padding: "8px 4px",
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {errors.declaration_details && (
                <span className={styles.error}>{errors.declaration_details}</span>
              )}
              <button
                type="button"
                onClick={addDeclarationRow}
                style={{
                  alignSelf: "flex-start", fontSize: 13, color: "#15803d",
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                }}
              >
                + Add another
              </button>
            </div>
          )}
        </div>

        {/* ATTESTATION */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>{sections.length + 3}</span>
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