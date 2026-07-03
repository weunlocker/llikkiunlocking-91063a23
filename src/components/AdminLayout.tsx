import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Briefcase, ListOrdered, Wallet, Settings,
  ShieldCheck, LogOut, ExternalLink, Bell, Plug, Tags, Mail, X, Send, Network, CreditCard, Shield, Crown, Gift, BarChart3, MessageSquare, Activity, ChevronDown, Smartphone, Server, Package, Menu, Bot, FileText,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import AdminProfileMenu from "@/components/AdminProfileMenu";
import AdminNotificationsBell from "@/components/AdminNotificationsBell";
import AdminGlobalSearch from "@/components/AdminGlobalSearch";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  children?: { to: string; label: string; icon: typeof LayoutDashboard }[];
};

const baseNavItems: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/login-activity", label: "Login Activity", icon: Activity },
  { to: "/admin/administrators", label: "Administrators", icon: ShieldCheck },
  { to: "/admin/groups", label: "Client Groups", icon: Crown },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/services", label: "Services", icon: Briefcase },
  { to: "/admin/stock", label: "Digital Stock", icon: Package },

  { to: "/admin/orders", label: "Orders", icon: ListOrdered },
  { to: "/admin/transactions", label: "Transactions", icon: Wallet },
  { to: "/admin/support", label: "Support", icon: MessageSquare },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/referrals", label: "Referrals", icon: Gift },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/telegram-bot", label: "Telegram Bot", icon: Send },
  { to: "/admin/api-providers", label: "API Providers", icon: Network },
  { to: "/admin/email-settings", label: "Email / SMTP", icon: Mail },
  { to: "/admin/email-templates", label: "Email Templates", icon: Mail },

  { to: "/admin/turnstile", label: "Turnstile", icon: Shield },
  { to: "/admin/ai-settings", label: "AI / Chatbot", icon: Bot },
  { to: "/admin/settings", label: "Settings", icon: Settings },

];

export default function AdminLayout({ children, title, subtitle, actions }: {
  children: ReactNode; title: string; subtitle?: string; actions?: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const logoSrc = settings.logo_url || logo;
  const [open, setOpen] = useState(false);
  const [supportPending, setSupportPending] = useState(0);
  const servicesActive = location.pathname.startsWith("/admin/services");
  const [servicesOpen, setServicesOpen] = useState(servicesActive);
  useEffect(() => { if (servicesActive) setServicesOpen(true); }, [servicesActive]);

  const navItems: NavItem[] = baseNavItems.map((item) => {
    if (item.to === "/admin/services" && settings.service_types_enabled) {
      return {
        ...item,
        children: [
          { to: "/admin/services?type=imei", label: "IMEI Services", icon: Smartphone },
          { to: "/admin/services?type=server", label: "Server Services", icon: Server },
        ],
      };
    }
    return item;
  });

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("unread_for_admin", true)
        .neq("status", "closed");
      setSupportPending(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("admin-support-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

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
        <div className="mb-2">
          <AdminGlobalSearch />
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.children) {
            return (
              <div key={item.to}>
                <button
                  type="button"
                  onClick={() => setServicesOpen((v) => !v)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    servicesActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
                </button>
                {servicesOpen && (
                  <div className="ml-3 mt-1 space-y-1 border-l border-border/60 pl-2">
                    {item.children.map((c) => {
                      const CIcon = c.icon;
                      const typeParam = new URLSearchParams(c.to.split("?")[1] ?? "").get("type");
                      const currentType = new URLSearchParams(location.search).get("type");
                      const isActive = location.pathname.startsWith("/admin/services") && currentType === typeParam;
                      return (
                        <NavLink
                          key={c.to}
                          to={c.to}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                          }`}
                        >
                          <CIcon className="w-3.5 h-3.5" />
                          <span className="flex-1">{c.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
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
              <span className="flex-1">{item.label}</span>
              {item.to === "/admin/support" && supportPending > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {supportPending > 99 ? "99+" : supportPending}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

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
            {(actions || true) && (
              <div className="flex flex-wrap items-center gap-2 md:shrink-0">
                {actions}
                <AdminNotificationsBell />
                <AdminProfileMenu />
              </div>
            )}
          </div>
        </header>
        <main className="p-4 sm:p-6 md:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
