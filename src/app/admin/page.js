"use client";
import { LayoutDashboard } from "lucide-react";

export default function AdminOverviewPage() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 16,
    }}>

      {/* Icon */}
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "#f0fdf4",
        border: "1.5px solid #bbf7d0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <LayoutDashboard size={24} color="#15803d" strokeWidth={1.8} />
      </div>

      {/* Text */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{
          fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: "#0f172a",
          letterSpacing: "-0.03em",
          margin: 0,
        }}>
          Admin Portal
        </h1>
        <p style={{
          fontSize: 13,
          color: "#94a3b8",
          marginTop: 6,
        }}>
          Overview page coming soon. Layout is working correctly.
        </p>
      </div>

    </div>
  );
}