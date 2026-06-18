"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Users, BookOpen, BadgeCheck,
  ShieldAlert, Clock, CheckCircle2, XCircle,
  AlertCircle, ArrowRight, LayoutDashboard, Calendar, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import styles from "./page.module.css";
import { getApplications, getSchemes, getMe } from "@/services";

// ── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, iconBg, iconColor, loading }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statTop}>
        <div className={styles.statIcon} style={{ background: iconBg }}>
          <Icon size={18} strokeWidth={1.8} style={{ color: iconColor }} />
        </div>
      </div>
      <div className={styles.statBottom}>
        {loading
          ? <div className={styles.statSkeleton} />
          : <div className={styles.statValue}>{value}</div>
        }
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

// ── CUSTOM TOOLTIP ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      <p className={styles.tooltipValue}>{payload[0].value} applications</p>
    </div>
  );
}

// ── STATUS MAP ────────────────────────────────────────────────────────────────
const STATUS_UI = {
  submitted:         { label: "Pending",  color: "#f59e0b" },
  eligibility_check: { label: "Pending",  color: "#f59e0b" },
  document_review:   { label: "Pending",  color: "#f59e0b" },
  shortlisted:       { label: "Pending",  color: "#f59e0b" },
  double_dip_flag:   { label: "Flagged",  color: "#ef4444" },
  approved:          { label: "Approved", color: "#15803d" },
  rejected:          { label: "Rejected", color: "#64748b" },
  withdrawn:         { label: "Rejected", color: "#64748b" },
  draft:             { label: "Pending",  color: "#f59e0b" },
};

