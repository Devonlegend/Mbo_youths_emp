"use client";

import { useState } from "react";
import {
  BookOpen,
  GraduationCap,
  Wrench,
  Zap,
  BadgeDollarSign,
  Calendar,
  Users,
  Plus,
} from "lucide-react";
import { schemes } from "../mockdata";
import styles from "./schemes.module.css";

// ── HELPERS ───────────────────────────────────
function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amount) {
  const num = parseFloat(amount);
  if (!num) return "Free";
  return `₦${num.toLocaleString("en-NG")}`;
}

// ── CATEGORY CONFIG ───────────────────────────
const categoryConfig = {
  scholarship: {
    icon: GraduationCap,
    iconColor: "#3b82f6",
    iconClass: styles.schemeIconScholarship,
    badgeClass: styles.badgeScholarship,
    label: "Scholarship",
  },
  vocational: {
    icon: Wrench,
    iconColor: "#8b5cf6",
    iconClass: styles.schemeIconVocational,
    badgeClass: styles.badgeVocational,
    label: "Vocational",
  },
  empowerment: {
    icon: Zap,
    iconColor: "#f59e0b",
    iconClass: styles.schemeIconEmpowerment,
    badgeClass: styles.badgeEmpowerment,
    label: "Empowerment",
  },
  grant: {
    icon: BadgeDollarSign,
    iconColor: "#15803d",
    iconClass: styles.schemeIconGrant,
    badgeClass: styles.badgeGrant,
    label: "Grant",
  },
};

