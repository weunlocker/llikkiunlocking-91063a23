import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Briefcase, ListOrdered, Wallet, Settings,
  ShieldCheck, LogOut, ExternalLink, Bell, Plug, Tags, Mail,
} from "lucide-react";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/suppliers", label: "Suppliers", icon: Plug },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/services", label: "Services", icon: Briefcase },
  { to: "/admin/orders", label: "Orders", icon: ListOrdered },
  { to: "/admin/transactions", label: "Transactions", icon: Wallet },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/email-settings", label: "Email / SMTP", icon: Mail },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children, title, subtitle, actions }: {
  children: ReactNode; title: string; subtitle?: string; actions?: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-md flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-border/60">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="bg-white rounded-md px-2 py-1 shadow-neon">
              <img src={logo} alt="LIKKI UNLOCKING" className="h-6 w-auto block" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-primary font-bold">Admin Panel</div>
              <div className="text-[10px] text-muted-foreground">LIKKI UNLOCKING</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate("/")}>
            <ExternalLink className="w-4 h-4 mr-2" /> View Public Site
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
