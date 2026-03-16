"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Trophy, Code2, Eye, Settings, LogOut, Users } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { BrandLogo } from "@/components/branding/BrandLogo";

const NAV = [
  { href: "/organizer/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard" },
  { href: "/organizer/contests",  icon: <Trophy className="w-4 h-4" />,          label: "Contests" },
  { href: "/organizer/problems",  icon: <Code2 className="w-4 h-4" />,           label: "Problems" },
  { href: "/organizer/settings",  icon: <Settings className="w-4 h-4" />,        label: "Settings" },
];

export function OrganizerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-800">
          <Link href="/organizer/dashboard" className="flex items-center gap-2 text-violet-400 font-bold">
            <BrandLogo size="sm" />
          </Link>
          <p className="text-xs text-gray-500 mt-1">Organizer</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-violet-900/40 text-violet-300 font-medium"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => { logout(); router.push("/login"); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors w-full">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
