"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { loadGoogleScript, renderGoogleButton } from "@/lib/googleAuth";
import { useAuthStore } from "@/lib/store";
import { BrandLogo } from "@/components/branding/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!googleClientId || !googleBtnRef.current) return;

    let mounted = true;
    loadGoogleScript()
      .then(() => {
        if (!mounted || !googleBtnRef.current) return;
        renderGoogleButton(googleBtnRef.current, googleClientId, async (credential) => {
          try {
            setGoogleLoading(true);
            const { data } = await api.post("/auth/google", { id_token: credential, role: "candidate" });
            setAuth(data.access_token, data.role, data.user_id);
            toast.success("Signed in with Google");
            router.push(data.role === "organizer" ? "/organizer/dashboard" : "/candidate/dashboard");
          } catch (err: any) {
            toast.error(err.response?.data?.detail || "Google sign-in failed");
          } finally {
            setGoogleLoading(false);
          }
        });
      })
      .catch(() => {
        toast.error("Unable to load Google Sign-In");
      });

    return () => {
      mounted = false;
    };
  }, [router, setAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);
      const { data } = await api.post("/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setAuth(data.access_token, data.role, data.user_id);
      toast.success("Welcome back!");
      router.push(data.role === "organizer" ? "/organizer/dashboard" : "/candidate/dashboard");
    } catch (err: any) {
      const message = err.response?.data?.detail || "Login failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-violet-400 font-bold text-xl mb-4">
            <BrandLogo size="lg" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"} required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-11 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-800" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-900 px-2 text-gray-500">or</span>
            </div>
          </div>

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
            <div className="flex justify-center">
              <div ref={googleBtnRef} className={googleLoading ? "opacity-60 pointer-events-none" : ""} />
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in.</p>
          )}
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          No account?{" "}
          <Link href="/signup" className="text-violet-400 hover:text-violet-300">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
