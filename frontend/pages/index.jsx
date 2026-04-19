import Link from "next/link";

const PAGE_BG = "#ffffff";
const SURFACE = "#ffffff";
const SURFACE_SOFT = "#fbfbfc";
const BORDER = "rgba(15,23,42,0.08)";
const BORDER_STRONG = "rgba(15,23,42,0.14)";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const ORANGE = "#ff7a00";
const ORANGE_DEEP = "#ea6a00";
const BLUE = "#2563eb";
const NAVY = "#0f172a";
const GREEN = "#16a34a";

function Badge({ children, tone = "default" }) {
  let background = "rgba(15,23,42,0.06)";
  let color = TEXT;

  if (tone === "blue") {
    background = "rgba(37,99,235,0.10)";
    color = BLUE;
  } else if (tone === "orange") {
    background = "rgba(255,122,0,0.12)";
    color = ORANGE;
  } else if (tone === "green") {
    background = "rgba(22,163,74,0.12)";
    color = GREEN;
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 34,
        padding: "8px 12px",
        borderRadius: 999,
        background,
        color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ href, children }) {
  return (
    <Link href={href} className="pg-btn-primary">
      {children}
    </Link>
  );
}

function SecondaryButton({ href, children }) {
  return (
    <a href={href} className="pg-btn-secondary">
      {children}
    </a>
  );
}

