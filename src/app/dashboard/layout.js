"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import styles from "./dashboard.module.css";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { getMe, getStudentProfile } from "@/services";

function LoadingSpinner() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#f8fafc",
    }}>
      <div style={{
        width: 28, height: 28,
        borderRadius: "50%",
        border: "2.5px solid #e2e8f0",
        borderTopColor: "#15803d",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const router = useRouter();
  
  useInactivityLogout();

  useEffect(() => {
    async function loadUser() {
      try {
        const [authRes, studentRes] = await Promise.all([
          getMe(),
          getStudentProfile(),
        ]);

        const auth    = authRes.data;
        const profile = studentRes.data;

        setUser({
          id:           auth.id,
          email:        auth.email,
          phone:        auth.phone_number   || "",
          role:         auth.role           || "student",
          first_name:   auth.firstname      || "",
          last_name:    auth.lastname       || "",
          lga:          profile.lga         || "",
          ward:         profile.ward        || "",
          level:        profile.level       || null,
          cgpa:         profile.cgpa        || null,
          is_verified:  profile.is_verified  || false,
          active_award: profile.active_award || "",
          has_active_award: profile.has_active_award || false,
          passport_photo: auth.passport || null,
          nin_masked:     "****-***-****",
          date_of_birth:  auth.date_of_birth || "",
          gender:         auth.gender        || "",
        });

      } catch (err) {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 768) setSidebarOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className={styles.shell}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={styles.mainWrap}>
        <Topbar
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