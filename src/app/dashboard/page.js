"use client";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Briefcase, Wrench, Banknote,
  ArrowRight, Home, Calendar, Clock, FileText, CheckCircle2,
} from "lucide-react";
import ProfileCard from "./components/ProfileCard";
import styles from "./page.module.css";

const mockUser = {
  first_name: "Chukwu",
  last_name: "Harrison",
  lga: "Mbo LGA",
  email: "c.harrison@mail.com",
  nin_masked: "****-***-4521",
  phone_masked: "+234 803 *** 4521",
  passport_photo: null,
  member_since: "January 2026",
};

const stats = [
  {
    label: "Total applications",
    value: "4",
    icon: FileText,
    iconClass: "si_blue",
    pillLabel: "All time",
    pillClass: "sp_neut",
    mobilePillClass: "sp_neut",
  },
  {
    label: "Approved",
    value: "1",
    icon: CheckCircle2,
    iconClass: "si_green",
    pillLabel: "Confirmed",
    pillClass: "sp_up",
    mobilePillClass: "sp_up",
  },
  {
    label: "Under review",
    value: "2",
    icon: Clock,
    iconClass: "si_amber",
    pillLabel: "In progress",
    pillClass: "sp_warn",
    mobilePillClass: "sp_warn",
  },
];

const CYCLE_END = new Date("2026-06-30");

function getDaysLeft() {
  const today = new Date();
  const diff = Math.ceil((CYCLE_END - today) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export default function DashboardPage() {
  const router = useRouter();
  const daysLeft = getDaysLeft();

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className={styles.page}>

      {/* GREETING */}
      <div className={styles.greeting}>
        <p className={styles.greetingDate}>{today}</p>
        <h1 className={styles.greetingTitle}>
          Welcome back,{" "}
          <span className={styles.greetingAccent}>{mockUser.first_name}</span>
          <span className={styles.greetingIcon}>
            <Home size={14} strokeWidth={2.5} />
          </span>
        </h1>
      </div>

      {/* CYCLE DEADLINE */}
      <div className={styles.cycleBanner}>
        <div className={styles.cycleLeft}>
          <Calendar size={14} strokeWidth={2} className={styles.cycleIcon} />
          <span>Current cycle closes <strong>30 Jun 2026</strong></span>
        </div>
        <div className={styles.cycleRight}>
          <Clock size={13} strokeWidth={2} />
          <span>{daysLeft} days left</span>
        </div>
      </div>

      {/* PROFILE CARD */}
      <ProfileCard
        user={mockUser}
        onEdit={() => router.push("/dashboard/profile")}
      />

      {/* STATS ROW */}
      <div className={styles.statsRow}>
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statTop}>
                <div className={`${styles.statIcon} ${styles[s.iconClass]}`}>
                  <Icon size={15} strokeWidth={1.8} />
                </div>
                <span className={`${styles.statPill} ${styles[s.pillClass]}`}>
                  {s.pillLabel}
                </span>
              </div>
              <div className={styles.statBottom}>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
              {/* mobile pill — only visible on small screens via CSS */}
              <span className={`${styles.statMobilePill} ${styles[s.mobilePillClass]}`}>
                {s.pillLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}