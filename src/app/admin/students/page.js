"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Search, ArrowRight, AlertCircle,
  CheckCircle2, XCircle, Shield,
} from "lucide-react";
import styles from "./page.module.css";
import { getStudents } from "@/services";

// ── SKELETON ROW ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className={styles.tableRow}>
      <div className={styles.skeletonCell} style={{ width: "22%" }} />
      <div className={styles.skeletonCell} style={{ width: "24%" }} />
      <div className={styles.skeletonCell} style={{ width: "14%" }} />
      <div className={styles.skeletonCell} style={{ width: "12%" }} />
      <div className={styles.skeletonCell} style={{ width: "10%" }} />
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function AdminStudentsPage() {
  const router = useRouter();

  const [students,    setStudents]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState("");
  const [filterVerified, setFilterVerified] = useState("all"); // "all" | "verified" | "unverified"
  const [filterOpen,  setFilterOpen]  = useState(false);

  // ── FETCH ─────────────────────────────────────────────────────────────────
useEffect(() => {
  let cancelled = false;
  async function load() {
    try {
      const res = await getStudents();
      if (cancelled) return;
      setStudents(Array.isArray(res.data?.results) ? res.data.results : []);
    } catch {
      if (!cancelled) setError("Failed to load students. Please try again.");
    } finally {
      if (!cancelled) setLoading(false);
    }
  }
  load();
  return () => { cancelled = true; };
}, []);

  // ── COUNTS ────────────────────────────────────────────────────────────────
  const total      = students.length;
  const verified   = students.filter((s) => s.is_verified).length;
  const unverified = total - verified;

  // ── FILTER + SEARCH ───────────────────────────────────────────────────────
  const filtered = students.filter((s) => {
    const fullName = `${s.firstname} ${s.lastname}`.toLowerCase();
    const matchSearch = search.trim() === "" ? true :
      fullName.includes(search.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.lga   || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.ward  || "").toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filterVerified === "all"        ? true :
      filterVerified === "verified"   ? s.is_verified :
      filterVerified === "unverified" ? !s.is_verified : true;

    return matchSearch && matchFilter;
  });

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Users size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className={styles.title}>Students</h1>
            <p className={styles.sub}>All registered youth from the host community.</p>
          </div>
        </div>
      </div>

      {/* SUMMARY STRIP */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Total Registered", value: total,      key: "all",        color: "#0f172a" },
          { label: "Verified",         value: verified,   key: "verified",   color: "#15803d" },
          { label: "Unverified",       value: unverified, key: "unverified", color: "#f59e0b" },
        ].map((s) => (
          <button
            key={s.key}
            className={`${styles.summaryItem} ${filterVerified === s.key ? styles.summaryItemActive : ""}`}
            onClick={() => setFilterVerified(s.key)}
          >
            <span className={styles.summaryValue} style={{ color: s.color }}>
              {loading ? "—" : s.value}
            </span>
            <span className={styles.summaryLabel}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* TOOLBAR */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name, email, LGA or ward..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter dropdown */}
          <div style={{ position: "relative" }}>
            <button
              className={`${styles.filterBtn} ${filterVerified !== "all" ? styles.filterBtnActive : ""}`}
              onClick={() => setFilterOpen((o) => !o)}
            >
              <Shield size={13} strokeWidth={2} />
              {filterVerified === "all" ? "All Students" :
               filterVerified === "verified" ? "Verified" : "Unverified"}
            </button>
            {filterOpen && (
              <div className={styles.filterDropdown}>
                {[
                  { key: "all",        label: "All Students" },
                  { key: "verified",   label: "Verified only" },
                  { key: "unverified", label: "Unverified only" },
                ].map((f) => (
                  <button
                    key={f.key}
                    className={`${styles.filterOption} ${filterVerified === f.key ? styles.filterOptionActive : ""}`}
                    onClick={() => { setFilterVerified(f.key); setFilterOpen(false); }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TABLE HEADER */}
        <div className={`${styles.tableRow} ${styles.tableHeader}`}>
          <span>Student</span>
          <span>Email</span>
          <span>LGA / Ward</span>
          <span>Verified</span>
          <span></span>
        </div>

        {/* LOADING */}
        {loading && [1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}

        {/* ERROR */}
        {!loading && error && (
          <div className={styles.emptyState}>
            <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
            <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
            <button
              className={styles.retryBtn}
              onClick={() => { setError(null); setLoading(true); }}
            >
              Try again
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <Users size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p className={styles.emptyTitle}>No students found</p>
            <p className={styles.emptySub}>
              {search ? "Try a different search term." : "No students registered yet."}
            </p>
          </div>
        )}

        {/* TABLE ROWS */}
        {!loading && !error && filtered.map((student) => {
          const initials =
            (student.firstname?.[0] || "").toUpperCase() +
            (student.lastname?.[0]  || "").toUpperCase();

          return (
            <div
              key={student.user_id}
              className={styles.tableRowData}
            >
              {/* Student */}
              <div className={styles.tdStudent}>
                <div className={styles.studentAvatar}>{initials}</div>
                <div className={styles.studentInfo}>
                  <span className={styles.studentName}>
                    {student.firstname} {student.lastname}
                  </span>
                  <span className={styles.studentMeta}>
                    {student.level || student.cgpa ? (
                      <>
                        {student.level ? `${student.level} Level` : ""}
                        {student.cgpa  ? ` · CGPA ${student.cgpa}` : ""}
                      </>
                    ) : null}
                  </span>
                </div>
              </div>

              {/* Email */}
              <span className={styles.tdEmail}>
                {student.email || "—"}
              </span>

              {/* LGA / Ward */}
              <div className={styles.tdLocation}>
                <span className={styles.lgaText}>{student.lga || "—"}</span>
                <span className={styles.wardText}>{student.ward || "—"}</span>
              </div>

              {/* Verified */}
              <div className={styles.tdVerified}>
                {student.is_verified ? (
                  <span className={styles.verifiedChip}>
                    <CheckCircle2 size={11} strokeWidth={2.5} />
                    Verified
                  </span>
                ) : (
                  <span className={styles.unverifiedChip}>
                    <XCircle size={11} strokeWidth={2.5} />
                    Unverified
                  </span>
                )}
              </div>

              {/* Action */}
              <button
                className={styles.viewBtn}
                onClick={() => router.push(`/admin/students/${student.user_id}`)}
              >
                View <ArrowRight size={11} strokeWidth={2} />
              </button>

            </div>
          );
        })}

        {/* FOOTER */}
        {!loading && !error && (
          <div className={styles.tableFooter}>
            Showing {filtered.length} of {students.length} students
          </div>
        )}

      </div>

    </div>
  );
}