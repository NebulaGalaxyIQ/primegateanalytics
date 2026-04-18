const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://127.0.0.1:8000";

const AUTH_BASE_URL = `${API_BASE_URL}/auth`;

const TOKEN_KEY = "access_token";
const USER_KEY = "auth_user";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function buildJsonHeaders(token = null) {
  const headers = {
    "Content-Type": "application/json",
  };

  const resolvedToken = token || getToken();
  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  return headers;
}

async function parseErrorResponse(response) {
  let message = `Request failed with status ${response.status}`;

  try {
    const data = await response.json();

    if (typeof data?.detail === "string" && data.detail.trim()) {
      message = data.detail;
    } else if (typeof data?.message === "string" && data.message.trim()) {
      message = data.message;
    } else if (Array.isArray(data?.detail) && data.detail.length) {
      message = data.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item?.msg === "string") return item.msg;
          return JSON.stringify(item);
        })
        .join(", ");
    }
  } catch (_) {
    try {
      const text = await response.text();
      if (text?.trim()) {
        message = text;
      }
    } catch (_) {
      // ignore
    }
  }

  return new Error(message);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function setToken(token) {
  if (!isBrowser()) return;
  const value = normalizeText(token);
  if (!value) return;
  localStorage.setItem(TOKEN_KEY, value);
}

export function getToken() {
  if (!isBrowser()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function removeToken() {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
}

export function setCurrentUser(user) {
  if (!isBrowser()) return;
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getCurrentUserFromStorage() {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function removeCurrentUser() {
  if (!isBrowser()) return;
  localStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  removeToken();
  removeCurrentUser();
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export async function login({ usernameOrEmail, password }) {
  const payload = {
    username_or_email: normalizeText(usernameOrEmail),
    password: normalizeText(password),
  };

  if (!payload.username_or_email) {
    throw new Error("Username or email is required");
  }

  if (!payload.password) {
    throw new Error("Password is required");
  }

  const data = await requestJson(`${AUTH_BASE_URL}/login`, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (data?.access_token) {
    setToken(data.access_token);
  }

  if (data?.user) {
    setCurrentUser(data.user);
  }

  return data;
}

export async function logout() {
  clearAuth();
  return true;
}

export async function getMe(token = null) {
  const data = await requestJson(`${AUTH_BASE_URL}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token || getToken()}`,
    },
  });

  if (data) {
    setCurrentUser(data);
  }

  return data;
}

export async function refreshCurrentUser(token = null) {
  return getMe(token);
}

export async function changePassword({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  const payload = {
    current_password: normalizeText(currentPassword),
    new_password: normalizeText(newPassword),
    confirm_password: normalizeText(confirmPassword),
  };

  if (!payload.current_password) {
    throw new Error("Current password is required");
  }

  if (!payload.new_password) {
    throw new Error("New password is required");
  }

  if (!payload.confirm_password) {
    throw new Error("Confirm password is required");
  }

  return requestJson(`${AUTH_BASE_URL}/change-password`, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function register({
  fullName,
  username,
  email,
  phoneNumber,
  role = "production_manager",
  department,
  password,
}) {
  const payload = {
    full_name: normalizeText(fullName),
    username: normalizeText(username),
    email: normalizeText(email).toLowerCase(),
    phone_number: normalizeText(phoneNumber) || null,
    role: normalizeText(role) || "production_manager",
    department: normalizeText(department) || null,
    password: normalizeText(password),
  };

  if (!payload.full_name) throw new Error("Full name is required");
  if (!payload.username) throw new Error("Username is required");
  if (!payload.email) throw new Error("Email is required");
  if (!payload.password) throw new Error("Password is required");

  return requestJson(`${AUTH_BASE_URL}/register`, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
}

export function getAuthHeaders(token = null) {
  const resolvedToken = token || getToken();
  return resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {};
}

export function requireToken() {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication token not found");
  }
  return token;
}

const authService = {
  login,
  logout,
  register,
  getMe,
  refreshCurrentUser,
  changePassword,
  setToken,
  getToken,
  removeToken,
  setCurrentUser,
  getCurrentUserFromStorage,
  removeCurrentUser,
  clearAuth,
  isAuthenticated,
  getAuthHeaders,
  requireToken,
};

export default authService;