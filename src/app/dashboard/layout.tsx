"use client";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import styles from "./dashboard.module.css";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { getMe, getStudentProfile, getCycles } from "@/services";
import { isAxiosError } from "axios";
import type { Cycle } from "@/types/scheme";
import type { UserRole } from "@/types/user";

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

interface DashboardUser {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  lga: string;
  ward: string;
  level: string | null;
  cgpa: string | null;
  is_verified: boolean;
  active_award: string;
  has_active_award: boolean;
  passport_photo: string | null;
  nin_masked: string;
  date_of_birth: string;
  gender: string;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser]               = useState<DashboardUser | null>(null);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [loading, setLoading]         = useState(true);
  const router = useRouter();
  
  useInactivityLogout();

  useEffect(() => {
    async function loadUser() {
      try {
        const [authRes, studentRes, cyclesRes] = await Promise.all([
          getMe(),
          getStudentProfile(),
          getCycles().catch(() => null),
        ]);

        const auth    = authRes.data;
        const profile = studentRes.data;
        const cyclesList: Cycle[] = cyclesRes?.data.results ?? [];
        const active = cyclesList.find((c) => c.is_active) || null;
        setActiveCycle(active);

        setUser({
          id:           auth.id,
          email:        auth.email,
          phone:        auth.phone_number   || "",
          role:         auth.role           || "student",
          first_name:   auth.firstname      || "",
          last_name:    auth.lastname       || "",
          lga:          profile.lga         || "",
          ward:         profile.ward        || "",
          level:        null,
          cgpa:         null,
          is_verified:  profile.is_verified  || false,
          active_award: profile.active_award || "",
          has_active_award: profile.has_active_award || false,
          passport_photo: auth.passport || null,
          nin_masked:     "****-***-****",
          date_of_birth:  auth.date_of_birth || "",
          gender:         auth.gender        || "",
        });

      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (status === 401 || status === 403) {
          router.replace("/login");
        } else {
          console.error("Failed to load user:", err);
        }
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
          activeCycle={activeCycle}
          onMenuOpen={() => setSidebarOpen(true)}
        />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}