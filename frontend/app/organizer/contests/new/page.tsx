"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrganizerShell } from "@/components/shells/OrganizerShell";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

const LANGS = ["python", "cpp", "java", "javascript"];

export default function NewContestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "",
    start_time: "", end_time: "",
    duration_minutes: 90,
    allowed_languages: ["python", "cpp", "java", "javascript"],
    proctoring_enabled: true,
  });

  const toggleLang = (lang: string) => {
    setForm((f) => ({
      ...f,
      allowed_languages: f.allowed_languages.includes(lang)
        ? f.allowed_languages.filter((l) => l !== lang)
        : [...f.allowed_languages, lang],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/contests", {
        ...form,
        start_time: new Date(form.start_time).toISOString(),
        end_time:   new Date(form.end_time).toISOString(),
      });
      toast.success(`Contest created! Code: ${data.contest_code}`);
      router.push(`/organizer/contests/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create contest");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OrganizerShell>
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Create Contest</h1>
          <p className="text-gray-400 text-sm mt-1">Set up a new coding examination</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <h2 className="font-semibold text-white">Basic Info</h2>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Contest title</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500"
                placeholder="e.g. Data Structures Mid-Term 2025" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                placeholder="Optional instructions for participants…" />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <h2 className="font-semibold text-white">Schedule</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Start time</label>
                <input required type="datetime-local" value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">End time</label>
                <input required type="datetime-local" value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Duration (minutes)</label>
              <input required type="number" min={10} max={480} value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: +e.target.value })}
                className="w-40 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500" />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white">Languages</h2>
            <div className="flex flex-wrap gap-3">
              {LANGS.map((lang) => (
                <button key={lang} type="button" onClick={() => toggleLang(lang)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    form.allowed_languages.includes(lang)
                      ? "border-violet-500 bg-violet-950/40 text-violet-300"
                      : "border-gray-700 text-gray-500 hover:border-gray-600"
                  }`}>{lang}</button>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">AI Proctoring</h2>
                <p className="text-sm text-gray-400 mt-0.5">Enable multi-agent CV monitoring for this contest</p>
              </div>
              <button type="button" onClick={() => setForm({ ...form, proctoring_enabled: !form.proctoring_enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.proctoring_enabled ? "bg-violet-600" : "bg-gray-700"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.proctoring_enabled ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? "Creating…" : "Create Contest"}
            </button>
            <button type="button" onClick={() => router.back()}
              className="px-6 border border-gray-700 text-gray-400 hover:text-white rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </OrganizerShell>
  );
}
