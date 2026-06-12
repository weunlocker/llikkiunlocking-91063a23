import { NavLink, useLocation } from "react-router-dom";
import { Home, LayoutGrid, ClipboardList, User, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { to: "/", icon: Home, label: "Home", end: true },
  { to: "/services", icon: LayoutGrid, label: "Services" },
  { to: "/dashboard?tab=orders", icon: ClipboardList, label: "Orders", match: "/dashboard" },
  { to: "/help", icon: HelpCircle, label: "Help" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot") || pathname.startsWith("/reset")) return null;

  // Show auth-only items only when logged in; otherwise swap Profile -> Login
  const navItems = user
    ? items
    : items.map((i) =>
        i.to === "/profile"
          ? { to: "/login", icon: User, label: "Login", end: false }
          : i.to.startsWith("/dashboard")
          ? { to: "/login", icon: ClipboardList, label: "Orders", end: false }
          : i
      );

  return (
    <nav
      aria-label="Bottom navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border/60 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {navItems.map((i) => {
          const active = i.end
            ? pathname === i.to
            : pathname.startsWith((i as any).match || i.to.split("?")[0]);
          return (
            <li key={i.label}>
              <NavLink
                to={i.to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <i.icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_6px_hsl(var(--primary))]" : ""}`} />
                <span>{i.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
