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
              {["Team Formation Open", "825+ Students", "Build Your Team of 6", "Don Bosco Institute of Technology, Kumbalagodu, Bangalore", "2026 Cohort", "Cross-Branch Diversity"].map((text) => (
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
            Open Now — 2026 Cohort
            <div className="eyebrow-line" />
          </div>

          <h1 className="hero-h1">
            <span>Build Your</span>
            <span className="stroke-text">Dream</span>
            <span>Team.</span>
          </h1>

          <div className="hero-bottom">
            <p className="hero-desc">
              Join <strong>825+ first-year students</strong> in self-organized cross-branch teams of 6.
              Register, create or join a team, and build something great together.
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
                  Register / Login
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
              <Link href="/team/browse" className="btn-outline">
                Browse Teams
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </Link>
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
            <div className="stat-sub">First-year students across all branches</div>
          </div>

          <div className="stat-block">
            <div className="stat-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              Team Size
            </div>
            <div className="stat-number accent">6</div>
            <div className="stat-sub">Members per team, cross-branch diversity required</div>
          </div>

          <div className="stat-block">
            <div className="stat-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Steps to Join
            </div>
            <div className="stat-number">3</div>
            <div className="stat-sub">Register, create or join a team, invite members</div>
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
            <div className="step-desc">Enter your USN to register. Your details are auto-filled from the student database. Takes under a minute.</div>
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <div className="step-index">— 02</div>
            <div className="step-name">Build Team</div>
            <div className="step-desc">Create your own team or browse open teams to join. Invite classmates from different branches using their USN.</div>
            <div className="step-tag" style={{ borderColor: "rgba(232,52,26,0.3)", color: "var(--red)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Self-organized
            </div>
          </div>

          <div className="step">
            <div className="step-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="step-index">— 03</div>
            <div className="step-name">Team Ready</div>
            <div className="step-desc">Once your team has 6 members with cross-branch diversity (including EEE/ECE), you&apos;re locked in and ready to innovate.</div>
            <div className="step-tag">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              6 Members
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
              { q: "How do I form a team?", a: "After registering, go to your Dashboard and click 'Create Team'. You'll become the team lead. Then invite other students by entering their USN — they'll get a notification to accept. You can also browse existing teams and request to join one." },
              { q: "What are the team requirements?", a: "Each team needs exactly 6 members with at least 2 different branches, no more than 4 from the same branch, and at least 1 member from EEE or ECE. The system validates constraints in real-time as you build your team." },
              { q: "Can I join a team without creating one?", a: "Yes! Go to 'Browse Teams' to see all public teams that are still forming. Click 'Request to Join' and the team lead will approve or reject your request. You can also accept invites from team leads." },
              { q: "What if someone rejects my join request?", a: "You can request to join other teams or create your own. There's no limit on how many requests you can send, though you can only be on one team at a time." },
              { q: "How do I check my team status?", a: "Visit the Status page and enter your USN, or log in to your Dashboard to see your current team, pending invites, and quick actions all in one place." },
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
            Team Formation Open
          </div>
          <h2 className="cta-title">Ready to build<br />your team?</h2>
          <p className="cta-sub">Registration takes under a minute. Create or join a team and start collaborating.</p>
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
              Register / Login
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          )}
          <Link href="/team/browse" className="btn-outline">
            Browse Teams
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <span className="footer-brand">© 2026 Idea Lab — Don Bosco Institute of Technology, Kumbalagodu, Bangalore</span>
        <span className="footer-brand" style={{ fontSize: "10px", color: "var(--muted)" }}>Made by B Section CSE Students: Harsha N, Mithun Gowda B, Naren V &amp; Nevil Anson Dsouza</span>
        <div className="footer-links">
          <Link href="/register">Register / Login</Link>
          <Link href="/team/browse">Teams</Link>
          <Link href="/status">Status</Link>
        </div>
      </footer>
    </>
  );
}
