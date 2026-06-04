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

export default function AdminTopbar({ user, onMenuOpen }) {
  const pathname = useRouter();
  const currentPath = usePathname();
  const router = useRouter();

  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

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
        <div className={styles.sep} />

        {/* ── AVATAR DROPDOWN ── */}
        <div className={styles.avatarWrap} ref={dropRef}>
          <button
            className={styles.avatarBtn}
            onClick={() => { setDropOpen((o) => !o); }}
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