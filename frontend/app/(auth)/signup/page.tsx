"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, Code2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { BrandLogo } from "@/components/branding/BrandLogo";

export default function SignupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({
    email: "", username: "", full_name: "", password: "",
    role: params.get("role") || "candidate",
  });
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/signup", form);
      // Auto login
      const loginForm = new URLSearchParams({ username: form.email, password: form.password });
      const { data } = await api.post("/auth/login", loginForm, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setAuth(data.access_token, data.role, data.user_id);
      toast.success("Account created!");
      router.push(data.role === "organizer" ? "/organizer/dashboard" : "/candidate/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-violet-400 font-bold text-xl mb-4">
            <BrandLogo size="lg" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
        </div>

        {/* Role picker */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { value: "candidate", icon: <Code2 className="w-5 h-5" />, label: "Candidate", sub: "Take exams & practice" },
            { value: "organizer", icon: <Users className="w-5 h-5" />, label: "Organizer", sub: "Create & manage contests" },
          ].map((r) => (
            <button key={r.value} type="button" onClick={() => update("role", r.value)}
              className={`p-4 rounded-xl border text-left transition-all ${
                form.role === r.value
                  ? "border-violet-500 bg-violet-950/40 text-white"
                  : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
              }`}>
              <div className={`mb-2 ${form.role === r.value ? "text-violet-400" : ""}`}>{r.icon}</div>
              <div className="text-sm font-semibold">{r.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{r.sub}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-4">
          {[
            { key: "full_name", label: "Full name", type: "text", placeholder: "Ada Lovelace" },
            { key: "username",  label: "Username",  type: "text", placeholder: "ada_lovelace" },
            { key: "email",     label: "Email",     type: "email", placeholder: "ada@example.com" },
            { key: "password",  label: "Password",  type: "password", placeholder: "Min. 8 characters" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{field.label}</label>
              <input
                type={field.type} required
                value={(form as any)[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-2">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-violet-400 hover:text-violet-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
