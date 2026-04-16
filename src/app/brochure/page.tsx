"use client";
export default function BrochurePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --black: #050508;
          --deep: #0a0a12;
          --cyan: #00f5ff;
          --yellow: #f5e642;
          --magenta: #ff2d78;
          --dim: rgba(0,245,255,0.18);
          --mono: 'Share Tech Mono', monospace;
          --orb: 'Orbitron', sans-serif;
          --bebas: 'Bebas Neue', sans-serif;
        }

        body { background: #111; }

        .wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 16px 64px;
          background: #111;
          min-height: 100vh;
          gap: 24px;
        }

        .print-btn {
          font-family: var(--mono);
          font-size: 13px;
          letter-spacing: 0.12em;
          background: transparent;
          color: var(--cyan);
          border: 1px solid var(--cyan);
          padding: 10px 32px;
          cursor: pointer;
          text-transform: uppercase;
        }
        .print-btn:hover { background: var(--cyan); color: var(--black); }

        /* A3 landscape */
        .a3 {
          width: 420mm;
          height: 297mm;
          background: var(--black);
          color: #fff;
          display: grid;
          grid-template-columns: 152mm 1fr;
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 60px rgba(0,245,255,0.15), 0 0 120px rgba(255,45,120,0.08);
        }

        /* scanline overlay */
        .a3::before {
          content: '';
          position: absolute; inset: 0; z-index: 10;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.08) 2px,
            rgba(0,0,0,0.08) 4px
          );
          pointer-events: none;
        }

        /* ── LEFT ── */
        .left {
          background: var(--deep);
          border-right: 2px solid var(--cyan);
          display: flex;
          flex-direction: column;
          padding: 12mm 11mm;
          position: relative;
          overflow: hidden;
        }

        /* corner brackets */
        .left::before, .left::after {
          content: '';
          position: absolute;
          width: 18mm; height: 18mm;
          border-color: var(--cyan);
          border-style: solid;
        }
        .left::before { top: 6mm; left: 6mm; border-width: 2px 0 0 2px; }
        .left::after  { bottom: 6mm; right: 6mm; border-width: 0 2px 2px 0; }

        .glow-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
        }
        .blob1 { width: 80mm; height: 80mm; background: rgba(0,245,255,0.07); top: -20mm; left: -20mm; }
        .blob2 { width: 60mm; height: 60mm; background: rgba(255,45,120,0.09); bottom: 10mm; right: -10mm; }

        .sys-label {
          font-family: var(--mono);
          font-size: 8pt;
          color: var(--cyan);
          letter-spacing: 0.14em;
          margin-bottom: 6mm;
          opacity: 0.7;
        }

        .main-title {
          font-family: var(--orb);
          font-size: 54pt;
          font-weight: 900;
          line-height: 0.88;
          letter-spacing: -0.01em;
          color: #fff;
          text-shadow: 0 0 30px rgba(0,245,255,0.5), 0 0 60px rgba(0,245,255,0.2);
          margin-bottom: 3mm;
        }

        .main-title .accent {
          display: block;
          color: var(--cyan);
          -webkit-text-stroke: 1px var(--cyan);
        }

        .glitch-sub {
          font-family: var(--mono);
          font-size: 8pt;
          color: var(--yellow);
          letter-spacing: 0.1em;
          margin-bottom: 7mm;
          opacity: 0.85;
        }

        .left-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, var(--cyan), transparent);
          margin-bottom: 7mm;
        }

        .meta-block {
          display: flex;
          flex-direction: column;
          gap: 3.5mm;
          margin-bottom: auto;
        }

        .meta-row {
          display: grid;
          grid-template-columns: 22mm 1fr;
          gap: 4mm;
          align-items: start;
        }

        .meta-key {
          font-family: var(--mono);
          font-size: 7pt;
          color: var(--cyan);
          opacity: 0.55;
          letter-spacing: 0.1em;
          padding-top: 1px;
        }

        .meta-val {
          font-family: var(--mono);
          font-size: 8.5pt;
          color: #fff;
          line-height: 1.4;
        }

        .meta-val.hi { color: var(--yellow); }

        .prize-box {
          border: 1px solid var(--magenta);
          padding: 5mm 6mm;
          margin-top: 6mm;
          position: relative;
          background: rgba(255,45,120,0.04);
          box-shadow: 0 0 20px rgba(255,45,120,0.12) inset;
        }

        .prize-box::before {
          content: 'PRIZE_POOL.EXE';
          position: absolute;
          top: -5px; left: 8px;
          font-family: var(--mono);
          font-size: 7pt;
          color: var(--magenta);
          background: var(--deep);
          padding: 0 4px;
          letter-spacing: 0.1em;
        }

        .prize-amt {
          font-family: var(--orb);
          font-size: 34pt;
          font-weight: 900;
          color: var(--magenta);
          text-shadow: 0 0 20px rgba(255,45,120,0.6);
          line-height: 1;
        }

        .prize-note {
          font-family: var(--mono);
          font-size: 7pt;
          color: rgba(255,45,120,0.6);
          margin-top: 2mm;
          letter-spacing: 0.06em;
        }

        .left-footer {
          margin-top: 6mm;
          padding-top: 4mm;
          border-top: 1px solid rgba(0,245,255,0.15);
        }

        .left-footer p {
          font-family: var(--mono);
          font-size: 7pt;
          color: rgba(0,245,255,0.4);
          line-height: 1.7;
          letter-spacing: 0.06em;
        }

        .left-footer strong {
          color: rgba(0,245,255,0.75);
        }

        /* ── RIGHT ── */
        .right {
          display: flex;
          flex-direction: column;
          background: var(--black);
        }

        .right-header {
          padding: 7mm 10mm;
          border-bottom: 1px solid rgba(0,245,255,0.2);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .right-header-label {
          font-family: var(--mono);
          font-size: 8pt;
          color: var(--cyan);
          letter-spacing: 0.14em;
          opacity: 0.7;
        }

        .right-header-tag {
          font-family: var(--mono);
          font-size: 8pt;
          color: var(--yellow);
          border: 1px solid rgba(245,230,66,0.4);
          padding: 2px 8px;
          letter-spacing: 0.1em;
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          flex: 1;
        }

        .ev {
          padding: 6mm 7mm;
          border-right: 1px solid rgba(0,245,255,0.12);
          border-bottom: 1px solid rgba(0,245,255,0.12);
          display: flex;
          flex-direction: column;
          gap: 2.5mm;
          position: relative;
          overflow: hidden;
        }

        .ev::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 3px; height: 100%;
          background: var(--cyan);
          opacity: 0;
        }

        .ev:nth-child(3n) { border-right: none; }
        .ev:nth-child(4), .ev:nth-child(5), .ev:nth-child(6) { border-bottom: none; }

        /* alternate accent colors */
        .ev:nth-child(2)::before, .ev:nth-child(5)::before { background: var(--magenta); opacity: 0.6; }
        .ev:nth-child(3)::before, .ev:nth-child(6)::before { background: var(--yellow); opacity: 0.6; }
        .ev:nth-child(1)::before, .ev:nth-child(4)::before { background: var(--cyan); opacity: 0.6; }

        .ev-num {
          font-family: var(--mono);
          font-size: 7pt;
          color: var(--cyan);
          opacity: 0.45;
          letter-spacing: 0.14em;
        }

        .ev:nth-child(2) .ev-num, .ev:nth-child(5) .ev-num { color: var(--magenta); }
        .ev:nth-child(3) .ev-num, .ev:nth-child(6) .ev-num { color: var(--yellow); }

        .ev-name {
          font-family: var(--orb);
          font-size: 12pt;
          font-weight: 700;
          line-height: 1.05;
          color: #fff;
          letter-spacing: 0.01em;
        }

        .ev-tag {
          display: inline-block;
          font-family: var(--mono);
          font-size: 6.5pt;
          color: var(--cyan);
          border: 1px solid rgba(0,245,255,0.3);
          padding: 1px 5px;
          width: fit-content;
          letter-spacing: 0.06em;
        }

        .ev:nth-child(2) .ev-tag, .ev:nth-child(5) .ev-tag { color: var(--magenta); border-color: rgba(255,45,120,0.3); }
        .ev:nth-child(3) .ev-tag, .ev:nth-child(6) .ev-tag { color: var(--yellow); border-color: rgba(245,230,66,0.3); }

        .ev-desc {
          font-family: var(--mono);
          font-size: 6.8pt;
          color: rgba(255,255,255,0.45);
          line-height: 1.55;
          flex: 1;
        }

        .ev-judging {
          font-family: var(--mono);
          font-size: 6pt;
          color: rgba(255,255,255,0.3);
          border-top: 1px solid rgba(0,245,255,0.08);
          padding-top: 2mm;
          line-height: 1.4;
        }

        .ev-judging span { color: rgba(0,245,255,0.5); }

        /* ── BOTTOM STRIP ── */
        .strip {
          border-top: 1px solid rgba(0,245,255,0.25);
          padding: 4mm 10mm;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0,245,255,0.03);
          flex-shrink: 0;
        }

        .strip-item { display: flex; flex-direction: column; gap: 1mm; }

        .strip-key {
          font-family: var(--mono);
          font-size: 6.5pt;
          color: var(--cyan);
          opacity: 0.45;
          letter-spacing: 0.14em;
        }

        .strip-val {
          font-family: var(--orb);
          font-size: 11pt;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.02em;
        }

        .strip-val.hi { color: var(--magenta); text-shadow: 0 0 10px rgba(255,45,120,0.5); }
        .strip-val.cy { color: var(--cyan); text-shadow: 0 0 10px rgba(0,245,255,0.4); }

        .strip-div {
          width: 1px; height: 10mm;
          background: rgba(0,245,255,0.15);
        }

        @media print {
          body { background: #050508; }
          .wrap { padding: 0; background: #050508; gap: 0; }
          .print-btn { display: none; }
          @page { size: A3 landscape; margin: 0; }
        }

        @media screen and (max-width: 1300px) {
          .a3 { transform-origin: top center; transform: scale(0.52); margin-bottom: -142mm; }
        }
      `}</style>

      <div className="wrap">
        <button className="print-btn" onClick={() => window.print()}>
          ▶ PRINT / EXPORT PDF
        </button>

        <div className="a3">

          {/* LEFT */}
          <div className="left">
            <div className="glow-blob blob1" />
            <div className="glow-blob blob2" />

            <div className="sys-label">// DEPT_CHEM · DBIT_BLR · 2026.SYS</div>

            <div className="main-title">
              IDEA<span className="accent">THON</span>
            </div>

            <div className="glitch-sub">
              &gt; CHEMISTRY_DEPT.PRESENTS — INTER_DEPT_SHOWCASE
            </div>

            <div className="left-divider" />

            <div className="meta-block">
              <div className="meta-row">
                <span className="meta-key">DATE</span>
                <span className="meta-val hi">09 · 05 · 2026</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">VENUE</span>
                <span className="meta-val">Don Bosco Institute of Technology, Bangalore</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">HOST</span>
                <span className="meta-val">Department of Chemistry, DBIT</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">ACCESS</span>
                <span className="meta-val">2nd Semester &amp; above · All DBIT Students</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">REGISTER</span>
                <span className="meta-val hi">ideathon.dfriendsclub.in</span>
              </div>
            </div>

            <div className="prize-box">
              <div className="prize-amt">₹30,000+</div>
              <div className="prize-note">// 6 events · cash prizes · top 3 per category</div>
            </div>

            <div className="left-footer">
              <p>
                <strong>IDEATHON 2026</strong><br />
                Chemistry Department · DBIT<br />
                Mysore Road, Bangalore — 560074
              </p>
            </div>
          </div>

          {/* RIGHT */}
          <div className="right">
            <div className="right-header">
              <span className="right-header-label">// EVENT_PORTFOLIO · 6_MODULES_LOADED</span>
              <span className="right-header-tag">SYS_DATE: 09.05.2026</span>
            </div>

            <div className="events-grid">
              {[
                {
                  num: "MOD_01",
                  name: "Treasure Hunt + Bounty",
                  tag: "TEAM · 4 NODES",
                  desc: "Strategy-heavy venue adventure built around clues, bonus tasks, and team coordination. Solve clue stations, complete mini-challenges, and take on optional bounty tasks for extra rewards.",
                  judging: "Accuracy · clues solved · bounty completion · teamwork · time",
                },
                {
                  num: "MOD_02",
                  name: "AI Image Generation",
                  tag: "SOLO_UNIT",
                  desc: "Use AI tools to generate images based on assigned themes. Tests prompt engineering, visual imagination, and creative direction. Submit best image with prompt logic note.",
                  judging: "Creativity · prompt engineering · originality · visual quality",
                },
                {
                  num: "MOD_03",
                  name: "Quiz",
                  tag: "TEAM · 4 NODES",
                  desc: "Multi-round team knowledge contest covering technology, current affairs, pop culture, and logical reasoning. Rounds include MCQs, rapid-fire, and visual prompts.",
                  judging: "Correct answers · speed · consistency · final point tally",
                },
                {
                  num: "MOD_04",
                  name: "Photo & Video Editing",
                  tag: "SOLO_UNIT",
                  desc: "Edit raw photos or videos within a fixed duration. Showcases digital media skills through composition, pacing, colour treatment, and narrative impact under deadline pressure.",
                  judging: "Creativity · technical skill · storytelling · polish",
                },
                {
                  num: "MOD_05",
                  name: "Expo",
                  tag: "SOLO / TEAM",
                  desc: "Exhibition-style showcase for projects, prototypes, and innovative ideas. Present to judges and visitors through live demos and Q&A. Real-world problem framing rewarded.",
                  judging: "Innovation · clarity · technical depth · feasibility · impact",
                },
                {
                  num: "MOD_06",
                  name: "Memeathon",
                  tag: "SOLO_UNIT",
                  desc: "Create memes around assigned themes within a limited time. Light, highly interactive, and audience-friendly — blends internet culture with structured competition.",
                  judging: "Creativity · humor · originality · relatability · theme fit",
                },
              ].map((ev) => (
                <div className="ev" key={ev.num}>
                  <div className="ev-num">{ev.num}</div>
                  <div className="ev-name">{ev.name}</div>
                  <div className="ev-tag">{ev.tag}</div>
                  <p className="ev-desc">{ev.desc}</p>
                  <div className="ev-judging">
                    <span>EVAL: </span>{ev.judging}
                  </div>
                </div>
              ))}
            </div>

            <div className="strip">
              <div className="strip-item">
                <span className="strip-key">DATE</span>
                <span className="strip-val cy">09 MAY 2026</span>
              </div>
              <div className="strip-div" />
              <div className="strip-item">
                <span className="strip-key">PRIZE_POOL</span>
                <span className="strip-val hi">₹30,000+</span>
              </div>
              <div className="strip-div" />
              <div className="strip-item">
                <span className="strip-key">MODULES</span>
                <span className="strip-val">6 EVENTS</span>
              </div>
              <div className="strip-div" />
              <div className="strip-item">
                <span className="strip-key">ACCESS_LEVEL</span>
                <span className="strip-val">2ND SEM+</span>
              </div>
              <div className="strip-div" />
              <div className="strip-item">
                <span className="strip-key">REGISTER</span>
                <span className="strip-val cy" style={{ fontSize: "9pt" }}>ideathon.dfriendsclub.in</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
