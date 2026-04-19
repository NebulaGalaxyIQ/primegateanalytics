import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import authService from "../../services/auth";

const PAGE_BG = "#f8fafc";
const SURFACE = "#ffffff";
const BORDER = "#e2e8f0";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const ORANGE = "#ff7a00";
const ORANGE_SOFT = "rgba(255,122,0,0.12)";
const BLUE = "#2563eb";
const RED = "#b91c1c";
const RED_SOFT = "rgba(185,28,28,0.08)";
const SHADOW =
  "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)";
const SHADOW_HOVER = "0 20px 30px -12px rgba(0, 0, 0, 0.1)";

function MenuIcon({ open }) {
  return (
    <span
      style={{
        display: "inline-flex",
        width: 20,
        height: 20,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: open ? 9 : 3,
          height: 2,
          background: TEXT,
          borderRadius: 999,
          transform: open ? "rotate(45deg)" : "none",
          transition: "all 0.2s ease",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 9,
          height: 2,
          background: TEXT,
          borderRadius: 999,
          opacity: open ? 0 : 1,
          transition: "all 0.2s ease",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: open ? 9 : 15,
          height: 2,
          background: TEXT,
          borderRadius: 999,
          transform: open ? "rotate(-45deg)" : "none",
          transition: "all 0.2s ease",
        }}
      />
    </span>
  );
}

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="10" width="8" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 17.5h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 20V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 20V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SaaSIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7 7v10.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5V7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BreakevenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7 16l3-4 3 2 4-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 8h2v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4 12.5 12 17l8-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 16.5 12 21l8-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 4h8l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ByproductsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 8.5 12 5l6 3.5v7L12 19l-6-3.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 11.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 14.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 17l5-5-5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 12H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DashboardLink({ href, label, icon, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 46,
        padding: "10px 14px",
        borderRadius: 14,
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: active ? ORANGE : TEXT,
        background: active ? ORANGE_SOFT : "transparent",
        border: `1px solid ${active ? "rgba(255,122,0,0.25)" : "transparent"}`,
        transition: "all 0.2s ease",
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          color: active ? ORANGE : MUTED,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

function LogoutButton({ compact = false, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        minHeight: 44,
        width: compact ? 44 : "100%",
        padding: compact ? "0" : "10px 14px",
        borderRadius: 14,
        border: `1px solid rgba(185,28,28,0.2)`,
        background: RED_SOFT,
        color: RED,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "system-ui, -apple-system, sans-serif",
        opacity: disabled ? 0.7 : 1,
        transition: "all 0.2s ease",
      }}
      aria-label="Logout"
      title="Logout"
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          flexShrink: 0,
        }}
      >
        <LogoutIcon />
      </span>
      {!compact ? <span>{disabled ? "Logging out..." : "Logout"}</span> : null}
    </button>
  );
}

