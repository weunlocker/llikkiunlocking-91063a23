import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Wallet, Zap, Menu, X, Sun, Moon, User as UserIcon, Shield } from "lucide-react";
import { ReactNode, useState } from "react";
import defaultLogo from "@/assets/logo.png";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useTheme } from "@/hooks/useTheme";
import LanguageSwitcher from "@/components/LanguageSwitcher";
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
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex h-14 sm:h-16 items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 group min-w-0 shrink">
            <div className="bg-white rounded-md px-1.5 py-1 shadow-neon shrink-0">
              <img src={logoSrc} alt={`${settings.brand_name} logo`} className="h-6 sm:h-7 md:h-8 w-auto block" />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
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

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden md:inline ml-2">Dashboard</span>
                </Button>
                {isAdmin && (
                  <Button variant="neon" size="sm" className="hidden sm:inline-flex" aria-label="Admin dashboard" onClick={() => navigate("/admin")}>
                    <Zap className="w-4 h-4" />
                    <span className="hidden md:inline ml-2">Admin</span>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="hidden sm:inline-flex rounded-full" title="Profile" aria-label="Profile menu">
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold uppercase">
                        {(profile?.display_name || user.email || "?").slice(0, 1)}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 bg-popover">
                    <DropdownMenuLabel className="space-y-1">
                      <div className="font-semibold truncate">{profile?.display_name || "Account"}</div>
                      <div className="text-xs text-muted-foreground truncate font-normal">{user.email}</div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <Shield className="w-3 h-3 text-primary" />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Group:</span>
                        <span className="text-xs font-semibold capitalize">{profile?.user_group || "standard"}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                      <UserIcon className="w-4 h-4 mr-2" /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/dashboard")} className="cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4 mr-2" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
              className="md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-border/50 glass">
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
