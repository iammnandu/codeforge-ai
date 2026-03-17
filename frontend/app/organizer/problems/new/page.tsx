"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OrganizerShell } from "@/components/shells/OrganizerShell";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";

interface TestCase { input: string; expected: string; is_sample: boolean; }

export default function NewProblemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestId = searchParams.get("contest");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", input_format: "", output_format: "",
    constraints: "", difficulty: "medium", time_limit_ms: 2000,
    is_public: true,
    memory_limit_mb: 256, sample_input: "", sample_output: "",
    tags: [] as string[], tagInput: "",
  });
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expected: "", is_sample: true },
    { input: "", expected: "", is_sample: false },
  ]);

  const addTestCase = () => setTestCases((t) => [...t, { input: "", expected: "", is_sample: false }]);
  const removeTestCase = (i: number) => setTestCases((t) => t.filter((_, j) => j !== i));
  const updateTC = (i: number, k: keyof TestCase, v: any) =>
    setTestCases((t) => t.map((tc, j) => j === i ? { ...tc, [k]: v } : tc));

  const addTag = () => {
    if (form.tagInput.trim() && !form.tags.includes(form.tagInput.trim())) {
      setForm((f) => ({ ...f, tags: [...f.tags, f.tagInput.trim()], tagInput: "" }));
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Enter prompt for AI generation");
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await api.post("/problems/generate-ai", {
        prompt: aiPrompt.trim(),
        difficulty: form.difficulty,
      });

      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
        input_format: data.input_format || prev.input_format,
        output_format: data.output_format || prev.output_format,
        constraints: data.constraints || prev.constraints,
        difficulty: data.difficulty || prev.difficulty,
        time_limit_ms: data.time_limit_ms || prev.time_limit_ms,
        memory_limit_mb: data.memory_limit_mb || prev.memory_limit_mb,
        sample_input: data.sample_input || prev.sample_input,
        sample_output: data.sample_output || prev.sample_output,
        tags: Array.isArray(data.tags) ? data.tags : prev.tags,
      }));
      if (Array.isArray(data.test_cases) && data.test_cases.length > 0) {
        setTestCases(
          data.test_cases.map((testCase: any) => ({
            input: testCase.input || "",
            expected: testCase.expected || "",
            is_sample: !!testCase.is_sample,
          }))
        );
      }
      toast.success("Problem generated with AI");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/problems", {
        title: form.title, description: form.description,
        input_format: form.input_format, output_format: form.output_format,
        constraints: form.constraints, difficulty: form.difficulty,
        time_limit_ms: form.time_limit_ms, memory_limit_mb: form.memory_limit_mb,
        is_public: form.is_public,
        sample_input: form.sample_input, sample_output: form.sample_output,
        tags: form.tags,
        test_cases: testCases.filter((tc) => tc.input && tc.expected),
      });

      if (contestId) {
        await api.post(`/contests/${contestId}/problems/${data.id}`);
      }

      toast.success("Problem created!");
      if (contestId) router.push(`/organizer/contests/${contestId}`);
      else router.push("/organizer/problems");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create problem");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 resize-none";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";
  const cardClass = "bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5";

  return (
    <OrganizerShell>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Create Problem</h1>
          <p className="text-gray-400 text-sm mt-1">Add a new coding problem with test cases</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={cardClass}>
            <h2 className="font-semibold text-white">Generate with AI</h2>
            <div>
              <label className={labelClass}>Prompt</label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className={inputClass}
                placeholder="e.g. Create a medium array + hashing problem about finding longest balanced subarray"
              />
            </div>
            <button
              type="button"
              onClick={generateWithAI}
              disabled={aiLoading}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
            >
              {aiLoading ? "Generating..." : "Generate with AI"}
            </button>
          </div>

          {/* Basic Info */}
          <div className={cardClass}>
            <h2 className="font-semibold text-white">Problem Info</h2>
            <div>
              <label className={labelClass}>Title</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass} placeholder="e.g. Two Sum" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Difficulty</label>
                <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  className={inputClass}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Time limit (ms)</label>
                <input type="number" min={100} max={10000} value={form.time_limit_ms}
                  onChange={(e) => setForm({ ...form, time_limit_ms: +e.target.value })}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Memory (MB)</label>
                <input type="number" min={32} max={1024} value={form.memory_limit_mb}
                  onChange={(e) => setForm({ ...form, memory_limit_mb: +e.target.value })}
                  className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Problem Visibility</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_public: true })}
                  className={`rounded-xl border px-4 py-3 text-sm text-left transition-colors ${
                    form.is_public
                      ? "border-violet-500 bg-violet-950/40 text-violet-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <p className="font-medium">Public Practice</p>
                  <p className="text-xs opacity-80 mt-1">Visible in candidate practice section</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_public: false })}
                  className={`rounded-xl border px-4 py-3 text-sm text-left transition-colors ${
                    !form.is_public
                      ? "border-violet-500 bg-violet-950/40 text-violet-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <p className="font-medium">Contest Only</p>
                  <p className="text-xs opacity-80 mt-1">Hidden from practice, usable in contests</p>
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Tags</label>
              <div className="flex gap-2 mb-2">
                <input value={form.tagInput} onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  className={`flex-1 ${inputClass}`} placeholder="array, dp, greedy…" />
                <button type="button" onClick={addTag}
                  className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1.5 bg-violet-900/30 text-violet-400 text-xs px-3 py-1 rounded-full">
                    {tag}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className={cardClass}>
            <h2 className="font-semibold text-white">Description</h2>
            <div>
              <label className={labelClass}>Problem Statement (supports Markdown)</label>
              <textarea required rows={6} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass} placeholder="Describe the problem…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Input Format</label>
                <textarea rows={3} value={form.input_format}
                  onChange={(e) => setForm({ ...form, input_format: e.target.value })}
                  className={inputClass} placeholder="Describe the input…" />
              </div>
              <div>
                <label className={labelClass}>Output Format</label>
                <textarea rows={3} value={form.output_format}
                  onChange={(e) => setForm({ ...form, output_format: e.target.value })}
                  className={inputClass} placeholder="Describe the expected output…" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Constraints</label>
              <textarea rows={2} value={form.constraints}
                onChange={(e) => setForm({ ...form, constraints: e.target.value })}
                className={inputClass} placeholder="1 ≤ n ≤ 10^5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Sample Input</label>
                <textarea rows={3} value={form.sample_input}
                  onChange={(e) => setForm({ ...form, sample_input: e.target.value })}
                  className={`${inputClass} font-mono`} placeholder="5&#10;1 2 3 4 5" />
              </div>
              <div>
                <label className={labelClass}>Sample Output</label>
                <textarea rows={3} value={form.sample_output}
                  onChange={(e) => setForm({ ...form, sample_output: e.target.value })}
                  className={`${inputClass} font-mono`} placeholder="15" />
              </div>
            </div>
          </div>

          {/* Test Cases */}
          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Test Cases</h2>
              <button type="button" onClick={addTestCase}
                className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors">
                <Plus className="w-4 h-4" /> Add Case
              </button>
            </div>
            {testCases.map((tc, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-400">Test {i + 1}</span>
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={tc.is_sample}
                        onChange={(e) => updateTC(i, "is_sample", e.target.checked)}
                        className="rounded" />
                      Sample (shown to candidates)
                    </label>
                  </div>
                  {testCases.length > 1 && (
                    <button type="button" onClick={() => removeTestCase(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Input</label>
                    <textarea rows={3} value={tc.input} onChange={(e) => updateTC(i, "input", e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-violet-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Expected Output</label>
                    <textarea rows={3} value={tc.expected} onChange={(e) => updateTC(i, "expected", e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-violet-500 resize-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? "Creating…" : "Create Problem"}
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
