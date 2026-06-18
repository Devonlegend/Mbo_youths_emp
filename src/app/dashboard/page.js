"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Calendar, Clock, FileText, CheckCircle2,
  GraduationCap, Briefcase, Wrench, Banknote,
  ArrowRight, ChevronRight, AlertCircle, Hourglass,
} from "lucide-react";
import ProfileCard from "./components/ProfileCard";
import LoadingSpinner from "./components/LoadingSpinner";
import styles from "./page.module.css";
import { getMe, getStudentProfile, getApplications, getSchemes } from "@/services";

const CYCLE_END = new Date("2027-03-31");

function getDaysLeft() {
  const diff = Math.ceil((CYCLE_END - new Date()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function formatTimeAgo(date) {
  const days = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}

function mapApplicationToActivity(app) {
  const statusMap = {
    approved:        { icon: CheckCircle2, iconClass: "act_green", title: "Application approved"           },
    submitted:       { icon: Hourglass,    iconClass: "act_amber", title: "Application submitted"          },
    double_dip_flag: { icon: AlertCircle,  iconClass: "act_blue",  title: "Application flagged for review" },
    rejected:        { icon: AlertCircle,  iconClass: "act_amber", title: "Application unsuccessful"       },
    document_review: { icon: Hourglass,    iconClass: "act_amber", title: "Documents under review"         },
    shortlisted:     { icon: CheckCircle2, iconClass: "act_green", title: "Application shortlisted"        },
  };
  const meta = statusMap[app.status] || { icon: FileText, iconClass: "act_blue", title: "Application updated" };
  const date = app.submission_date ? new Date(app.submission_date) : null;
  return {
    icon:      meta.icon,
    iconClass: meta.iconClass,
    title:     meta.title,
    desc: app.scheme_name || app.scheme?.name || "Programme",
    time:      date ? formatTimeAgo(date) : "",
  };
}

function getSchemeIcon(awardType) {
  switch (awardType) {
    case "scholarship":  return { icon: GraduationCap, iconClass: "qa_green"  };
    case "vocational":   return { icon: Wrench,        iconClass: "qa_amber"  };
    case "empowerment":  return { icon: Briefcase,     iconClass: "qa_blue"   };
    case "grant":        return { icon: Banknote,      iconClass: "qa_red"    };
    default:             return { icon: GraduationCap, iconClass: "qa_green"  };
  }
}

export default function DashboardPage() {
  const router = useRouter();

  const [user,           setUser]          = useState(null);
  const [stats,          setStats]         = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [schemes,        setSchemes]       = useState([]);
  const [loading,        setLoading]       = useState(true);

  const daysLeft = getDaysLeft();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const [authRes, studentRes, appsRes, schemesRes] = await Promise.all([
          getMe(),
          getStudentProfile(),
          getApplications().catch(() => ({ data: [] })),
          getSchemes().catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        const auth    = authRes.data;
        const profile = studentRes.data;
        const apps = Array.isArray(appsRes.data?.results) ? appsRes.data.results : [];
        const schemesList = Array.isArray(schemesRes.data?.results) ? schemesRes.data.results : [];

        setUser({
          first_name:     auth.firstname      || "",
          last_name:      auth.lastname       || "",
          email:          auth.email          || "",
          phone:          auth.phone_number   || "",
          lga:            profile.lga         || "",
          ward:           profile.ward        || "",
          is_verified:    profile.is_verified || false,
          passport_photo: profile.passport || null,
        });

        setStats({
          total:       apps.length,
          approved:    apps.filter((a) => a.status === "approved").length,
          underReview: apps.filter((a) =>
            ["submitted", "document_review", "shortlisted",
             "eligibility_check", "double_dip_flag"].includes(a.status)
          ).length,
        });

        const sorted = [...apps].sort((a, b) =>
          new Date(b.submission_date) - new Date(a.submission_date)
        );
        setRecentActivity(sorted.slice(0, 3).map(mapApplicationToActivity));
        setSchemes(schemesList.slice(0, 4));

      } catch {
        // layout handles auth failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className={styles.page}>

      {/* GREETING */}
      <div className={styles.greeting}>
        <p className={styles.greetingDate}>{today}</p>
        <h1 className={styles.greetingTitle}>
          Welcome back,{" "}
          <span className={styles.greetingAccent}>{user?.first_name || "there"}</span>
          <span className={styles.greetingWave}>👋</span>
        </h1>
      </div>

      {/* CYCLE BANNER */}
      <div className={styles.cycleBanner}>
        <div className={styles.cycleLeft}>
          <Calendar size={14} strokeWidth={2} className={styles.cycleIcon} />
          <span>Current cycle closes <strong>31 Mar 2027</strong></span>
        </div>
        <div className={styles.cycleRight}>
          <Clock size={13} strokeWidth={2} />
          <span>{daysLeft} days left</span>
        </div>
      </div>

      {/* PROFILE CARD */}
      <ProfileCard user={user} onEdit={() => router.push("/dashboard/profile")} />

      {/* STATS */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={`${styles.statIcon} ${styles.si_blue}`}><FileText size={15} strokeWidth={1.8} /></div>
            <span className={`${styles.statPill} ${styles.sp_neut}`}>All time</span>
          </div>
          <div className={styles.statBottom}>
            <div className={styles.statValue}>{stats?.total ?? 0}</div>
            <div className={styles.statLabel}>Total applications</div>
          </div>
          <span className={`${styles.statMobilePill} ${styles.sp_neut}`}>All time</span>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={`${styles.statIcon} ${styles.si_green}`}><CheckCircle2 size={15} strokeWidth={1.8} /></div>
            <span className={`${styles.statPill} ${styles.sp_up}`}>Confirmed</span>
          </div>
          <div className={styles.statBottom}>
            <div className={styles.statValue}>{stats?.approved ?? 0}</div>
            <div className={styles.statLabel}>Approved</div>
          </div>
          <span className={`${styles.statMobilePill} ${styles.sp_up}`}>Confirmed</span>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={`${styles.statIcon} ${styles.si_amber}`}><Clock size={15} strokeWidth={1.8} /></div>
            <span className={`${styles.statPill} ${styles.sp_warn}`}>In progress</span>
          </div>
          <div className={styles.statBottom}>
            <div className={styles.statValue}>{stats?.underReview ?? 0}</div>
            <div className={styles.statLabel}>Under review</div>
          </div>
          <span className={`${styles.statMobilePill} ${styles.sp_warn}`}>In progress</span>
        </div>
      </div>

      {/* QUICK ACTIONS — real schemes from API */}
      <div>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Apply for a programme</span>
          <button className={styles.sectionLink} onClick={() => router.push("/dashboard/programmes")}>
            View all <ChevronRight size={13} strokeWidth={2} />
          </button>
        </div>

        {schemes.length === 0 ? (
          <div className={styles.activityList}>
            <div className={styles.activityItem} style={{ justifyContent: "center", padding: "24px 18px" }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>
                No programmes available yet.
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.qaGrid}>
            {schemes.map((scheme) => {
              const { icon: Icon, iconClass } = getSchemeIcon(scheme.award_type);
              return (
                <button
                  key={scheme.id}
                  className={styles.qaCard}
                  onClick={() => router.push(`/dashboard/programmes?scheme_id=${scheme.id}`)}
                >
                  <div className={`${styles.qaIcon} ${styles[iconClass]}`}>
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <div className={styles.qaText}>
                    <span className={styles.qaLabel}>{scheme.name}</span>
                    <span className={styles.qaDesc}>{scheme.description?.slice(0, 40) || "View details"}</span>
                  </div>
                  <ArrowRight size={14} strokeWidth={2} className={styles.qaArrow} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENT ACTIVITY */}
      <div>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Recent activity</span>
          <button className={styles.sectionLink} onClick={() => router.push("/dashboard/applications")}>
            All applications <ChevronRight size={13} strokeWidth={2} />
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <div className={styles.activityList}>
            <div className={styles.activityItem} style={{ justifyContent: "center", padding: "24px 18px" }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>
                No activity yet — apply for a programme to get started.
              </span>
            </div>
          </div>
        ) : (
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
        )}
      </div>

    </div>
  );
}