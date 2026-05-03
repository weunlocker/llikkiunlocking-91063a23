import { Link } from "react-router-dom";
import defaultLogo from "@/assets/logo.png";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function BrandHeader() {
  const { settings } = useSiteSettings();
  const logoSrc = settings.logo_url || defaultLogo;

  return (
    <Link to="/" className="flex items-center justify-center mb-8">
      <div className="bg-white rounded-md px-3 py-2 shadow-neon">
        <img src={logoSrc} alt={`${settings.brand_name} logo`} className="h-12 w-auto block" />
      </div>
    </Link>
  );
}
