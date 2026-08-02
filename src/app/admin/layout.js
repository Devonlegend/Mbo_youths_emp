"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "./components/AdminSidebar";
import AdminTopbar from "./components/AdminTopbar";
import { getMe } from "@/services";
import styles from "./admin.module.css";

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user,        setUser]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const router = useRouter();

  // ── Load admin user on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const res = await getMe();
        if (cancelled) return;

        const u = res.data;

        // Only allow admin roles — redirect students back to their dashboard
        // Keep loading=true here so the admin shell never flashes while
        // the redirect is in flight.
        if (u.role === "student") {
          router.replace("/dashboard");
          return;
        }

        setUser(u);
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          router.replace("/login");
          // keep loading=true — we're navigating away
        } else {
          console.error("Failed to load admin user:", err);
          setLoading(false);
        }
      }
    }
    loadUser();
    return () => { cancelled = true; };
  }, []);
  
  // Close sidebar when screen goes desktop width
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 768) setSidebarOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`${styles.loadingShell} adminShell`}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  // ── Shell ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.shell}>

      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
      />

      {/* Main area — shifts right to account for collapsed sidebar */}
      <div className={styles.mainWrap}>
        <AdminTopbar
          user={user}
          onMenuOpen={() => setSidebarOpen(true)}
        />
        <main className={styles.content}>
          {children}
        </main>
      </div>

    </div>
  );
}