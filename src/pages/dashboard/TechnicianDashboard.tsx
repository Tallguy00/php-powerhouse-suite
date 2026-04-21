import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Wrench, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

const TechnicianDashboard = () => {
  const { user, roles, loading } = useAuth();
  const { lang } = useLang();
  const [stats, setStats] = useState({ assigned: 0, inProgress: 0, completed: 0 });

  useEffect(() => {
    if (!user || !roles.includes("technician")) return;
    (async () => {
      const { data } = await supabase.from("technician_tasks").select("status").eq("technician_id", user.id);
      setStats({
        assigned: data?.filter((t) => t.status === "assigned").length ?? 0,
        inProgress: data?.filter((t) => t.status === "in_progress").length ?? 0,
        completed: data?.filter((t) => t.status === "completed").length ?? 0,
      });
    })();
  }, [user, roles]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!roles.includes("technician")) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <h1 className={`text-3xl font-bold tracking-tight ${lang === "am" ? "font-ethiopic" : ""}`}>
        {lang === "am" ? "የቴክኒሻን ዳሽቦርድ" : "Technician Dashboard"}
      </h1>
      <div className="mt-8 grid sm:grid-cols-3 gap-5">
        <StatCard icon={Wrench} tone="secondary" label={lang === "am" ? "የተመደቡ" : "Assigned"} value={String(stats.assigned)} amharic={lang === "am"} />
        <StatCard icon={AlertTriangle} tone="accent" label={lang === "am" ? "በመካሄድ ላይ" : "In Progress"} value={String(stats.inProgress)} amharic={lang === "am"} />
        <StatCard icon={CheckCircle2} tone="success" label={lang === "am" ? "ተጠናቋል" : "Completed"} value={String(stats.completed)} amharic={lang === "am"} />
      </div>
      <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        <p className={lang === "am" ? "font-ethiopic" : ""}>
          {lang === "am" ? "የተግባር ዝርዝር በቅርቡ።" : "Task list coming soon."}
        </p>
      </div>
    </DashboardLayout>
  );
};

export default TechnicianDashboard;