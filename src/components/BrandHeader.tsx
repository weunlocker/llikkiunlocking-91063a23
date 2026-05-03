import { Link } from "react-router-dom";
import defaultLogo from "@/assets/logo.png";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function BrandHeader() {
  const { settings } = useSiteSettings();
  const logoSrc = settings.logo_url || defaultLogo;

  return (
    <Link to="/" className="flex items-center justify-center gap-3 mb-8">
      <div className="bg-white rounded-md px-2 py-1 shadow-neon">
        <img src={logoSrc} alt={`${settings.brand_name} logo`} className="h-10 w-auto block" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-bold text-xl">{settings.brand_name}</span>
        {settings.tagline && <span className="text-xs text-muted-foreground">{settings.tagline}</span>}
      </div>
    </Link>
  );
}
