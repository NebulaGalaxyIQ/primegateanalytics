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

function primaryButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 50,
    padding: "0 26px",
    borderRadius: 999,
    border: "none",
    background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_DEEP} 100%)`,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "Inter, system-ui, sans-serif",
    textDecoration: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 16px 30px rgba(255,122,0,0.18)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    cursor: "pointer",
  };
}

function secondaryButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 50,
    padding: "0 24px",
    borderRadius: 999,
    border: `1px solid ${BORDER_STRONG}`,
    background: SURFACE,
    color: TEXT,
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "Inter, system-ui, sans-serif",
    textDecoration: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 8px 18px rgba(15,23,42,0.05)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    cursor: "pointer",
  };
}

function interactiveCardBase() {
  return {
    transition:
      "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease",
    cursor: "pointer",
  };
}

function handleCardEnter(e) {
  e.currentTarget.style.transform = "translateY(-6px)";
  e.currentTarget.style.boxShadow = "0 22px 42px rgba(15,23,42,0.10)";
  e.currentTarget.style.borderColor = "rgba(37,99,235,0.16)";
}

function handleCardLeave(e, shadow = "0 14px 30px rgba(15,23,42,0.05)") {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = shadow;
  e.currentTarget.style.borderColor = BORDER;
}

function topPillStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.08)",
    color: BLUE,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.01em",
  };
}

function MetricCard({ label, value, note, accent = "orange", icon = "•" }) {
  const accentColor = accent === "blue" ? BLUE : accent === "green" ? GREEN : ORANGE;

  return (
    <div
      style={{
        ...interactiveCardBase(),
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
      }}
      onMouseEnter={handleCardEnter}
      onMouseLeave={(e) => handleCardLeave(e)}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: 12,
          background: `${accentColor}12`,
          color: accentColor,
          fontSize: 16,
          fontWeight: 800,
          marginBottom: 14,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 800,
          color: TEXT,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 14,
          fontWeight: 700,
          color: TEXT,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          lineHeight: 1.6,
          color: MUTED,
        }}
      >
        {note}
      </div>
    </div>
  );
}

function ModuleCard({ icon, title, text }) {
  return (
    <div
      style={{
        ...interactiveCardBase(),
        position: "relative",
        overflow: "hidden",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 28,
        padding: 26,
        boxShadow: "0 16px 34px rgba(15,23,42,0.06)",
      }}
      onMouseEnter={handleCardEnter}
      onMouseLeave={(e) => handleCardLeave(e, "0 16px 34px rgba(15,23,42,0.06)")}
    >
      <div
        style={{
          position: "absolute",
          top: -50,
          right: -30,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(255,122,0,0.08))",
        }}
      />

      <div
        style={{
          position: "relative",
          width: 56,
          height: 56,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,122,0,0.10))",
          fontSize: 26,
          marginBottom: 18,
        }}
      >
        {icon}
      </div>

      <h3
        style={{
          position: "relative",
          margin: 0,
          fontSize: 20,
          lineHeight: 1.3,
          fontWeight: 800,
          color: TEXT,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          position: "relative",
          margin: "12px 0 0",
          fontSize: 14,
          lineHeight: 1.75,
          color: MUTED,
        }}
      >
        {text}
      </p>
    </div>
  );
}

function PanelRow({ title, meta, color }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "14px 0",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: TEXT,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.5,
          }}
        >
          {meta}
        </div>
      </div>

      <div
        style={{
          minWidth: 10,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 0 6px ${color}18`,
        }}
      />
    </div>
  );
}

