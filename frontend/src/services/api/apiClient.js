const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "false") === "true";

/** Returns the stored JWT token (null if not authenticated) */
function getToken() {
  return localStorage.getItem("adapt_token") || null;
}

/** Returns the stored user object (null if not authenticated) */
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("adapt_user") || "null");
  } catch {
    return null;
  }
}

/** Returns the current authenticated learner ID, or null before sign-in. */
function getUserId() {
  return getUser()?.id || null;
}

function requireUserId() {
  const userId = getUserId();
  if (!userId) throw new Error("Sign in to continue.");
  return userId;
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({ message: "Unexpected server response" }));
  if (response.status === 401) {
    // Clear stale session and let the app handle redirect
    localStorage.removeItem("adapt_token");
    localStorage.removeItem("adapt_user");
    window.dispatchEvent(new Event("adapt:unauthorized"));
  }
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

export const apiClient = { USE_MOCK, request, baseUrl: BASE_URL, getToken, getUser, getUserId, requireUserId };
