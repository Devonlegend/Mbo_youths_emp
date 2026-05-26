"use client";
import { useState } from "react";
import { MapPin, Mail, Phone, Send, CheckCircle } from "lucide-react";
import styles from "./Contact.module.css";

const contactInfo = [
  {
    icon: MapPin,
    label: "Address",
    value: "RMHCDT, Mbo LGA, Akwa Ibom State",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    icon: Mail,
    label: "Email",
    value: "info@rmhcdt.org",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+234 070 1234 5678",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className={styles.section} id="contact">
      <div className={styles.container}>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.label}>
            <span className={styles.labelDot} />
            Get In Touch
          </div>
          <h2 className={styles.heading}>
            Questions About
            <span className={styles.headingAccent}> Your Application?</span>
          </h2>
          <p className={styles.subtext}>
            Reach out to the Trust's designated officer for support
            with your application or any eligibility questions.
          </p>
        </div>

        {/* TWO COLUMNS */}
        <div className={styles.grid}>

          {/* LEFT — CONTACT INFO */}
          <div className={styles.left}>
            <div className={styles.infoList}>
              {contactInfo.map((c, i) => {
                const Icon = c.icon;
                return (
                  <div
                    key={i}
                    className={styles.infoCard}
                    style={{
                      background: c.bg,
                      borderColor: c.border,
                    }}
                  >
                    <div
                      className={styles.infoIconBox}
                      style={{ background: c.color }}
                    >
                      <Icon size={18} color="#ffffff" strokeWidth={2} />
                    </div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>{c.label}</span>
                      <span className={styles.infoValue}>{c.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — FORM */}
          <div className={styles.right}>
            {submitted ? (
              <div className={styles.successBox}>
                <CheckCircle size={40} color="#15803d" strokeWidth={1.5} />
                <h3 className={styles.successTitle}>Message Sent</h3>
                <p className={styles.successDesc}>
                  Thank you for reaching out. The Trust's designated
                  officer will get back to you shortly.
                </p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      className={styles.formInput}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      className={styles.formInput}
                      required
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Message</label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Write your message here..."
                    className={styles.formTextarea}
                    rows={5}
                    required
                  />
                </div>
                <button type="submit" className={styles.submitBtn}>
                  <Send size={16} strokeWidth={2} />
                  Send Message
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}