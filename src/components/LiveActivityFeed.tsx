import { useEffect, useState } from "react";
import { CheckCircle2, Activity } from "lucide-react";

const ACTIONS = [
  "iPhone 15 Pro iCloud unlocked",
  "Samsung S24 Ultra carrier check",
  "Xiaomi 14 IMEI verified",
  "iPhone 14 blacklist cleared",
  "Pixel 8 network unlock",
  "iPhone 13 FMI status pulled",
  "Huawei P60 IMEI report",
  "iPhone 12 Sprint unlock",
  "Galaxy A55 carrier lookup",
  "OnePlus 12 IMEI check",
  "iPhone 15 model+IMEI info",
  "iPhone SE iCloud status",
];

const COUNTRIES = [
  { flag: "🇺🇸", name: "USA" },
  { flag: "🇬🇧", name: "UK" },
  { flag: "🇮🇳", name: "India" },
  { flag: "🇦🇪", name: "UAE" },
  { flag: "🇧🇷", name: "Brazil" },
  { flag: "🇩🇪", name: "Germany" },
  { flag: "🇪🇸", name: "Spain" },
  { flag: "🇮🇹", name: "Italy" },
  { flag: "🇲🇽", name: "Mexico" },
  { flag: "🇳🇬", name: "Nigeria" },
  { flag: "🇵🇭", name: "Philippines" },
  { flag: "🇵🇰", name: "Pakistan" },
  { flag: "🇪🇬", name: "Egypt" },
  { flag: "🇸🇦", name: "Saudi Arabia" },
];

type Entry = { id: number; action: string; country: { flag: string; name: string }; secAgo: number };

function makeEntry(id: number): Entry {
  return {
    id,
    action: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
    country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
    secAgo: 1 + Math.floor(Math.random() * 90),
  };
}

export default function LiveActivityFeed() {
  const [entries, setEntries] = useState<Entry[]>(() =>
    Array.from({ length: 4 }, (_, i) => makeEntry(i)).sort((a, b) => a.secAgo - b.secAgo)
  );
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    // Baseline that grows steadily — mimics live processing
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const minutesSinceMidnight = (Date.now() - start.getTime()) / 60000;
    const base = Math.floor(420 + minutesSinceMidnight * 1.6);
    setTodayCount(base);

    const tick = setInterval(() => {
      setTodayCount((n) => n + 1);
      setEntries((prev) => {
        const next = [makeEntry(Date.now()), ...prev].slice(0, 4);
        return next;
      });
    }, 6000 + Math.random() * 4000);
    return () => clearInterval(tick);
  }, []);

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
