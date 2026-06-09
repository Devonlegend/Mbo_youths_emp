"use client";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Settings, LogOut, ChevronDown,
         GraduationCap, CalendarClock, FileText, CheckCheck, Sparkles,
         ShieldAlert, UserCircle, Megaphone, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import styles from "./Topbar.module.css";
import { logout } from "@/services";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
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

function formatTime(isoString) {
  if (!isoString) return "";
  const diff  = new Date() - new Date(isoString);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function Topbar({ user, onMenuOpen }) {
  const router = useRouter();

  const [dropOpen,  setDropOpen]  = useState(false);
  const [bellOpen,  setBellOpen]  = useState(false);
  const [notifs,    setNotifs]    = useState([]);
  const [loading,   setLoading]   = useState(false);

  const dropRef = useRef(null);
  const bellRef = useRef(null);

  const unread = notifs.filter((n) => !n.read).length;

  const initials =
    (user?.first_name?.[0]?.toUpperCase() || "") +
    (user?.last_name?.[0]?.toUpperCase()  || "");

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load notifications on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getNotifications();
        setNotifs(Array.isArray(res.data) ? res.data : []);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleMarkAllRead() {
    setNotifs((n) => n.map((item) => ({ ...item, read: true })));
    try { await markAllNotificationsRead(); } catch {}
  }

  async function handleBellItemClick(notif) {
    if (!notif.read) {
      setNotifs((n) => n.map((item) => item.id === notif.id ? { ...item, read: true } : item));
      try { await markNotificationRead(notif.id); } catch {}
    }
  }

  function handleViewAll() {
    setBellOpen(false);
    router.push("/dashboard/notifications");
  }

  async function handleLogout() {
    try { await logout(); } catch {}
    finally { window.location.href = "/login"; }
  }

  // Show top 4 unread first, then read
  const preview = [
    ...notifs.filter((n) => !n.read),
    ...notifs.filter((n) =>  n.read),
  ].slice(0, 4);

  return (
    <header className={styles.topbar}>

      {/* LEFT */}
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuOpen} aria-label="Open menu">
          <Menu size={18} strokeWidth={2} />
        </button>
      </div>

      {/* CENTER */}
      <div className={styles.center}>
        <span className={styles.cyclePill}>
          <span className={styles.cycleDot} />
          Cycle 2026 – 2027
        </span>
      </div>

      {/* RIGHT */}
      <div className={styles.right}>

        {/* BELL */}
        <div className={styles.bellWrap} ref={bellRef}>
          <button
            className={styles.iconBtn}
            aria-label="Notifications"
            onClick={() => { setBellOpen((o) => !o); setDropOpen(false); }}
          >
            <Bell size={16} strokeWidth={2} />
            {unread > 0 && (
              <span className={styles.notifBadge}>{unread}</span>
            )}
          </button>

          {bellOpen && (
            <div className={styles.bellDropdown}>
              <div className={styles.bellHead}>
                <span className={styles.bellHeadTitle}>Notifications</span>
                {unread > 0 && (
                  <button className={styles.bellMarkAll} onClick={handleMarkAllRead}>
                    <CheckCheck size={12} strokeWidth={2} /> Mark all read
                  </button>
                )}
              </div>

              <div className={styles.bellList}>
                {loading && (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <Loader2 size={18} color="#94a3b8" />
                  </div>
                )}
                {!loading && preview.length === 0 && (
                  <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    No notifications yet
                  </div>
                )}
                {!loading && preview.map((n) => {
                  const Icon   = TYPE_ICONS[n.type] || Bell;
                  const colors = TYPE_META[n.type] || TYPE_META.system;
                  return (
                    <div
                      key={n.id}
                      className={styles.bellItem}
                      style={{ opacity: n.read ? 0.6 : 1, cursor: "pointer" }}
                      onClick={() => handleBellItemClick(n)}
                    >
                      <div
                        className={styles.bellItemIcon}
                        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                      >
                        <Icon size={13} strokeWidth={2} style={{ color: colors.icon }} />
                      </div>
                      <div className={styles.bellItemBody}>
                        <span className={styles.bellItemTitle}>{n.title}</span>
                        <span className={styles.bellItemMsg}>{n.message}</span>
                        <span className={styles.bellItemTime}>{formatTime(n.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className={styles.bellFooter} onClick={handleViewAll}>
                View all notifications
              </button>
            </div>
          )}
        </div>

        <div className={styles.sep} />

        {/* AVATAR DROPDOWN */}
        <div className={styles.avatarWrap} ref={dropRef}>
          <button
            className={styles.avatarBtn}
            onClick={() => { setDropOpen((o) => !o); setBellOpen(false); }}
            aria-label="Profile menu"
          >
            <div className={styles.avatar}>{initials || "RY"}</div>
            <div className={styles.avatarInfo}>
              <span className={styles.avatarName}>
                {user?.first_name} {user?.last_name}
              </span>
              <span className={styles.avatarSub}>
                {user?.email || "Youth Portal"}
              </span>
            </div>
            <ChevronDown
              size={13}
              strokeWidth={2}
              className={`${styles.chevron} ${dropOpen ? styles.chevronOpen : ""}`}
            />
          </button>

          {dropOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropHeader}>
                <div className={styles.dropName}>
                  {user?.first_name} {user?.last_name}
                </div>
                <div className={styles.dropSub}>
                  {user?.email || "Youth Portal"}
                </div>
              </div>
              <div className={styles.dropDivider} />
              <a
                href="/dashboard/settings"
                className={styles.dropItem}
                onClick={() => setDropOpen(false)}
              >
                <Settings size={14} strokeWidth={1.8} />
                Settings
              </a>
              <button
                className={`${styles.dropItem} ${styles.dropLogout}`}
                onClick={handleLogout}
              >
                <LogOut size={14} strokeWidth={1.8} />
                Sign out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}