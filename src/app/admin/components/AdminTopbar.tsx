"use client";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Settings, LogOut, ChevronDown, Search, Sun, Moon, Monitor} from "lucide-react";
import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { useTheme } from "next-themes";
import styles from "./Topbar.module.css";
import { logout } from "@/services";

interface AdminUser {
  firstname?: string;
  lastname?: string;
  role?: string;
  email?: string;
}

export default function AdminTopbar({ user, onMenuOpen }: { user: AdminUser | null; onMenuOpen: () => void }) {
  const currentPath = usePathname();
  const router = useRouter();

  const [dropOpen, setDropOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const initials =
    (user?.firstname?.[0]?.toUpperCase() || "") +
    (user?.lastname?.[0]?.toUpperCase()  || "");

  const roleLabel =
    user?.role === "superadmin" ? "Super Admin" :
    user?.role === "verifier"   ? "Verifier"    :
    "Admin";

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const themes = ["system", "light", "dark"];
  const themeIcons: Record<string, ReactNode> = {
    system: <Monitor size={15} strokeWidth={1.8} />,
    light:  <Sun     size={15} strokeWidth={1.8} />,
    dark:   <Moon    size={15} strokeWidth={1.8} />,
  };

  function cycleTheme() {
    const current = themes.indexOf(theme ?? "system");
    const next = themes[(current + 1) % themes.length];
    setTheme(next);
  }

  function capitalize(str?: string) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDropOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } catch {}
    finally {
      router.push("/login");
    }
  }


  return (
    <header className={styles.topbar}>

      {/* LEFT — hamburger */}
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuOpen} aria-label="Open menu">
          <Menu size={18} strokeWidth={2} />
        </button>
      </div>

      {/* RIGHT — search + avatar */}
      <div className={styles.right}>

        {/* Search */}
        <div
          ref={searchRef}
          className={`${styles.searchWrap} ${searchOpen ? styles.searchWrapOpen : ""}`}
        >
          <Search size={14} strokeWidth={2} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search..."
            className={styles.searchInput}
            autoFocus={searchOpen}
          />
          <button
            className={styles.searchIconBtn}
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Search"
          >
            <Search size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Theme toggle */}
        {mounted && (
          <button
            className={styles.themeBtn}
            onClick={cycleTheme}
            aria-label={`Switch theme (current: ${theme})`}
            title={`Theme: ${theme}`}
          >
            {themeIcons[theme ?? "system"] || themeIcons.system}
          </button>
        )}

        <div className={styles.sep} />

        {/* AVATAR DROPDOWN */}
        <div className={styles.avatarWrap} ref={dropRef}>
          <button
            className={styles.avatarBtn}
            onClick={() => setDropOpen((o) => !o)}
            aria-label="Admin menu"
          >
            <div className={styles.avatar}>{initials || "AD"}</div>
            <div className={styles.avatarInfo}>
              <span className={styles.avatarName}>{capitalize(user?.firstname)} {capitalize(user?.lastname)}</span>
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
                <div className={styles.dropAvatar}>{initials || "AD"}</div>
                <div>
                  <div className={styles.dropName}>{capitalize(user?.firstname)} {capitalize(user?.lastname)}</div>
                  <div className={styles.dropEmail}>{user?.email || ""}</div>
                </div>
              </div>
              <div className={styles.dropDivider} />
              <a href="/admin/settings" className={styles.dropItem} onClick={() => setDropOpen(false)}>
                <Settings size={14} strokeWidth={1.8} />
                Settings
              </a>
              <button className={`${styles.dropItem} ${styles.dropLogout}`} onClick={handleLogout}>
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