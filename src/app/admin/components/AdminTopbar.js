"use client";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, Menu, Settings, LogOut, ChevronDown,
  CheckCheck, AlertCircle, ClipboardList, Users,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import styles from "./Topbar.module.css";
import { logout } from "@/services";

// ── Page title map — shows current page name in topbar ────────────────────────
const PAGE_TITLES = {
  "/admin":                   "Overview",
  "/admin/applications":      "Applications",
  "/admin/students":          "Students",
  "/admin/schemes":           "Schemes",
  "/admin/beneficiaries":     "Beneficiary Register",
  "/admin/disqualifications": "Disqualification Register",
  "/admin/audit-log":         "Audit Log",
  "/admin/settings":          "Settings",
};

// ── Mock notifications — replace with real endpoint when backend adds it ──────
const PREVIEW_NOTIFS = [
  {
    id: 1,
    icon: ClipboardList,
    iconBg: "#fffbeb", iconBorder: "#fde68a", iconColor: "#d97706",
    title: "New application submitted",
    message: "Emmanuel Etim applied for the University Scholarship Award.",
    time: "5 min ago",
  },
  {
    id: 2,
    icon: AlertCircle,
    iconBg: "#fef2f2", iconBorder: "#fecaca", iconColor: "#dc2626",
    title: "Flagged application",
    message: "Duplicate NIN detected on application APP-007.",
    time: "1 hour ago",
  },
  {
    id: 3,
    icon: Users,
    iconBg: "#f0fdf4", iconBorder: "#bbf7d0", iconColor: "#15803d",
    title: "New student registered",
    message: "Blessing Okon completed registration.",
    time: "2 hours ago",
  },
];

export default function AdminTopbar({ user, onMenuOpen }) {
  const pathname = useRouter();
  const currentPath = usePathname();
  const router = useRouter();

  const [dropOpen, setDropOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [unread,   setUnread]   = useState(PREVIEW_NOTIFS.length);

  const dropRef = useRef(null);
  const bellRef = useRef(null);

  // Get current page title
  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    path === "/admin" ? currentPath === "/admin" : currentPath.startsWith(path)
  )?.[1] || "Admin Portal";

  // Admin initials
  const initials =
    (user?.firstname?.[0]?.toUpperCase() || "") +
    (user?.lastname?.[0]?.toUpperCase()  || "");

  // Role label
  const roleLabel =
    user?.role === "superadmin" ? "Super Admin" :
    user?.role === "verifier"   ? "Verifier"    :
    "Admin";

  // Close dropdowns on outside click
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
      await logout();
    } catch {
      // Fail silently — still redirect
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <header className={styles.topbar}>

      {/* LEFT — hamburger (mobile) + page title */}
      <div className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onMenuOpen}
          aria-label="Open menu"
        >
          <Menu size={18} strokeWidth={2} />
        </button>
        <span className={styles.pageTitle}>{pageTitle}</span>
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
                  <button
                    className={styles.bellMarkAll}
                    onClick={() => setUnread(0)}
                  >
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
                        style={{
                          background:   n.iconBg,
                          border:       `1px solid ${n.iconBorder}`,
                        }}
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

              <button
                className={styles.bellFooter}
                onClick={() => { setBellOpen(false); router.push("/admin/notifications"); }}
              >
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
            aria-label="Admin menu"
          >
            <div className={styles.avatar}>{initials || "AD"}</div>
            <div className={styles.avatarInfo}>
              <span className={styles.avatarName}>
                {user?.firstname} {user?.lastname}
              </span>
              <span className={styles.avatarRole}>{roleLabel}</span>
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
                  {user?.firstname} {user?.lastname}
                </div>
                <div className={styles.dropEmail}>
                  {user?.email || ""}
                </div>
                <span className={styles.dropRoleBadge}>{roleLabel}</span>
              </div>
              <div className={styles.dropDivider} />
              <a
                href="/admin/settings"
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