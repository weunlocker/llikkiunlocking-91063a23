import { ReactNode, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Briefcase, ListOrdered, Wallet, Settings,
  ShieldCheck, LogOut, ExternalLink, Bell, Plug, Tags, Mail, Menu, X, Send, Network,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/services", label: "Services", icon: Briefcase },
  { to: "/admin/orders", label: "Orders", icon: ListOrdered },
  { to: "/admin/transactions", label: "Transactions", icon: Wallet },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/telegram-bot", label: "Telegram Bot", icon: Send },
  { to: "/admin/api-providers", label: "API Providers", icon: Network },
  { to: "/admin/email-settings", label: "Email / SMTP", icon: Mail },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children, title, subtitle, actions }: {
  children: ReactNode; title: string; subtitle?: string; actions?: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const logoSrc = settings.logo_url || logo;
  const [open, setOpen] = useState(false);

  const SidebarBody = (
    <>
      <div className="px-5 py-5 border-b border-border/60 flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-md px-2 py-1 shadow-neon">
            <img src={logoSrc} alt={settings.brand_name} className="h-6 w-auto block" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-primary font-bold">Admin Panel</div>
            <div className="text-[10px] text-muted-foreground">{settings.brand_name}</div>
          </div>
        </Link>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/60 space-y-2">
        <div className="px-3 py-2 rounded-lg glass">
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="font-bold text-primary">ADMIN</span>
          </div>
          <div className="text-xs text-muted-foreground truncate mt-1">{profile?.email}</div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setOpen(false); navigate("/"); }}>
          <ExternalLink className="w-4 h-4 mr-2" /> View Public Site
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-md flex-col sticky top-0 h-screen">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border/60 bg-card flex flex-col md:hidden animate-in slide-in-from-left">
            {SidebarBody}
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 sm:px-6 md:px-8 py-3 sm:py-4">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setOpen(true)} aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">{title}</h1>
                {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
              </div>
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2 md:shrink-0 [&>div.relative]:flex-1 [&>div.relative]:min-w-0 md:[&>div.relative]:w-64 md:[&>div.relative]:flex-none">
                {actions}
              </div>
            )}
          </div>
        </header>
        <main className="p-4 sm:p-6 md:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
