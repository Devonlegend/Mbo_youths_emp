"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./dashboard.module.css";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("access_token");
    const userData = localStorage.getItem("user");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (userData) {
      setUser(JSON.parse(userData));
    }

    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  return

  return (
    <div className={styles.shell} data-dark={dark ? "1" : "0"}>
      <Sidebar dark={dark} setDark={setDark} />
      <div className={styles.mainWrap}>
        <Topbar dark={dark} setDark={setDark} user={user} />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}