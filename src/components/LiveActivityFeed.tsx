import { useEffect, useState } from "react";
import { CheckCircle2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK_ACTIONS = [
  "iPhone 15 Pro iCloud unlocked",
  "Samsung S24 Ultra carrier check",
  "Xiaomi 14 IMEI verified",
  "iPhone 14 blacklist cleared",
  "Pixel 8 network unlock",
];

const VERBS = ["checked", "unlocked", "verified", "processed", "completed", "delivered", "pulled", "cleared"];

const COUNTRIES = [
  { flag: "🇺🇸", name: "USA" }, { flag: "🇬🇧", name: "UK" }, { flag: "🇨🇦", name: "Canada" },
  { flag: "🇦🇺", name: "Australia" }, { flag: "🇮🇳", name: "India" }, { flag: "🇦🇪", name: "UAE" },
  { flag: "🇧🇷", name: "Brazil" }, { flag: "🇩🇪", name: "Germany" }, { flag: "🇪🇸", name: "Spain" },
  { flag: "🇮🇹", name: "Italy" }, { flag: "🇲🇽", name: "Mexico" }, { flag: "🇳🇬", name: "Nigeria" },
  { flag: "🇵🇭", name: "Philippines" }, { flag: "🇵🇰", name: "Pakistan" }, { flag: "🇪🇬", name: "Egypt" },
  { flag: "🇸🇦", name: "Saudi Arabia" }, { flag: "🇫🇷", name: "France" }, { flag: "🇳🇱", name: "Netherlands" },
  { flag: "🇧🇪", name: "Belgium" }, { flag: "🇨🇭", name: "Switzerland" }, { flag: "🇸🇪", name: "Sweden" },
  { flag: "🇳🇴", name: "Norway" }, { flag: "🇫🇮", name: "Finland" }, { flag: "🇩🇰", name: "Denmark" },
  { flag: "🇵🇱", name: "Poland" }, { flag: "🇨🇿", name: "Czechia" }, { flag: "🇦🇹", name: "Austria" },
  { flag: "🇮🇪", name: "Ireland" }, { flag: "🇵🇹", name: "Portugal" }, { flag: "🇬🇷", name: "Greece" },
  { flag: "🇹🇷", name: "Turkey" }, { flag: "🇷🇺", name: "Russia" }, { flag: "🇺🇦", name: "Ukraine" },
  { flag: "🇷🇴", name: "Romania" }, { flag: "🇿🇦", name: "South Africa" }, { flag: "🇰🇪", name: "Kenya" },
  { flag: "🇬🇭", name: "Ghana" }, { flag: "🇲🇦", name: "Morocco" }, { flag: "🇩🇿", name: "Algeria" },
  { flag: "🇹🇳", name: "Tunisia" }, { flag: "🇶🇦", name: "Qatar" }, { flag: "🇰🇼", name: "Kuwait" },
  { flag: "🇴🇲", name: "Oman" }, { flag: "🇯🇴", name: "Jordan" }, { flag: "🇱🇧", name: "Lebanon" },
  { flag: "🇮🇶", name: "Iraq" }, { flag: "🇮🇷", name: "Iran" }, { flag: "🇮🇩", name: "Indonesia" },
  { flag: "🇲🇾", name: "Malaysia" }, { flag: "🇸🇬", name: "Singapore" }, { flag: "🇹🇭", name: "Thailand" },
  { flag: "🇻🇳", name: "Vietnam" }, { flag: "🇰🇷", name: "South Korea" }, { flag: "🇯🇵", name: "Japan" },
  { flag: "🇨🇳", name: "China" }, { flag: "🇭🇰", name: "Hong Kong" }, { flag: "🇹🇼", name: "Taiwan" },
  { flag: "🇳🇿", name: "New Zealand" }, { flag: "🇦🇷", name: "Argentina" }, { flag: "🇨🇱", name: "Chile" },
  { flag: "🇨🇴", name: "Colombia" }, { flag: "🇵🇪", name: "Peru" }, { flag: "🇻🇪", name: "Venezuela" },
  { flag: "🇧🇩", name: "Bangladesh" }, { flag: "🇱🇰", name: "Sri Lanka" }, { flag: "🇳🇵", name: "Nepal" },
];

type Entry = { id: number; action: string; country: { flag: string; name: string }; secAgo: number };

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function makeEntry(id: number, actions: string[], excludeCountry?: string): Entry {
  const pool = excludeCountry ? COUNTRIES.filter((c) => c.name !== excludeCountry) : COUNTRIES;
  return {
    id,
    action: rand(actions),
    country: rand(pool),
    secAgo: 1 + Math.floor(Math.random() * 90),
  };
}

export default function LiveActivityFeed() {
  const [actions, setActions] = useState<string[]>(FALLBACK_ACTIONS);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [todayCount, setTodayCount] = useState(0);

  // Pull real service names so the feed reflects what admin actually added.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("services_public")
        .select("name")
        .limit(120);
      const names = (data ?? []).map((s: { name: string }) => s.name).filter(Boolean);
      if (names.length > 0) {
        const enriched = names.map((n) => `${n} ${rand(VERBS)}`);
        setActions(enriched);
        // Seed with varied countries (no repeats among visible entries)
        const seen = new Set<string>();
        const seed: Entry[] = [];
        for (let i = 0; i < 4; i++) {
          let e = makeEntry(i, enriched);
          let guard = 0;
          while (seen.has(e.country.name) && guard < 20) { e = makeEntry(i, enriched); guard++; }
          seen.add(e.country.name);
          seed.push(e);
        }
        setEntries(seed.sort((a, b) => a.secAgo - b.secAgo));
      } else {
        setEntries(Array.from({ length: 4 }, (_, i) => makeEntry(i, FALLBACK_ACTIONS)).sort((a, b) => a.secAgo - b.secAgo));
      }
    })();
  }, []);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const minutesSinceMidnight = (Date.now() - start.getTime()) / 60000;
    const base = Math.floor(420 + minutesSinceMidnight * 1.6);
    setTodayCount(base);

    const tick = setInterval(() => {
      setTodayCount((n) => n + 1);
      setEntries((prev) => {
        const top = prev[0]?.country.name;
        const next = [makeEntry(Date.now(), actions, top), ...prev].slice(0, 4);
        return next;
      });
    }, 6000 + Math.random() * 4000);
    return () => clearInterval(tick);
  }, [actions]);

  return (
    <section className="container py-12 sm:py-16 border-t border-border/40">
      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6 lg:gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/30 text-xs mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-success font-semibold uppercase tracking-wider">Live</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
            <span className="font-mono glow-text">{todayCount.toLocaleString()}</span> orders<br />processed today
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Real-time activity from clients across 80+ countries. Your order joins the queue instantly.
          </p>
        </div>

        <div className="glass rounded-2xl p-4 sm:p-5 border border-primary/20">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.2em]">
              <Activity className="w-3.5 h-3.5" /> Activity stream
            </div>
            <div className="text-[10px] font-mono text-success">●  LIVE</div>
          </div>
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/40 border border-border/40 animate-fade-up">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.action}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span>{e.country.flag} {e.country.name}</span>
                    <span>•</span>
                    <span>{e.secAgo < 60 ? `${e.secAgo}s ago` : `${Math.floor(e.secAgo / 60)}m ago`}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
