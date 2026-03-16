"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Code2, Eye, Zap, Users, Trophy, ArrowRight, CheckCircle } from "lucide-react";
import { BrandLogo } from "@/components/branding/BrandLogo";

const features = [
  { icon: <Shield className="w-6 h-6" />, title: "Multi-Agent CV Proctoring", desc: "5 parallel AI agents monitor face, gaze, objects, behavior, and environment in real time." },
  { icon: <Eye className="w-6 h-6" />,    title: "Off-Frame Device Detection", desc: "Camera calibration detects phones held below the desk — even when completely outside the camera frame." },
  { icon: <Code2 className="w-6 h-6" />,  title: "Multi-Language IDE", desc: "Full Monaco editor with Python, C++, Java, and JavaScript support. Run & submit against hidden test cases." },
  { icon: <Zap className="w-6 h-6" />,    title: "Real-Time Suspicion Scoring", desc: "Weighted signal fusion gives each candidate a live 0-100 suspicion score with automatic flagging." },
  { icon: <Users className="w-6 h-6" />,  title: "Email Contest Invites", desc: "Organizers invite participants by email. Candidates join with one click or a 8-character contest code." },
  { icon: <Trophy className="w-6 h-6" />, title: "Live Leaderboard", desc: "Real-time rankings update as candidates submit. Export final results as CSV or PDF." },
];

const steps = [
  { step: "01", title: "Create Contest", desc: "Set up problems, add test cases, configure proctoring settings." },
  { step: "02", title: "Invite Candidates", desc: "Send email invites. Candidates join via link or 8-digit code." },
  { step: "03", title: "AI Proctoring Starts", desc: "Environment scan → camera calibration → continuous monitoring." },
  { step: "04", title: "Review Results", desc: "View flagged events, replay suspicious moments, export grades." },
];

export default function LandingPage() {
  const heroStats = [
    { label: "Candidates Monitored", value: "25K+" },
    { label: "Cheating Signals", value: "18+" },
    { label: "Avg. Setup Time", value: "< 2 min" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
        <motion.div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-violet-700/20 blur-3xl"
          animate={{ x: [0, 50, 0], y: [0, 35, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-fuchsia-700/10 blur-3xl"
          animate={{ x: [0, -45, 0], y: [0, 45, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <BrandLogo size="md" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how"      className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing"  className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"  className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">Log in</Link>
            <Link href="/signup" className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-colors font-medium">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 bg-violet-950/60 border border-violet-800/40 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              Research-grade CV proctoring system
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent leading-tight">
              AI-Powered<br />Secure Coding<br />Examinations
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Next-generation proctoring platform powered by multi-agent computer vision.
              Detects cheating even from devices <em>outside the camera frame</em>.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/signup?role=organizer" className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-7 py-3.5 rounded-xl font-semibold transition-all hover:scale-105">
                Create a contest <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/signup?role=candidate" className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-7 py-3.5 rounded-xl font-semibold transition-all">
                Join as candidate
              </Link>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto"
            >
              {heroStats.map((item) => (
                <div key={item.label} className="bg-gray-900/80 border border-gray-800 rounded-xl px-4 py-3">
                  <div className="text-white font-semibold">{item.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{item.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Hero visual — score dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-3 text-xs text-gray-500 font-mono">Proctor Dashboard — Live</span>
            </div>
            <div className="grid grid-cols-4 gap-0 divide-x divide-gray-800 text-sm">
              {[
                { name: "Alice Johnson",  score: 12, status: "clean",    face: "✓", phone: "—", gaze: "✓" },
                { name: "Bob Kumar",      score: 67, status: "high",     face: "✓", phone: "📱", gaze: "⚠" },
                { name: "Carol Zhang",    score: 8,  status: "clean",    face: "✓", phone: "—", gaze: "✓" },
                { name: "David Osei",     score: 41, status: "medium",   face: "✓", phone: "—", gaze: "⚠" },
              ].map((c) => (
                <motion.div
                  key={c.name}
                  className="p-4 space-y-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs font-medium truncate">{c.name}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      c.status === "clean" ? "bg-green-900/40 text-green-400" :
                      c.status === "medium" ? "bg-yellow-900/40 text-yellow-400" :
                      "bg-red-900/40 text-red-400"
                    }`}>{c.score}</span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex justify-between"><span>Face</span><span>{c.face}</span></div>
                    <div className="flex justify-between"><span>Phone</span><span>{c.phone}</span></div>
                    <div className="flex justify-between"><span>Gaze</span><span>{c.gaze}</span></div>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1">
                    <motion.div
                      className={`h-1 rounded-full ${c.score > 60 ? "bg-red-500" : c.score > 30 ? "bg-yellow-500" : "bg-green-500"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${c.score}%` }}
                      transition={{ duration: 0.9, delay: 0.15 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Everything you need to run secure exams</h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">From contest creation to result export, with AI proctoring running in the background.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-violet-800/50 transition-colors"
              >
                <div className="w-12 h-12 bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-400 mb-4">{f.icon}</div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">How it works</h2>
          <div className="space-y-8">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                viewport={{ once: true }}
                className="flex gap-6"
              >
                <div className="flex-shrink-0 w-14 h-14 bg-violet-900/30 border border-violet-800/40 rounded-2xl flex items-center justify-center text-violet-400 font-bold text-lg">
                  {s.step}
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                  <p className="text-gray-400 text-sm">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-gray-900 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-400 mb-12">Free to get started. Scale as you grow.</p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {[
              { plan: "Starter", price: "Free", features: ["3 contests/month", "Up to 30 candidates", "Basic proctoring", "Email invites"], cta: "Get started free", primary: false },
              { plan: "Pro",     price: "$49/mo", features: ["Unlimited contests", "Unlimited candidates", "Full CV proctoring", "Priority support", "PDF exports"], cta: "Start free trial", primary: true },
            ].map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
                className={`rounded-2xl p-8 border ${p.primary ? "border-violet-600 bg-violet-950/30" : "border-gray-800 bg-gray-900"}`}
              >
                <h3 className="font-bold text-xl mb-1">{p.plan}</h3>
                <div className="text-3xl font-bold text-white mb-6">{p.price}</div>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                  p.primary ? "bg-violet-600 hover:bg-violet-500 text-white" : "border border-gray-700 hover:border-gray-500 text-gray-300"
                }`}>{p.cta}</Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <BrandLogo size="sm" showText={false} /> CodeForge AI © 2026
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
