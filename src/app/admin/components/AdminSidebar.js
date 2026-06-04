"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Users, BookOpen,
  BadgeCheck, ShieldAlert, ScrollText, Settings,
  LogOut, X, ChevronRight,
} from "lucide-react";
import styles from "./Sidebar.module.css";

// ── NAV STRUCTURE ─────────────────────────────────────────────────────────────
const navMain = [
  { label: "Overview",      href: "/admin",              icon: LayoutDashboard },
  { label: "Applications",  href: "/admin/applications", icon: ClipboardList   },
  { label: "Students",      href: "/admin/students",     icon: Users           },
  { label: "Schemes",       href: "/admin/schemes",      icon: BookOpen        },
];

const navRecords = [
  { label: "Beneficiaries",     href: "/admin/beneficiaries",     icon: BadgeCheck  },
  { label: "Disqualifications", href: "/admin/disqualifications", icon: ShieldAlert },
  { label: "Audit Log",         href: "/admin/audit-log",         icon: ScrollText  },
];

// ── NAV ITEM ──────────────────────────────────────────────────────────────────
function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
      title={item.label}
    >
      <span className={styles.navIcon}>
        <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
      </span>
      <span className={styles.navLabel}>{item.label}</span>
    </Link>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
export default function AdminSidebar({ isOpen, onClose, user }) {
  const pathname = usePathname();

  function isActive(href) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  // Initials from admin name
  const initials =
    (user?.firstname?.[0]?.toUpperCase() || "") +
    (user?.lastname?.[0]?.toUpperCase()  || "");

  // Role label
  const roleLabel =
    user?.role === "superadmin" ? "Super Admin" :
    user?.role === "verifier"   ? "Verifier"    :
    "Admin";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>

        {/* ── LOGO ── */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <span className={styles.logoLetter}>R</span>
          </div>
          <div className={styles.logoBrand}>
            <span className={styles.logoName}>RMHCDT</span>
            <span className={styles.logoSub}>Admin Portal</span>
          </div>
          {/* Close button — mobile only */}
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* ── NAV ── */}
        <nav className={styles.nav}>

          {/* Section label — hidden in collapsed mode */}
          <span className={styles.sectionLabel}>Main</span>

          {navMain.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onClick={onClose}
            />
          ))}

          <div className={styles.divider} />

          <span className={styles.sectionLabel}>Records</span>

          {navRecords.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onClick={onClose}
            />
          ))}

        </nav>

        {/* ── BOTTOM — settings + admin profile + sign out ── */}
        <div className={styles.bottom}>

          <Link
            href="/admin/settings"
            className={`${styles.navItem} ${isActive("/admin/settings") ? styles.navItemActive : ""}`}
            title="Settings"
            onClick={onClose}
          >
            <span className={styles.navIcon}>
              <Settings size={17} strokeWidth={1.8} />
            </span>
            <span className={styles.navLabel}>Settings</span>
          </Link>

          <div className={styles.divider} />

          {/* Admin profile snippet */}
          <div className={styles.adminProfile}>
            <div className={styles.adminAvatar}>
              {initials || "AD"}
            </div>
            <div className={styles.adminInfo}>
              <span className={styles.adminName}>
                {user?.firstname} {user?.lastname}
              </span>
              <span className={styles.adminRole}>{roleLabel}</span>
            </div>
          </div>

          <button
            className={`${styles.navItem} ${styles.signOut}`}
            title="Sign out"
          >
            <span className={styles.navIcon}>
              <LogOut size={17} strokeWidth={1.8} />
            </span>
            <span className={styles.navLabel}>Sign out</span>
          </button>

        </div>

      </aside>
    </>
  );
}