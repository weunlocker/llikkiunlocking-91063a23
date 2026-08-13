import { useEffect } from "react";
import { Wrench } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logo from "@/assets/logo.png";

export default function Maintenance() {
  const { settings } = useSiteSettings();
  const logoSrc = settings.logo_url || logo;

  useEffect(() => {
    document.title = `${settings.maintenance_title} | ${settings.brand_name}`;
    // Hide any third-party / platform badges while maintenance is active
    const style = document.createElement("style");
    style.id = "maintenance-hide-badges";
    style.textContent = `
      #lovable-badge, #lovable-badge-close, [id^="lovable-badge"],
      a[href*="lovable.dev"][target="_blank"],
      gpt-engineer-badge, .gpteng-badge { display: none !important; visibility: hidden !important; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [settings.maintenance_title, settings.brand_name, settings.logo_url]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="glass rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center space-y-5">
        <img src={logoSrc} alt={settings.brand_name} className="h-14 mx-auto object-contain" />
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Wrench className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">{settings.maintenance_title}</h1>
        <p className="text-muted-foreground whitespace-pre-line">{settings.maintenance_message}</p>
        {settings.contact_email && (
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
            <a href={`mailto:${settings.contact_email}`} className="text-primary hover:underline">
              {settings.contact_email}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
