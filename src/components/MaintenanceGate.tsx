import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";
import Maintenance from "@/pages/Maintenance";

/** Allowed while maintenance is active so admins can still sign in and manage the site. */
const ALLOWED = ["/admin", "/login", "/reset-password", "/login-otp"];

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { settings, loading } = useSiteSettings();
  const { isAdmin, loading: authLoading } = useAuth();
  const { pathname } = useLocation();

  if (!settings.maintenance_enabled || loading || authLoading) return <>{children}</>;
  if (isAdmin) return <>{children}</>;
  if (ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return <>{children}</>;

  return <Maintenance />;
}
