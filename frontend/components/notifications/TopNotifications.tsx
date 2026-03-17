"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";

type Role = "candidate" | "organizer";

interface Notice {
  id: string;
  text: string;
  href: string;
}

export function TopNotifications({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const storageKey = role === "candidate" ? "cf_notifications_candidate" : "cf_notifications_organizer";

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const now = Date.now();
      const items: Notice[] = [];

      try {
        const savedRaw = localStorage.getItem(storageKey);
        if (savedRaw) {
          const saved: Notice[] = JSON.parse(savedRaw);
          items.push(...saved.slice(0, 5));
        }
      } catch {}

      try {
        const { data: contests } = await api.get("/contests");
        (contests || []).forEach((contest: any) => {
          const endMs = contest?.end_time ? new Date(contest.end_time).getTime() : 0;
          if (endMs && endMs <= now) {
            items.push({
              id: `contest-ended-${contest.id}`,
              text: `Contest ended: ${contest.title}`,
              href: role === "candidate" ? `/candidate/contest/${contest.id}/results` : `/organizer/contests/${contest.id}/results`,
            });
          }
        });
      } catch {}

      try {
        const { data: problems } = await api.get("/problems");
        (problems || [])
          .filter((p: any) => p?.is_public)
          .slice(0, 2)
          .forEach((problem: any) => {
            items.push({
              id: `pub-problem-${problem.id}`,
              text: `New public problem: ${problem.title}`,
              href: role === "candidate" ? `/candidate/ide/${problem.id}` : `/organizer/problems`,
            });
          });
      } catch {}

      const unique = Array.from(new Map(items.map((item) => [item.id, item])).values()).slice(0, 8);
      if (mounted) setNotices(unique);
    };

    load();
    const timer = setInterval(load, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [role, storageKey]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const count = useMemo(() => notices.length, [notices]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors text-gray-300"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-violet-600 text-white text-[10px] leading-4 text-center font-semibold">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-gray-800 text-sm font-semibold text-white">Notifications</div>
          <div className="max-h-80 overflow-y-auto">
            {notices.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-500">No notifications</p>
            ) : (
              notices.map((n) => (
                <Link key={n.id} href={n.href} className="block px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                  {n.text}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
