"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";
import Navbar from "@/components/Navbar";

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace("/dashboard");
      return;
    }
    setIsLoggedIn(false);
  }, [router]);

  // Scroll reveal
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // FAQ toggle
  function toggleFaq(e: React.MouseEvent<HTMLButtonElement>) {
    const item = (e.currentTarget as HTMLElement).closest(".faq-item");
    if (!item) return;
    const isOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item.open").forEach((el) => el.classList.remove("open"));
    if (!isOpen) item.classList.add("open");
  }

  return (
    <>
      <Navbar />

      {/* TICKER */}
      <div className="ticker">
        <div className="ticker-inner">
          {[...Array(2)].map((_, i) => (
            <span key={i} style={{ display: "contents" }}>
              {["Registrations Open", "Chemistry Department", "DBIT Bangalore", "Pick Your Event", "Individual Registration", "Don Bosco Institute of Technology"].map((text) => (
                <span key={text + i} className="ticker-item">
                  <span className="ticker-dot" />
                  {text}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--red)" stroke="none"><circle cx="12" cy="12" r="5" /></svg>
            Registrations Open — 2026
            <div className="eyebrow-line" />
          </div>

          <h1 className="hero-h1">
            <span>Register for</span>
            <span className="stroke-text">Chem</span>
            <span>Events.</span>
          </h1>

          <div className="hero-bottom">
            <p className="hero-desc">
              Chemistry Department, DBIT invites students to participate in exciting events.
              Register with your USN, verify your identity, and pick the event you want to join.
            </p>
            <div className="hero-cta-group">
              {isLoggedIn ? (
                <Link href="/dashboard" className="btn-large">
                  My Dashboard
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <Link href="/register" className="btn-large">
                  Register Now
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="stat-block">
            <div className="stat-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Students
            </div>
            <div className="stat-number">825<span style={{ color: "var(--red)" }}>+</span></div>
            <div className="stat-sub">DBIT students eligible to register</div>
          </div>

          <div className="stat-block">
            <div className="stat-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Events
            </div>
            <div className="stat-number accent">Live</div>
            <div className="stat-sub">Admin-managed events with limited seats</div>
          </div>

          <div className="stat-block">
            <div className="stat-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Steps to Join
            </div>
            <div className="stat-number">4</div>
            <div className="stat-sub">USN → OTP → Profile → Pick an event</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="steps-section reveal">
        <div className="steps-header">
          <div className="steps-header-label">
            <div className="section-tag">Process</div>
            <div className="section-num">01</div>
          </div>
          <div className="steps-header-title">How It Works</div>
        </div>

        <div className="steps-grid">
          <div className="step">
            <div className="step-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div className="step-index">— 01</div>
            <div className="step-name">Register</div>
            <div className="step-desc">Enter your USN. Your details are auto-filled from the student database. Verify with an OTP sent to your college email.</div>
            <div className="step-tag">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              &lt; 1 min
            </div>
          </div>

          <div className="step">
            <div className="step-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="step-index">— 02</div>
            <div className="step-name">Pick an Event</div>
            <div className="step-desc">Browse available events published by the Chemistry department. Each event has limited seats — select the one you want to attend.</div>
            <div className="step-tag" style={{ borderColor: "rgba(232,52,26,0.3)", color: "var(--red)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Limited seats
            </div>
          </div>

          <div className="step">
            <div className="step-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="step-index">— 03</div>
            <div className="step-name">You&apos;re In</div>
            <div className="step-desc">Your spot is confirmed. View your selected event from the dashboard. You can change your event any time while registrations are open.</div>
            <div className="step-tag">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Confirmed
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section reveal">
        <div className="faq-layout">
          <div className="faq-sidebar">
            <div className="section-tag">FAQs</div>
            <div className="faq-sidebar-title">Common Questions</div>
            <div className="section-num">02</div>
          </div>
          <div className="faq-list">
            {[
              { q: "Who can register?", a: "Any DBIT student whose USN is present in the student database uploaded by the admin. If your USN is not found, contact the Chemistry department to get it added." },
              { q: "How do I verify my identity?", a: "After entering your USN, an OTP is sent to your college email address (USN@dbit.in). Enter the OTP to proceed. The OTP is valid for 10 minutes." },
              { q: "Can I change my event after registering?", a: "You can change your event once while registrations are open. Go to your Dashboard and select a different event. Note: this is a one-time change — choose carefully. If the new event is full, you’ll be notified." },
              { q: "What happens if an event is full?", a: "Full events are clearly marked and cannot be selected. Choose another available event. Contact the admin if you need assistance." },
              { q: "How do I check my registration status?", a: "Log in to your Dashboard to see your current event selection and profile details." },
            ].map(({ q, a }) => (
              <div className="faq-item" key={q}>
                <button className="faq-q" onClick={toggleFaq}>
                  {q}
                  <div className="faq-icon-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                </button>
                <div className="faq-a">
                  <div className="faq-a-inner">{a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section reveal">
        <div className="cta-left">
          <div className="cta-overline">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--red)"><circle cx="12" cy="12" r="10" /></svg>
            Registrations Open
          </div>
          <h2 className="cta-title">Ready to join<br />an event?</h2>
          <p className="cta-sub">Registration takes under a minute. Pick your event and secure your spot.</p>
        </div>
        <div className="cta-right">
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn-large">
              My Dashboard
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <Link href="/register" className="btn-large">
              Register Now
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <span className="footer-brand">© 2026 Event Registration — Chemistry Department, Don Bosco Institute of Technology, Bangalore</span>
        <span className="footer-brand" style={{ fontSize: "10px", color: "var(--muted)" }}>Built by Dept. of CSE, Section B — DBIT</span>
        <span className="footer-brand" style={{ fontSize: "10px", color: "var(--muted)", opacity: 0.7 }}>
          Made by B Section CSE Students: Harsha N, Mithun Gowda B, Naren V, Nevil Anson Dsouza, Lekhan H R &amp; Manasvi R
        </span>
        <div className="footer-links">
          <Link href="/register">Register</Link>
          <Link href="/admin">Admin</Link>
        </div>
      </footer>
    </>
  );
}
