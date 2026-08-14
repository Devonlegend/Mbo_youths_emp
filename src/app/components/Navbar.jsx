"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogIn, ArrowRight } from "lucide-react";
import styles from "./Navbar.module.css";

const NAV_LINKS = ["About", "Programmes", "How It Works", "Eligibility", "Contact"];

function getHref(link) {
  return "#" + link.toLowerCase().split(" ").join("-");
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the drawer on outside click / tap
  useEffect(() => {
    if (!menuOpen) return;

    function handleOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [menuOpen]);

  // Close the drawer on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  function handleLogoClick(e) {
    if (pathname === "/") {
      e.preventDefault();
      const hero = document.getElementById("hero");
      if (hero) {
        hero.scrollIntoView({ behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      window.history.pushState(null, "", "/");
    }
    setMenuOpen(false);
  }

  return (
    <nav
      ref={navRef}
      className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}
    >
      <div className={styles.inner}>
        {/* LOGO */}
        <Link href="/" onClick={handleLogoClick} className={styles.logoLink}>
          <img
            src="https://res.cloudinary.com/dwn6p3qmd/image/upload/f_auto,q_auto,w_80,h_80,c_fill,g_face/v1784673040/mboyouths_ssedqs.png"
            alt="RMHCDT"
            className={styles.logoBox}
            width="40"
            height="40"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>Mbo Youth </span>
            <span className={styles.logoSubtitle}>Youth Portal</span>
          </div>
        </Link>

        {/* DESKTOP NAV LINKS */}
        <div className={styles.desktopLinks}>
          {NAV_LINKS.map((label) => (
            <a key={label} href={getHref(label)} className={styles.navLink}>
              {label}
            </a>
          ))}
        </div>

        {/* DESKTOP BUTTONS */}
        <div className={styles.desktopButtons}>
          <Link href="/login" className={styles.signInBtn}>
            <LogIn size={14} strokeWidth={2} />
            <span>Sign In</span>
          </Link>
          <Link href="/register" className={styles.applyBtn}>
            <span>Apply Now</span>
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>

        {/* MOBILE: SIGN IN + HAMBURGER */}
        <div className={styles.mobileActions}>
          <Link href="/login" className={styles.signInBtnMobileTop}>
            <LogIn size={14} strokeWidth={2} />
            <span>Sign In</span>
          </Link>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X size={18} strokeWidth={2} />
            ) : (
              <Menu size={18} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      <div
        className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ""}`}
      >
        <div className={styles.mobileMenuInner}>
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href={getHref(label)}
              onClick={() => setMenuOpen(false)}
              className={styles.mobileNavLink}
            >
              {label}
            </a>
          ))}

          <div className={styles.divider} />

          {/* <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className={styles.signInBtnMobile}
          >
            <LogIn size={14} strokeWidth={2} />
            <span>Sign In</span>
          </Link> */}

          <Link
            href="/register"
            onClick={() => setMenuOpen(false)}
            className={styles.applyBtnMobile}
          >
            <span>Apply Now</span>
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </nav>
  );
}