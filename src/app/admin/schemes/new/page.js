"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, GraduationCap, Briefcase,
  Wrench, Banknote, AlertCircle, CheckCircle2,
  Loader2, Plus, Trash2, GripVertical, ChevronDown,
  ChevronUp, Settings2,
} from "lucide-react";
import styles from "./page.module.css";
import { createScheme } from "@/services";

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────
const categoryConfig = {
  scholarship: { label: "Scholarship", color: "#15803d", bg: "#f0fdf4", icon: GraduationCap },
  empowerment: { label: "Empowerment", color: "#b45309", bg: "#fffbeb", icon: Briefcase     },
  grant:       { label: "Grant",       color: "#7e22ce", bg: "#faf5ff", icon: Banknote      },
};

/* ─────────────────────────────────────────────────────────────────────────
 * FORM BUILDER — DISABLED (commented out, not deleted)
 *
 * Why: The apply form (student-facing) does NOT read these saved fields.
 * It calls GET /schemes/{id}/fields/, which regenerates the field list
 * directly from the backend's PROGRAMME_ANSWER_SERIALIZERS — completely
 * ignoring whatever is configured here. So this builder currently has
 * zero effect on what students see or submit; it's a no-op UI.
 *
 * Leaving the code here (commented) in case the backend is later updated
 * to read custom SchemeFormField records instead of the fixed serializers,
 * at which point this can be re-enabled.
 * ───────────────────────────────────────────────────────────────────────── */

// const defaultFields = {
//   scholarship: [
//     { field_name: "institution",    field_label: "Institution Name",       field_type: "text",     placeholder: "e.g. University of Uyo",         is_required: true,  options: [], section: "Academic Information" },
//     { field_name: "level",          field_label: "Level of Study",         field_type: "select",   placeholder: "",                               is_required: true,  options: ["Secondary", "Undergraduate", "Postgraduate", "Vocational", "Professional"], section: "Academic Information" },
//     { field_name: "department",     field_label: "Department / Course",    field_type: "text",     placeholder: "e.g. Computer Science",           is_required: true,  options: [], section: "Academic Information" },
//     { field_name: "current_level",  field_label: "Current Level / Year",   field_type: "select",   placeholder: "",                               is_required: true,  options: ["100", "200", "300", "400", "500", "Postgraduate"], section: "Academic Information" },
//     { field_name: "matric_number",  field_label: "Matriculation Number",   field_type: "text",     placeholder: "e.g. UU/2022/001234",             is_required: true,  options: [], section: "Academic Information" },
//     { field_name: "cgpa",           field_label: "CGPA / Last Score",      field_type: "text",     placeholder: "e.g. 4.21 / 5.0",                is_required: true,  options: [], section: "Academic Information" },
//     { field_name: "result",         field_label: "Last Academic Result",   field_type: "file",     placeholder: "",                               is_required: true,  options: [], section: "Supporting Documents" },
//     { field_name: "admission",      field_label: "Admission Letter",       field_type: "file",     placeholder: "",                               is_required: true,  options: [], section: "Supporting Documents" },
//     { field_name: "bank_name",      field_label: "Bank Name",              field_type: "select",   placeholder: "",                               is_required: true,  options: ["Access Bank", "First Bank of Nigeria", "Guaranty Trust Bank (GTBank)", "United Bank for Africa (UBA)", "Zenith Bank", "Others"], section: "Bank Details" },
//     { field_name: "account_number", field_label: "Account Number",         field_type: "text",     placeholder: "10-digit account number",         is_required: true,  options: [], section: "Bank Details" },
//     { field_name: "account_name",   field_label: "Account Name",           field_type: "text",     placeholder: "Name as on bank account",         is_required: true,  options: [], section: "Bank Details" },
//   ],
//   empowerment: [
//     { field_name: "trade",             field_label: "Trade / Skill",          field_type: "text",     placeholder: "e.g. Tailoring, Welding",       is_required: true,  options: [], section: "Business / Trade Information" },
//     { field_name: "current_status",    field_label: "Current Status",         field_type: "select",   placeholder: "",                              is_required: true,  options: ["Starting", "Existing", "Cooperative"], section: "Business / Trade Information" },
//     { field_name: "support_needed",    field_label: "Support Needed",         field_type: "textarea", placeholder: "Describe the support needed...", is_required: true,  options: [], section: "Business / Trade Information" },
//     { field_name: "equipment",         field_label: "Equipment List",         field_type: "text",     placeholder: "e.g. Sewing machine",           is_required: false, options: [], section: "Business / Trade Information" },
//     { field_name: "business_location", field_label: "Business Location",      field_type: "text",     placeholder: "e.g. Eket Market, Mbo LGA",     is_required: true,  options: [], section: "Business / Trade Information" },
//   ],
//   grant: [
//     { field_name: "grant_purpose",          field_label: "Grant Purpose",          field_type: "textarea", placeholder: "Describe the purpose of the grant...",   is_required: true,  options: [], section: "Grant Details" },
//     { field_name: "business_plan_desc",     field_label: "Business Plan Summary",  field_type: "textarea", placeholder: "Brief summary of your business plan...", is_required: true,  options: [], section: "Grant Details" },
//     { field_name: "amount_requested",       field_label: "Amount Requested (₦)",   field_type: "text",     placeholder: "e.g. 500,000",                          is_required: true,  options: [], section: "Grant Details" },
//     { field_name: "expected_beneficiaries", field_label: "Expected Beneficiaries", field_type: "text",     placeholder: "e.g. 10 community members",              is_required: true,  options: [], section: "Grant Details" },
//     { field_name: "business_plan",          field_label: "Business Plan Document", field_type: "file",     placeholder: "",                                      is_required: true,  options: [], section: "Grant Details" },
//     { field_name: "bank_name",              field_label: "Bank Name",              field_type: "select",   placeholder: "",                                      is_required: true,  options: ["Access Bank", "First Bank of Nigeria", "Guaranty Trust Bank (GTBank)", "United Bank for Africa (UBA)", "Zenith Bank", "Others"], section: "Bank Details" },
//     { field_name: "account_number",         field_label: "Account Number",         field_type: "text",     placeholder: "10-digit account number",                is_required: true,  options: [], section: "Bank Details" },
//     { field_name: "account_name",           field_label: "Account Name",           field_type: "text",     placeholder: "Name as on bank account",                is_required: true,  options: [], section: "Bank Details" },
//   ],
// };


