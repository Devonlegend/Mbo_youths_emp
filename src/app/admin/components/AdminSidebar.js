"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Users, BookOpen,
  BadgeCheck, ShieldAlert, ScrollText, Settings,
  LogOut, X,
} from "lucide-react";
import styles from "./Sidebar.module.css";
import { logout } from "@/services";

// ── NAV STRUCTURE ─────────────────────────────────────────────────────────────
const navMain = [
  { label: "Overview",      href: "/admin",              icon: LayoutDashboard, roles: ["admin", "superadmin", "verifier"] },
  { label: "Applications",  href: "/admin/applications", icon: ClipboardList,   roles: ["admin", "superadmin", "verifier"] },
  { label: "Students",      href: "/admin/students",     icon: Users,           roles: ["admin", "superadmin", "verifier"] },
  { label: "Schemes",       href: "/admin/schemes",      icon: BookOpen,        roles: ["admin", "superadmin"] },
];

const navRecords = [
  { label: "Beneficiaries",     href: "/admin/beneficiaries",     icon: BadgeCheck,  roles: ["admin", "superadmin", "verifier"] },
  { label: "Disqualifications", href: "/admin/disqualifications", icon: ShieldAlert, roles: ["admin", "superadmin", "verifier"] },
  { label: "Audit Log",         href: "/admin/audit-log",         icon: ScrollText,  roles: ["superadmin"] },
];

  async function handleLogout() {
    try {
      await logout();
    } catch {}
    finally {
      window.location.href = "/login";
    }
  }

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
        <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
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

  const initials =
    (user?.firstname?.[0]?.toUpperCase() || "") +
    (user?.lastname?.[0]?.toUpperCase()  || "");

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

            <span className={styles.sectionLabel}>Main</span>

            {navMain.filter(item => item.roles.includes(user?.role)).map((item) => (
              <NavItem key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
            ))}

            <div className={styles.divider} />

            <span className={styles.sectionLabel}>Records</span>

            {navRecords.filter(item => item.roles.includes(user?.role)).map((item) => (
              <NavItem key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
            ))}

          </nav>

        {/* ── BOTTOM ── */}
        <div className={styles.bottom}>

          <Link
            href="/admin/settings"
            className={`${styles.navItem} ${isActive("/admin/settings") ? styles.navItemActive : ""}`}
            title="Settings"
            onClick={onClose}
          >
            <span className={styles.navIcon}>
              <Settings size={20} strokeWidth={1.8} />
            </span>
            <span className={styles.navLabel}>Settings</span>
          </Link>

          <div className={styles.divider} />

          {/* Static profile display */}
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

          {/* Sign out */}
          <button
            className={`${styles.navItem} ${styles.signOut}`}
            title="Sign out"
            onClick={handleLogout}
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