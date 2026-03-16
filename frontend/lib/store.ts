// lib/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  role: string | null;
  userId: number | null;
  setAuth: (token: string, role: string, userId: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userId: null,
      setAuth: (token, role, userId) => set({ token, role, userId }),
      logout: () => set({ token: null, role: null, userId: null }),
    }),
    { name: "codeforgeai-auth" }
  )
);
