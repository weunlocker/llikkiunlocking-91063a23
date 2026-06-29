import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Wallet, Zap, Menu, X, Sun, Moon, User as UserIcon, Shield } from "lucide-react";
import { ReactNode, useState } from "react";
import defaultLogo from "@/assets/logo.png";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useTheme } from "@/hooks/useTheme";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PromoRibbon from "@/components/PromoRibbon";
import AdminProfileMenu from "@/components/AdminProfileMenu";

import { useSupportNotifications } from "@/hooks/useSupportNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { settings } = useSiteSettings();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const logoSrc = settings.logo_url || defaultLogo;
  const [menuOpen, setMenuOpen] = useState(false);
  useSupportNotifications();

  const allNavLinks = [
    { to: "/", label: "Home" },
    { to: "/services", label: "Services" },
    { to: "/free-check", label: "Free Check" },
    { to: "/pricing", label: "Pricing" },
  ];
  const isDashboardArea = location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/admin") || location.pathname.startsWith("/profile");
  const navLinks = isDashboardArea ? allNavLinks.filter((l) => l.to === "/") : allNavLinks;

  return (
    <div className="min-h-screen flex flex-col">
      <PromoRibbon />
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex h-14 sm:h-16 items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 group min-w-0 shrink">
            <div className="bg-white rounded-md px-1.5 py-1 shadow-neon shrink-0">
              <img src={logoSrc} alt={`${settings.brand_name} logo`} className="h-6 sm:h-7 md:h-8 w-auto block" />
            </div>
          </Link>

          {!isDashboardArea && (
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    `px-4 py-2 text-sm rounded-md transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isDashboardArea && (
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `hidden sm:inline-flex px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                Home
              </NavLink>
            )}
            
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            {user ? (
              <>
                {profile && (
                  <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md glass text-xs sm:text-sm">
                    <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    <span className="font-mono font-semibold">${Number(profile.balance).toFixed(2)}</span>
                  </div>
                )}
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" aria-label="Dashboard" onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden md:inline ml-2">Dashboard</span>
                </Button>
                {isAdmin && (
                  <Button variant="neon" size="sm" className="hidden sm:inline-flex" aria-label="Admin dashboard" onClick={() => navigate("/admin")}>
                    <Zap className="w-4 h-4" />
                    <span className="hidden md:inline ml-2">Admin</span>
                  </Button>
                )}
                <div className="hidden sm:flex">
                  <AdminProfileMenu mode="client" />
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/login")}>Login</Button>
                <Button variant="hero" size="sm" onClick={() => navigate("/register")}>Get Started</Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t border-border/50 glass">
            <nav className="container flex flex-col py-2">
              {navLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-3 text-sm rounded-md transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              {user && (
                <>
                  <NavLink
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `px-3 py-3 text-sm rounded-md transition-colors ${
                        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      }`
                    }
                  >
                    Dashboard
                  </NavLink>
                  {isAdmin && (
                    <NavLink
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `px-3 py-3 text-sm rounded-md transition-colors ${
                          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        }`
                      }
                    >
                      Admin
                    </NavLink>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); signOut(); }}
                    className="px-3 py-3 text-sm text-left rounded-md text-muted-foreground hover:text-foreground"
                  >
                    Sign out
                  </button>
                </>
              )}
              {!user && (
                <NavLink
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-3 text-sm rounded-md text-muted-foreground hover:text-foreground"
                >
                  Login
                </NavLink>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/50 mt-12 sm:mt-20 pb-24 sm:pb-8">
        <div className="container py-6 sm:py-8 text-center text-sm text-muted-foreground space-y-2">
          <p>© 2018–{new Date().getFullYear()} {settings.brand_name}{settings.tagline ? ` · ${settings.tagline}` : ""}</p>
          {(settings.contact_email || settings.contact_phone) && (
            <p className="text-xs">
              {settings.contact_email && <a href={`mailto:${settings.contact_email}`} className="hover:text-primary">{settings.contact_email}</a>}
              {settings.contact_email && settings.contact_phone && " · "}
              {settings.contact_phone && <a href={`tel:${settings.contact_phone}`} className="hover:text-primary">{settings.contact_phone}</a>}
            </p>
          )}
          {settings.footer_text && <p className="text-xs">{settings.footer_text}</p>}
        </div>
      </footer>
    </div>
  );
}
