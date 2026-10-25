import { API_BASE, refreshSession, requireCookieConsent } from "./api";

async function authRequest(path, options = {}) {
  requireCookieConsent();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Authentication request failed");
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function login(email, password) {
  return authRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(formData) {
  return authRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(formData),
  });
}

export async function getSession() {
  try {
    return await authRequest("/api/auth/session");
  } catch (error) {
    if (error.status !== 401 || !(await refreshSession())) throw error;
    return authRequest("/api/auth/session");
  }
}

export async function logout() {
  try {
    await authRequest("/api/auth/logout", { method: "POST" });
  } catch {
    // Local auth state is cleared even when the session has already expired.
  }
}
