import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import authService from "../services/auth";

const PAGE_BG = "#ffffff";
const CARD_BG = "#ffffff";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e2e8f0";
const SOFT = "#f8fafc";
const BLUE = "#2563eb";
const BLUE_DARK = "#1d4ed8";
const RED = "#b91c1c";
const RED_BG = "rgba(185,28,28,0.06)";
const GREEN = "#15803d";
const GREEN_BG = "rgba(21,128,61,0.08)";
const ORANGE = "#ff7a00";

const DEFAULT_DASHBOARD_PATH = "/dashboard";

const DEFAULT_API_BASE_URL = "https://primegateanalytics-2.onrender.com";
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

/**
 * Render free services can take time to wake up.
 * 90 seconds prevents the frontend from failing too early.
 */
const LOGIN_TIMEOUT_MS = 90000;
const HEALTH_TIMEOUT_MS = 12000;
const AUTH_READY_TIMEOUT_MS = 15000;
const AUTH_READY_CHECK_INTERVAL_MS = 150;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeErrorMessage(error) {
  if (!error) return "Login failed.";

  const detail = error?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => item?.msg || item?.message || String(item))
      .join(", ");
  }

  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : "";

  if (message) {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("failed to fetch") ||
      lowerMessage.includes("networkerror") ||
      lowerMessage.includes("network error")
    ) {
      return "Unable to reach the server. Please wait a moment and try again. If this continues, check the API URL and backend service.";
    }

    return message;
  }

  return "Login failed.";
}

function isSafeInternalPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function normalizeRedirectCandidate(value) {
  if (!isSafeInternalPath(value)) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const blockedPrefixes = ["/login", "/auth/login", "/register", "/forgot-password"];
  if (blockedPrefixes.some((prefix) => trimmed.startsWith(prefix))) return null;

  return trimmed;
}

function resolveRedirectTarget(router) {
  const nextParam = typeof router?.query?.next === "string" ? router.query.next : null;
  return normalizeRedirectCandidate(nextParam) || DEFAULT_DASHBOARD_PATH;
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function warmBackend(timeoutMs = HEALTH_TIMEOUT_MS) {
  if (typeof window === "undefined") return false;
  if (!API_BASE_URL) return false;

  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    return response.ok;
  } catch (_) {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function waitForAuthenticatedState(timeoutMs = AUTH_READY_TIMEOUT_MS) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      if (authService?.isAuthenticated?.()) return true;
    } catch (_) {}

    await sleep(AUTH_READY_CHECK_INTERVAL_MS);
  }

  return false;
}

async function redirectToTarget(router, target) {
  try {
    await router.replace(target);
  } catch (_) {}

  if (typeof window !== "undefined") {
    const currentPath =
      window.location.pathname + window.location.search + window.location.hash;

    if (currentPath !== target) {
      window.location.replace(target);
    }
  }
}

