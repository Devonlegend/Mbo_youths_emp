"use client";
import { useState } from "react";
import {
  FileText, UploadCloud, Trash2, CheckCircle2,
  AlertCircle, Clock, Eye, Download, Search, Filter, ChevronDown,
} from "lucide-react";
import styles from "./page.module.css";

const DOCS = [
  {
    id: 1,
    name: "Passport Photograph",
    desc: "Clear recent passport photo with white background.",
    category: "Identity",
    required: true,
    file: { name: "passport_photo.jpg", size: "214 KB", date: "10 Jan 2026" },
    status: "verified",
  },
  {
    id: 2,
    name: "National ID / NIN Slip",
    desc: "Valid government-issued national identity document.",
    category: "Identity",
    required: true,
    file: { name: "nin_slip.pdf", size: "380 KB", date: "10 Jan 2026" },
    status: "verified",
  },
  {
    id: 3,
    name: "Proof of Residency",
    desc: "Utility bill or LGA attestation letter confirming Mbo LGA residence.",
    category: "Identity",
    required: true,
    file: null,
    status: "missing",
  },
  {
    id: 4,
    name: "Last Academic Result",
    desc: "Most recent semester or year result sheet.",
    category: "Scholarship",
    required: true,
    file: { name: "result_300l.pdf", size: "512 KB", date: "14 May 2026" },
    status: "verified",
  },
  {
    id: 5,
    name: "Admission Letter",
    desc: "Current session admission or acceptance letter from institution.",
    category: "Scholarship",
    required: true,
    file: { name: "admission_2026.pdf", size: "290 KB", date: "14 May 2026" },
    status: "pending",
  },
  {
    id: 6,
    name: "Business Plan",
    desc: "Full business plan document for grant or empowerment applications.",
    category: "Grant",
    required: false,
    file: { name: "business_plan_2026.pdf", size: "1.2 MB", date: "2 Apr 2026" },
    status: "verified",
  },
  {
    id: 7,
    name: "Bank Statement",
    desc: "Last 3 months bank statement for financial verification.",
    category: "Grant",
    required: false,
    file: null,
    status: "missing",
  },
  {
    id: 8,
    name: "Trade / Skill Certificate",
    desc: "Certificate or evidence of trade skill for empowerment applications.",
    category: "Empowerment",
    required: false,
    file: null,
    status: "missing",
  },
];

const CATEGORIES = ["All", "Identity", "Scholarship", "Grant", "Empowerment"];
const MAX_SIZE = 5 * 1024 * 1024;

const statusMap = {
  verified: { label: "Verified",  cls: "verified", icon: CheckCircle2 },
  pending:  { label: "Pending",   cls: "pending",  icon: Clock        },
  missing:  { label: "Missing",   cls: "missing",  icon: AlertCircle  },
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState(DOCS);
  const [activeFilter, setActiveFilter] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");

  const verified = docs.filter((d) => d.status === "verified").length;
  const missing  = docs.filter((d) => d.status === "missing").length;

  const filtered = docs.filter((d) => {
    const matchCat = activeFilter === "All" || d.category === activeFilter;
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
                        d.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function handleUpload(id, e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_SIZE) { alert("File must not exceed 5MB."); return; }
    setDocs((prev) => prev.map((d) =>
      d.id === id
        ? { ...d, file: { name: file.name, size: `${(file.size / 1024).toFixed(0)} KB`, date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) }, status: "pending" }
        : d
    ));
  }

  function handleRemove(id) {
    setDocs((prev) => prev.map((d) =>
      d.id === id ? { ...d, file: null, status: "missing" } : d
    ));
  }

  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Documents</h1>
          <p className={styles.sub}>Upload and manage your supporting documents.</p>
        </div>
        <div className={styles.statsRow}>
          <div className={styles.statPill}>
            <span className={styles.statDotGreen} />
            {verified} verified
          </div>
          {missing > 0 && (
            <div className={`${styles.statPill} ${styles.statPillWarn}`}>
              <span className={styles.statDotAmber} />
              {missing} missing
            </div>
          )}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ position: "relative" }}>
          <button
            className={`${styles.filterBtn} ${activeFilter !== "All" ? styles.filterActive : ""}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <Filter size={14} strokeWidth={2} />
            {activeFilter === "All" ? "Filter" : activeFilter}
            <ChevronDown size={13} strokeWidth={2.5} />
          </button>
          {filterOpen && (
            <div className={styles.filterDropdown}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.filterOption} ${activeFilter === cat ? styles.filterOptionActive : ""}`}
                  onClick={() => { setActiveFilter(cat); setFilterOpen(false); }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NOTICE */}
      {missing > 0 && (
        <div className={styles.notice}>
          <AlertCircle size={15} color="#b45309" style={{ flexShrink: 0 }} />
          <span>You have <strong>{missing} missing document{missing > 1 ? "s" : ""}</strong>. Upload them to avoid delays in your application review.</span>
        </div>
      )}

      {/* DOCUMENT LIST */}
      <div className={styles.docList}>
        {filtered.map((doc) => {
          const s = statusMap[doc.status];
          const StatusIcon = s.icon;
          return (
            <div key={doc.id} className={`${styles.docCard} ${styles[`card_${doc.status}`]}`}>
              <div className={styles.docTop}>
                <div className={styles.docInfo}>
                  <div className={styles.docNameRow}>
                    <span className={styles.docName}>{doc.name}</span>
                    {doc.required && <span className={styles.reqTag}>Required</span>}
                  </div>
                  <p className={styles.docDesc}>{doc.desc}</p>
                  <span className={styles.catChip}>{doc.category}</span>
                </div>
                <span className={`${styles.statusBadge} ${styles[`sb_${doc.status}`]}`}>
                  <StatusIcon size={11} strokeWidth={2.5} />
                  {s.label}
                </span>
              </div>

              {/* FILE AREA */}
              {doc.file ? (
                <div className={styles.filePreview}>
                  <FileText size={16} color="#15803d" />
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{doc.file.name}</span>
                    <span className={styles.fileMeta}>{doc.file.size} · Uploaded {doc.file.date}</span>
                  </div>
                  <div className={styles.fileActions}>
                    <button className={styles.fileBtn} title="Preview">
                      <Eye size={14} strokeWidth={2} />
                    </button>
                    <button className={styles.fileBtn} title="Download">
                      <Download size={14} strokeWidth={2} />
                    </button>
                    <button className={styles.fileBtnDanger} onClick={() => handleRemove(doc.id)} title="Remove">
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className={styles.uploadArea}>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(e) => handleUpload(doc.id, e)}
                    style={{ display: "none" }}
                  />
                  <UploadCloud size={18} color="#94a3b8" />
                  <span className={styles.uploadTitle}>Click to upload</span>
                  <span className={styles.uploadHint}>PDF, JPG or PNG · Max 5MB</span>
                </label>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}