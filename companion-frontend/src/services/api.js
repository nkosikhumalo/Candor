/** Shared credentialed API client. Authentication is carried only by an HttpOnly cookie. */
import { Capacitor } from "@capacitor/core";

const configuredApiBase = import.meta.env.VITE_API_BASE;
const isNativeApp = Capacitor.isNativePlatform();
const apiBase = isNativeApp
    ? configuredApiBase || "https://medicare-ze3o.onrender.com"
    : import.meta.env.DEV
        ? configuredApiBase || "http://localhost:5000"
        : "";
export const API_BASE = apiBase.replace(/\/+$/, "");

const COOKIE_CONSENT_KEY = "candor_cookie_consent";

export function hasCookieConsent() {
    try { return localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted"; }
    catch { return false; }
}

export function requireCookieConsent() {
    if (!hasCookieConsent()) throw new Error("Allow the required session cookie in Cookie settings to sign in or use your account.");
}

export async function refreshSession() {
    requireCookieConsent();
    try {
        const response = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function apiFetch(path, options = {}) {
    requireCookieConsent();
    const { _sessionRetry = false, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers || {});
    if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...fetchOptions,
        credentials: "include",
        headers,
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
        if (!_sessionRetry && await refreshSession()) {
            return apiFetch(path, { ...fetchOptions, _sessionRetry: true });
        }
        window.dispatchEvent(new Event("auth:expired"));
        const err = new Error(data.message || "Session expired. Please log in again.");
        err.status = 401;
        err.code = "UNAUTHORIZED";
        throw err;
    }
    if (!res.ok) {
        const err = new Error(data.message || data.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        err.retryAfter = res.headers.get("Retry-After");
        throw err;
    }
    return data;
}