export default function LoginPage() {
  const router = useRouter();

  const mountedRef = useRef(false);
  const hasRedirectedRef = useRef(false);
  const autofillSyncTimersRef = useRef([]);

  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loginStatus, setLoginStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isWarmingBackend, setIsWarmingBackend] = useState(false);

  const redirectTarget = useMemo(() => resolveRedirectTarget(router), [router]);

  const syncInputsFromDom = useCallback(() => {
    const nextUsername = usernameInputRef.current?.value || "";
    const nextPassword = passwordInputRef.current?.value || "";

    setUsernameOrEmail((prev) => (prev === nextUsername ? prev : nextUsername));
    setPassword((prev) => (prev === nextPassword ? prev : nextPassword));
  }, []);

  const getLiveCredentials = useCallback(() => {
    const liveUsername = (usernameInputRef.current?.value || usernameOrEmail || "").trim();
    const livePassword = passwordInputRef.current?.value || password || "";

    return {
      usernameOrEmail: liveUsername,
      password: livePassword,
    };
  }, [password, usernameOrEmail]);

  const hasCredentials = useMemo(() => {
    const liveUsername = (usernameInputRef.current?.value || usernameOrEmail || "").trim();
    const livePassword = passwordInputRef.current?.value || password || "";

    return Boolean(liveUsername && livePassword);
  }, [usernameOrEmail, password]);

  const canSubmit = hasCredentials && !isSubmitting;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      autofillSyncTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      autofillSyncTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function prepareBackend() {
      setIsWarmingBackend(true);

      await warmBackend();

      if (!cancelled && mountedRef.current) {
        setIsWarmingBackend(false);
      }
    }

    prepareBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    syncInputsFromDom();

    const syncDelays = [0, 80, 200, 500, 1000];
    const timerIds = syncDelays.map((delay) =>
      window.setTimeout(() => {
        syncInputsFromDom();
      }, delay)
    );

    autofillSyncTimersRef.current = timerIds;

    const handleWindowFocus = () => syncInputsFromDom();
    const handlePageShow = () => syncInputsFromDom();

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      timerIds.forEach((id) => clearTimeout(id));
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [syncInputsFromDom]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function checkAuthAndRedirect() {
      try {
        syncInputsFromDom();

        const authenticated = authService?.isAuthenticated?.();

        if (authenticated && !hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          await redirectToTarget(router, redirectTarget);
          return;
        }
      } catch (_) {
        try {
          authService?.clearAuth?.();
        } catch (_) {}
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsCheckingAuth(false);
        }
      }
    }

    checkAuthAndRedirect();

    return () => {
      cancelled = true;
    };
  }, [router, redirectTarget, syncInputsFromDom]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      syncInputsFromDom();

      const credentials = getLiveCredentials();

      if (!credentials.usernameOrEmail || !credentials.password || isSubmitting) {
        return;
      }

      setError("");
      setSuccess("");
      setLoginStatus("Connecting to server...");
      setIsSubmitting(true);

      try {
        /**
         * Wake backend again when the user clicks login.
         * This helps when Render is asleep.
         */
        await warmBackend(8000);

        if (!mountedRef.current) return;

        setLoginStatus("Verifying your credentials...");

        await withTimeout(
          authService.login({
            usernameOrEmail: credentials.usernameOrEmail,
            password: credentials.password,
            rememberMe,
          }),
          LOGIN_TIMEOUT_MS,
          "The server is still waking up. Please wait a moment, then try again."
        );

        if (!mountedRef.current) return;

        setLoginStatus("Preparing your dashboard...");

        const authReady = await waitForAuthenticatedState();
        if (!authReady) {
          throw new Error("Login succeeded, but session was not ready. Please try again.");
        }

        if (!mountedRef.current) return;

        setSuccess("Login successful.");
        setLoginStatus("Opening dashboard...");

        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          await redirectToTarget(router, redirectTarget);
        }
      } catch (err) {
        if (!mountedRef.current) return;

        setError(normalizeErrorMessage(err));
        setLoginStatus("");
        setIsSubmitting(false);
        hasRedirectedRef.current = false;
        return;
      }

      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    },
    [getLiveCredentials, isSubmitting, redirectTarget, rememberMe, router, syncInputsFromDom]
  );

  if (isCheckingAuth) {
    return (
      <>
        <Head>
          <title>Login | UMG</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        </Head>

        <div style={loadingContainerStyle}>
          <div style={loadingCardStyle}>
            <div style={spinnerStyle} />
            <div style={loadingTitleStyle}>Opening login</div>
            <div style={loadingSubtitleStyle}>Please wait a moment.</div>
          </div>
        </div>

        <style jsx global>{globalStyles}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Login | UMG</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div style={pageContainerStyle}>
        <div style={cardContainerStyle}>
          <div style={cardStyle}>
            <div style={brandHeaderStyle}>
              <div style={brandAccentStyle} />
              <div style={brandTitleStyle}>PrimeGate Analytics</div>
            </div>

            <div style={formHeaderStyle}>
              <div style={formTitleStyle}>Sign in</div>
              <div style={formSubtitleStyle}>
                Enter your credentials to access the dashboard.
              </div>
            </div>

            {isWarmingBackend && !isSubmitting ? (
              <div style={infoBoxStyle}>
                <span style={miniSpinnerStyle} />
                <span>Preparing secure connection...</span>
              </div>
            ) : null}

            {error ? <div style={errorBoxStyle}>{error}</div> : null}
            {success ? <div style={successBoxStyle}>{success}</div> : null}

            <form onSubmit={handleSubmit} autoComplete="on">
              <div style={inputGroupStyle}>
                <label htmlFor="usernameOrEmail" style={labelStyle}>
                  Username or Email
                </label>
                <input
                  ref={usernameInputRef}
                  id="usernameOrEmail"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  onInput={syncInputsFromDom}
                  onFocus={syncInputsFromDom}
                  placeholder="Enter username or email"
                  style={inputStyle}
                  disabled={isSubmitting}
                />
              </div>

              <div style={inputGroupStyle}>
                <label htmlFor="password" style={labelStyle}>
                  Password
                </label>
                <div style={passwordWrapperStyle}>
                  <input
                    ref={passwordInputRef}
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onInput={syncInputsFromDom}
                    onFocus={syncInputsFromDom}
                    placeholder="Enter password"
                    style={{ ...inputStyle, paddingRight: 84 }}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      ...showHideButtonStyle,
                      ...(isSubmitting ? disabledTextButtonStyle : null),
                    }}
                    disabled={isSubmitting}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div style={checkboxRowStyle}>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: BLUE }}
                    disabled={isSubmitting}
                  />
                  <span>Remember me</span>
                </label>

                <span style={secureTextStyle}>Secure account access</span>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
                style={{
                  ...submitButtonStyle,
                  ...(isSubmitting
                    ? loadingSubmitButtonStyle
                    : canSubmit
                    ? activeSubmitButtonStyle
                    : disabledSubmitButtonStyle),
                }}
              >
                <span style={buttonContentStyle}>
                  {isSubmitting ? <span style={buttonSpinnerStyle} /> : null}
                  <span>{isSubmitting ? "Signing in..." : "Sign in"}</span>
                </span>
              </button>

              {isSubmitting ? (
                <div style={loginProgressStyle}>
                  <span style={miniSpinnerStyle} />
                  <span>
                    {loginStatus ||
                      "Signing in. Please wait while the server responds."}
                  </span>
                </div>
              ) : null}
            </form>

            <div style={footerNoteStyle}>
              After login you will be redirected to your dashboard.
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  html, body, #__next {
    min-height: 100%;
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-family: Arial, sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  input,
  button,
  textarea,
  select {
    font: inherit;
  }

  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-text-fill-color: ${TEXT};
    -webkit-box-shadow: 0 0 0px 1000px #ffffff inset;
    transition: background-color 9999s ease-in-out 0s;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const loadingContainerStyle = {
  minHeight: "100vh",
  background: PAGE_BG,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const loadingCardStyle = {
  width: "100%",
  maxWidth: 400,
  border: `1px solid ${BORDER}`,
  borderRadius: 24,
  background: CARD_BG,
  padding: 32,
  textAlign: "center",
};

const spinnerStyle = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: `3px solid ${SOFT}`,
  borderTopColor: BLUE,
  margin: "0 auto 16px",
  animation: "spin 0.9s linear infinite",
};