function mapActivityStatus(status) {
  return STATUS_UI[status] || { label: "Pending", color: "#f59e0b" };
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const days = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function AdminOverviewPage() {
  const router = useRouter();

  const [stats,     setStats]     = useState(null);
  const [chartData, setChartData] = useState([]);
  const [activity,  setActivity]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [user,      setUser]      = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [appsRes, schemesRes, meRes] = await Promise.allSettled([
          getApplications(),
          getSchemes(),
          getMe(),
        ]);

        if (cancelled) return;

        if (meRes.status === "fulfilled") {
          setUser(meRes.value.data);
        }

        // ── Applications — paginated response ─────────────────────────────
        const apps = appsRes.status === "fulfilled"
          ? (Array.isArray(appsRes.value.data?.results) ? appsRes.value.data.results : [])
          : [];

        const total = appsRes.status === "fulfilled" ? (appsRes.value.data?.count ?? 0) : 0;
        const pending  = apps.filter((a) =>
          ["submitted", "eligibility_check", "document_review",
           "shortlisted", "draft"].includes(a.status)
        ).length;
        const flagged  = apps.filter((a) => a.status === "double_dip_flag").length;
        const approved = apps.filter((a) => a.status === "approved").length;
        const rejected = apps.filter((a) =>
          ["rejected", "withdrawn"].includes(a.status)
        ).length;

        // ── Schemes — paginated response ──────────────────────────────────
        const schemes = schemesRes.status === "fulfilled"
          ? (Array.isArray(schemesRes.value.data?.results) ? schemesRes.value.data.results : [])
          : [];
        const openSchemes = schemes.filter((s) => s.is_active && s.is_published).length;

        setStats({ total, pending, flagged, approved, rejected, openSchemes });

        setChartData([
          { label: "Pending",  value: pending,  fill: "#f59e0b" },
          { label: "Flagged",  value: flagged,  fill: "#ef4444" },
          { label: "Approved", value: approved, fill: "#15803d" },
          { label: "Rejected", value: rejected, fill: "#94a3b8" },
        ]);

        // ── Recent activity — last 5 ──────────────────────────────────────
        const sorted = [...apps]
          .sort((a, b) => new Date(b.submission_date) - new Date(a.submission_date))
          .slice(0, 5);
        setActivity(sorted);

      } catch {
        setStats({ total: 0, pending: 0, flagged: 0, approved: 0, rejected: 0, openSchemes: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const statCards = [
    { icon: ClipboardList, label: "Total Applications", value: stats?.total      ?? 0, iconBg: "#eff6ff", iconColor: "#3b82f6" },
    { icon: Clock,         label: "Pending Review",     value: stats?.pending    ?? 0, iconBg: "#fffbeb", iconColor: "#f59e0b" },
    { icon: AlertCircle,   label: "Flagged",            value: stats?.flagged    ?? 0, iconBg: "#fef2f2", iconColor: "#ef4444" },
    { icon: CheckCircle2,  label: "Approved",           value: stats?.approved   ?? 0, iconBg: "#f0fdf4", iconColor: "#15803d" },
    { icon: XCircle,       label: "Rejected",           value: stats?.rejected   ?? 0, iconBg: "#f8fafc", iconColor: "#64748b" },
    { icon: BookOpen,      label: "Open Schemes",       value: stats?.openSchemes ?? 0, iconBg: "#f0fdf4", iconColor: "#15803d" },
  ];

  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <LayoutDashboard size={20} color="#15803d" strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            <h1 className={styles.title}>Overview</h1>
            <p className={styles.sub}>Here's what's happening today</p>
          </div>
        </div>
        <div className={styles.dateBadge}>
          <Calendar size={16} color="#15803d" strokeWidth={1.8} />
          <span className={styles.dateBadgeText}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className={styles.statsGrid}>
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} loading={loading} />
        ))}
      </div>

      {/* CHART + QUICK ACTIONS */}
      <div className={styles.middleRow}>

        {/* Bar chart */}
        <div className={styles.chartCard}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Applications by Status</h2>
              <p className={styles.cardSub}>Current cycle breakdown</p>
            </div>
            <div className={styles.cardHeadIcon}>
              <TrendingUp size={16} color="#15803d" strokeWidth={1.8} />
            </div>
          </div>

          {loading ? (
            <div className={styles.chartSkeleton} />
          ) : chartData.every((d) => d.value === 0) ? (
            <div className={styles.chartEmpty}>
              <TrendingUp size={28} color="#cbd5e1" strokeWidth={1.5} />
              <p>No application data yet this cycle.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                barSize={36}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#94a3b8", fontFamily: "Inter, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#94a3b8", fontFamily: "Inter, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick actions */}
        <div className={styles.quickCard}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Quick Actions</h2>
              <p className={styles.cardSub}>Jump to key sections</p>
            </div>
          </div>
          <div className={styles.quickList}>
            {[
              { label: "Review pending applications", href: "/admin/applications",             icon: ClipboardList, color: "#f59e0b", bg: "#fffbeb", roles: ["admin", "superadmin", "verifier"] },
              { label: "View flagged applications",   href: "/admin/applications?tab=flagged", icon: AlertCircle,   color: "#ef4444", bg: "#fef2f2", roles: ["admin", "superadmin", "verifier"] },
              { label: "Manage students",             href: "/admin/students",                 icon: Users,         color: "#3b82f6", bg: "#eff6ff", roles: ["admin", "superadmin", "verifier"] },
              { label: "Manage schemes",              href: "/admin/schemes",                  icon: BookOpen,      color: "#15803d", bg: "#f0fdf4", roles: ["admin", "superadmin"] },
              { label: "Beneficiary register",        href: "/admin/beneficiaries",            icon: BadgeCheck,    color: "#15803d", bg: "#f0fdf4", roles: ["admin", "superadmin", "verifier"] },
              { label: "Disqualification register",   href: "/admin/disqualifications",        icon: ShieldAlert,   color: "#ef4444", bg: "#fef2f2", roles: ["admin", "superadmin", "verifier"] },
            ].filter((q) => q.roles.includes(user?.role)).map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.href}
                  className={styles.quickItem}
                  onClick={() => router.push(q.href)}
                >
                  <div className={styles.quickIcon} style={{ background: q.bg }}>
                    <Icon size={14} strokeWidth={2} style={{ color: q.color }} />
                  </div>
                  <span className={styles.quickLabel}>{q.label}</span>
                  <ArrowRight size={13} strokeWidth={2} className={styles.quickArrow} />
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* RECENT ACTIVITY */}
      <div className={styles.activityCard}>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle}>Recent Applications</h2>
            <p className={styles.cardSub}>Latest submissions across all schemes</p>
          </div>
          <button
            className={styles.viewAllBtn}
            onClick={() => router.push("/admin/applications")}
          >
            View all <ArrowRight size={12} strokeWidth={2} />
          </button>
        </div>

        {loading ? (
          <div className={styles.tableSkeleton}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} className={styles.tableSkeletonRow}>
                <div className={styles.skeletonBlock} style={{ width: "25%" }} />
                <div className={styles.skeletonBlock} style={{ width: "30%" }} />
                <div className={styles.skeletonBlock} style={{ width: "15%" }} />
                <div className={styles.skeletonBlock} style={{ width: "12%" }} />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className={styles.emptyState}>
            <ClipboardList size={28} color="#cbd5e1" strokeWidth={1.5} />
            <p>No applications yet this cycle.</p>
          </div>
        ) : (
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHeader}`}>
              <span>Student</span>
              <span>Scheme</span>
              <span>Submitted</span>
              <span>Status</span>
              <span></span>
            </div>
            {activity.map((app) => {
              const { label, color } = mapActivityStatus(app.status);
              return (
                <div key={app.id} className={styles.tableRow}>
                  <span className={styles.tdName}>
                    {app.student?.full_name || "—"}
                  </span>
                  <span className={styles.tdScheme}>
                    {app.scheme?.name || "—"}
                  </span>
                  <span className={styles.tdDate}>
                    {formatTimeAgo(app.submission_date)}
                  </span>
                  <span>
                    <span
                      className={styles.statusBadge}
                      style={{
                        background: `${color}18`,
                        color,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {label}
                    </span>
                  </span>
                  <span>
                    <button
                      className={styles.viewBtn}
                      onClick={() => router.push(`/admin/applications/${app.id}`)}
                    >
                      View <ArrowRight size={11} strokeWidth={2} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}