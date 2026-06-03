"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Search, Menu } from "lucide-react";
import { currentAdmin } from "../mockdata";
import styles from "./Topbar.module.css";

const pageTitles = {
};

function getInitials(name) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getPageInfo(pathname) {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const parent = "/" + pathname.split("/").slice(1, 3).join("/");
  if (pageTitles[parent]) return pageTitles[parent];
  return { title: "", description: "" };
}

export default function Topbar({ onMenuOpen }) {
  const pathname = usePathname();
  const { title, description } = getPageInfo(pathname);

  return (
    <header className={styles.topbar}>
      <button className={styles.hamburger} onClick={onMenuOpen} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div className={styles.titleArea}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description && (
          <>
            <span className={styles.dot}>·</span>
            <span className={styles.pageDescription}>{description}</span>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <div className={styles.searchBar}>
          <Search size={13} aria-hidden="true" />
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search..."
            aria-label="Search"
          />
        </div>

        <button className={styles.iconBtn} aria-label="Notifications">
          <Bell size={15} />
          <span className={styles.notifDot} />
        </button>

        <div className={styles.divider} />

        <button className={styles.profileBtn} aria-label="Admin profile">
          <div className={styles.avatar}>
            <span className={styles.avatarInitials}>
              {getInitials(`${currentAdmin.firstname} ${currentAdmin.lastname}`)}
            </span>
          </div>
          <div className={styles.profileInfo}>
            <span className={styles.profileName}>{currentAdmin.firstname}</span>
            <span className={styles.profileRole}>{currentAdmin.role}</span>
          </div>
          <ChevronDown size={14} className={styles.chevron} />
        </button>
      </div>
    </header>
  );
}