"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = ["About", "Programmes", "How It Works", "Eligibility", "Contact"];

  function getHref(link) {
    return "#" + link.toLowerCase().split(" ").join("-");
  }

  return (
    <>
      <nav
        className={
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 " +
          (scrolled
            ? "bg-white/98 shadow-sm"
            : "bg-white/90 backdrop-blur-md")
        }
        style={{ borderBottom: "2px solid #15803d" }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between h-16">

          {/* LOGO */}
          <Link href="/" className="flex items-center gap-3 no-underline">
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ background: "#15803d", borderRadius: "8px" }}
            >
              <span
                style={{
                  color: "#fbbf24",
                  fontWeight: 800,
                  fontSize: "15px",
                  fontFamily: "var(--font-jakarta)",
                }}
              >
                R
              </span>
            </div>
            <div className="flex flex-col">
              <span
                style={{
                  color: "#0f172a",
                  fontWeight: 800,
                  fontSize: "14px",
                  letterSpacing: "0.01em",
                  lineHeight: 1.1,
                  fontFamily: "var(--font-jakarta)",
                }}
              >
                RMHCDT
              </span>
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "9px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                  fontFamily: "var(--font-inter)",
                }}
              >
                Youth Portal
              </span>
            </div>
          </Link>

          {/* DESKTOP NAV LINKS */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link}
                href={getHref(link)}
                className="no-underline px-4 py-2 rounded-lg transition-all duration-200"
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                  fontWeight: 500,
                  fontFamily: "var(--font-inter)",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = "#15803d";
                  e.target.style.background = "#f0fdf4";
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = "#64748b";
                  e.target.style.background = "transparent";
                }}
              >
                {link}
              </a>
            ))}
          </div>

          {/* DESKTOP BUTTONS */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className="no-underline px-4 py-2 rounded-lg transition-all duration-200"
              style={{
                color: "#15803d",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "var(--font-jakarta)",
                border: "1.5px solid #bbf7d0",
                background: "#f0fdf4",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#dcfce7";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f0fdf4";
              }}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="no-underline px-5 py-2 rounded-lg transition-all duration-200"
              style={{
                background: "#15803d",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "var(--font-jakarta)",
                boxShadow: "0 2px 8px rgba(21,128,61,0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#166534";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#15803d";
              }}
            >
              Apply Now
            </Link>
          </div>

          {/* MOBILE HAMBURGER */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
            style={{
              background: menuOpen ? "#f0fdf4" : "transparent",
              border: "1.5px solid #e2e8f0",
              color: "#374151",
            }}
          >
            {menuOpen
              ? <X size={18} strokeWidth={2} />
              : <Menu size={18} strokeWidth={2} />
            }
          </button>
        </div>

        {/* MOBILE MENU */}
        <div
          className="lg:hidden overflow-hidden transition-all duration-300"
          style={{
            maxHeight: menuOpen ? "420px" : "0px",
            borderTop: menuOpen ? "1px solid #f1f5f9" : "none",
            background: "#ffffff",
          }}
        >
          <div className="px-6 py-5 flex flex-col gap-1">
            {/* NAV LINKS */}
            {navLinks.map((link) => (
              <a
                key={link}
                href={getHref(link)}
                onClick={() => setMenuOpen(false)}
                className="no-underline px-3 py-2.5 rounded-lg transition-all duration-200"
                style={{
                  color: "#374151",
                  fontSize: "13px",
                  fontWeight: 500,
                  fontFamily: "var(--font-inter)",
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = "#15803d";
                  e.target.style.background = "#f0fdf4";
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = "#374151";
                  e.target.style.background = "transparent";
                }}
              >
                {link}
              </a>
            ))}

            {/* DIVIDER */}
            <div style={{ height: "1px", background: "#f1f5f9", margin: "8px 0" }} />

            {/* MOBILE BUTTONS SIDE BY SIDE */}
            <div className="flex gap-3">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="no-underline flex-1 text-center py-2.5 rounded-lg transition-all duration-200"
                style={{
                  color: "#15803d",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "var(--font-jakarta)",
                  border: "1.5px solid #bbf7d0",
                  background: "#f0fdf4",
                }}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMenuOpen(false)}
                className="no-underline flex-1 text-center py-2.5 rounded-lg transition-all duration-200"
                style={{
                  background: "#15803d",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "var(--font-jakarta)",
                }}
              >
                Apply Now
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}