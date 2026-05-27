"use client";
import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import styles from "./dashboard.module.css";

const mockUser = {
  first_name: "Chukwu",
  last_name: "Harrison",
  lga: "Mbo LGA",
  email: "c.harrison@mail.com",
  nin_masked: "****-***-4521",
  phone_masked: "+234 803 *** 4521",
  passport_photo: null,
};

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on desktop resize
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 768) setSidebarOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className={styles.shell}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={styles.mainWrap}>
        <Topbar
          user={mockUser}
          onMenuOpen={() => setSidebarOpen(true)}
        />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}