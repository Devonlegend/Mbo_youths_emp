"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, ArrowLeft, ArrowRight, UploadCloud,
  FileText, Trash2, ShieldCheck, AlertCircle, Check,
} from "lucide-react";
import styles from "../apply-form.module.css";

const MAX_SIZE = 5 * 1024 * 1024;

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
  const router = useRouter();
  const [form, setForm] = useState({
    institution: "", level: "", department: "",
    current_level: "", matric_number: "", cgpa: "",
    declared_external: "", declaration_details: "",
    attested: false,
  });
  const [result, setResult]     = useState(null);
  const [admission, setAdmission] = useState(null);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    setErrors((er) => ({ ...er, [name]: "" }));
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
    if (!form.institution.trim())   e.institution   = "Required";
    if (!form.level)                e.level         = "Required";
    if (!form.department.trim())    e.department    = "Required";
    if (!form.current_level)        e.current_level = "Required";
    if (!form.matric_number.trim()) e.matric_number = "Required";
    if (!form.cgpa.trim())          e.cgpa          = "Required";
    if (!result)                    e.result        = "Please upload your last result";
    if (!admission)                 e.admission     = "Please upload your admission letter";
    if (!form.declared_external)    e.declared_external = "Required";
    if (form.declared_external === "yes" && !form.declaration_details.trim())
      e.declaration_details = "Please provide details of prior support received";
    if (!form.attested)             e.attested      = "You must attest to this declaration";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400)); // mock
    setLoading(false);
    setSubmitted(true);
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
            Your Scholarship application has been submitted and is under verification.
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

      {/* BACK */}
      <button className={styles.backBtn} onClick={() => router.push("/dashboard/programmes")}>
        <ArrowLeft size={15} strokeWidth={2} /> Back to Programmes
      </button>

      {/* HEADER */}
      <div className={styles.formHeader}>
        <div className={styles.formHeaderIcon} style={{ background: "#15803d" }}>
          <GraduationCap size={22} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div className={styles.formCat} style={{ color: "#15803d", background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            Scholarship
          </div>
          <h1 className={styles.formTitle}>2026/2027 University Scholarship Award</h1>
          <p className={styles.formSub}>Complete all fields accurately. Submission is final.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>

        {/* ── SECTION 1: ACADEMIC INFO ── */}
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

        {/* ── SECTION 2: DOCUMENTS ── */}
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

        {/* ── SECTION 3: SELF-DECLARATION ── */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>3</span>
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

        {/* ── SECTION 4: ATTESTATION ── */}
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

        {/* ── SUBMIT ── */}
        <div className={styles.formFooter}>
          <div className={styles.securedNote}>
            <ShieldCheck size={13} color="#15803d" strokeWidth={2} />
            <span>Secured under the Petroleum Industry Act, 2021</span>
          </div>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Submitting..." : <>Submit Application <ArrowRight size={15} strokeWidth={2} /></>}
          </button>
        </div>

      </form>
    </div>
  );
}