function InsightCard({ title, text, accent = "blue" }) {
  const accentColor =
    accent === "orange" ? ORANGE : accent === "green" ? GREEN : BLUE;

  return (
    <div className="pg-card pg-insight-card">
      <div
        className="pg-insight-icon"
        style={{
          background: `${accentColor}12`,
          color: accentColor,
        }}
      >
        ●
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function MetricCard({ value, label, note, accent = "orange", icon = "•" }) {
  const accentColor =
    accent === "blue" ? BLUE : accent === "green" ? GREEN : ORANGE;

  return (
    <div className="pg-card pg-metric-card">
      <div
        className="pg-metric-icon"
        style={{
          background: `${accentColor}12`,
          color: accentColor,
        }}
      >
        {icon}
      </div>
      <div className="pg-metric-value">{value}</div>
      <div className="pg-metric-label">{label}</div>
      <div className="pg-metric-note">{note}</div>
    </div>
  );
}

function ModuleCard({ icon, title, text }) {
  return (
    <div className="pg-card pg-module-card">
      <div className="pg-module-orb" />
      <div className="pg-module-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function PanelRow({ title, meta, color }) {
  return (
    <div className="pg-panel-row">
      <div className="pg-panel-row-text">
        <div className="pg-panel-row-title">{title}</div>
        <div className="pg-panel-row-meta">{meta}</div>
      </div>
      <div
        className="pg-panel-dot"
        style={{
          background: color,
          boxShadow: `0 0 0 6px ${color}18`,
        }}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <div className="pg-page">
        <div className="pg-shell">
          <header className="pg-header">
            <div className="pg-brand">
              <div className="pg-logo">PG</div>

              <div className="pg-brand-copy">
                <div className="pg-brand-title">PrimeGate Analytics</div>
                <div className="pg-brand-subtitle">
                  Internal data analysis and organization workspace
                </div>
              </div>
            </div>

            <div className="pg-header-actions">
              <div className="pg-badges">
                <Badge tone="blue">Analytics</Badge>
                <Badge tone="orange">Organization</Badge>
                <Badge tone="green">Management</Badge>
              </div>

              <PrimaryButton href="/login">Login</PrimaryButton>
            </div>
          </header>

          <section className="pg-hero-grid">
            <div className="pg-hero">
              <div className="pg-hero-glow pg-hero-glow-right" />
              <div className="pg-hero-glow pg-hero-glow-left" />

              <div className="pg-pill">Unified internal management</div>

              <h1>
                Organize records, monitor workflows, and review analytics from
                one clean platform.
              </h1>

              <p className="pg-hero-text">
                Built for internal teams that need a clear and structured
                environment for data organization, record review, reporting, and
                operational oversight.
              </p>

              <div className="pg-hero-actions">
                <PrimaryButton href="/login">Access platform</PrimaryButton>
                <SecondaryButton href="#capabilities">
                  Explore modules
                </SecondaryButton>
              </div>

              <div className="pg-insight-grid">
                <InsightCard
                  title="Structured dashboard flow"
                  text="Clear entry points for records, summaries, analytics, and internal outputs."
                  accent="blue"
                />
                <InsightCard
                  title="Better information grouping"
                  text="Key work areas are separated cleanly to improve navigation and understanding."
                  accent="orange"
                />
                <InsightCard
                  title="Focused team visibility"
                  text="The layout supports internal review with less clutter and better visual control."
                  accent="green"
                />
              </div>
            </div>

            <div className="pg-side-column">
              <div className="pg-side-panel">
                <div className="pg-side-panel-top">
                  <div>
                    <div className="pg-side-label">WORKSPACE SNAPSHOT</div>
                    <div className="pg-side-title">Analytics-ready overview</div>
                  </div>
                  <Badge tone="green">Focused</Badge>
                </div>

                <div className="pg-metric-grid">
                  <MetricCard
                    value="Clear"
                    label="Data structure"
                    note="Records and workflows are grouped for easier internal review."
                    accent="blue"
                    icon="↗"
                  />
                  <MetricCard
                    value="Smart"
                    label="Navigation flow"
                    note="The page supports faster movement across key management areas."
                    accent="orange"
                    icon="◆"
                  />
                </div>

                <MetricCard
                  value="1 Hub"
                  label="Unified workspace"
                  note="Analytics, organization, and internal management stay in one system."
                  accent="green"
                  icon="●"
                />
              </div>

              <div className="pg-side-panel">
                <div className="pg-side-label pg-orange">ACTIVE MODULES</div>
                <div className="pg-side-title">Workflow areas</div>
                <p className="pg-side-text">
                  A cleaner landing page for users entering a serious data and
                  organization environment.
                </p>

                <PanelRow
                  title="Operational records"
                  meta="Structured sections for daily records and internal tracking."
                  color={ORANGE}
                />
                <PanelRow
                  title="Analytics and summaries"
                  meta="Better visibility into trends, totals, and organized reporting."
                  color={BLUE}
                />
                <PanelRow
                  title="Documents and outputs"
                  meta="Prepared files and export paths for internal use and review."
                  color={GREEN}
                />
              </div>
            </div>
          </section>

          <section id="capabilities" className="pg-section">
            <div className="pg-section-head">
              <div className="pg-section-chip">CORE SYSTEM AREAS</div>
              <h2>Modern internal platform experience</h2>
              <p>
                The page is focused on analysis, organization, visibility, and
                structured workflow.
              </p>
            </div>

            <div className="pg-modules-grid">
              <ModuleCard
                icon="📈"
                title="Performance visibility"
                text="A more refined entry point for reviewing metrics, summaries, and operational progress across the system."
              />
              <ModuleCard
                icon="🧩"
                title="Organized workflows"
                text="Key work areas are separated cleanly so users can move through records and outputs with less friction."
              />
              <ModuleCard
                icon="🗂️"
                title="Data organization"
                text="The homepage feels more like a real internal system with stronger grouping and cleaner hierarchy."
              />
              <ModuleCard
                icon="⚡"
                title="Faster user entry"
                text="Direct access stays visible while the layout remains modern, clear, and management-focused."
              />
            </div>
          </section>

          <section className="pg-summary-grid">
            <div className="pg-highlight pg-highlight-dark">
              <div className="pg-highlight-label">DESIGN DIRECTION</div>
              <h3>Cleaner, sharper, more analytical.</h3>
              <p>
                This version gives the homepage a more premium management-system
                look with stronger hierarchy and better dashboard feel.
              </p>
            </div>

            <div className="pg-highlight">
              <div className="pg-highlight-label pg-blue">USER EXPERIENCE</div>
              <h3>Less clutter, better focus.</h3>
              <p>
                The page now emphasizes clarity, internal control, and organized
                navigation.
              </p>
            </div>

            <div className="pg-highlight pg-soft">
              <div className="pg-highlight-label pg-orange">ACCESS</div>
              <h3>Direct entry to the platform.</h3>
              <p>
                The call to action stays strong while the layout feels more like
                a true internal management landing page.
              </p>
            </div>
          </section>

          <section className="pg-cta">
            <div className="pg-cta-copy">
              <div className="pg-side-label">READY TO CONTINUE</div>
              <h3>Enter the internal workspace</h3>
              <p>
                Sign in to continue with your records, organized data, and
                internal workflows.
              </p>
            </div>

            <PrimaryButton href="/login">Login</PrimaryButton>
          </section>

          <footer className="pg-footer">
            PrimeGate Analytics · Internal management and analysis platform
          </footer>
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .pg-page {
          min-height: 100vh;
          width: 100%;
          background: ${PAGE_BG};
          color: ${TEXT};
          font-family: Inter, system-ui, sans-serif;
          overflow-x: hidden;
        }

        .pg-shell {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 16px;
        }

        .pg-header,
        .pg-hero,
        .pg-side-panel,
        .pg-section,
        .pg-highlight,
        .pg-cta {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
        }

        .pg-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 18px;
        }

        .pg-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          flex: 1 1 340px;
        }

        .pg-logo {
          width: 52px;
          height: 52px;
          min-width: 52px;
          border-radius: 16px;
          background: linear-gradient(
            135deg,
            #0f172a 0%,
            #2563eb 55%,
            #ff7a00 100%
          );
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 900;
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.15);
        }

        .pg-brand-copy {
          min-width: 0;
        }

        .pg-brand-title {
          font-size: 24px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: ${NAVY};
          word-break: break-word;
        }

        .pg-brand-subtitle {
          margin-top: 4px;
          font-size: 13px;
          line-height: 1.6;
          color: ${MUTED};
        }

        .pg-header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
          flex: 1 1 320px;
        }

        .pg-badges {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .pg-btn-primary,
        .pg-btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 0 22px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 15px;
          font-weight: 700;
          white-space: nowrap;
          transition: transform 0.2s ease, box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .pg-btn-primary {
          border: none;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            ${ORANGE} 0%,
            ${ORANGE_DEEP} 100%
          );
          box-shadow: 0 16px 30px rgba(255, 122, 0, 0.18);
        }

        .pg-btn-secondary {
          border: 1px solid ${BORDER_STRONG};
          background: ${SURFACE};
          color: ${TEXT};
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
        }

        .pg-btn-primary:hover,
        .pg-btn-secondary:hover,
        .pg-card:hover,
        .pg-highlight:hover,
        .pg-side-panel:hover {
          transform: translateY(-4px);
        }

        .pg-btn-primary:hover {
          box-shadow: 0 18px 34px rgba(255, 122, 0, 0.24);
        }

        .pg-btn-secondary:hover {
          border-color: rgba(37, 99, 235, 0.18);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.08);
        }

        .pg-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
          gap: 18px;
          align-items: stretch;
          margin-bottom: 18px;
        }

        .pg-hero {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          padding: 34px 30px 30px;
        }

        .pg-hero-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .pg-hero-glow-right {
          top: -80px;
          right: -50px;
          width: 220px;
          height: 220px;
          background: radial-gradient(
            circle,
            rgba(37, 99, 235, 0.08) 0%,
            rgba(37, 99, 235, 0) 72%
          );
        }

        .pg-hero-glow-left {
          bottom: -90px;
          left: -50px;
          width: 240px;
          height: 240px;
          background: radial-gradient(
            circle,
            rgba(255, 122, 0, 0.08) 0%,
            rgba(255, 122, 0, 0) 72%
          );
        }

        .pg-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
          color: ${BLUE};
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .pg-hero h1 {
          position: relative;
          margin: 18px 0 0;
          max-width: 860px;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1.05;
          font-weight: 900;
          color: ${NAVY};
          letter-spacing: -0.05em;
          word-break: break-word;
        }

        .pg-hero-text {
          position: relative;
          margin: 18px 0 0;
          max-width: 860px;
          font-size: 16px;
          line-height: 1.85;
          color: ${MUTED};
        }

        .pg-hero-actions {
          position: relative;
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 28px;
        }

        .pg-insight-grid {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 30px;
        }

        .pg-card,
        .pg-highlight,
        .pg-side-panel {
          transition: transform 0.22s ease, box-shadow 0.22s ease,
            border-color 0.22s ease;
        }

        .pg-card {
          border: 1px solid ${BORDER};
          border-radius: 24px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
        }

        .pg-insight-card {
          padding: 20px;
        }

        .pg-insight-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 14px;
        }

        .pg-insight-card h3,
        .pg-module-card h3 {
          margin: 0;
          color: ${TEXT};
          font-weight: 800;
          letter-spacing: -0.02em;
          word-break: break-word;
        }

        .pg-insight-card h3 {
          font-size: 16px;
          margin-bottom: 8px;
        }

        .pg-insight-card p,
        .pg-module-card p {
          margin: 0;
          color: ${MUTED};
          line-height: 1.7;
          word-break: break-word;
        }

        .pg-insight-card p {
          font-size: 13px;
        }

        .pg-side-column {
          display: grid;
          gap: 18px;
          min-width: 0;
        }

        .pg-side-panel {
          border-radius: 30px;
          padding: 24px;
        }

        .pg-side-panel-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .pg-side-label {
          font-size: 13px;
          font-weight: 800;
          color: ${BLUE};
          letter-spacing: 0.08em;
        }

        .pg-side-label.pg-orange,
        .pg-orange {
          color: ${ORANGE};
        }

        .pg-side-title {
          margin-top: 6px;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 800;
          color: ${TEXT};
          letter-spacing: -0.02em;
          word-break: break-word;
        }

        .pg-side-text {
          margin: 10px 0 8px;
          font-size: 14px;
          line-height: 1.7;
          color: ${MUTED};
        }

        .pg-metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 14px;
        }

        .pg-metric-card {
          padding: 20px;
        }

        .pg-metric-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 14px;
        }

        .pg-metric-value {
          font-size: 28px;
          line-height: 1.05;
          font-weight: 800;
          color: ${TEXT};
          letter-spacing: -0.03em;
          word-break: break-word;
        }

        .pg-metric-label {
          margin-top: 8px;
          font-size: 14px;
          font-weight: 700;
          color: ${TEXT};
          word-break: break-word;
        }

        .pg-metric-note {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.6;
          color: ${MUTED};
          word-break: break-word;
        }

        .pg-panel-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid ${BORDER};
        }

        .pg-panel-row:last-child {
          border-bottom: none;
        }

        .pg-panel-row-text {
          min-width: 0;
          flex: 1;
        }

        .pg-panel-row-title {
          font-size: 14px;
          font-weight: 700;
          color: ${TEXT};
          margin-bottom: 4px;
          word-break: break-word;
        }

        .pg-panel-row-meta {
          font-size: 12px;
          line-height: 1.5;
          color: ${MUTED};
          word-break: break-word;
        }

        .pg-panel-dot {
          width: 10px;
          height: 10px;
          min-width: 10px;
          border-radius: 50%;
        }

        .pg-section {
          border-radius: 34px;
          padding: 30px 22px;
          margin-bottom: 18px;
        }

        .pg-section-head {
          text-align: center;
          margin-bottom: 28px;
        }

        .pg-section-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255, 122, 0, 0.1);
          color: ${ORANGE};
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 14px;
        }

        .pg-section-head h2 {
          margin: 0;
          font-size: clamp(28px, 4vw, 40px);
          line-height: 1.1;
          font-weight: 900;
          color: ${NAVY};
          letter-spacing: -0.04em;
          word-break: break-word;
        }

        .pg-section-head p {
          margin: 12px auto 0;
          max-width: 820px;
          font-size: 15px;
          line-height: 1.8;
          color: ${MUTED};
        }

        .pg-modules-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 22px;
        }

        .pg-module-card {
          position: relative;
          overflow: hidden;
          padding: 26px;
          border-radius: 28px;
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.06);
        }

        .pg-module-orb {
          position: absolute;
          top: -50px;
          right: -30px;
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.06),
            rgba(255, 122, 0, 0.08)
          );
        }

        .pg-module-icon {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.08),
            rgba(255, 122, 0, 0.1)
          );
          font-size: 26px;
          margin-bottom: 18px;
        }

        .pg-module-card h3 {
          position: relative;
          font-size: 20px;
          line-height: 1.3;
          margin-bottom: 12px;
        }

        .pg-module-card p {
          position: relative;
          font-size: 14px;
          line-height: 1.75;
        }

        .pg-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 18px;
        }

        .pg-highlight {
          border-radius: 30px;
          padding: 28px;
        }

        .pg-highlight-dark {
          background: linear-gradient(
            135deg,
            #0f172a 0%,
            #1e293b 55%,
            #2563eb 100%
          );
          color: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.14);
        }

        .pg-soft {
          background: ${SURFACE_SOFT};
        }

        .pg-highlight-label {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 10px;
        }

        .pg-highlight-label.pg-blue {
          color: ${BLUE};
        }

        .pg-highlight-label.pg-orange {
          color: ${ORANGE};
        }

        .pg-highlight h3 {
          margin: 0;
          font-size: 24px;
          line-height: 1.18;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: ${NAVY};
          word-break: break-word;
        }

        .pg-highlight-dark h3 {
          color: #ffffff;
          font-size: 26px;
          line-height: 1.15;
        }

        .pg-highlight p {
          margin: 12px 0 0;
          font-size: 14px;
          line-height: 1.8;
          color: ${MUTED};
          word-break: break-word;
        }

        .pg-highlight-dark p {
          color: rgba(255, 255, 255, 0.82);
        }

        .pg-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
          border-radius: 34px;
          padding: 32px 24px;
          margin-bottom: 12px;
        }

        .pg-cta-copy {
          min-width: 0;
          flex: 1 1 420px;
        }

        .pg-cta h3 {
          margin: 0;
          font-size: 30px;
          line-height: 1.12;
          font-weight: 900;
          color: ${NAVY};
          letter-spacing: -0.04em;
          word-break: break-word;
        }

        .pg-cta p {
          margin: 10px 0 0;
          max-width: 760px;
          font-size: 15px;
          line-height: 1.8;
          color: ${MUTED};
        }

        .pg-footer {
          padding: 14px 6px 2px;
          color: ${MUTED};
          font-size: 13px;
          text-align: center;
        }

        @media (max-width: 1180px) {
          .pg-hero-grid {
            grid-template-columns: 1fr;
          }

          .pg-modules-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pg-summary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 820px) {
          .pg-shell {
            padding: 12px;
          }

          .pg-header {
            padding: 16px;
            border-radius: 20px;
          }

          .pg-brand {
            flex: 1 1 100%;
          }

          .pg-header-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .pg-hero {
            padding: 24px 18px 20px;
            border-radius: 24px;
          }

          .pg-side-panel,
          .pg-section,
          .pg-highlight,
          .pg-cta {
            border-radius: 24px;
          }

          .pg-side-panel {
            padding: 18px;
          }

          .pg-section {
            padding: 22px 16px;
          }

          .pg-cta {
            padding: 24px 18px;
          }

          .pg-hero h1 {
            font-size: 34px;
            line-height: 1.08;
          }

          .pg-hero-text,
          .pg-section-head p,
          .pg-cta p {
            font-size: 14px;
            line-height: 1.75;
          }

          .pg-insight-grid,
          .pg-metric-grid,
          .pg-modules-grid {
            grid-template-columns: 1fr;
          }

          .pg-side-panel-top {
            align-items: flex-start;
          }

          .pg-cta h3 {
            font-size: 26px;
          }
        }

        @media (max-width: 560px) {
          .pg-shell {
            padding: 10px;
          }

          .pg-header {
            gap: 14px;
            padding: 14px;
          }

          .pg-logo {
            width: 46px;
            height: 46px;
            min-width: 46px;
            font-size: 18px;
          }

          .pg-brand-title {
            font-size: 20px;
          }

          .pg-brand-subtitle {
            font-size: 12px;
          }

          .pg-badges {
            gap: 8px;
          }

          .pg-btn-primary,
          .pg-btn-secondary {
            width: 100%;
            min-height: 46px;
            padding: 0 18px;
          }

          .pg-header-actions {
            gap: 10px;
          }

          .pg-hero h1 {
            font-size: 28px;
          }

          .pg-pill,
          .pg-section-chip,
          .pg-side-label {
            font-size: 12px;
          }

          .pg-side-title {
            font-size: 18px;
          }

          .pg-highlight h3,
          .pg-highlight-dark h3,
          .pg-cta h3 {
            font-size: 22px;
            line-height: 1.18;
          }

          .pg-metric-value {
            font-size: 24px;
          }

          .pg-module-card,
          .pg-highlight,
          .pg-insight-card,
          .pg-metric-card {
            padding: 18px;
          }

          .pg-module-card h3 {
            font-size: 18px;
          }

          .pg-panel-row {
            align-items: flex-start;
          }
        }
      `}</style>
    </>
  );
}