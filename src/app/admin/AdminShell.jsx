"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import styles from "./layout.module.css";

export default function AdminShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={styles.root}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className={styles.body}>
        <Topbar onMenuOpen={() => setMobileOpen(true)} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}