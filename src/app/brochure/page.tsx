"use client";
export default function BrochurePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');

        :root {
          --ink: #0D0D0D;
          --paper: #F2EFE9;
          --paper2: #E8E4DD;
          --red: #E8341A;
          --muted: #7A7670;
          --bebas: 'Bebas Neue', sans-serif;
          --body: 'Instrument Sans', sans-serif;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #ccc; }

        .brochure-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 16px 64px;
          background: #ccc;
          min-height: 100vh;
          font-family: var(--body);
          gap: 32px;
        }

        .print-btn {
          font-family: var(--bebas);
          font-size: 16px;
          letter-spacing: 0.1em;
          background: var(--ink);
          color: var(--paper);
          border: none;
          padding: 10px 32px;
          cursor: pointer;
        }

        /* A3 = 420mm × 297mm landscape */
        .a3 {
          width: 420mm;
          height: 297mm;
          background: var(--paper);
          color: var(--ink);
          display: grid;
          grid-template-columns: 148mm 1fr;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 40px rgba(0,0,0,0.25);
        }

        /* ── LEFT PANEL ── */
        .left {
          background: var(--ink);
          color: var(--paper);
          display: flex;
          flex-direction: column;
          padding: 14mm 12mm;
          position: relative;
          overflow: hidden;
        }

        .left-noise {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle at 30% 20%, rgba(232,52,26,0.18) 0%, transparent 55%),
                            radial-gradient(circle at 80% 80%, rgba(232,52,26,0.10) 0%, transparent 50%);
          pointer-events: none;
        }

        .left-eyebrow {
          font-family: var(--bebas);
          font-size: 11px;
          letter-spacing: 0.22em;
          color: var(--red);
          margin-bottom: 6mm;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .left-eyebrow::before {
          content: '';
          display: inline-block;
          width: 6px; height: 6px;
          background: var(--red);
          border-radius: 50%;
        }

        .left-title {
          font-family: var(--bebas);
          font-size: 52pt;
          line-height: 0.92;
          letter-spacing: 0.01em;
          color: #fff;
          margin-bottom: 5mm;
        }

        .left-title span {
          display: block;
          color: var(--red);
        }

        .left-sub {
          font-size: 9pt;
          color: rgba(242,239,233,0.65);
          line-height: 1.6;
          margin-bottom: 8mm;
          max-width: 110mm;
        }

        .left-divider {
          width: 100%;
          height: 1px;
          background: rgba(242,239,233,0.15);
          margin-bottom: 8mm;
        }

        .left-meta {
          display: flex;
          flex-direction: column;
          gap: 4mm;
          margin-bottom: auto;
        }

        .meta-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .meta-label {
          font-family: var(--bebas);
          font-size: 9px;
          letter-spacing: 0.18em;
          color: rgba(242,239,233,0.45);
          min-width: 22mm;
          padding-top: 1px;
        }

        .meta-val {
          font-size: 10pt;
          font-weight: 600;
          color: #fff;
          line-height: 1.3;
        }

        .meta-val.accent { color: var(--red); }

        .prize-block {
          border: 1px solid rgba(232,52,26,0.4);
          padding: 5mm 6mm;
          margin-top: 6mm;
        }

        .prize-label {
          font-family: var(--bebas);
          font-size: 10px;
          letter-spacing: 0.2em;
          color: rgba(242,239,233,0.45);
          margin-bottom: 2mm;
        }

        .prize-amount {
          font-family: var(--bebas);
          font-size: 36pt;
          color: var(--red);
          line-height: 1;
        }

        .prize-amount sup {
          font-size: 16pt;
          vertical-align: super;
        }

        .prize-note {
          font-size: 8pt;
          color: rgba(242,239,233,0.5);
          margin-top: 1mm;
        }

        .left-footer {
          margin-top: 6mm;
          padding-top: 5mm;
          border-top: 1px solid rgba(242,239,233,0.12);
        }

        .left-footer-org {
          font-family: var(--bebas);
          font-size: 11px;
          letter-spacing: 0.14em;
          color: rgba(242,239,233,0.5);
          line-height: 1.6;
        }

        .left-footer-org strong {
          color: rgba(242,239,233,0.85);
          display: block;
        }

        /* ── RIGHT PANEL ── */
        .right {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .right-top {
          padding: 10mm 12mm 8mm;
          border-bottom: 1.5px solid var(--ink);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .right-top-label {
          font-family: var(--bebas);
          font-size: 11px;
          letter-spacing: 0.2em;
          color: var(--muted);
        }

        .right-top-tag {
          font-family: var(--bebas);
          font-size: 10px;
          letter-spacing: 0.14em;
          border: 1px solid var(--ink);
          padding: 3px 10px;
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          flex: 1;
        }

        .event-card {
          padding: 7mm 8mm;
          border-right: 1.5px solid var(--ink);
          border-bottom: 1.5px solid var(--ink);
          display: flex;
          flex-direction: column;
          gap: 3mm;
        }

        .event-card:nth-child(3n) { border-right: none; }
        .event-card:nth-child(4), .event-card:nth-child(5), .event-card:nth-child(6) { border-bottom: none; }

        .event-num {
          font-family: var(--bebas);
          font-size: 9px;
          letter-spacing: 0.16em;
          color: var(--muted);
        }

        .event-name {
          font-family: var(--bebas);
          font-size: 17pt;
          line-height: 1.0;
          letter-spacing: 0.02em;
          color: var(--ink);
        }

        .event-tag {
          display: inline-block;
          font-size: 7pt;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--red);
          border: 1px solid rgba(232,52,26,0.35);
          padding: 1px 6px;
          width: fit-content;
        }

        .event-desc {
          font-size: 7.5pt;
          color: var(--muted);
          line-height: 1.55;
          flex: 1;
        }

        .event-judging {
          font-size: 6.5pt;
          color: var(--ink);
          border-top: 1px solid rgba(13,13,13,0.1);
          padding-top: 2mm;
          line-height: 1.4;
        }

        .event-judging strong { color: var(--ink); }

        /* ── BOTTOM STRIP ── */
        .bottom-strip {
          border-top: 1.5px solid var(--ink);
          padding: 4mm 12mm;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--paper2);
          flex-shrink: 0;
        }

        .strip-item {
          display: flex;
          flex-direction: column;
          gap: 1mm;
        }

        .strip-label {
          font-family: var(--bebas);
          font-size: 8px;
          letter-spacing: 0.18em;
          color: var(--muted);
        }

        .strip-val {
          font-family: var(--bebas);
          font-size: 13pt;
          letter-spacing: 0.04em;
          color: var(--ink);
        }

        .strip-divider {
          width: 1px;
          height: 10mm;
          background: rgba(13,13,13,0.15);
        }

        @media print {
          body { background: white; }
          .brochure-wrap { padding: 0; background: white; gap: 0; }
          .print-btn { display: none; }
          .a3 { box-shadow: none; }
          @page { size: A3 landscape; margin: 0; }
        }

        @media screen and (max-width: 1300px) {
          .a3 { transform-origin: top center; transform: scale(0.55); margin-bottom: -130mm; }
        }
      `}</style>

      <div className="brochure-wrap">
        <button className="print-btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>

        <div className="a3">

          {/* ── LEFT ── */}
          <div className="left">
            <div className="left-noise" />

            <div className="left-eyebrow">Chemistry Dept · DBIT Bangalore</div>

            <div className="left-title">
              IDEA<span>THON</span>
            </div>

            <p className="left-sub">
              An inter-department showcase of creativity, technology, and innovation — six competitive events designed to challenge every kind of thinker.
            </p>

            <div className="left-divider" />

            <div className="left-meta">
              <div className="meta-row">
                <span className="meta-label">Date</span>
                <span className="meta-val">09 May 2026</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Venue</span>
                <span className="meta-val">Don Bosco Institute of Technology, Bangalore</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Organiser</span>
                <span className="meta-val">Department of Chemistry, DBIT</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Eligibility</span>
                <span className="meta-val">2nd Semester &amp; above — All DBIT Students</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Register</span>
                <span className="meta-val accent">ideathon.dfriendsclub.in</span>
              </div>
            </div>

            <div className="prize-block">
              <div className="prize-label">Total Prize Pool</div>
              <div className="prize-amount"><sup>₹</sup>30,000<sup>+</sup></div>
              <div className="prize-note">Across 6 events · Cash prizes for top 3 in each</div>
            </div>

            <div className="left-footer">
              <div className="left-footer-org">
                <strong>IDEATHON 2026</strong>
                Chemistry Department · Don Bosco Institute of Technology<br />
                Mysore Road, Bangalore — 560074
              </div>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="right">
            <div className="right-top">
              <span className="right-top-label">Event Portfolio — 6 Events</span>
              <span className="right-top-tag">09 · 05 · 2026</span>
            </div>

            <div className="events-grid">
              {[
                {
                  num: "01",
                  name: "Treasure Hunt + Bounty",
                  tag: "Team · 4 Members",
                  desc: "A strategy-heavy venue adventure built around clues, bonus tasks, and team coordination. Solve clue stations, complete mini-challenges, and take on optional bounty tasks for extra rewards.",
                  judging: "Accuracy, clues solved, bounty completion, teamwork, time",
                },
                {
                  num: "02",
                  name: "AI Image Generation",
                  tag: "Individual",
                  desc: "Use AI tools to generate images based on assigned themes. Tests prompt engineering, visual imagination, and creative direction. Submit your best image with a short note on prompt logic.",
                  judging: "Creativity, prompt engineering, originality, visual quality",
                },
                {
                  num: "03",
                  name: "Quiz",
                  tag: "Team · 4 Members",
                  desc: "A multi-round team knowledge contest covering technology, current affairs, pop culture, and logical reasoning. Rounds include MCQs, rapid-fire, and visual prompts.",
                  judging: "Correct answers, speed, consistency, final point tally",
                },
                {
                  num: "04",
                  name: "Photo & Video Editing",
                  tag: "Individual",
                  desc: "Edit raw photos or videos within a fixed duration. Showcases digital media skills through composition, pacing, colour treatment, and narrative impact under deadline pressure.",
                  judging: "Creativity, technical skill, storytelling, polish",
                },
                {
                  num: "05",
                  name: "Expo",
                  tag: "Individual / Team",
                  desc: "An exhibition-style showcase for projects, prototypes, and innovative ideas. Present to judges and visitors through live demos and Q&A. Encourages real-world problem framing.",
                  judging: "Innovation, clarity, technical depth, feasibility, impact",
                },
                {
                  num: "06",
                  name: "Memeathon",
                  tag: "Individual",
                  desc: "Create memes around assigned themes within a limited time. Light, highly interactive, and audience-friendly — blends internet culture with structured competition.",
                  judging: "Creativity, humor, originality, relatability, theme fit",
                },
              ].map((ev) => (
                <div className="event-card" key={ev.num}>
                  <div className="event-num">— {ev.num}</div>
                  <div className="event-name">{ev.name}</div>
                  <div className="event-tag">{ev.tag}</div>
                  <p className="event-desc">{ev.desc}</p>
                  <div className="event-judging">
                    <strong>Judged on: </strong>{ev.judging}
                  </div>
                </div>
              ))}
            </div>

            <div className="bottom-strip">
              <div className="strip-item">
                <span className="strip-label">Date</span>
                <span className="strip-val">09 May 2026</span>
              </div>
              <div className="strip-divider" />
              <div className="strip-item">
                <span className="strip-label">Prize Pool</span>
                <span className="strip-val">₹30,000+</span>
              </div>
              <div className="strip-divider" />
              <div className="strip-item">
                <span className="strip-label">Events</span>
                <span className="strip-val">6 Categories</span>
              </div>
              <div className="strip-divider" />
              <div className="strip-item">
                <span className="strip-label">Eligibility</span>
                <span className="strip-val">2nd Sem &amp; Above</span>
              </div>
              <div className="strip-divider" />
              <div className="strip-item">
                <span className="strip-label">Register at</span>
                <span className="strip-val" style={{ color: "var(--red)" }}>ideathon.dfriendsclub.in</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
