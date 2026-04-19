import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import authService from "../../services/auth";
import DashboardLayout from "../../components/layouts/DashboardLayout";

const PAGE_BG = "#f8fafc";
const CARD_BG = "#ffffff";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const SOFT = "#f1f5f9";
const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37,99,235,0.10)";
const ORANGE = "#ff7a00";
const ORANGE_SOFT = "rgba(255,122,0,0.12)";
const GREEN = "#15803d";
const GREEN_SOFT = "rgba(21,128,61,0.10)";
const PURPLE = "#8b5cf6";
const PURPLE_SOFT = "rgba(139,92,246,0.10)";
const RED = "#dc2626";
const RED_SOFT = "rgba(220,38,38,0.10)";
const SHADOW = "0 10px 24px rgba(15, 23, 42, 0.06)";
const SHADOW_HOVER = "0 18px 36px rgba(15, 23, 42, 0.10)";

const MODULES = [
  {
    title: "Orders",
    href: "/orders",
    description: "View and manage order records, statuses, and activity.",
    accent: BLUE,
    accentSoft: BLUE_SOFT,
    icon: "📋",
    tag: "Operations",
  },
  {
    title: "Order Reports",
    href: "/reports",
    description: "Open reporting pages and review operational summaries.",
    accent: GREEN,
    accentSoft: GREEN_SOFT,
    icon: "📊",
    tag: "Analysis",
  },
  {
    title: "Inventory",
    href: "/inventory",
    description: "Manage inventory entries, daily sheets, and stock reports.",
    accent: ORANGE,
    accentSoft: ORANGE_SOFT,
    icon: "📦",
    tag: "Stock",
  },
  {
    title: "Audit",
    href: "/audit",
    description: "Generate, review, and export weekly or monthly audit records.",
    accent: PURPLE,
    accentSoft: PURPLE_SOFT,
    icon: "🔍",
    tag: "Compliance",
  },
  {
    title: "Byproducts",
    href: "/byproducts",
    description: "Manage byproducts customers, sales, reports, and templates.",
    accent: RED,
    accentSoft: RED_SOFT,
    icon: "🧾",
    tag: "Sales",
  },
  {
    title: "Breakeven",
    href: "/breakeven",
    description: "Review live breakeven summary, downloads, and monthly settings.",
    accent: GREEN,
    accentSoft: GREEN_SOFT,
    icon: "⚖️",
    tag: "Finance",
  },
  {
    title: "Slaughter Services",
    href: "/saas",
    description: "Manage slaughter service records, summaries, and exports.",
    accent: ORANGE,
    accentSoft: ORANGE_SOFT,
    icon: "🏭",
    tag: "Services",
  },
];

const QUICK_LINKS = [
  {
    title: "Daily Inventory Sheet",
    href: "/inventory/daily",
    accent: BLUE,
    accentSoft: BLUE_SOFT,
    icon: "📅",
  },
  {
    title: "New Inventory Entry",
    href: "/inventory/new",
    accent: GREEN,
    accentSoft: GREEN_SOFT,
    icon: "➕",
  },
  {
    title: "Byproducts Sales",
    href: "/byproducts/sales",
    accent: RED,
    accentSoft: RED_SOFT,
    icon: "💰",
  },
  {
    title: "Byproducts Reports",
    href: "/byproducts/reports",
    accent: PURPLE,
    accentSoft: PURPLE_SOFT,
    icon: "🧮",
  },
];

const OVERVIEW_CARDS = [
  {
    title: "Core modules",
    value: MODULES.length,
    color: ORANGE,
    note: "Operations and reporting tools",
  },
  {
    title: "Quick actions",
    value: QUICK_LINKS.length,
    color: BLUE,
    note: "Fast links for daily work",
  },
  {
    title: "Inventory & byproducts",
    value: 2,
    color: GREEN,
    note: "Stock and secondary sales flow",
  },
];

function ModuleCard({ title, href, description, accent, accentSoft, icon, tag }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 22,
          background: CARD_BG,
          padding: "22px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 220,
          cursor: "pointer",
          transition: "all 0.22s ease",
          boxShadow: SHADOW,
          height: "100%",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = SHADOW_HOVER;
          e.currentTarget.style.borderColor = `${accent}55`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = SHADOW;
          e.currentTarget.style.borderColor = BORDER;
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 36, lineHeight: 1 }}>{icon}</div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 28,
                padding: "0 10px",
                borderRadius: 999,
                background: accentSoft,
                color: accent,
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {tag}
            </div>
          </div>

          <div
            style={{
              width: 42,
              height: 4,
              borderRadius: 999,
              background: accent,
              marginBottom: 16,
            }}
          />

          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: TEXT,
              marginBottom: 8,
              lineHeight: 1.35,
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
            {description}
          </div>
        </div>

        <div
          style={{
            marginTop: 22,
            fontSize: 13,
            fontWeight: 700,
            color: accent,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>Open module</span>
          <span>→</span>
        </div>
      </div>
    </Link>
  );
}