function SmallBadge({ children, tone = "default" }) {
  let bg = "rgba(15,23,42,0.06)";
  let color = TEXT;

  if (tone === "blue") {
    bg = "rgba(37,99,235,0.10)";
    color = BLUE;
  } else if (tone === "orange") {
    bg = "rgba(255,122,0,0.12)";
    color = ORANGE;
  } else if (tone === "green") {
    bg = "rgba(22,163,74,0.12)";
    color = GREEN;
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 12px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function InsightCard({ title, text, accent = "blue" }) {
  const accentColor = accent === "orange" ? ORANGE : accent === "green" ? GREEN : BLUE;

  return (
    <div
      style={{
        ...interactiveCardBase(),
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
      }}
      onMouseEnter={handleCardEnter}
      onMouseLeave={(e) => handleCardLeave(e)}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: `${accentColor}12`,
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accentColor,
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        ●
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: TEXT,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: MUTED,
        }}
      >
        {text}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: PAGE_BG,
        color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: 0,
          padding: "14px 16px 34px",
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            marginBottom: 18,
            padding: "14px 16px",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 22,
            boxShadow: "0 8px 22px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #0f172a 0%, #2563eb 55%, #ff7a00 100%)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 900,
                  boxShadow: "0 12px 24px rgba(37,99,235,0.15)",
                }}
              >
                PG
              </div>

              <div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: NAVY,
                    letterSpacing: "-0.03em",
                  }}
                >
                  PrimeGate Analytics
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 13,
                    color: MUTED,
                    fontWeight: 500,
                  }}
                >
                  Internal data analysis and organization workspace
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <SmallBadge tone="blue">Analytics</SmallBadge>
              <SmallBadge tone="orange">Organization</SmallBadge>
              <SmallBadge tone="green">Management</SmallBadge>

              <Link
                href="/login"
                style={primaryButtonStyle()}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 18px 34px rgba(255,122,0,0.24)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 16px 30px rgba(255,122,0,0.18)";
                }}
              >
                Login
              </Link>
            </div>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.28fr) minmax(320px, 0.92fr)",
            gap: 18,
            alignItems: "stretch",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 34,
              padding: "34px 30px 30px",
              boxShadow: "0 18px 40px rgba(15,23,42,0.05)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -80,
                right: -50,
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0) 72%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -90,
                left: -50,
                width: 240,
                height: 240,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,122,0,0.08) 0%, rgba(255,122,0,0) 72%)",
              }}
            />

            <div style={{ position: "relative" }}>
              <div style={topPillStyle()}>Unified internal management</div>

              <h1
                style={{
                  margin: "18px 0 0",
                  maxWidth: 860,
                  fontSize: "clamp(34px, 4.9vw, 58px)",
                  lineHeight: 1.05,
                  fontWeight: 900,
                  color: NAVY,
                  letterSpacing: "-0.05em",
                }}
              >
                Organize records, monitor workflows, and review analytics from one clean platform.
              </h1>

              <p
                style={{
                  margin: "18px 0 0",
                  maxWidth: 860,
                  fontSize: 16,
                  lineHeight: 1.85,
                  color: MUTED,
                }}
              >
                Built for internal teams that need a clear and structured environment for data
                organization, record review, reporting, and operational oversight.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  marginTop: 28,
                }}
              >
                <Link
                  href="/login"
                  style={primaryButtonStyle()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 18px 34px rgba(255,122,0,0.24)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 16px 30px rgba(255,122,0,0.18)";
                  }}
                >
                  Access platform
                </Link>

                <a
                  href="#capabilities"
                  style={secondaryButtonStyle()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 14px 26px rgba(15,23,42,0.08)";
                    e.currentTarget.style.borderColor = "rgba(37,99,235,0.18)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 8px 18px rgba(15,23,42,0.05)";
                    e.currentTarget.style.borderColor = BORDER_STRONG;
                  }}
                >
                  Explore modules
                </a>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  marginTop: 30,
                }}
              >
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
          </div>

          <div
            style={{
              display: "grid",
              gap: 18,
            }}
          >
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 30,
                padding: 24,
                boxShadow: "0 18px 40px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: BLUE,
                      letterSpacing: "0.08em",
                    }}
                  >
                    WORKSPACE SNAPSHOT
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 20,
                      fontWeight: 800,
                      color: TEXT,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Analytics-ready overview
                  </div>
                </div>

                <SmallBadge tone="green">Focused</SmallBadge>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
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

            <div
              style={{
                ...interactiveCardBase(),
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 30,
                padding: 24,
                boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
              }}
              onMouseEnter={handleCardEnter}
              onMouseLeave={(e) => handleCardLeave(e, "0 16px 34px rgba(15,23,42,0.05)")}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: ORANGE,
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                ACTIVE MODULES
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: TEXT,
                  letterSpacing: "-0.02em",
                  marginBottom: 10,
                }}
              >
                Workflow areas
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: MUTED,
                  marginBottom: 8,
                }}
              >
                A cleaner landing page for users entering a serious data and organization
                environment.
              </div>

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

        <section
          id="capabilities"
          style={{
            marginBottom: 18,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 34,
            padding: "30px 22px",
            boxShadow: "0 16px 36px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(255,122,0,0.10)",
                color: ORANGE,
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              CORE SYSTEM AREAS
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.1,
                fontWeight: 900,
                color: NAVY,
                letterSpacing: "-0.04em",
              }}
            >
              Modern internal platform experience
            </h2>

            <p
              style={{
                margin: "12px auto 0",
                maxWidth: 820,
                fontSize: 15,
                lineHeight: 1.8,
                color: MUTED,
              }}
            >
              The page is focused on analysis, organization, visibility, and structured workflow.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 22,
            }}
          >
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

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 18,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              ...interactiveCardBase(),
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #2563eb 100%)",
              color: "#ffffff",
              borderRadius: 30,
              padding: 28,
              boxShadow: "0 20px 40px rgba(15,23,42,0.14)",
              border: "1px solid rgba(15,23,42,0.06)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px)";
              e.currentTarget.style.boxShadow = "0 26px 48px rgba(15,23,42,0.18)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 20px 40px rgba(15,23,42,0.14)";
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.70)",
                marginBottom: 10,
              }}
            >
              DESIGN DIRECTION
            </div>
            <div
              style={{
                fontSize: 26,
                lineHeight: 1.15,
                fontWeight: 900,
                letterSpacing: "-0.03em",
              }}
            >
              Cleaner, sharper, more analytical.
            </div>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 14,
                lineHeight: 1.8,
                color: "rgba(255,255,255,0.82)",
              }}
            >
              This version gives the homepage a more premium management-system look with stronger
              hierarchy and better dashboard feel.
            </p>
          </div>

          <div
            style={{
              ...interactiveCardBase(),
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 30,
              padding: 28,
              boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
            }}
            onMouseEnter={handleCardEnter}
            onMouseLeave={(e) => handleCardLeave(e, "0 16px 34px rgba(15,23,42,0.05)")}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: BLUE,
                marginBottom: 10,
              }}
            >
              USER EXPERIENCE
            </div>
            <div
              style={{
                fontSize: 24,
                lineHeight: 1.18,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: NAVY,
              }}
            >
              Less clutter, better focus.
            </div>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 14,
                lineHeight: 1.8,
                color: MUTED,
              }}
            >
              The page now emphasizes clarity, internal control, and organized navigation.
            </p>
          </div>

          <div
            style={{
              ...interactiveCardBase(),
              background: SURFACE_SOFT,
              border: `1px solid ${BORDER}`,
              borderRadius: 30,
              padding: 28,
              boxShadow: "0 16px 34px rgba(15,23,42,0.04)",
            }}
            onMouseEnter={handleCardEnter}
            onMouseLeave={(e) => handleCardLeave(e, "0 16px 34px rgba(15,23,42,0.04)")}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: ORANGE,
                marginBottom: 10,
              }}
            >
              ACCESS
            </div>
            <div
              style={{
                fontSize: 24,
                lineHeight: 1.18,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: NAVY,
              }}
            >
              Direct entry to the platform.
            </div>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 14,
                lineHeight: 1.8,
                color: MUTED,
              }}
            >
              The call to action stays strong while the layout feels more like a true internal
              management landing page.
            </p>
          </div>
        </section>

        <section
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 34,
            padding: "32px 24px",
            boxShadow: "0 16px 36px rgba(15,23,42,0.04)",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: BLUE,
                  marginBottom: 8,
                }}
              >
                READY TO CONTINUE
              </div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 30,
                  lineHeight: 1.12,
                  fontWeight: 900,
                  color: NAVY,
                  letterSpacing: "-0.04em",
                }}
              >
                Enter the internal workspace
              </h3>
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: MUTED,
                  maxWidth: 760,
                }}
              >
                Sign in to continue with your records, organized data, and internal workflows.
              </p>
            </div>

            <Link
              href="/login"
              style={primaryButtonStyle()}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 18px 34px rgba(255,122,0,0.24)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 16px 30px rgba(255,122,0,0.18)";
              }}
            >
              Login
            </Link>
          </div>
        </section>

        <footer
          style={{
            padding: "14px 6px 2px",
            color: MUTED,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          PrimeGate Analytics · Internal management and analysis platform
        </footer>
      </div>
    </div>
  );
}