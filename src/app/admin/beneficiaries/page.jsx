"use client";

import { useState } from "react";
import { Search, Lock } from "lucide-react";
import { beneficiaries } from "../mockdata";
import styles from "./beneficiaries.module.css";

// ── HELPERS ───────────────────────────────────
function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── CATEGORY BADGE ────────────────────────────
function CategoryBadge({ category }) {
  const map = {
    scholarship: styles.badgeScholarship,
    vocational: styles.badgeVocational,
    empowerment: styles.badgeEmpowerment,
    grant: styles.badgeGrant,
  };
  const labels = {
    scholarship: "Scholarship",
    vocational: "Vocational",
    empowerment: "Empowerment",
    grant: "Grant",
  };
  return (
    <span className={map[category] || styles.badgeScholarship}>
      {labels[category] || category}
    </span>
  );
}

// ── PAGE ──────────────────────────────────────
export default function BeneficiariesPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lgaFilter, setLgaFilter] = useState("all");

  const filtered = beneficiaries.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.student_name.toLowerCase().includes(q) ||
      b.scheme_name.toLowerCase().includes(q) ||
      b.student_id.toLowerCase().includes(q);

    const matchCategory =
      categoryFilter === "all" || b.category === categoryFilter;

    const matchLga = lgaFilter === "all" || b.lga === lgaFilter;

    return matchSearch && matchCategory && matchLga;
  });

  const uniqueLgas = [...new Set(beneficiaries.map((b) => b.lga))];

  const scholarshipCount = beneficiaries.filter(
    (b) => b.category === "scholarship"
  ).length;
  const otherCount = beneficiaries.filter(
    (b) => b.category !== "scholarship"
  ).length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Beneficiary Register</h1>
          <p className={styles.pageSubtitle}>
            Read-only record of all approved beneficiaries
          </p>
        </div>
        <span className={styles.readOnlyBadge}>
          <Lock size={10} />
          Read Only
        </span>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotTotal}`} />
          <div>
            <div className={styles.statPillValue}>{beneficiaries.length}</div>
            <div className={styles.statPillLabel}>Total Beneficiaries</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotScholarship}`} />
          <div>
            <div className={styles.statPillValue}>{scholarshipCount}</div>
            <div className={styles.statPillLabel}>Scholarships</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotOther}`} />
          <div>
            <div className={styles.statPillValue}>{otherCount}</div>
            <div className={styles.statPillLabel}>Other Awards</div>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>
              <Search size={14} color="#94a3b8" />
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name or scheme..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="scholarship">Scholarship</option>
            <option value="vocational">Vocational</option>
            <option value="empowerment">Empowerment</option>
            <option value="grant">Grant</option>
          </select>

          <select
            className={styles.filterSelect}
            value={lgaFilter}
            onChange={(e) => setLgaFilter(e.target.value)}
          >
            <option value="all">All LGAs</option>
            {uniqueLgas.map((lga) => (
              <option key={lga} value={lga}>{lga}</option>
            ))}
          </select>

          <div className={styles.toolbarRight}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No beneficiaries found</div>
            <div className={styles.emptySubtitle}>
              Try adjusting your search or filter
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableThead}>
                <tr>
                  <th className={styles.tableTh}>Beneficiary</th>
                  <th className={styles.tableTh}>Scheme</th>
                  <th className={styles.tableTh}>Category</th>
                  <th className={styles.tableTh}>LGA</th>
                  <th className={styles.tableTh}>Ward</th>
                  <th className={styles.tableTh}>Approved</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className={styles.tableTr}>
                    <td className={styles.tdStudent}>
                      <div className={styles.tdStudentName}>{b.student_name}</div>
                      <div className={styles.tdStudentMeta}>{b.student_id}</div>
                    </td>
                    <td className={styles.tdScheme}>
                      <div className={styles.tdSchemeText}>{b.scheme_name}</div>
                    </td>
                    <td className={styles.tdCell}>
                      <CategoryBadge category={b.category} />
                    </td>
                    <td className={styles.tdMuted}>{b.lga}</td>
                    <td className={styles.tdMuted}>{b.ward}</td>
                    <td className={styles.tdMuted}>
                      {formatDate(b.approved_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {filtered.length} of {beneficiaries.length} beneficiaries
          </div>
          <div className={styles.paginationButtons}>
            <button className={styles.paginationBtn}>Previous</button>
            <button
              className={`${styles.paginationBtn} ${styles.paginationBtnActive}`}
            >
              1
            </button>
            <button className={styles.paginationBtn}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}