function QuickLinkCard({ title, href, accent, accentSoft, icon }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          transition: "all 0.2s ease",
          boxShadow: "0 2px 10px rgba(15, 23, 42, 0.03)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${accent}55`;
          e.currentTarget.style.backgroundColor = accentSoft;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = BORDER;
          e.currentTarget.style.backgroundColor = CARD_BG;
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
          <span
            style={{
              fontWeight: 600,
              color: TEXT,
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            {title}
          </span>
        </div>
        <span style={{ color: accent, fontSize: 15, fontWeight: 700 }}>→</span>
      </div>
    </Link>
  );
}

function OverviewCard({ title, value, color, note }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: "18px 18px",
        boxShadow: "0 2px 10px rgba(15, 23, 42, 0.03)",
      }}
    >
      <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>{title}</div>
      <div
        style={{
          color,
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1.1,
          marginTop: 8,
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: MUTED,
          fontSize: 12,
          lineHeight: 1.6,
          marginTop: 8,
        }}
      >
        {note}
      </div>
    </div>
  );
}

function WelcomeBanner() {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 24,
        padding: "24px 22px",
        boxShadow: SHADOW,
        marginBottom: 28,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 30,
              padding: "0 12px",
              borderRadius: 999,
              background: ORANGE_SOFT,
              color: ORANGE,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            Workspace overview
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1.2,
              color: TEXT,
              marginBottom: 10,
              letterSpacing: "-0.02em",
            }}
          >
            Manage orders, inventory, audits, and byproducts from one place.
          </div>

          <div
            style={{
              fontSize: 14,
              color: MUTED,
              lineHeight: 1.8,
              maxWidth: 760,
            }}
          >
            Open the module you need, move quickly through daily work, and jump into
            byproducts sales and reports directly from the dashboard.
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            background: SOFT,
            padding: "18px 16px",
            display: "grid",
            alignContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: TEXT,
            }}
          >
            Today’s focus
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            <div style={miniBulletStyle()}>
              <span style={miniDotStyle(ORANGE)} />
              <span>Track inventory and daily production flow</span>
            </div>
            <div style={miniBulletStyle()}>
              <span style={miniDotStyle(BLUE)} />
              <span>Review orders and operational reports</span>
            </div>
            <div style={miniBulletStyle()}>
              <span style={miniDotStyle(RED)} />
              <span>Manage byproducts sales, customers, and templates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function miniBulletStyle() {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 13,
    color: TEXT,
    lineHeight: 1.6,
  };
}

function miniDotStyle(color) {
  return {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: color,
    marginTop: 6,
    flexShrink: 0,
  };
}

export default function DashboardIndexPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const pageTitle = useMemo(() => "Dashboard | PGA", []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const authenticated = authService?.isAuthenticated?.();
      if (!authenticated) {
        router.replace("/login?next=/dashboard");
        return;
      }
    } catch (_) {
      try {
        authService?.clearAuth?.();
      } catch {}
      router.replace("/login?next=/dashboard");
      return;
    }

    setIsCheckingAuth(false);
  }, [router]);

  if (isCheckingAuth) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
        </Head>

        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: PAGE_BG,
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: CARD_BG,
              borderRadius: 24,
              padding: 32,
              textAlign: "center",
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: `3px solid ${SOFT}`,
                borderTopColor: ORANGE,
                margin: "0 auto 20px",
                animation: "spin 0.9s linear infinite",
              }}
            />
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: TEXT }}>
              Loading dashboard
            </div>
            <div style={{ fontSize: 14, color: MUTED }}>Verifying your session...</div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          html,
          body,
          #__next {
            min-height: 100%;
            margin: 0;
            padding: 0;
            background: #f8fafc;
            font-family: system-ui, -apple-system, sans-serif;
          }
          * {
            box-sizing: border-box;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
      </Head>

      <DashboardLayout
        title="Dashboard"
        subtitle="Welcome back. Choose a module to continue."
      >
        <div
          style={{
            background: PAGE_BG,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: TEXT,
          }}
        >
          <div style={{ maxWidth: 1360, margin: "0 auto" }}>
            <WelcomeBanner />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                marginBottom: 28,
              }}
            >
              {OVERVIEW_CARDS.map((item) => (
                <OverviewCard
                  key={item.title}
                  title={item.title}
                  value={item.value}
                  color={item.color}
                  note={item.note}
                />
              ))}
            </div>

            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 18,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>
                    Core modules
                  </div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    Access your main operational and reporting tools
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 18,
                }}
              >
                {MODULES.map((item) => (
                  <ModuleCard
                    key={item.href}
                    title={item.title}
                    href={item.href}
                    description={item.description}
                    accent={item.accent}
                    accentSoft={item.accentSoft}
                    icon={item.icon}
                    tag={item.tag}
                  />
                ))}
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 18,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>
                    Quick actions
                  </div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    Jump into daily inventory and byproducts tasks
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                {QUICK_LINKS.map((link) => (
                  <QuickLinkCard
                    key={link.href}
                    title={link.title}
                    href={link.href}
                    accent={link.accent}
                    accentSoft={link.accentSoft}
                    icon={link.icon}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>

      <style jsx global>{`
        html,
        body,
        #__next {
          min-height: 100%;
          margin: 0;
          padding: 0;
          background: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
        }
        * {
          box-sizing: border-box;
        }
      `}</style>
    </>
  );
}