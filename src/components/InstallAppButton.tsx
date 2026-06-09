import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast.success("App installed");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") toast.success("Installing app…");
      setDeferred(null);
      return;
    }
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    if (isIOS) {
      toast.info("On iPhone: tap Share → Add to Home Screen", { duration: 6000 });
    } else {
      toast.info("Open browser menu → Install app / Add to Home Screen", { duration: 6000 });
    }
  };

  if (installed) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium">App installed</p>
            <p className="text-xs text-muted-foreground">You're using LIKKI as an installed app.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 gap-3">
      <div>
        <p className="text-sm font-medium">Install app on your phone</p>
        <p className="text-xs text-muted-foreground">Add LIKKI to your home screen for a fullscreen app experience.</p>
      </div>
      <Button onClick={handleClick} size="sm" className="shrink-0">
        <Download className="w-4 h-4 mr-2" />
        Install app
      </Button>
    </div>
  );
}
