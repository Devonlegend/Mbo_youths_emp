"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, ClipboardList,
  Files, UserCircle, Bell, BookOpen,
  HelpCircle, Settings, LogOut, X,
} from "lucide-react";
import styles from "./Sidebar.module.css";
import { useState, useEffect } from "react";
import { logout } from "@/services";
import { getNotifications } from "@/services";

const navMain = [
  { label: "Dashboard",       href: "/dashboard",              icon: LayoutDashboard },
  { label: "Programmes",      href: "/dashboard/programmes",   icon: FileText },
  { label: "My Applications", href: "/dashboard/applications", icon: ClipboardList },
];

const navAccount = [
  // { label: "My Documents",  href: "/dashboard/documents",     icon: Files },
  { label: "My Profile",    href: "/dashboard/profile",       icon: UserCircle },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

const navInfo = [
  { label: "Policy Guide",   href: "/dashboard/policy",    icon: BookOpen },
  { label: "Help & Support", href: "/dashboard/help",      icon: HelpCircle },
  { label: "Settings",       href: "/dashboard/settings",  icon: Settings },
];

function NavItem({ item, active, onClick, badge }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`${styles.navItem} ${active ? styles.active : ""}`}
    >
      <span className={styles.navIcon}>
        <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
      </span>
      <span className={styles.navLabel}>{item.label}</span>
      {badge > 0 && (
        <span className={styles.navBadge}>{badge}</span>
      )}
    </Link>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function loadUnread() {
      try {
        const res = await getNotifications();
        const notifs = Array.isArray(res.data) ? res.data : [];
        setUnread(notifs.filter((n) => !n.read).length);
      } catch {}
    }
    loadUnread();
  }, []);

  function isActive(href) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  async function handleLogout() {    
    try {
      await logout();
    } catch (err) {
      // Even if the call fails, we still clear local state and redirect
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>

        {/* LOGO */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}><span>R</span></div>
          <div className={styles.logoBrand}>
            <span className={styles.logoName}>RMHCDT</span>
            <span className={styles.logoSub}>Youth Portal</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* NAV */}
        <nav className={styles.nav}>
          <div className={styles.sectionLabel}>Main</div>
          {navMain.map((item) => (
            <NavItem key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
          ))}

          <div className={styles.divider} />

          <div className={styles.sectionLabel}>Account</div>
          {navAccount.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            active={isActive(item.href)}
            onClick={onClose}
            badge={item.label === "Notifications" ? unread : 0}
          />
        ))}

          <div className={styles.divider} />

          <div className={styles.sectionLabel}>Info</div>
          {navInfo.map((item) => (
            <NavItem key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
          ))}
        </nav>

        {/* BOTTOM */}
        <div className={styles.bottom}>
          <button className={`${styles.navItem} ${styles.logout}`} onClick={handleLogout}>
            <span className={styles.navIcon}><LogOut size={15} strokeWidth={1.8} /></span>
            <span className={styles.navLabel}>Sign out</span>
          </button>
        </div>

      </aside>
    </>
  );
}