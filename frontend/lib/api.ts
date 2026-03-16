import axios from "axios";

const AUTH_KEY = "codeforgeai-auth";
const LEGACY_AUTH_KEY = "examai-auth";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(AUTH_KEY) || localStorage.getItem(LEGACY_AUTH_KEY);
      if (stored) {
        const { state } = JSON.parse(stored);
        if (state?.token) config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch {}
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(LEGACY_AUTH_KEY);
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
