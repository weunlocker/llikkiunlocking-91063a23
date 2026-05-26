import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Mail, User as UserIcon, LogOut, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (profile?.display_name || user?.email || "?")[0]?.toUpperCase();

  return (
    <Layout>
      <Seo
        title="Your Profile — LIKKI UNLOCKING"
        description="View and manage your LIKKI UNLOCKING account details, group, and sign-in options."
        path="/profile"
        noindex
      />
      <div className="container max-w-2xl py-10">
        <h1 className="text-3xl font-bold mb-6">Profile</h1>
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
              {initial}
            </div>
            <div>
              <CardTitle className="text-2xl">{profile?.display_name || "Account"}</CardTitle>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row icon={<UserIcon className="w-4 h-4" />} label="Name" value={profile?.display_name || "—"} />
            <Row icon={<Mail className="w-4 h-4" />} label="Email" value={user?.email || "—"} />
            <Row
              icon={<Shield className="w-4 h-4 text-primary" />}
              label="Group"
              value={<span className="capitalize font-semibold">{profile?.user_group || "standard"}</span>}
            />
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
              </Button>
              <Button variant="destructive" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
