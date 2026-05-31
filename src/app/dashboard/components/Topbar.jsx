"use client";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Settings, LogOut, ChevronDown,
         GraduationCap, CalendarClock, FileText, CheckCheck, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import styles from "./Topbar.module.css";
import { logout } from "@/services";

/* ── preview notifications (top 3 unread) — stays mock until backend adds notifications ── */
const PREVIEW_NOTIFS = [
  {
    id: 0,
    icon: Sparkles,
    iconBg: "#fffbeb", iconBorder: "#fde68a", iconColor: "#d97706",
    title: "Welcome to RMHCDT Youth Portal!",
    message: "Complete your profile and explore available programmes.",
    time: "Just now",
  },
  {
    id: 1,
    icon: GraduationCap,
    iconBg: "#f0fdf4", iconBorder: "#bbf7d0", iconColor: "#15803d",
    title: "Application approved",
    message: "Your Scholarship application has been approved.",
    time: "2h ago",
  },
  {
    id: 2,
    icon: CalendarClock,
    iconBg: "#fffbeb", iconBorder: "#fde68a", iconColor: "#d97706",
    title: "Deadline reminder",
    message: "Grant document submission closes in 2 days.",
    time: "5h ago",
  },
  {
    id: 3,
    icon: FileText,
    iconBg: "#eff6ff", iconBorder: "#bfdbfe", iconColor: "#2563eb",
    title: "New programme open",
    message: "2026 Youth Skills Training Programme is now open.",
    time: "Yesterday",
  },
];

export default function Topbar({ user, onMenuOpen }) {
  const router   = useRouter();
  const [dropOpen, setDropOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [unread,   setUnread]   = useState(PREVIEW_NOTIFS.length);

  const dropRef = useRef(null);
  const bellRef = useRef(null);

  const initials =
    (user?.first_name?.[0]?.toUpperCase() || "") +
    (user?.last_name?.[0]?.toUpperCase()  || "");

  /* close dropdowns on outside click */
  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    try {
      // Tell backend to blacklist refresh token + clear httpOnly cookies
      await logout();
    } catch (err) {
      // Even if the call fails, still redirect to login
    } finally {
      window.location.href = "/login";
    }
  }

  function handleViewAll() {
    setBellOpen(false);
    setUnread(0);
    router.push("/dashboard/notifications");
  }

  function handleMarkAllRead() {
    setUnread(0);
  }

  return (
    <header className={styles.topbar}>

      {/* LEFT — hamburger menu */}
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuOpen} aria-label="Open menu">
          <Menu size={18} strokeWidth={2} />
        </button>
      </div>

      {/* CENTER — cycle pill */}
      <div className={styles.center}>
        <span className={styles.cyclePill}>
          <span className={styles.cycleDot} />
          Cycle 2026 – 2027
        </span>
      </div>

      {/* RIGHT — bell + avatar */}
      <div className={styles.right}>

        {/* ── BELL ── */}
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
                {PREVIEW_NOTIFS.map((n) => {
                  const Icon = n.icon;
                  return (
                    <div key={n.id} className={styles.bellItem}>
                      <div
                        className={styles.bellItemIcon}
                        style={{ background: n.iconBg, border: `1px solid ${n.iconBorder}` }}
                      >
                        <Icon size={13} strokeWidth={2} style={{ color: n.iconColor }} />
                      </div>
                      <div className={styles.bellItemBody}>
                        <span className={styles.bellItemTitle}>{n.title}</span>
                        <span className={styles.bellItemMsg}>{n.message}</span>
                        <span className={styles.bellItemTime}>{n.time}</span>
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

        {/* ── AVATAR DROPDOWN ── */}
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