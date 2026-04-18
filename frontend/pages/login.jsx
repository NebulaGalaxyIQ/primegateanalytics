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
const LOGIN_TIMEOUT_MS = 15000;
const AUTH_READY_TIMEOUT_MS = 5000;
const AUTH_READY_CHECK_INTERVAL_MS = 120;

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

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
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
  const nextParam =
    typeof router?.query?.next === "string" ? router.query.next : null;

  return normalizeRedirectCandidate(nextParam) || DEFAULT_DASHBOARD_PATH;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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

  const canSubmit = useMemo(() => {
    const liveUsername = (usernameInputRef.current?.value || usernameOrEmail || "").trim();
    const livePassword = passwordInputRef.current?.value || password || "";

    return Boolean(liveUsername && livePassword && !isSubmitting);
  }, [usernameOrEmail, password, isSubmitting]);

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
      setIsSubmitting(true);

      try {
        const loginPromise = authService.login({
          usernameOrEmail: credentials.usernameOrEmail,
          password: credentials.password,
          rememberMe,
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Login is taking too long. Please try again."));
          }, LOGIN_TIMEOUT_MS);
        });

        await Promise.race([loginPromise, timeoutPromise]);

        const authReady = await waitForAuthenticatedState();
        if (!authReady) {
          throw new Error("Login succeeded, but session was not ready. Please try again.");
        }

        if (!mountedRef.current) return;

        setSuccess("Login successful.");

        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          await redirectToTarget(router, redirectTarget);
        }
      } catch (err) {
        if (!mountedRef.current) return;

        setError(normalizeErrorMessage(err));
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
                    style={showHideButtonStyle}
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
                  ...(canSubmit
                    ? activeSubmitButtonStyle
                    : disabledSubmitButtonStyle),
                }}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
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
  marginBottom: 20,
  outline: "none",
};

const activeSubmitButtonStyle = {
  background: BLUE,
  color: "#ffffff",
  border: `1px solid ${BLUE}`,
  cursor: "pointer",
  pointerEvents: "auto",
};

const disabledSubmitButtonStyle = {
  background: SOFT,
  color: MUTED,
  border: `1px solid ${BORDER}`,
  cursor: "not-allowed",
  pointerEvents: "auto",
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