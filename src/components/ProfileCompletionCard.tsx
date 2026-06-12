import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileCompletionCard() {
  const { profile } = useAuth();
  if (!profile) return null;

  const fields = [
    { key: "display_name", label: "Display name", value: profile.display_name },
    { key: "phone", label: "Phone", value: (profile as any).phone },
    { key: "address", label: "Address", value: (profile as any).address },
    { key: "city", label: "City", value: (profile as any).city },
    { key: "country", label: "Country", value: (profile as any).country },
  ];
  const filled = fields.filter((f) => f.value && String(f.value).trim().length > 0);
  const pct = Math.round((filled.length / fields.length) * 100);

  if (pct === 100) return null;

  return (
    <Card className="p-4 sm:p-5 glass">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <UserCog className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Complete your profile</h3>
            <p className="text-xs text-muted-foreground">{pct}% complete — finish for a smoother checkout</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/profile">Edit</Link>
        </Button>
      </div>
      <Progress value={pct} className="h-2 mb-3" />
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
        {fields.map((f) => {
          const done = !!(f.value && String(f.value).trim());
          return (
            <li key={f.key} className={`flex items-center gap-1.5 ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              <span>{f.label}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
