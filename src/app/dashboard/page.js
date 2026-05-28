"use client";
import { useRouter } from "next/navigation";
import {
  Calendar, Clock, FileText, CheckCircle2,
  GraduationCap, Briefcase, Wrench, Banknote,
  ArrowRight, ChevronRight, AlertCircle, Hourglass,
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

const quickActions = [
  {
    icon: GraduationCap,
    label: "Scholarship",
    desc: "Education support",
    iconClass: "qa_green",
    href: "/dashboard/programmes?type=scholarship",
  },
  {
    icon: Briefcase,
    label: "Empowerment",
    desc: "Business support",
    iconClass: "qa_blue",
    href: "/dashboard/programmes?type=empowerment",
  },
  {
    icon: Wrench,
    label: "Training",
    desc: "Skill development",
    iconClass: "qa_amber",
    href: "/dashboard/programmes?type=training",
  },
  {
    icon: Banknote,
    label: "Grant",
    desc: "Funding access",
    iconClass: "qa_red",
    href: "/dashboard/programmes?type=grant",
  },
];

const recentActivity = [
  {
    icon: CheckCircle2,
    iconClass: "act_green",
    title: "Scholarship application approved",
    desc: "2026 University Scholarship",
    time: "2 days ago",
  },
  {
    icon: Hourglass,
    iconClass: "act_amber",
    title: "Grant application under review",
    desc: "Youth Business Start-Up Grant",
    time: "5 days ago",
  },
  {
    icon: AlertCircle,
    iconClass: "act_blue",
    title: "Training application submitted",
    desc: "Digital Skills Programme 2026",
    time: "1 week ago",
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
          <span className={styles.greetingWave}>👋</span>
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
              <span className={`${styles.statMobilePill} ${styles[s.mobilePillClass]}`}>
                {s.pillLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Apply for a programme</span>
          <button
            className={styles.sectionLink}
            onClick={() => router.push("/dashboard/programmes")}
          >
            View all <ChevronRight size={13} strokeWidth={2} />
          </button>
        </div>
        <div className={styles.qaGrid}>
          {quickActions.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                className={styles.qaCard}
                onClick={() => router.push(q.href)}
              >
                <div className={`${styles.qaIcon} ${styles[q.iconClass]}`}>
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <div className={styles.qaText}>
                  <span className={styles.qaLabel}>{q.label}</span>
                  <span className={styles.qaDesc}>{q.desc}</span>
                </div>
                <ArrowRight size={14} strokeWidth={2} className={styles.qaArrow} />
              </button>
            );
          })}
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Recent activity</span>
          <button
            className={styles.sectionLink}
            onClick={() => router.push("/dashboard/applications")}
          >
            All applications <ChevronRight size={13} strokeWidth={2} />
          </button>
        </div>
        <div className={styles.activityList}>
          {recentActivity.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className={styles.activityItem}>
                <div className={`${styles.activityIcon} ${styles[a.iconClass]}`}>
                  <Icon size={14} strokeWidth={2} />
                </div>
                <div className={styles.activityBody}>
                  <span className={styles.activityTitle}>{a.title}</span>
                  <span className={styles.activityDesc}>{a.desc}</span>
                </div>
                <span className={styles.activityTime}>{a.time}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}