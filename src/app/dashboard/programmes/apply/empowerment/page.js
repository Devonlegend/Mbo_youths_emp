"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, ArrowLeft, ArrowRight, ShieldCheck, AlertCircle, Check } from "lucide-react";
import styles from "../apply-form.module.css";
import { submitApplication } from "@/services";

export default function EmpowermentForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const schemeId     = searchParams.get("scheme_id");

  const [form, setForm] = useState({
    trade:               "",
    current_status:      "",
    support_needed:      "",
    equipment:           "",
    business_location:   "",
    declared_external:   "",
    declaration_details: "",
    attested:            false,
  });

  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError,  setApiError]  = useState("");

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    setErrors((er) => ({ ...er, [name]: "" }));
    setApiError("");
  }

  function validate() {
    const e = {};
    if (!schemeId)                     e.scheme            = "Invalid scheme. Please go back and try again.";
    if (!form.trade.trim())            e.trade             = "Required";
    if (!form.current_status)          e.current_status    = "Required";
    if (!form.support_needed.trim())   e.support_needed    = "Required";
    if (!form.business_location.trim())e.business_location = "Required";
    if (!form.declared_external)       e.declared_external = "Required";
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

      formData.append("scheme_id",           schemeId);
      formData.append("trade",               form.trade);
      formData.append("current_status",      form.current_status);
      formData.append("support_needed",      form.support_needed);
      formData.append("equipment",           form.equipment);
      formData.append("business_location",   form.business_location);
      formData.append("declared_external",   form.declared_external);
      formData.append("declaration_details", form.declaration_details);
      formData.append("attested",            form.attested);
      formData.append("category",            "empowerment");

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

  // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className={styles.successPage}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <Check size={28} strokeWidth={2.5} color="#15803d" />
          </div>
          <h1 className={styles.successTitle}>Application Submitted</h1>
          <p className={styles.successDesc}>
            Your Empowerment application has been submitted and is under verification.
            You will be notified of the outcome.
          </p>
          <button className={styles.successBtn}
            onClick={() => router.push("/dashboard/applications")}>
            View My Applications <ArrowRight size={14} strokeWidth={2} />
          </button>
          <button className={styles.successBack}
            onClick={() => router.push("/dashboard/programmes")}>
            Back to Programmes
          </button>
        </div>
      </div>
    );
  }

  // ── FORM ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      <button className={styles.backBtn} onClick={() => router.push("/dashboard/programmes")}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to Programmes
      </button>

      <div className={styles.formHeader}>
        <div className={styles.formHeaderIcon} style={{ background: "#b45309" }}>
          <Briefcase size={22} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div className={styles.formCat}
            style={{ color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" }}>
            Empowerment
          </div>
          <h1 className={styles.formTitle}>Youth Empowerment Starter Pack 2026</h1>
          <p className={styles.formSub}>Complete all fields accurately. Submission is final.</p>
        </div>
      </div>

      {/* API error banner */}
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

      {/* Missing scheme_id warning */}
      {!schemeId && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 10, padding: "12px 16px",
          fontSize: 13, color: "#b45309",
        }}>
          <AlertCircle size={16} strokeWidth={2} />
          <span>No scheme selected. Please go back to Programmes and click Apply.</span>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>

        {/* SECTION 1: BUSINESS / TRADE INFO */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>1</span>
            <div>
              <h2 className={styles.sectionTitle}>Business / Trade Information</h2>
              <p className={styles.sectionSub}>Details about your trade or income-generating activity.</p>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Trade / Skill</label>
              <input name="trade" value={form.trade} onChange={handleChange}
                placeholder="e.g. Tailoring, Welding, Catering"
                className={`${styles.input} ${errors.trade ? styles.inputError : ""}`} />
              {errors.trade && <span className={styles.error}>{errors.trade}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Current Status</label>
              <select name="current_status" value={form.current_status} onChange={handleChange}
                className={`${styles.input} ${errors.current_status ? styles.inputError : ""}`}>
                <option value="">Select status</option>
                <option value="Starting">Just starting out</option>
                <option value="Existing">Existing business (expanding)</option>
                <option value="Cooperative">Part of a cooperative</option>
              </select>
              {errors.current_status && <span className={styles.error}>{errors.current_status}</span>}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Support Needed</label>
            <textarea name="support_needed" value={form.support_needed} onChange={handleChange}
              rows={3} placeholder="Describe the specific support or equipment you need..."
              className={`${styles.textarea} ${errors.support_needed ? styles.inputError : ""}`} />
            {errors.support_needed && <span className={styles.error}>{errors.support_needed}</span>}
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Equipment List (optional)</label>
              <input name="equipment" value={form.equipment} onChange={handleChange}
                placeholder="e.g. Sewing machine, Generator"
                className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Business Location</label>
              <input name="business_location" value={form.business_location} onChange={handleChange}
                placeholder="e.g. Eket Market, Mbo LGA"
                className={`${styles.input} ${errors.business_location ? styles.inputError : ""}`} />
              {errors.business_location && <span className={styles.error}>{errors.business_location}</span>}
            </div>
          </div>
        </div>

        {/* SECTION 2: SELF-DECLARATION */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>2</span>
            <div>
              <h2 className={styles.sectionTitle}>Self-Declaration</h2>
              <p className={styles.sectionSub}>
                Have you received support from any HCDT, NGO, or government programme in the past 1 year?
              </p>
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
              <textarea name="declaration_details" value={form.declaration_details}
                onChange={handleChange} rows={3} placeholder="e.g. NDDC Grant, 2025"
                className={`${styles.textarea} ${errors.declaration_details ? styles.inputError : ""}`} />
              {errors.declaration_details && <span className={styles.error}>{errors.declaration_details}</span>}
            </div>
          )}
        </div>

        {/* SECTION 3: ATTESTATION */}
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
            <input type="checkbox" name="attested" checked={form.attested}
              onChange={handleChange} className={styles.checkbox} />
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