// // ── FIELD TYPE OPTIONS ────────────────────────────────────────────────────────
// const fieldTypes = [
//   { value: "text",     label: "Text Input" },
//   { value: "textarea", label: "Text Area" },
//   { value: "select",   label: "Dropdown" },
//   { value: "radio",    label: "Radio Buttons" },
//   { value: "file",     label: "File Upload" },
//   { value: "number",   label: "Number" },
//   { value: "checkbox", label: "Checkbox" },
// ];

// // ── FIELD ROW COMPONENT ───────────────────────────────────────────────────────
// function FieldRow({ field, index, onChange, onRemove }) {
//   const [expanded, setExpanded] = useState(false);
//
//   return (
//     <div className={styles.fieldRow}>
//       <div className={styles.fieldRowTop}>
//         <div className={styles.fieldRowDrag}>
//           <GripVertical size={14} color="#cbd5e1" strokeWidth={2} />
//           <span className={styles.fieldRowNum}>{index + 1}</span>
//         </div>
//
//         <div className={styles.fieldRowMain}>
//           <input
//             className={styles.fieldInput}
//             placeholder="Field label (e.g. Institution Name)"
//             value={field.field_label}
//             onChange={(e) => onChange(index, "field_label", e.target.value)}
//           />
//           <select
//             className={styles.fieldSelect}
//             value={field.field_type}
//             onChange={(e) => onChange(index, "field_type", e.target.value)}
//           >
//             {fieldTypes.map((t) => (
//               <option key={t.value} value={t.value}>{t.label}</option>
//             ))}
//           </select>
//           <label className={styles.fieldRequired}>
//             <input
//               type="checkbox"
//               checked={field.is_required}
//               onChange={(e) => onChange(index, "is_required", e.target.checked)}
//               style={{ accentColor: "#15803d" }}
//             />
//             Required
//           </label>
//         </div>
//
//         <div className={styles.fieldRowActions}>
//           <button
//             type="button"
//             className={styles.fieldExpandBtn}
//             onClick={() => setExpanded((v) => !v)}
//             title="More options"
//           >
//             {expanded ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
//           </button>
//           <button
//             type="button"
//             className={styles.fieldRemoveBtn}
//             onClick={() => onRemove(index)}
//             title="Remove field"
//           >
//             <Trash2 size={13} strokeWidth={2} />
//           </button>
//         </div>
//       </div>
//
//       {expanded && (
//         <div className={styles.fieldRowExtra}>
//           <div className={styles.fieldExtraRow}>
//             <div className={styles.fieldExtraItem}>
//               <label className={styles.fieldExtraLabel}>Field Name (key)</label>
//               <input
//                 className={styles.fieldInput}
//                 placeholder="e.g. institution_name"
//                 value={field.field_name}
//                 onChange={(e) => onChange(index, "field_name", e.target.value)}
//               />
//             </div>
//             <div className={styles.fieldExtraItem}>
//               <label className={styles.fieldExtraLabel}>Section</label>
//               <input
//                 className={styles.fieldInput}
//                 placeholder="e.g. Academic Information"
//                 value={field.section}
//                 onChange={(e) => onChange(index, "section", e.target.value)}
//               />
//             </div>
//             <div className={styles.fieldExtraItem}>
//               <label className={styles.fieldExtraLabel}>Placeholder</label>
//               <input
//                 className={styles.fieldInput}
//                 placeholder="Input hint text..."
//                 value={field.placeholder}
//                 onChange={(e) => onChange(index, "placeholder", e.target.value)}
//               />
//             </div>
//           </div>
//           {(field.field_type === "select" || field.field_type === "radio") && (
//             <div className={styles.fieldExtraItem} style={{ marginTop: 8 }}>
//               <label className={styles.fieldExtraLabel}>Options (one per line)</label>
//               <textarea
//                 className={styles.fieldTextarea}
//                 rows={3}
//                 placeholder={"Option 1\nOption 2\nOption 3"}
//                 value={(field.options || []).join("\n")}
//                 onChange={(e) => onChange(index, "options", e.target.value.split("\n").filter(Boolean))}
//               />
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

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

  // const [fields,   setFields]   = useState(defaultFields.scholarship.map((f, i) => ({ ...f, order: i })));
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState("");
  const [success,  setSuccess]  = useState(false);

  const category = categoryConfig[form.award_type] || categoryConfig.scholarship;
  const CatIcon  = category.icon;

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setApiError("");

    // When category changes — swap to default fields for that category
    // if (key === "award_type") {
    //   setFields((defaultFields[value] || []).map((f, i) => ({ ...f, order: i })));
    // }
  }

  // ── FIELD OPERATIONS ──────────────────────────────────────────────────────
  // function handleFieldChange(index, key, value) {
  //   setFields((prev) => prev.map((f, i) => i === index ? { ...f, [key]: value } : f));
  // }

  // function handleFieldRemove(index) {
  //   setFields((prev) => prev.filter((_, i) => i !== index));
  // }

  // function handleAddField() {
  //   setFields((prev) => [...prev, {
  //     field_name:  "",
  //     field_label: "",
  //     field_type:  "text",
  //     placeholder: "",
  //     is_required: true,
  //     options:     [],
  //     section:     "",
  //     order:       prev.length,
  //   }]);
  // }

  // ── VALIDATION ────────────────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!form.name.trim())               e.name = "Scheme name is required.";
    if (!form.description.trim())        e.description = "Description is required.";
    if (!form.award_amount)              e.award_amount = "Award amount is required.";
    if (!form.total_slots)               e.total_slots = "Total slots is required.";
    if (!form.application_open_date)     e.application_open_date = "Open date is required.";
    if (!form.application_close_date)    e.application_close_date = "Close date is required.";
    if (form.application_open_date && form.application_close_date &&
        form.application_close_date <= form.application_open_date)
      e.application_close_date = "Close date must be after open date.";
    return e;
  }

  // ── SUBMIT ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setLoading(true);
    setApiError("");

    try {
      // Step 1 — create the scheme
      const res = await createScheme({
        ...form,
        award_amount:    parseFloat(form.award_amount),
        total_slots:     parseInt(form.total_slots),
        remaining_slots: parseInt(form.total_slots),
        is_published:    false,
        is_active:       true,
      });

      const schemeId = res.data.id;

      // Step 2 — save the form fields
      // DISABLED: the apply form sources its fields from GET /schemes/{id}/fields/,
      // which is generated server-side from PROGRAMME_ANSWER_SERIALIZERS and does
      // NOT read whatever gets POSTed here. Re-enable only if/when the backend is
      // changed to honor custom SchemeFormField records.
      // if (fields.length > 0) {
      //   const { default: api } = await import("@/services/axiosInstance");
      //   await api.post(`/schemes/${schemeId}/fields/`, fields.map((f, i) => ({ ...f, order: i })));
      // }

      setSuccess(true);
      setTimeout(() => router.push("/admin/schemes"), 1200);
    } catch (err) {
  console.log("Scheme error:", err?.response?.data);
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
          <div className={styles.headerIcon} style={{ background: category.bg, border: `1.5px solid ${category.color}30` }}>
            <CatIcon size={22} color={category.color} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>{form.name.trim() || "New Scheme"}</h1>
            <p className={styles.sub}>{form.academic_year} · {category.label}</p>
          </div>
        </div>
      </div>

      {/* SUCCESS */}
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

        {/* LEFT — scheme info + form builder */}
        <div className={styles.leftCol}>

          {/* Basic Info */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Basic Information</h2>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Scheme Name {errors.name && <span className={styles.fieldError}>{errors.name}</span>}</label>
              <input
                className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                placeholder="e.g. 2026/2027 University Scholarship Award"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Category</label>
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
                      <span style={{ color: form.award_type === key ? cat.color : "#374151" }}>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Description {errors.description && <span className={styles.fieldError}>{errors.description}</span>}</label>
              <textarea
                className={`${styles.textarea} ${errors.description ? styles.inputError : ""}`}
                rows={4}
                placeholder="Describe the purpose and scope of this scheme..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </div>

          {/* Dates */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Application Period</h2>
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Open Date {errors.application_open_date && <span className={styles.fieldError}>{errors.application_open_date}</span>}</label>
                <input type="date" className={`${styles.input} ${errors.application_open_date ? styles.inputError : ""}`}
                  value={form.application_open_date} onChange={(e) => set("application_open_date", e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Close Date {errors.application_close_date && <span className={styles.fieldError}>{errors.application_close_date}</span>}</label>
                <input type="date" className={`${styles.input} ${errors.application_close_date ? styles.inputError : ""}`}
                  value={form.application_close_date} onChange={(e) => set("application_close_date", e.target.value)} />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Academic Year</label>
              <input className={styles.input} placeholder="e.g. 2026/2027"
                value={form.academic_year} onChange={(e) => set("academic_year", e.target.value)} />
            </div>
          </div>

          {/* Form Builder — DISABLED, see comment block near top of file for why */}
          {/*
          <div className={styles.card}>
            <div className={styles.cardHeadRow}>
              <div>
                <h2 className={styles.cardTitle}>Application Form Fields</h2>
                <p className={styles.cardSub}>These fields will appear on the student application form. Pre-filled based on category.</p>
              </div>
              <div className={styles.formBuilderIcon}>
                <Settings2 size={16} color="#15803d" strokeWidth={1.8} />
              </div>
            </div>

            <div className={styles.fieldsList}>
              {fields.map((field, index) => (
                <FieldRow
                  key={index}
                  field={field}
                  index={index}
                  onChange={handleFieldChange}
                  onRemove={handleFieldRemove}
                />
              ))}
            </div>

            <button type="button" className={styles.addFieldBtn} onClick={handleAddField}>
              <Plus size={14} strokeWidth={2} /> Add Field
            </button>
          </div>
          */}

        </div>

        {/* RIGHT — award details + preview + submit */}
        <div className={styles.rightCol}>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Award Details</h2>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Award Amount (₦) {errors.award_amount && <span className={styles.fieldError}>{errors.award_amount}</span>}</label>
              <input type="number" className={`${styles.input} ${errors.award_amount ? styles.inputError : ""}`}
                placeholder="e.g. 500000" value={form.award_amount} onChange={(e) => set("award_amount", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Total Slots {errors.total_slots && <span className={styles.fieldError}>{errors.total_slots}</span>}</label>
              <input type="number" className={`${styles.input} ${errors.total_slots ? styles.inputError : ""}`}
                placeholder="e.g. 50" value={form.total_slots} onChange={(e) => set("total_slots", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Stacking Policy</label>
              <select className={styles.input} value={form.stacking_policy} onChange={(e) => set("stacking_policy", e.target.value)}>
                <option value="exclusive">Exclusive — no other active awards</option>
                <option value="major_only">Major Only — no other major awards</option>
                <option value="open">Open — can stack with any award</option>
              </select>
            </div>
          </div>

          {/* Preview */}
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
              {/* <span>·</span>
              <span>{fields.length} fields</span> */}
            </div>
          </div>

          {/* Submit */}
          <div className={styles.submitWrap}>
            <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading || success}>
              {loading
                ? <><Loader2 size={15} strokeWidth={2} className={styles.spin} /> Creating...</>
                : <><Plus size={15} strokeWidth={2} /> Create Scheme</>
              }
            </button>
            <p className={styles.submitNote}>
              Saved as draft. Publish from the schemes page when ready.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}