"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap, ArrowLeft, ArrowRight, UploadCloud,
  FileText, Trash2, ShieldCheck, AlertCircle, Check,
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

function FileUpload({ label, hint, value, onChange, onRemove, error }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {!value ? (
        <label className={`${styles.uploadArea} ${error ? styles.uploadError : ""}`}>
          <input type="file" accept="application/pdf,image/jpeg,image/png"
            onChange={onChange} style={{ display: "none" }} />
          <UploadCloud size={22} color="#94a3b8" />
          <span className={styles.uploadTitle}>Click to upload</span>
          <span className={styles.uploadHint}>PDF, JPG or PNG · Max 5MB</span>
        </label>
      ) : (
        <div className={styles.filePreview}>
          <FileText size={18} color="#15803d" />
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{value.name}</span>
            <span className={styles.fileSize}>{(value.size / 1024).toFixed(1)} KB</span>
          </div>
          <button type="button" onClick={onRemove} className={styles.fileRemove}>
            <Trash2 size={14} color="#ef4444" />
          </button>
        </div>
      )}
      {error && <span className={styles.error}>{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export default function ScholarshipForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const schemeId     = searchParams.get("scheme_id");

  const [form, setForm] = useState({
    institution:         "",
    level:               "",
    department:          "",
    current_level:       "",
    matric_number:       "",
    cgpa:                "",
    // Bank details
    bank_name:           "",
    account_number:      "",
    account_name:        "",
    // Declaration
    declared_external:   "",
    declaration_details: "",
    attested:            false,
  });

  const [result,    setResult]    = useState(null);
  const [admission, setAdmission] = useState(null);
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError,  setApiError]  = useState("");

  // ── Pre-fill bank details if student already saved them ──────────────────
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
      .catch(() => {}); // Silently fail — fields just stay empty
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    setErrors((er) => ({ ...er, [name]: "" }));
    setApiError("");
  }

  function handleFile(setter) {
    return (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > MAX_SIZE) { alert("File must not exceed 5MB."); return; }
      setter(file);
    };
  }

  function validate() {
    const e = {};
    if (!schemeId)                  e.scheme           = "Invalid scheme. Please go back and try again.";
    if (!form.institution.trim())   e.institution      = "Required";
    if (!form.level)                e.level            = "Required";
    if (!form.department.trim())    e.department       = "Required";
    if (!form.current_level)        e.current_level    = "Required";
    if (!form.matric_number.trim()) e.matric_number    = "Required";
    if (!form.cgpa.trim())          e.cgpa             = "Required";
    if (!result)                    e.result           = "Please upload your last result";
    if (!admission)                 e.admission        = "Please upload your admission letter";
    if (!form.bank_name)            e.bank_name        = "Required";
    if (!form.account_number.trim()) e.account_number  = "Required";
    else if (!/^\d{10}$/.test(form.account_number.trim())) e.account_number = "Account number must be 10 digits";
    if (!form.account_name.trim())  e.account_name     = "Required";
    if (!form.declared_external)    e.declared_external = "Required";
    if (form.declared_external === "yes" && !form.declaration_details.trim())
      e.declaration_details = "Please provide details of prior support received";
    if (!form.attested)             e.attested         = "You must attest to this declaration";
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
      formData.append("institution",         form.institution);
      formData.append("level",               form.level);
      formData.append("department",          form.department);
      formData.append("current_level",       form.current_level);
      formData.append("matric_number",       form.matric_number);
      formData.append("cgpa",                form.cgpa);
      formData.append("bank_name",           form.bank_name);
      formData.append("account_number",      form.account_number);
      formData.append("account_name",        form.account_name);
      formData.append("declared_external",   form.declared_external);
      formData.append("declaration_details", form.declaration_details);
      formData.append("attested",            form.attested);
      formData.append("category",            "scholarship");

      if (result)    formData.append("result_document",  result);
      if (admission) formData.append("admission_letter", admission);

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
            Your Scholarship application has been submitted and is under verification.
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
        <div className={styles.formHeaderIcon} style={{ background: "#15803d" }}>
          <GraduationCap size={22} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div className={styles.formCat}
            style={{ color: "#15803d", background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            Scholarship
          </div>
          <h1 className={styles.formTitle}>2026/2027 University Scholarship Award</h1>
          <p className={styles.formSub}>Complete all fields accurately. Submission is final.</p>
        </div>
      </div>

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

        {/* SECTION 1: ACADEMIC INFO */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>1</span>
            <div>
              <h2 className={styles.sectionTitle}>Academic Information</h2>
              <p className={styles.sectionSub}>Details about your institution and studies.</p>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Institution Name</label>
              <input name="institution" value={form.institution} onChange={handleChange}
                placeholder="e.g. University of Uyo"
                className={`${styles.input} ${errors.institution ? styles.inputError : ""}`} />
              {errors.institution && <span className={styles.error}>{errors.institution}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Level of Study</label>
              <select name="level" value={form.level} onChange={handleChange}
                className={`${styles.input} ${errors.level ? styles.inputError : ""}`}>
                <option value="">Select level</option>
                <option value="Secondary">Secondary (SSCE)</option>
                <option value="Undergraduate">Undergraduate (ND/HND/BSc)</option>
                <option value="Postgraduate">Postgraduate (MSc/MBA/PhD)</option>
                <option value="Vocational">Vocational/Technical</option>
                <option value="Professional">Professional Certification</option>
              </select>
              {errors.level && <span className={styles.error}>{errors.level}</span>}
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Department / Course of Study</label>
              <input name="department" value={form.department} onChange={handleChange}
                placeholder="e.g. Computer Science"
                className={`${styles.input} ${errors.department ? styles.inputError : ""}`} />
              {errors.department && <span className={styles.error}>{errors.department}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Current Level / Year</label>
              <select name="current_level" value={form.current_level} onChange={handleChange}
                className={`${styles.input} ${errors.current_level ? styles.inputError : ""}`}>
                <option value="">Select level</option>
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
                <option value="300">300 Level</option>
                <option value="400">400 Level</option>
                <option value="500">500 Level</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
              {errors.current_level && <span className={styles.error}>{errors.current_level}</span>}
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Matriculation Number</label>
              <input name="matric_number" value={form.matric_number} onChange={handleChange}
                placeholder="e.g. UU/2022/001234"
                className={`${styles.input} ${errors.matric_number ? styles.inputError : ""}`} />
              {errors.matric_number && <span className={styles.error}>{errors.matric_number}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>CGPA / Last Score</label>
              <input name="cgpa" value={form.cgpa} onChange={handleChange}
                placeholder="e.g. 4.21 / 5.0"
                className={`${styles.input} ${errors.cgpa ? styles.inputError : ""}`} />
              {errors.cgpa && <span className={styles.error}>{errors.cgpa}</span>}
            </div>
          </div>
        </div>

        {/* SECTION 2: DOCUMENTS */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>2</span>
            <div>
              <h2 className={styles.sectionTitle}>Supporting Documents</h2>
              <p className={styles.sectionSub}>Upload clear, legible copies of required documents.</p>
            </div>
          </div>
          <div className={styles.grid2}>
            <FileUpload
              label="Last Academic Result"
              hint="Most recent semester/year result"
              value={result}
              onChange={handleFile(setResult)}
              onRemove={() => setResult(null)}
              error={errors.result}
            />
            <FileUpload
              label="Admission Letter"
              hint="Current session admission letter"
              value={admission}
              onChange={handleFile(setAdmission)}
              onRemove={() => setAdmission(null)}
              error={errors.admission}
            />
          </div>
        </div>

        {/* SECTION 3: BANK DETAILS */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>3</span>
            <div>
              <h2 className={styles.sectionTitle}>Bank Details</h2>
              <p className={styles.sectionSub}>
                Disbursements will be made to this account. Ensure details are accurate.
              </p>
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
                placeholder="10-digit account number"
                maxLength={10}
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
                onChange={handleChange} rows={3} placeholder="e.g. NDDC Scholarship, 2025"
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