"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Banknote, ArrowLeft, ArrowRight, ShieldCheck,
  AlertCircle, Check, UploadCloud, FileText, Trash2,
} from "lucide-react";
import styles from "../apply-form.module.css";
import { submitApplication } from "@/services";
import { getBankDetail } from "@/services/students";

const MAX_SIZE = 5 * 1024 * 1024;

const NIGERIAN_BANKS = [
  "Access Bank", "Citibank Nigeria", "EcoBank Nigeria", "Fidelity Bank",
  "First Bank of Nigeria", "First City Monument Bank (FCMB)", "Globus Bank",
  "Guaranty Trust Bank (GTBank)", "Heritage Bank", "Keystone Bank",
  "Lotus Bank", "Optimus Bank", "Polaris Bank", "Providus Bank",
  "Stanbic IBTC Bank", "Standard Chartered Bank", "Sterling Bank",
  "SunTrust Bank", "Titan Trust Bank", "Union Bank of Nigeria",
  "United Bank for Africa (UBA)", "Unity Bank", "Wema Bank", "Zenith Bank",
];

export default function GrantForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const schemeId     = searchParams.get("scheme_id");

  const [form, setForm] = useState({
    grant_purpose:           "",
    business_plan_desc:      "",
    amount_requested:        "",
    expected_beneficiaries:  "",
    bank_name:               "",
    account_number:          "",
    account_name:            "",
    declared_external:       "",
    declaration_details:     "",
    attested:                false,
  });

  const [businessPlan, setBusinessPlan] = useState(null);
  const [errors,       setErrors]       = useState({});
  const [loading,      setLoading]      = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [apiError,     setApiError]     = useState("");

  useEffect(() => {
    getBankDetail()
      .then((res) => {
        const b = res.data;
        if (b) {
          setForm((f) => ({
            ...f,
            bank_name:      b.bank_name      || "",
            account_number: b.account_number || "",
            account_name:   b.account_name   || "",
          }));
        }
      })
      .catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    setErrors((er) => ({ ...er, [name]: "" }));
    setApiError("");
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_SIZE) { alert("File must not exceed 5MB."); return; }
    setBusinessPlan(file);
    setErrors((er) => ({ ...er, business_plan: "" }));
  }

  function validate() {
    const e = {};
    if (!schemeId)                           e.scheme                 = "Invalid scheme. Please go back and try again.";
    if (!form.grant_purpose.trim())          e.grant_purpose          = "Required";
    if (!form.business_plan_desc.trim())     e.business_plan_desc     = "Required";
    if (!form.amount_requested.trim())       e.amount_requested       = "Required";
    if (!form.expected_beneficiaries.trim()) e.expected_beneficiaries = "Required";
    if (!businessPlan)                       e.business_plan          = "Please upload your business plan";
    if (!form.bank_name)                     e.bank_name              = "Required";
    if (!form.account_number.trim())         e.account_number         = "Required";
    else if (!/^\d{10}$/.test(form.account_number.trim())) e.account_number = "Account number must be 10 digits";
    if (!form.account_name.trim())           e.account_name           = "Required";
    if (!form.declared_external)             e.declared_external      = "Required";
    if (form.declared_external === "yes" && !form.declaration_details.trim())
      e.declaration_details = "Please provide details";
    if (!form.attested) e.attested = "You must attest to this declaration";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");

    try {
      const formData = new FormData();
      formData.append("scheme_id",              schemeId);
      formData.append("grant_purpose",          form.grant_purpose);
      formData.append("business_plan_desc",     form.business_plan_desc);
      formData.append("amount_requested",       form.amount_requested);
      formData.append("expected_beneficiaries", form.expected_beneficiaries);
      formData.append("bank_name",              form.bank_name);
      formData.append("account_number",         form.account_number);
      formData.append("account_name",           form.account_name);
      formData.append("declared_external",      form.declared_external);
      formData.append("declaration_details",    form.declaration_details);
      formData.append("attested",               form.attested);
      formData.append("category",               "grant");
      if (businessPlan) formData.append("business_plan", businessPlan);

      await submitApplication(formData);
      setSubmitted(true);

    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Submission failed. Please try again.";
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.successPage}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <Check size={28} strokeWidth={2.5} color="#15803d" />
          </div>
          <h1 className={styles.successTitle}>Application Submitted</h1>
          <p className={styles.successDesc}>
            Your Grant application has been submitted and is under verification.
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

  return (
    <div className={styles.page}>

      <button className={styles.backBtn} onClick={() => router.push("/dashboard/programmes")}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to Programmes
      </button>

      <div className={styles.formHeader}>
        <div className={styles.formHeaderIcon} style={{ background: "#7e22ce" }}>
          <Banknote size={22} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div className={styles.formCat} style={{ color: "#7e22ce", background: "#faf5ff", borderColor: "#e9d5ff" }}>
            Grant
          </div>
          <h1 className={styles.formTitle}>2026 SME Business Startup Grant</h1>
          <p className={styles.formSub}>Complete all fields accurately. Submission is final.</p>
        </div>
      </div>

      {apiError && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
          <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{apiError}</span>
        </div>
      )}

      {!schemeId && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#b45309" }}>
          <AlertCircle size={16} strokeWidth={2} />
          <span>No scheme selected. Please go back to Programmes and click Apply.</span>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>

        {/* SECTION 1: GRANT DETAILS */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>1</span>
            <div>
              <h2 className={styles.sectionTitle}>Grant Details</h2>
              <p className={styles.sectionSub}>Provide details about your proposed project or business.</p>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Grant Purpose</label>
            <textarea name="grant_purpose" value={form.grant_purpose} onChange={handleChange}
              rows={3} placeholder="Describe the purpose of the grant and what it will be used for..."
              className={`${styles.textarea} ${errors.grant_purpose ? styles.inputError : ""}`} />
            {errors.grant_purpose && <span className={styles.error}>{errors.grant_purpose}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Business Plan Summary</label>
            <textarea name="business_plan_desc" value={form.business_plan_desc} onChange={handleChange}
              rows={4} placeholder="Provide a brief summary of your business plan and how you intend to use the funds..."
              className={`${styles.textarea} ${errors.business_plan_desc ? styles.inputError : ""}`} />
            {errors.business_plan_desc && <span className={styles.error}>{errors.business_plan_desc}</span>}
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Amount Requested (₦)</label>
              <input name="amount_requested" value={form.amount_requested} onChange={handleChange}
                placeholder="e.g. 500,000"
                className={`${styles.input} ${errors.amount_requested ? styles.inputError : ""}`} />
              {errors.amount_requested && <span className={styles.error}>{errors.amount_requested}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Expected Beneficiaries</label>
              <input name="expected_beneficiaries" value={form.expected_beneficiaries} onChange={handleChange}
                placeholder="e.g. 10 community members"
                className={`${styles.input} ${errors.expected_beneficiaries ? styles.inputError : ""}`} />
              {errors.expected_beneficiaries && <span className={styles.error}>{errors.expected_beneficiaries}</span>}
            </div>
          </div>
        </div>

        {/* SECTION 2: BUSINESS PLAN DOCUMENT */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>2</span>
            <div>
              <h2 className={styles.sectionTitle}>Business Plan Document</h2>
              <p className={styles.sectionSub}>Upload your full business plan document.</p>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Business Plan</label>
            {!businessPlan ? (
              <label className={`${styles.uploadArea} ${errors.business_plan ? styles.uploadError : ""}`}>
                <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={handleFile} style={{ display: "none" }} />
                <UploadCloud size={22} color="#94a3b8" />
                <span className={styles.uploadTitle}>Click to upload business plan</span>
                <span className={styles.uploadHint}>PDF, JPG or PNG · Max 5MB</span>
              </label>
            ) : (
              <div className={styles.filePreview}>
                <FileText size={18} color="#7e22ce" />
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{businessPlan.name}</span>
                  <span className={styles.fileSize}>{(businessPlan.size / 1024).toFixed(1)} KB</span>
                </div>
                <button type="button" onClick={() => setBusinessPlan(null)} className={styles.fileRemove}>
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            )}
            {errors.business_plan && <span className={styles.error}>{errors.business_plan}</span>}
          </div>
        </div>

        {/* SECTION 3: BANK DETAILS */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>3</span>
            <div>
              <h2 className={styles.sectionTitle}>Bank Details</h2>
              <p className={styles.sectionSub}>Grant disbursements will be made to this account. Ensure details are accurate.</p>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Bank Name</label>
              <select name="bank_name" value={form.bank_name} onChange={handleChange}
                className={`${styles.input} ${errors.bank_name ? styles.inputError : ""}`}>
                <option value="">Select bank</option>
                {NIGERIAN_BANKS.map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
              {errors.bank_name && <span className={styles.error}>{errors.bank_name}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Account Number</label>
              <input name="account_number" value={form.account_number} onChange={handleChange}
                placeholder="10-digit account number" maxLength={10}
                className={`${styles.input} ${errors.account_number ? styles.inputError : ""}`} />
              {errors.account_number && <span className={styles.error}>{errors.account_number}</span>}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Account Name</label>
            <input name="account_name" value={form.account_name} onChange={handleChange}
              placeholder="Name as it appears on your bank account"
              className={`${styles.input} ${errors.account_name ? styles.inputError : ""}`} />
            {errors.account_name && <span className={styles.error}>{errors.account_name}</span>}
            <span className={styles.hint}>Must match your BVN-linked account name exactly.</span>
          </div>
        </div>

        {/* SECTION 4: SELF-DECLARATION */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>4</span>
            <div>
              <h2 className={styles.sectionTitle}>Self-Declaration</h2>
              <p className={styles.sectionSub}>Have you received support from any HCDT, NGO, or government programme in the past 1 year?</p>
            </div>
          </div>
          <div className={styles.radioGroup}>
            <label className={`${styles.radioCard} ${form.declared_external === "no" ? styles.radioCardActive : ""}`}>
              <input type="radio" name="declared_external" value="no" onChange={handleChange} />
              <span className={styles.radioLabel}>No, I have not received any external support</span>
            </label>
            <label className={`${styles.radioCard} ${form.declared_external === "yes" ? styles.radioCardActive : ""}`}>
              <input type="radio" name="declared_external" value="yes" onChange={handleChange} />
              <span className={styles.radioLabel}>Yes, I have received external support</span>
            </label>
          </div>
          {errors.declared_external && <span className={styles.error}>{errors.declared_external}</span>}
          {form.declared_external === "yes" && (
            <div className={styles.field} style={{ marginTop: 12 }}>
              <label className={styles.label}>Provide details (organisation, category, year)</label>
              <textarea name="declaration_details" value={form.declaration_details} onChange={handleChange}
                rows={3} placeholder="e.g. NDDC Grant, 2025"
                className={`${styles.textarea} ${errors.declaration_details ? styles.inputError : ""}`} />
              {errors.declaration_details && <span className={styles.error}>{errors.declaration_details}</span>}
            </div>
          )}
        </div>

        {/* SECTION 5: ATTESTATION */}
        <div className={styles.section}>
          <div className={styles.attestBox}>
            <AlertCircle size={16} color="#b45309" />
            <p className={styles.attestText}>
              I confirm that all information provided in this application is true, accurate,
              and complete to the best of my knowledge. I understand that providing false or
              misleading information will result in the rejection of this application and may
              result in my disqualification from programmes administered by RMHCDT.
            </p>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" name="attested" checked={form.attested} onChange={handleChange} className={styles.checkbox} />
            <span className={styles.checkLabel}>I have read and I agree to the above declaration</span>
          </label>
          {errors.attested && <span className={styles.error}>{errors.attested}</span>}
        </div>

        {/* SUBMIT */}
        <div className={styles.formFooter}>
          <button type="submit" className={styles.submitBtn} disabled={loading || !schemeId}>
            {loading ? "Submitting..." : <>Submit Application <ArrowRight size={15} strokeWidth={2} /></>}
          </button>
        </div>

      </form>
    </div>
  );
}