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
const ORANGE = "#ff7a00";
const GREEN = "#15803d";
const PURPLE = "#8b5cf6";

// All modules with unique emoji icons (no meat for slaughter)
const MODULES = [
  {
    title: "Orders",
    href: "/orders",
    description: "View and manage order records, statuses, and activity.",
    accent: BLUE,
    icon: "📋",
  },
  {
    title: "Reports",
    href: "/reports",
    description: "Open reporting pages and review operational summaries.",
    accent: GREEN,
    icon: "📊",
  },
  {
    title: "Inventory",
    href: "/inventory",
    description: "Manage inventory entries, daily sheets, and stock reports.",
    accent: ORANGE,
    icon: "📦",
  },
  {
    title: "Audit",
    href: "/audit",
    description: "Generate, review, and export weekly or monthly audit records.",
    accent: PURPLE,
    icon: "🔍",
  },
  {
    title: "Breakeven",
    href: "/breakeven",
    description: "Review live breakeven summary, downloads, and monthly settings.",
    accent: GREEN,
    icon: "⚖️",
  },
  {
    title: "Slaughter Services",
    href: "/saas",
    description: "Manage slaughter service records, summaries, and exports.",
    accent: ORANGE,
    icon: "🏭", // Factory emoji – no meat
  },
];

const QUICK_LINKS = [
  { title: "Daily Inventory Sheet", href: "/inventory/daily", accent: BLUE, icon: "📅" },
  { title: "New Entry / Setup", href: "/inventory/new", accent: GREEN, icon: "➕" },
];

function ModuleCard({ title, href, description, accent, icon }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          background: CARD_BG,
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          cursor: "pointer",
          transition: "all 0.25s ease",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = "0 20px 25px -12px rgba(0, 0, 0, 0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.02)";
        }}
      >
        <div>
          <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: accent,
              marginBottom: 16,
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED }}>{description}</div>
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 13,
            fontWeight: 600,
            color: accent,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>Open</span>
          <span>→</span>
        </div>
      </div>
    </Link>
  );
}

function QuickLinkCard({ title, href, accent, icon }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = accent;
          e.currentTarget.style.backgroundColor = `${accent}08`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = BORDER;
          e.currentTarget.style.backgroundColor = CARD_BG;
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontWeight: 600, color: TEXT, fontSize: 14 }}>{title}</span>
        </div>
        <span style={{ color: accent, fontSize: 14 }}>→</span>
      </div>
    </Link>
  );
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
              maxWidth: 400,
              background: CARD_BG,
              borderRadius: 24,
              padding: 32,
              textAlign: "center",
              border: `1px solid ${BORDER}`,
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
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
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
          body {
            margin: 0;
            background: #f8fafc;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      {/* No extra logout button – layout's sidebar already has a text "Logout" button */}
      <DashboardLayout title="Dashboard" subtitle="Welcome back. Choose a module to continue.">
        <div
          style={{
            background: PAGE_BG,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: TEXT,
          }}
        >
          <div style={{ maxWidth: 1320, margin: "0 auto" }}>
            {/* Main modules grid */}
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
                  <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Core modules</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    Access your most important operational tools
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 20,
                }}
              >
                {MODULES.map((item) => (
                  <ModuleCard
                    key={item.href}
                    title={item.title}
                    href={item.href}
                    description={item.description}
                    accent={item.accent}
                    icon={item.icon}
                  />
                ))}
              </div>
            </div>

            {/* Quick actions section */}
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
                  <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Quick actions</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    Daily inventory sheet & new entry forms
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {QUICK_LINKS.map((link) => (
                  <QuickLinkCard
                    key={link.href}
                    title={link.title}
                    href={link.href}
                    accent={link.accent}
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