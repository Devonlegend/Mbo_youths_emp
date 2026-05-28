"use client";
import { FileText, Eye, Download } from "lucide-react";
import styles from "./page.module.css";

const DOCS = [
  {
    id: 1,
    name: "Passport Photograph",
    desc: "Clear recent passport photo submitted during registration.",
    category: "Identity",
    file: { name: "passport_photo.jpg", size: "214 KB", date: "10 Jan 2026" },
  },
  {
    id: 2,
    name: "National ID / NIN Slip",
    desc: "Valid government-issued national identity document.",
    category: "Identity",
    file: { name: "nin_slip.pdf", size: "380 KB", date: "10 Jan 2026" },
  },
  {
    id: 3,
    name: "Certificate of Origin",
    desc: "Certificate confirming Mbo LGA indigeneship.",
    category: "Identity",
    file: { name: "certificate_of_origin.pdf", size: "290 KB", date: "10 Jan 2026" },
  },
  {
    id: 4,
    name: "Last Academic Result",
    desc: "Most recent semester or year result sheet.",
    category: "Scholarship",
    file: { name: "result_300l.pdf", size: "512 KB", date: "14 May 2026" },
  },
  {
    id: 5,
    name: "Admission Letter",
    desc: "Current session admission letter from institution.",
    category: "Scholarship",
    file: { name: "admission_2026.pdf", size: "290 KB", date: "14 May 2026" },
  },
  {
    id: 6,
    name: "Business Plan",
    desc: "Full business plan submitted for grant application.",
    category: "Grant",
    file: { name: "business_plan_2026.pdf", size: "1.2 MB", date: "2 Apr 2026" },
  },
];

const categoryColors = {
  Identity:    { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
  Scholarship: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  Grant:       { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
  Empowerment: { bg: "#f5f3ff", border: "#ddd6fe", color: "#7c3aed" },
};

export default function DocumentsPage() {
  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <FileText size={20} strokeWidth={1.8} color="#15803d" />
        </div>
        <div>
          <h1 className={styles.title}>My Documents</h1>
          <p className={styles.sub}>Documents you have submitted through registration and applications.</p>
        </div>
      </div>

      {/* DOC LIST */}
      <div className={styles.docList}>
        {DOCS.map((doc) => {
          const cat = categoryColors[doc.category] || categoryColors.Identity;
          return (
            <div key={doc.id} className={styles.docCard}>

              {/* TOP ROW */}
              <div className={styles.docTop}>
                <div className={styles.docMeta}>
                  <span className={styles.docName}>{doc.name}</span>
                  <p className={styles.docDesc}>{doc.desc}</p>
                </div>
                <span
                  className={styles.catChip}
                  style={{ background: cat.bg, borderColor: cat.border, color: cat.color }}
                >
                  {doc.category}
                </span>
              </div>

              {/* FILE ROW */}
              <div className={styles.fileRow}>
                <FileText size={15} color="#15803d" strokeWidth={1.8} className={styles.fileIcon} />
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{doc.file.name}</span>
                  <span className={styles.fileMeta}>{doc.file.size} · {doc.file.date}</span>
                </div>
                <div className={styles.fileActions}>
                  <button className={styles.fileBtn} title="Preview">
                    <Eye size={14} strokeWidth={2} />
                  </button>
                  <button className={styles.fileBtn} title="Download">
                    <Download size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}