const loadingTitleStyle = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 6,
  color: TEXT,
};

const loadingSubtitleStyle = {
  fontSize: 13,
  color: MUTED,
};

const pageContainerStyle = {
  minHeight: "100vh",
  background: PAGE_BG,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const cardContainerStyle = {
  width: "100%",
  maxWidth: 460,
};

const cardStyle = {
  background: CARD_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 28,
  padding: "32px 28px 36px",
  boxShadow: "0 20px 35px -12px rgba(0,0,0,0.08)",
};

const brandHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 28,
};

const brandAccentStyle = {
  width: 40,
  height: 4,
  borderRadius: 999,
  background: ORANGE,
};

const brandTitleStyle = {
  fontSize: 20,
  fontWeight: 800,
  color: TEXT,
  letterSpacing: "-0.01em",
};

const formHeaderStyle = {
  marginBottom: 24,
};

const formTitleStyle = {
  fontSize: 28,
  fontWeight: 700,
  color: TEXT,
  marginBottom: 6,
  letterSpacing: "-0.01em",
};

const formSubtitleStyle = {
  fontSize: 14,
  color: MUTED,
  lineHeight: 1.5,
};

const inputGroupStyle = {
  marginBottom: 18,
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: TEXT,
  marginBottom: 8,
};

const inputStyle = {
  width: "100%",
  height: 48,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: "0 16px",
  outline: "none",
  fontSize: 14,
  color: TEXT,
  background: "#ffffff",
  appearance: "none",
};

