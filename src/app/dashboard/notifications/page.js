"use client";
import { useState } from "react";
import {
  Bell, CheckCircle2, Clock, AlertTriangle, Search,
  UserCircle, Megaphone, CheckCheck, Trash2,
  GraduationCap, FileText, ShieldAlert, CalendarClock, Sparkles,
} from "lucide-react";
import styles from "./page.module.css";

/* ── MOCK DATA ── */
const MOCK_NOTIFICATIONS = [
  {
    id: 0,
    type: "welcome",
    icon: Sparkles,
    title: "Welcome to RMHCDT Youth Portal!",
    message: "Your account has been created successfully. Complete your profile and explore available programmes this cycle.",
    time: "Just now",
    read: false,
  },
  {
    id: 1,
    type: "application",
    icon: GraduationCap,
    title: "Application status updated",
    message: "Your 2026/2027 University Scholarship application has been approved.",
    time: "2 hours ago",
    read: false,
  },
  {
    id: 2,
    type: "deadline",
    icon: CalendarClock,
    title: "Deadline reminder",
    message: "Document submission for the SME Business Startup Grant closes in 2 days.",
    time: "5 hours ago",
    read: false,
  },
  {
    id: 3,
    type: "programme",
    icon: FileText,
    title: "New programme available",
    message: "The 2026 Youth Skills Training Programme is now open. Apply before slots run out.",
    time: "Yesterday",
    read: false,
  },
  {
    id: 4,
    type: "profile",
    icon: UserCircle,
    title: "Complete your profile",
    message: "Your profile is missing a passport photo. Upload one to stay eligible this cycle.",
    time: "2 days ago",
    read: true,
  },
  {
    id: 5,
    type: "system",
    icon: Megaphone,
    title: "Cycle 2026–2027 is now active",
    message: "The new programme cycle has officially opened. Log in to review your eligibility.",
    time: "3 days ago",
    read: true,
  },
  {
    id: 6,
    type: "alert",
    icon: ShieldAlert,
    title: "Action required on application",
    message: "Your Empowerment Programme application has been flagged. Please review and resubmit.",
    time: "4 days ago",
    read: true,
  },
];

const TYPE_META = {
  application: { color: "green",  bg: "#f0fdf4", border: "#bbf7d0", icon: "#15803d" },
  deadline:    { color: "amber",  bg: "#fffbeb", border: "#fde68a", icon: "#d97706" },
  programme:   { color: "blue",   bg: "#eff6ff", border: "#bfdbfe", icon: "#2563eb" },
  profile:     { color: "slate",  bg: "#f8fafc", border: "#e2e8f0", icon: "#64748b" },
  system:      { color: "green",  bg: "#f0fdf4", border: "#bbf7d0", icon: "#15803d" },
  alert:       { color: "red",    bg: "#fef2f2", border: "#fecaca", icon: "#dc2626" },
  welcome:     { color: "amber",  bg: "#fffbeb", border: "#fde68a", icon: "#d97706" },
};

const FILTERS = ["All", "Unread"];

export default function NotificationsPage() {
  const [notifs, setNotifs]       = useState(MOCK_NOTIFICATIONS);
  const [activeFilter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const unreadCount = notifs.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifs((n) => n.map((item) => ({ ...item, read: true })));
  }

  function markRead(id) {
    setNotifs((n) => n.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  function dismiss(id) {
    setNotifs((n) => n.filter((item) => item.id !== id));
  }

  function clearAll() {
    setNotifs([]);
  }

  const filtered = notifs.filter((n) => {
    const matchesFilter =
      activeFilter === "All" ? true :
      activeFilter === "Unread" ? !n.read : true;
    const matchesSearch = search.trim() === "" ? true :
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.message.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className={styles.page}>

      {/* ── PAGE HEADER ── */}
      <div className={styles.pageHead}>
        <div className={styles.pageHeadLeft}>
          <div className={styles.pageHeadIcon}>
            <Bell size={16} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>Notifications</h1>
            <p className={styles.pageSub}>
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "You're all caught up"}
            </p>
          </div>
        </div>
        <div className={styles.pageHeadActions}>
          {unreadCount > 0 && (
            <button className={styles.btnGhost} onClick={markAllRead}>
              <CheckCheck size={13} strokeWidth={2} /> Mark all read
            </button>
          )}
          {notifs.length > 0 && (
            <button className={styles.btnGhostDanger} onClick={clearAll}>
              <Trash2 size={13} strokeWidth={2} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── SEARCH + FILTER ROW ── */}
      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          <Search size={13} strokeWidth={2} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${activeFilter === f ? styles.filterActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
              {f === "Unread" && unreadCount > 0 && (
                <span className={styles.filterBadge}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── NOTIFICATION LIST ── */}
      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Bell size={28} strokeWidth={1.5} />
            </div>
            <p className={styles.emptyTitle}>No notifications here</p>
            <p className={styles.emptySub}>You're all caught up — check back later.</p>
          </div>
        ) : (
          filtered.map((notif) => {
            const meta = TYPE_META[notif.type];
            const Icon = notif.icon;
            return (
              <div
                key={notif.id}
                className={`${styles.notifCard} ${!notif.read ? styles.notifUnread : ""}`}
                onClick={() => markRead(notif.id)}
              >
                {/* icon */}
                <div
                  className={styles.notifIconWrap}
                  style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
                >
                  <Icon size={15} strokeWidth={2} style={{ color: meta.icon }} />
                </div>

                {/* content */}
                <div className={styles.notifBody}>
                  <div className={styles.notifTop}>
                    <span className={styles.notifTitle}>{notif.title}</span>
                    <span className={styles.notifTime}>{notif.time}</span>
                  </div>
                  <p className={styles.notifMessage}>{notif.message}</p>
                </div>

                {/* dismiss */}
                <button
                  className={styles.dismissBtn}
                  onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}
                  title="Dismiss"
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}