// ── CREATE SCHEME FORM ────────────────────────
function CreateSchemeForm() {
  const [form, setForm] = useState({
    name: "",
    award_type: "",
    description: "",
    award_amount: "",
    total_slots: "",
    application_open_date: "",
    application_close_date: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Scheme name is required";
    if (!form.award_type) errs.award_type = "Award type is required";
    if (!form.description.trim()) errs.description = "Description is required";
    if (!form.total_slots || isNaN(form.total_slots) || Number(form.total_slots) < 1)
      errs.total_slots = "Enter a valid number of slots";
    if (!form.application_open_date) errs.application_open_date = "Open date is required";
    if (!form.application_close_date) errs.application_close_date = "Close date is required";
    if (
      form.application_open_date &&
      form.application_close_date &&
      form.application_close_date <= form.application_open_date
    )
      errs.application_close_date = "Close date must be after open date";
    return errs;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    // When backend is ready: POST /schemes/
    setSubmitted(true);
  }

  function handleReset() {
    setForm({
      name: "",
      award_type: "",
      description: "",
      award_amount: "",
      total_slots: "",
      application_open_date: "",
      application_close_date: "",
    });
    setErrors({});
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className={styles.formCard}>
        <div className={styles.formHeader}>
          <h3 className={styles.formTitle}>Create New Scheme</h3>
          <p className={styles.formSubtitle}>Fill in the details below</p>
        </div>
        <div className={styles.formBody}>
          <div className={styles.successBanner}>
            ✓ Scheme created successfully
          </div>
          <button className={styles.btnSubmit} onClick={handleReset}>
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <h3 className={styles.formTitle}>Create New Scheme</h3>
        <p className={styles.formSubtitle}>Fill in the details below</p>
      </div>
      <div className={styles.formBody}>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Scheme Name</label>
          <input
            className={`${styles.formInput} ${errors.name ? styles.formInputError : ""}`}
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. 2027 University Scholarship"
          />
          {errors.name && <span className={styles.formError}>{errors.name}</span>}
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Award Type</label>
          <select
            className={`${styles.formSelect} ${errors.award_type ? styles.formInputError : ""}`}
            name="award_type"
            value={form.award_type}
            onChange={handleChange}
          >
            <option value="">— Select type —</option>
            <option value="scholarship">Scholarship</option>
            <option value="vocational">Vocational</option>
            <option value="empowerment">Empowerment</option>
            <option value="grant">Grant</option>
          </select>
          {errors.award_type && (
            <span className={styles.formError}>{errors.award_type}</span>
          )}
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Description</label>
          <textarea
            className={`${styles.formTextarea} ${errors.description ? styles.formInputError : ""}`}
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Brief description of this scheme..."
          />
          {errors.description && (
            <span className={styles.formError}>{errors.description}</span>
          )}
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>
            Award Amount{" "}
            <span style={{ color: "#94a3b8", fontWeight: 400 }}>
              (leave blank if free)
            </span>
          </label>
          <input
            className={styles.formInput}
            name="award_amount"
            value={form.award_amount}
            onChange={handleChange}
            placeholder="e.g. 500000"
            type="number"
            min="0"
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Total Slots</label>
          <input
            className={`${styles.formInput} ${errors.total_slots ? styles.formInputError : ""}`}
            name="total_slots"
            value={form.total_slots}
            onChange={handleChange}
            placeholder="e.g. 50"
            type="number"
            min="1"
          />
          {errors.total_slots && (
            <span className={styles.formError}>{errors.total_slots}</span>
          )}
        </div>

        <div className={styles.formDivider} />

        <div className={styles.formField}>
          <label className={styles.formLabel}>Application Open Date</label>
          <input
            className={`${styles.formInput} ${errors.application_open_date ? styles.formInputError : ""}`}
            name="application_open_date"
            value={form.application_open_date}
            onChange={handleChange}
            type="date"
          />
          {errors.application_open_date && (
            <span className={styles.formError}>{errors.application_open_date}</span>
          )}
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Application Close Date</label>
          <input
            className={`${styles.formInput} ${errors.application_close_date ? styles.formInputError : ""}`}
            name="application_close_date"
            value={form.application_close_date}
            onChange={handleChange}
            type="date"
          />
          {errors.application_close_date && (
            <span className={styles.formError}>{errors.application_close_date}</span>
          )}
        </div>

        <div className={styles.formDivider} />

        <button className={styles.btnSubmit} onClick={handleSubmit}>
          Create Scheme
        </button>
      </div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────
export default function SchemesPage() {
  const [schemeList, setSchemeList] = useState(schemes);

  function handlePublish(id) {
    setSchemeList((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, is_active: true, is_published: true } : s
      )
    );
  }

  function handleClose(id) {
    setSchemeList((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, is_active: false } : s
      )
    );
  }

  const totalSlots = schemeList.reduce((acc, s) => acc + s.total_slots, 0);
  const openCount = schemeList.filter((s) => s.is_active && s.is_published).length;
  const closedCount = schemeList.filter((s) => !s.is_active).length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Schemes</h1>
          <p className={styles.pageSubtitle}>
            Manage scholarship and grant schemes
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotTotal}`} />
          <div>
            <div className={styles.statPillValue}>{schemeList.length}</div>
            <div className={styles.statPillLabel}>Total Schemes</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotOpen}`} />
          <div>
            <div className={styles.statPillValue}>{openCount}</div>
            <div className={styles.statPillLabel}>Open</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotClosed}`} />
          <div>
            <div className={styles.statPillValue}>{closedCount}</div>
            <div className={styles.statPillLabel}>Closed</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotSlots}`} />
          <div>
            <div className={styles.statPillValue}>{totalSlots}</div>
            <div className={styles.statPillLabel}>Total Slots</div>
          </div>
        </div>
      </div>

      {/* Body grid */}
      <div className={styles.bodyGrid}>

        {/* Scheme list */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>All Schemes</h2>
              <p className={styles.cardSubtitle}>
                {schemeList.length} schemes total
              </p>
            </div>
          </div>

          <div className={styles.schemeList}>
            {schemeList.map((scheme) => {
              const isOpen = scheme.is_active && scheme.is_published;
              const config = categoryConfig[scheme.award_type] || categoryConfig.grant;
              const Icon = config.icon;
              const filled = scheme.total_slots - scheme.remaining_slots;
              const fillPct = Math.min((filled / scheme.total_slots) * 100, 100);
              const isFull = filled >= scheme.total_slots;

              return (
                <div key={scheme.id} className={styles.schemeItem}>
                  <div className={`${styles.schemeIconBox} ${config.iconClass}`}>
                    <Icon size={18} color={config.iconColor} strokeWidth={2} />
                  </div>

                  <div className={styles.schemeContent}>
                    <div className={styles.schemeTop}>
                      <div className={styles.schemeName}>{scheme.name}</div>
                      <div className={styles.schemeActions}>
                        <span className={config.badgeClass}>{config.label}</span>
                        <span className={isOpen ? styles.badgeOpen : styles.badgeClosed}>
                          {isOpen ? "Open" : "Closed"}
                        </span>
                        {!isOpen && (
                          <button
                            className={styles.btnPublish}
                            onClick={() => handlePublish(scheme.id)}
                          >
                            Publish
                          </button>
                        )}
                        {isOpen && (
                          <button
                            className={styles.btnClose}
                            onClick={() => handleClose(scheme.id)}
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>

                    <p className={styles.schemeDesc}>{scheme.description}</p>

                    <div className={styles.schemeMeta}>
                      <div className={styles.schemeMetaItem}>
                        <Calendar size={11} />
                        <span>Closes </span>
                        <span className={styles.schemeMetaValue}>
                          {formatDate(scheme.application_close_date)}
                        </span>
                      </div>
                      <div className={styles.schemeMetaItem}>
                        <Users size={11} />
                        <span>Slots </span>
                        <span className={styles.schemeMetaValue}>
                          {filled}/{scheme.total_slots}
                        </span>
                        <div className={styles.fillBarWrap}>
                          <div className={styles.fillBarTrack}>
                            <div
                              className={`${styles.fillBarFill} ${
                                isFull ? styles.fillBarFillFull : ""
                              }`}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className={styles.schemeMetaItem}>
                        <BookOpen size={11} />
                        <span>Award </span>
                        <span className={styles.schemeMetaValue}>
                          {formatAmount(scheme.award_amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Create scheme form */}
        <CreateSchemeForm />
      </div>
    </div>
  );
}