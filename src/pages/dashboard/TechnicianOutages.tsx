import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Navigate } from "react-router-dom";
import { Loader2, AlertTriangle, MapPin, Clock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Severity = "low" | "medium" | "high" | "critical";
type Status = "reported" | "investigating" | "in_progress" | "resolved";

interface Outage {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  severity: Severity;
  status: Status;
  region_id: string | null;
  created_at: string;
  resolved_at: string | null;
}
interface Region { id: string; name_en: string; name_am: string }

const SEV_TONE: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-accent text-accent-foreground",
  critical: "bg-destructive text-destructive-foreground",
};
const STATUS_TONE: Record<Status, string> = {
  reported: "bg-secondary text-secondary-foreground",
  investigating: "bg-accent text-accent-foreground",
  in_progress: "bg-primary text-primary-foreground",
  resolved: "bg-success text-success-foreground",
};

const TechnicianOutages = () => {
  const { roles, loading: authLoading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";
  const fontEth = am ? "font-ethiopic" : "";
  const [loading, setLoading] = useState(true);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [regions, setRegions] = useState<Record<string, Region>>({});
  const [filter, setFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!roles.includes("technician")) return;
    (async () => {
      setLoading(true);
      const [{ data: o }, { data: r }] = await Promise.all([
        supabase.from("outages")
          .select("id,title,description,location,severity,status,region_id,created_at,resolved_at")
          .order("created_at", { ascending: false }),
        supabase.from("regions").select("id,name_en,name_am"),
      ]);
      setOutages((o ?? []) as Outage[]);
      const map: Record<string, Region> = {};
      (r ?? []).forEach((x) => { map[x.id] = x as Region; });
      setRegions(map);
      setLoading(false);
    })();
  }, [roles]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!roles.includes("technician")) return <Navigate to="/dashboard" replace />;

  const q = search.trim().toLowerCase();
  const visible = outages
    .filter((o) => filter === "all" ? true : o.status === filter)
    .filter((o) => !q ? true : (
      o.title.toLowerCase().includes(q) ||
      (o.location ?? "").toLowerCase().includes(q) ||
      (o.description ?? "").toLowerCase().includes(q)
    ));

  const counts = {
    all: outages.length,
    reported: outages.filter((o) => o.status === "reported").length,
    investigating: outages.filter((o) => o.status === "investigating").length,
    in_progress: outages.filter((o) => o.status === "in_progress").length,
    resolved: outages.filter((o) => o.status === "resolved").length,
  };

  const fmt = (d: string) => new Date(d).toLocaleString(am ? "am-ET" : "en-US",
    { dateStyle: "medium", timeStyle: "short" });
  const regionName = (id: string | null) => id ? (am ? regions[id]?.name_am : regions[id]?.name_en) ?? "—" : "—";

  return (
    <DashboardLayout>
      <div>
        <h1 className={`text-3xl font-bold tracking-tight ${fontEth}`}>
          {am ? "የመቋረጥ ዝርዝር" : "Outages Feed"}
        </h1>
        <p className={`text-sm text-muted-foreground mt-1 ${fontEth}`}>
          {am ? "በሁሉም ክልሎች ያሉ የኤሌክትሪክ መቋረጦች።" : "Live view of outages across all regions."}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={am ? "ፈልግ..." : "Search title, location..."}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Status | "all")}>
          <TabsList>
            <TabsTrigger value="all">{am ? "ሁሉም" : "All"} ({counts.all})</TabsTrigger>
            <TabsTrigger value="reported">{am ? "ሪፖርት" : "Reported"} ({counts.reported})</TabsTrigger>
            <TabsTrigger value="investigating">{am ? "ምርመራ" : "Investigating"} ({counts.investigating})</TabsTrigger>
            <TabsTrigger value="in_progress">{am ? "በመካሄድ" : "In Progress"} ({counts.in_progress})</TabsTrigger>
            <TabsTrigger value="resolved">{am ? "ተፈቷል" : "Resolved"} ({counts.resolved})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className={fontEth}>{am ? "ምንም መቋረጥ አልተገኘም።" : "No outages found."}</p>
          </div>
        ) : visible.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-elegant transition-smooth">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-lg truncate">{o.title}</h3>
                  <Badge className={SEV_TONE[o.severity]}>{o.severity}</Badge>
                  <Badge className={STATUS_TONE[o.status]}>{o.status.replace("_", " ")}</Badge>
                </div>
                {o.description && <p className="text-sm text-muted-foreground mt-1.5">{o.description}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {o.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{o.location}</span>}
                  <span>{regionName(o.region_id)}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmt(o.created_at)}</span>
                  {o.resolved_at && <span className="text-success">✓ {fmt(o.resolved_at)}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default TechnicianOutages;