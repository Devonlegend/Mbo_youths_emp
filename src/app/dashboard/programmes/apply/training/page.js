"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wrench, ArrowLeft, ArrowRight, ShieldCheck, AlertCircle, Check } from "lucide-react";
import styles from "../apply-form.module.css";
import { submitApplication } from "@/services";

export default function TrainingForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const schemeId     = searchParams.get("scheme_id");

  const [form, setForm] = useState({
    training_name:       "",
    education_level:     "",
    prior_experience:    "",
    career_goal:         "",
    availability:        "",
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
    if (!schemeId)                     e.scheme             = "Invalid scheme. Please go back and try again.";
    if (!form.training_name.trim())    e.training_name      = "Required";
    if (!form.education_level)         e.education_level    = "Required";
    if (!form.career_goal.trim())      e.career_goal        = "Required";
    if (!form.availability)            e.availability       = "Required";
    if (!form.declared_external)       e.declared_external  = "Required";
    if (form.declared_external === "yes" && !form.declaration_details.trim())
      e.declaration_details = "Please provide details";
    if (!form.attested)                e.attested           = "You must attest to this declaration";
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
      formData.append("training_name",       form.training_name);
      formData.append("education_level",     form.education_level);
      formData.append("prior_experience",    form.prior_experience);
      formData.append("career_goal",         form.career_goal);
      formData.append("availability",        form.availability);
      formData.append("declared_external",   form.declared_external);
      formData.append("declaration_details", form.declaration_details);
      formData.append("attested",            form.attested);
      formData.append("category",            "vocational");

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
            Your Training application has been submitted and is under verification.
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
        <div className={styles.formHeaderIcon} style={{ background: "#1d4ed8" }}>
          <Wrench size={22} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div className={styles.formCat}
            style={{ color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" }}>
            Training
          </div>
          <h1 className={styles.formTitle}>Digital Skills Training 2026</h1>
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

        {/* SECTION 1: TRAINING DETAILS */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>1</span>
            <div>
              <h2 className={styles.sectionTitle}>Training Details</h2>
              <p className={styles.sectionSub}>Tell us about the training you are applying for and your background.</p>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Training Applied For</label>
              <input name="training_name" value={form.training_name} onChange={handleChange}
                placeholder="e.g. Digital Marketing, Web Development"
                className={`${styles.input} ${errors.training_name ? styles.inputError : ""}`} />
              {errors.training_name && <span className={styles.error}>{errors.training_name}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Highest Education Level</label>
              <select name="education_level" value={form.education_level} onChange={handleChange}
                className={`${styles.input} ${errors.education_level ? styles.inputError : ""}`}>
                <option value="">Select level</option>
                <option value="Primary">Primary School</option>
                <option value="Secondary">Secondary School (SSCE)</option>
                <option value="OND">OND / NCE</option>
                <option value="HND">HND</option>
                <option value="BSc">BSc / BA</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
              {errors.education_level && <span className={styles.error}>{errors.education_level}</span>}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Prior Experience (optional)</label>
            <textarea name="prior_experience" value={form.prior_experience} onChange={handleChange}
              rows={3} placeholder="Describe any relevant experience or skills you already have..."
              className={styles.textarea} />
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Career Goal</label>
              <textarea name="career_goal" value={form.career_goal} onChange={handleChange}
                rows={2} placeholder="What do you want to achieve with this training?"
                className={`${styles.textarea} ${errors.career_goal ? styles.inputError : ""}`} />
              {errors.career_goal && <span className={styles.error}>{errors.career_goal}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Availability</label>
              <select name="availability" value={form.availability} onChange={handleChange}
                className={`${styles.input} ${errors.availability ? styles.inputError : ""}`}>
                <option value="">Select availability</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Weekends">Weekends only</option>
                <option value="Evenings">Evenings only</option>
              </select>
              {errors.availability && <span className={styles.error}>{errors.availability}</span>}
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
                onChange={handleChange} rows={3} placeholder="e.g. NDDC Training, 2025"
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