import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Wallet, Zap } from "lucide-react";
import { ReactNode } from "react";
import logo from "@/assets/logo.png";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group min-w-0">
            <div className="bg-white rounded-md px-2 py-1 shadow-neon">
              <img src={logo} alt="LIKKI UNLOCKING logo" className="h-7 md:h-8 w-auto block" />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { to: "/", label: "Home" },
              { to: "/services", label: "Services" },
              { to: "/pricing", label: "Pricing" },
              { to: "/api-docs", label: "API" },
            ].map((l) => (
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

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {profile && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md glass text-sm">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="font-mono font-semibold">${Number(profile.balance).toFixed(2)}</span>
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Dashboard</span>
                </Button>
                {isAdmin && (
                  <Button variant="neon" size="sm" onClick={() => navigate("/admin")}>
                    <Zap className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">Admin</span>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Login</Button>
                <Button variant="hero" size="sm" onClick={() => navigate("/register")}>Get Started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/50 mt-20">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} LIKKI UNLOCKING · #1 Direct Wholesale Supplier</p>
        </div>
      </footer>
    </div>
  );
}