const passwordWrapperStyle = {
  position: "relative",
};

const showHideButtonStyle = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: BLUE,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  padding: "6px 10px",
  borderRadius: 20,
};

const disabledTextButtonStyle = {
  color: MUTED,
  cursor: "not-allowed",
};

const checkboxRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
  flexWrap: "wrap",
  gap: 12,
};

const checkboxLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: MUTED,
  userSelect: "none",
};

const secureTextStyle = {
  fontSize: 12,
  color: MUTED,
};

const submitButtonStyle = {
  width: "100%",
  height: 50,
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 700,
  transition: "background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease",
  marginBottom: 12,
  outline: "none",
};

const activeSubmitButtonStyle = {
  background: BLUE,
  color: "#ffffff",
  border: `1px solid ${BLUE}`,
  cursor: "pointer",
  pointerEvents: "auto",
};

const loadingSubmitButtonStyle = {
  background: BLUE_DARK,
  color: "#ffffff",
  border: `1px solid ${BLUE_DARK}`,
  cursor: "wait",
  pointerEvents: "none",
};

const disabledSubmitButtonStyle = {
  background: SOFT,
  color: MUTED,
  border: `1px solid ${BORDER}`,
  cursor: "not-allowed",
  pointerEvents: "auto",
};

const buttonContentStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonSpinnerStyle = {
  width: 17,
  height: 17,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.4)",
  borderTopColor: "#ffffff",
  animation: "spin 0.8s linear infinite",
  flexShrink: 0,
};

const miniSpinnerStyle = {
  width: 15,
  height: 15,
  borderRadius: "50%",
  border: `2px solid ${BORDER}`,
  borderTopColor: BLUE,
  animation: "spin 0.8s linear infinite",
  flexShrink: 0,
};

const loginProgressStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  color: MUTED,
  fontSize: 12,
  lineHeight: 1.5,
  marginBottom: 18,
  textAlign: "center",
};

const infoBoxStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: `1px solid ${BORDER}`,
  background: SOFT,
  color: MUTED,
  borderRadius: 16,
  padding: "11px 14px",
  fontSize: 13,
  marginBottom: 20,
  lineHeight: 1.5,
};

const footerNoteStyle = {
  fontSize: 12,
  color: MUTED,
  textAlign: "center",
  borderTop: `1px solid ${BORDER}`,
  paddingTop: 20,
  marginTop: 8,
};

const errorBoxStyle = {
  border: `1px solid rgba(185,28,28,0.2)`,
  background: RED_BG,
  color: RED,
  borderRadius: 16,
  padding: "12px 16px",
  fontSize: 13,
  marginBottom: 20,
  lineHeight: 1.5,
};

const successBoxStyle = {
  border: `1px solid rgba(21,128,61,0.2)`,
  background: GREEN_BG,
  color: GREEN,
  borderRadius: 16,
  padding: "12px 16px",
  fontSize: 13,
  marginBottom: 20,
  lineHeight: 1.5,
};