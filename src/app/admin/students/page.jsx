"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { students } from "../mockdata";
import styles from "./students.module.css";

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function VerificationBadge({ verified }) {
  return (
    <span className={verified ? styles.badgeVerified : styles.badgeUnverified}>
      {verified ? "✓ Verified" : "⚠ Unverified"}
    </span>
  );
}

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [lgaFilter, setLgaFilter] = useState("all");

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const fullName = `${s.firstname} ${s.lastname}`.toLowerCase();
    const matchSearch =
      !q ||
      fullName.includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.nin_hash.includes(q) ||
      s.id.toLowerCase().includes(q);

    const matchVerified =
      verifiedFilter === "all" ||
      (verifiedFilter === "verified" && s.is_verified) ||
      (verifiedFilter === "unverified" && !s.is_verified);

    const matchLga = lgaFilter === "all" || s.lga === lgaFilter;

    return matchSearch && matchVerified && matchLga;
  });

  const uniqueLgas = [...new Set(students.map((s) => s.lga))];
  const totalVerified = students.filter((s) => s.is_verified).length;
  const totalUnverified = students.filter((s) => !s.is_verified).length;

  return (
    <div className={styles.page}>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Students</h1>
          <p className={styles.pageSubtitle}>All registered students on the portal</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotTotal}`} />
          <div>
            <div className={styles.statPillValue}>{students.length}</div>
            <div className={styles.statPillLabel}>Total Students</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotVerified}`} />
          <div>
            <div className={styles.statPillValue}>{totalVerified}</div>
            <div className={styles.statPillLabel}>Verified</div>
          </div>
        </div>
        <div className={styles.statPill}>
          <div className={`${styles.statPillDot} ${styles.statPillDotUnverified}`} />
          <div>
            <div className={styles.statPillValue}>{totalUnverified}</div>
            <div className={styles.statPillLabel}>Unverified</div>
          </div>
        </div>
      </div>

      <div className={styles.card}>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>
              <Search size={14} color="#94a3b8" />
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, NIN or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={styles.filterSelect}
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
          >
            <option value="all">All Students</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified Only</option>
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
            <div className={styles.emptyTitle}>No students found</div>
            <div className={styles.emptySubtitle}>
              Try adjusting your search or filter
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead className={styles.tableThead}>
                <tr>
                  <th className={styles.tableTh}>Student</th>
                  <th className={styles.tableTh}>NIN Hash</th>
                  <th className={styles.tableTh}>Level</th>
                  <th className={styles.tableTh}>CGPA</th>
                  <th className={styles.tableTh}>LGA</th>
                  <th className={styles.tableTh}>Ward</th>
                  <th className={styles.tableTh}>Verified</th>
                  <th className={styles.tableTh}>Registered</th>
                  <th className={styles.tableTh}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id} className={styles.tableTr}>
                    <td className={styles.tdStudent}>
                      <div className={styles.tdStudentName}>
                        {student.firstname} {student.lastname}
                      </div>
                      <div className={styles.tdStudentMeta}>{student.email}</div>
                    </td>
                    <td className={styles.tdMono}>{student.nin_hash}</td>
                    <td className={styles.tdCell}>{student.level} Level</td>
                    <td className={styles.tdCell}>{student.cgpa}</td>
                    <td className={styles.tdMuted}>{student.lga}</td>
                    <td className={styles.tdMuted}>{student.ward}</td>
                    <td className={styles.tdCell}>
                      <VerificationBadge verified={student.is_verified} />
                    </td>
                    <td className={styles.tdMuted}>
                      {formatDate(student.created_at)}
                    </td>
                    <td className={styles.tdActions}>
                      <Link
                        href={`/admin/students/${student.id}`}
                        className={styles.btnView}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {filtered.length} of {students.length} students
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