function getPageMeta(pathname) {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return {
      title: "Dashboard",
      subtitle: "Open operational modules and move across management pages.",
    };
  }

  if (pathname === "/orders" || pathname.startsWith("/orders/")) {
    return {
      title: "Orders",
      subtitle: "Manage and review order activity.",
    };
  }

  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return {
      title: "Order Reports",
      subtitle: "Review reports, exports, and operational summaries.",
    };
  }

  if (pathname === "/breakeven" || pathname.startsWith("/breakeven/")) {
    return {
      title: "Breakeven",
      subtitle: "Review live breakeven summary, downloads, and monthly settings.",
    };
  }

  if (pathname === "/saas" || pathname.startsWith("/saas/")) {
    return {
      title: "Slaughter Services",
      subtitle: "Manage slaughter service records and reports.",
    };
  }

  if (pathname === "/inventory" || pathname.startsWith("/inventory/")) {
    return {
      title: "Inventory",
      subtitle: "Manage inventory entries, daily sheets, and stock reports.",
    };
  }

  if (pathname === "/audit" || pathname.startsWith("/audit/")) {
    return {
      title: "Audit",
      subtitle: "Generate, review, and export weekly or monthly audit records.",
    };
  }

  if (pathname === "/byproducts" || pathname.startsWith("/byproducts/")) {
    return {
      title: "Byproducts",
      subtitle: "Manage byproducts sales, customers, reports, templates, and summaries.",
    };
  }

  return {
    title: "Dashboard",
    subtitle: "Manage operational records and reports.",
  };
}

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return "U";
  const parts = String(nameOrEmail).trim().split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return String(nameOrEmail).slice(0, 2).toUpperCase();
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  actions = null,
  contentStyle = {},
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const pageMeta = useMemo(() => getPageMeta(router.pathname), [router.pathname]);
  const pageTitle = title || pageMeta.title;
  const pageSubtitle = subtitle || pageMeta.subtitle;

  useEffect(() => {
    let mounted = true;

    async function fetchUser() {
      try {
        setUserLoading(true);
        const currentUser = await authService.getCurrentUser?.();
        if (mounted) {
          setUser(currentUser || null);
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setUserLoading(false);
        }
      }
    }

    fetchUser();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => setIsMobile(window.innerWidth < 992);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [router.asPath]);

  async function handleLogout() {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);

      try {
        await authService?.logout?.();
      } catch (_) {}

      try {
        authService?.clearAuth?.();
      } catch (_) {}

      await router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <DashboardIcon />,
      active: router.pathname === "/dashboard" || router.pathname.startsWith("/dashboard/"),
    },
    {
      href: "/orders",
      label: "Orders",
      icon: <OrdersIcon />,
      active: router.pathname === "/orders" || router.pathname.startsWith("/orders/"),
    },
    {
      href: "/reports",
      label: "Order Reports",
      icon: <ReportsIcon />,
      active: router.pathname === "/reports" || router.pathname.startsWith("/reports/"),
    },
    {
      href: "/inventory",
      label: "Inventory",
      icon: <InventoryIcon />,
      active: router.pathname === "/inventory" || router.pathname.startsWith("/inventory/"),
    },
    {
      href: "/audit",
      label: "Audit",
      icon: <AuditIcon />,
      active: router.pathname === "/audit" || router.pathname.startsWith("/audit/"),
    },
    {
      href: "/byproducts",
      label: "Byproducts",
      icon: <ByproductsIcon />,
      active: router.pathname === "/byproducts" || router.pathname.startsWith("/byproducts/"),
    },
    {
      href: "/breakeven",
      label: "Breakeven",
      icon: <BreakevenIcon />,
      active: router.pathname === "/breakeven" || router.pathname.startsWith("/breakeven/"),
    },
    {
      href: "/saas",
      label: "Slaughter Services",
      icon: <SaaSIcon />,
      active: router.pathname === "/saas" || router.pathname.startsWith("/saas/"),
    },
  ];

  const displayName = user?.name || user?.full_name || user?.email || "User";
  const userInitials = getInitials(displayName);
  const userEmail = user?.email || "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAGE_BG,
        color: TEXT,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "280px minmax(0, 1fr)",
          minHeight: "100vh",
        }}
      >
        {!isMobile && (
          <aside
            style={{
              position: "sticky",
              top: 0,
              height: "100vh",
              background: SURFACE,
              borderRight: `1px solid ${BORDER}`,
              padding: "24px 20px",
              boxSizing: "border-box",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              <div
                style={{
                  borderBottom: `1px solid ${BORDER}`,
                  paddingBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    background: `linear-gradient(135deg, ${ORANGE} 0%, #e65c00 100%)`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    marginBottom: 6,
                  }}
                >
                  PG Analytics IQ
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: MUTED,
                    fontWeight: 500,
                  }}
                >
                  Analytics Workspace
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: MUTED,
                    marginBottom: 12,
                    paddingLeft: 12,
                  }}
                >
                  Main
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  {navItems.map((item) => (
                    <DashboardLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={item.active}
                    />
                  ))}
                </div>
              </div>

              <div
                style={{
                  borderTop: `1px solid ${BORDER}`,
                  paddingTop: 20,
                  marginTop: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                    background: "#f1f5f9",
                    borderRadius: 16,
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 40,
                      background: ORANGE_SOFT,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 16,
                      color: ORANGE,
                    }}
                  >
                    {userLoading ? "?" : userInitials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: TEXT,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userLoading ? "Loading..." : displayName}
                    </div>

                    {userEmail ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: MUTED,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {userEmail}
                      </div>
                    ) : null}
                  </div>
                </div>

                <LogoutButton onClick={handleLogout} disabled={isLoggingOut} />
              </div>
            </div>
          </aside>
        )}

        <div style={{ minWidth: 0, background: PAGE_BG }}>
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              background: "rgba(248, 250, 252, 0.9)",
              backdropFilter: "blur(12px)",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 1600,
                margin: "0 auto",
                padding: "16px 24px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  minWidth: 0,
                }}
              >
                {isMobile ? (
                  <button
                    type="button"
                    onClick={() => setMobileOpen((prev) => !prev)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: `1px solid ${BORDER}`,
                      background: SURFACE,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    aria-label="Toggle menu"
                  >
                    <MenuIcon open={mobileOpen} />
                  </button>
                ) : null}

                <div style={{ minWidth: 0 }}>
                  <h1
                    style={{
                      fontSize: "1.75rem",
                      lineHeight: 1.2,
                      fontWeight: 700,
                      color: TEXT,
                      margin: 0,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {pageTitle}
                  </h1>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 14,
                      color: MUTED,
                      lineHeight: 1.5,
                    }}
                  >
                    {pageSubtitle}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {actions}

                {!isMobile ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: SURFACE,
                      borderRadius: 40,
                      border: `1px solid ${BORDER}`,
                      padding: "4px 4px 4px 12px",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 32,
                        background: ORANGE_SOFT,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: 13,
                        color: ORANGE,
                      }}
                    >
                      {userLoading ? "?" : userInitials}
                    </div>

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: TEXT,
                        maxWidth: 150,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userLoading ? "Loading..." : displayName}
                    </span>

                    <LogoutButton compact onClick={handleLogout} disabled={isLoggingOut} />
                  </div>
                ) : (
                  <LogoutButton compact onClick={handleLogout} disabled={isLoggingOut} />
                )}
              </div>
            </div>
          </header>

          {isMobile && mobileOpen ? (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 40,
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(4px)",
              }}
              onClick={() => setMobileOpen(false)}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "280px",
                  maxWidth: "85vw",
                  height: "100%",
                  background: SURFACE,
                  boxShadow: SHADOW_HOVER,
                  padding: "24px 20px",
                  overflowY: "auto",
                  boxSizing: "border-box",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      background: `linear-gradient(135deg, ${ORANGE} 0%, #e65c00 100%)`,
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    PG Analytics IQ
                  </div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    Analytics Workspace
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#f1f5f9",
                    borderRadius: 16,
                    padding: "12px",
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 40,
                      background: ORANGE_SOFT,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 16,
                      color: ORANGE,
                    }}
                  >
                    {userLoading ? "?" : userInitials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: TEXT,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userLoading ? "Loading..." : displayName}
                    </div>

                    {userEmail ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: MUTED,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {userEmail}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {navItems.map((item) => (
                    <DashboardLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={item.active}
                      onClick={() => setMobileOpen(false)}
                    />
                  ))}
                </div>

                <div style={{ marginTop: 24 }}>
                  <LogoutButton onClick={handleLogout} disabled={isLoggingOut} />
                </div>
              </div>
            </div>
          ) : null}

          <main
            style={{
              width: "100%",
              maxWidth: 1600,
              margin: "0 auto",
              padding: "24px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                minWidth: 0,
                ...contentStyle,
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}