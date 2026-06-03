"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  BookOpen,
  Award,
  XCircle,
  ScrollText,
  ShieldCheck,
  X,
  Settings,
} from "lucide-react";
import styles from "./Sidebar.module.css";

const navItems = [
  { label: "Overview", href: "/admin/overview", icon: LayoutDashboard },
  { label: "Applications", href: "/admin/applications", icon: FileText },
  { label: "Students", href: "/admin/students", icon: Users },
  { label: "Schemes", href: "/admin/schemes", icon: BookOpen },
  { label: "Beneficiary Register", href: "/admin/beneficiaries", icon: Award },
  { label: "Disqualification Register", href: "/admin/disqualifications", icon: XCircle },
  { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const NavContent = () => (
    <>
      <div className={styles.logoArea}>
        <div className={styles.logoMark}>
          <ShieldCheck size={20} strokeWidth={2.5} color="#ffffff" />
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>RMHCDT</span>
          <span className={styles.logoSub}>Admin Portal</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <span className={styles.navSectionLabel}>Management</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              title={item.label}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.8}
                color={isActive ? "#4ade80" : "#64748b"}
              />
              <span className={isActive ? styles.navItemLabelActive : styles.navItemLabel}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.piaBadge}>
          <span className={styles.piaTitle}>Governed under</span>
          <span className={styles.piaText}>Petroleum Industry Act 2021</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.mobileDrawer} ${mobileOpen ? styles.mobileDrawerOpen : ""}`}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
          <X size={16} color="#64748b" />
        </button>
        <NavContent />
      </aside>

      <aside className={styles.sidebar}>
        <NavContent />
      </aside>
    </>
  );
}