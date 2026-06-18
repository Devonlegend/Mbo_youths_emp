"use client";
import { useState, useEffect } from "react";
import {
  Bell, Search, CheckCheck, Trash2,
  CheckCircle2, XCircle, ShieldCheck,
  FileText, ShieldAlert, CalendarClock, Sparkles,
  UserCircle, Megaphone, AlertCircle, Loader2, GraduationCap,
} from "lucide-react";
import styles from "./page.module.css";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearAllNotifications,
} from "@/services";

const TYPE_META = {
  application: { bg: "#f0fdf4", border: "#bbf7d0", icon: "#15803d" },
  deadline:    { bg: "#fffbeb", border: "#fde68a", icon: "#d97706" },
  programme:   { bg: "#eff6ff", border: "#bfdbfe", icon: "#2563eb" },
  profile:     { bg: "#f8fafc", border: "#e2e8f0", icon: "#64748b" },
  system:      { bg: "#f0fdf4", border: "#bbf7d0", icon: "#15803d" },
  alert:       { bg: "#fef2f2", border: "#fecaca", icon: "#dc2626" },
  welcome:     { bg: "#fffbeb", border: "#fde68a", icon: "#d97706" },
};

const TYPE_ICONS = {
  application: GraduationCap,
  deadline:    CalendarClock,
  programme:   FileText,
  profile:     UserCircle,
  system:      Megaphone,
  alert:       ShieldAlert,
  welcome:     Sparkles,
};

const FILTERS = ["All", "Unread"];

function formatTime(isoString) {
  if (!isoString) return "—";
  const diff = new Date() - new Date(isoString);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7)   return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function NotificationsPage() {
  const [notifs,       setNotifs]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [activeFilter, setFilter]       = useState("All");
  const [search,       setSearch]       = useState("");

  const unreadCount = notifs.filter((n) => !n.read).length;

  // ── FETCH ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const res = await getNotifications();
      setNotifs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  // ── ACTIONS ────────────────────────────────────────────────────────
  async function markRead(id) {
    setNotifs((n) => n.map((item) => item.id === id ? { ...item, read: true } : item));
    try {
      await markNotificationRead(id);
    } catch {}
  }

  async function markAllRead() {
    setNotifs((n) => n.map((item) => ({ ...item, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {}
  }

  async function dismiss(id) {
    setNotifs((n) => n.filter((item) => item.id !== id));
    try {
      await dismissNotification(id);
    } catch {}
  }

  async function clearAll() {
    setNotifs([]);
    try {
      await clearAllNotifications();
    } catch {}
  }

  // ── FILTER ─────────────────────────────────────────────────────────
  const filtered = notifs.filter((n) => {
    const matchesFilter =
      activeFilter === "All"    ? true :
      activeFilter === "Unread" ? !n.read : true;
    const matchesSearch = search.trim() === "" ? true :
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.message.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
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

      {/* SEARCH + FILTER */}
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

      {/* LIST */}
      <div className={styles.list}>

        {loading && (
          <div className={styles.empty}>
            <Loader2 size={24} className={styles.spin} color="#94a3b8" />
            <p className={styles.emptySub}>Loading notifications...</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.empty}>
            <AlertCircle size={28} color="#f87171" strokeWidth={1.5} />
            <p className={styles.emptyTitle} style={{ color: "#ef4444" }}>{error}</p>
            <button className={styles.btnGhost} onClick={loadNotifications}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Bell size={28} strokeWidth={1.5} />
            </div>
            <p className={styles.emptyTitle}>No notifications here</p>
            <p className={styles.emptySub}>You're all caught up — check back later.</p>
          </div>
        )}

        {!loading && !error && filtered.map((notif) => {
          const title = notif.title.toLowerCase();

          const metaKey =
            title.includes("approved")  ? "application" :
            title.includes("rejected")  ? "alert"       :
            title.includes("submitted") ? "application" :
            title.includes("verified")  ? "system"      :
            title.includes("eligible")  ? "alert"       :
            title.includes("programme") ? "programme"   :
            title.includes("waiver")    ? "deadline"    :
            notif.type;
          const meta = TYPE_META[metaKey] || TYPE_META.system;

          const Icon =
            title.includes("approved")  ? CheckCircle2  :
            title.includes("rejected")  ? XCircle       :
            title.includes("submitted") ? FileText       :
            title.includes("verified")  ? ShieldCheck    :
            title.includes("eligible")  ? ShieldAlert    :
            title.includes("programme") ? CalendarClock  :
            title.includes("waiver")    ? FileText       :
            TYPE_ICONS[notif.type]      || Bell;
          return (
            <div
              key={notif.id}
              className={`${styles.notifCard} ${!notif.read ? styles.notifUnread : ""}`}
              onClick={() => markRead(notif.id)}
            >
              <div
                className={styles.notifIconWrap}
                style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
              >
                <Icon size={15} strokeWidth={2} style={{ color: meta.icon }} />
              </div>

              <div className={styles.notifBody}>
                <div className={styles.notifTop}>
                  <span className={styles.notifTitle}>{notif.title}</span>
                  <span className={styles.notifTime}>{formatTime(notif.time)}</span>
                </div>
                <p className={styles.notifMessage}>{notif.message}</p>
              </div>

              <button
                className={styles.dismissBtn}
                onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}
                title="Dismiss"
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          );
        })}

      </div>

    </div>
  );
}