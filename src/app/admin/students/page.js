"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Search, ArrowRight, AlertCircle,
  CheckCircle2, XCircle, Shield,
} from "lucide-react";
import styles from "./page.module.css";
import { getStudents, getStudentStats } from "@/services";
import Pagination from "../components/pagination/Pagination";

const PAGE_SIZE = 50; // matches API_PAGE_SIZE in backend settings.py

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
  const [loading,      setLoading]    = useState(true);
  const [error,        setError]      = useState(null);
  const [search,       setSearch]     = useState("");
  const [filterVerified, setFilterVerified] = useState("all"); // "all" | "verified" | "unverified"
  const [filterOpen,   setFilterOpen] = useState(false);

  // ── PAGINATION STATE ────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, next: null, previous: null });

  // ── REAL TOTALS — from /students/stats/, NOT from the loaded page ──────
  const [stats, setStats] = useState({ total_students: 0, verified: 0, unverified: 0 });

  // ── FETCH ONE PAGE OF STUDENTS ───────────────────────────────────────────
  async function loadStudents(targetPage) {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudents(targetPage);
      setStudents(Array.isArray(res.data?.results) ? res.data.results : []);
      setPageInfo({
        count:    res.data?.count    ?? 0,
        next:     res.data?.next     ?? null,
        previous: res.data?.previous ?? null,
      });
      setPage(targetPage);
    } catch {
      setError("Failed to load students. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── FETCH ACCURATE TOTALS (separate from pagination) ────────────────────
  async function loadStats() {
    try {
      const res = await getStudentStats();
      setStats(res.data);
    } catch {
      // Summary strip just falls back to "—" — not worth blocking the page for.
    }
  }

  useEffect(() => {
    loadStudents(1);
    loadStats();
  }, []);

  // ── FILTER + SEARCH (current page only — see note below) ────────────────
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

      {/* SUMMARY STRIP — now backed by /students/stats/, true totals */}
      <div className={styles.summaryStrip}>
        {[
          { label: "Total Registered", value: stats.total_students, key: "all",        color: "var(--color-text)" },
          { label: "Verified",         value: stats.verified,       key: "verified",   color: "var(--color-primary)" },
          { label: "Unverified",       value: stats.unverified,     key: "unverified", color: "#f59e0b" },
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
              placeholder="Search this page by name, email, LGA or ward..."
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
            <button className={styles.retryBtn} onClick={() => loadStudents(page)}>
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
              {search
                ? "No match on this page — try Next to check other pages."
                : "No students registered yet."}
            </p>
          </div>
        )}

        {/* TABLE ROWS */}
        {!loading && !error && filtered.map((student) => {
          const initials =
            (student.firstname?.[0] || "").toUpperCase() +
            (student.lastname?.[0]  || "").toUpperCase();

          return (
            <div key={student.user_id} className={styles.tableRowData}>
              <div className={styles.tdStudent}>
                <div className={styles.studentAvatar}>{initials}</div>
                <div className={styles.studentInfo}>
                  <span className={styles.studentName}>
                    {student.firstname} {student.lastname}
                  </span>
                  <span className={styles.studentMeta}>
                    {student.level ? `${student.level} Level` : ""}
                    {student.cgpa  ? ` · CGPA ${student.cgpa}` : ""}
                  </span>
                </div>
              </div>

              <span className={styles.tdEmail}>{student.email || "—"}</span>

              <div className={styles.tdLocation}>
                <span className={styles.lgaText}>{student.lga || "—"}</span>
                <span className={styles.wardText}>{student.ward || "—"}</span>
              </div>

              <div className={styles.tdVerified}>
                {student.is_verified ? (
                  <span className={styles.verifiedChip}>
                    <CheckCircle2 size={11} strokeWidth={2.5} /> Verified
                  </span>
                ) : (
                  <span className={styles.unverifiedChip}>
                    <XCircle size={11} strokeWidth={2.5} /> Unverified
                  </span>
                )}
              </div>

              <button
                className={styles.viewBtn}
                onClick={() => router.push(`/admin/students/${student.user_id}`)}
              >
                View <ArrowRight size={11} strokeWidth={2} />
              </button>
            </div>
          );
        })}

        {/* PAGINATION BAR — replaces the old static tableFooter */}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={pageInfo.count}
          hasNext={!!pageInfo.next}
          hasPrevious={!!pageInfo.previous}
          loading={loading}
          onPageChange={(newPage) => loadStudents(newPage)}
        />

      </div>

    </div>
  );
}