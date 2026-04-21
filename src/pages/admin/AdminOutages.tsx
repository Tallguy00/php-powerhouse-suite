import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Loader2, MapPin, Search, UserCog, Wrench, CheckCircle2, Clock, Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Severity = "low" | "medium" | "high" | "critical";
type Status = "reported" | "investigating" | "in_progress" | "resolved";

type Outage = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  region_id: string | null;
  reported_by: string | null;
  severity: Severity;
  status: Status;
  resolved_at: string | null;
  created_at: string;
};

type Region = { id: string; name_en: string; name_am: string };
type Technician = { id: string; full_name: string | null; phone: string | null };
type Task = { id: string; outage_id: string; technician_id: string; status: string };

const SEVERITY_META: Record<Severity, { en: string; am: string; tone: string }> = {
  low: { en: "Low", am: "ዝቅተኛ", tone: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  medium: { en: "Medium", am: "መካከለኛ", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  high: { en: "High", am: "ከፍተኛ", tone: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  critical: { en: "Critical", am: "አሳሳቢ", tone: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const STATUS_META: Record<Status, { en: string; am: string; tone: string; icon: typeof Clock }> = {
  reported: { en: "Reported", am: "ሪፖርት", tone: "bg-gray-500/10 text-gray-600 border-gray-500/30", icon: AlertTriangle },
  investigating: { en: "Investigating", am: "በማጣራት", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Search },
  in_progress: { en: "In Progress", am: "በሂደት", tone: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Activity },
  resolved: { en: "Resolved", am: "ተፈትቷል", tone: "bg-green-500/10 text-green-600 border-green-500/30", icon: CheckCircle2 },
};

const ALL_STATUSES: Status[] = ["reported", "investigating", "in_progress", "resolved"];
const ALL_SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

const AdminOutages = () => {
  const { roles, loading: authLoading } = useAuth();
  const { lang } = useLang();
  const { toast } = useToast();
  const isAm = lang === "am";
  const fontClass = isAm ? "font-ethiopic" : "";

  const [outages, setOutages] = useState<Outage[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");

  const [assignOutage, setAssignOutage] = useState<Outage | null>(null);
  const [assignTech, setAssignTech] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const isAdmin = roles.includes("admin");

  const load = async () => {
    setLoading(true);
    const [oRes, rRes, trRes, tkRes] = await Promise.all([
      supabase.from("outages").select("*").order("created_at", { ascending: false }),
      supabase.from("regions").select("id, name_en, name_am").order("name_en"),
      supabase.from("user_roles").select("user_id").eq("role", "technician"),
      supabase.from("technician_tasks").select("id, outage_id, technician_id, status"),
    ]);

    if (oRes.error || rRes.error || trRes.error || tkRes.error) {
      toast({
        title: isAm ? "ስህተት" : "Failed to load",
        description: oRes.error?.message ?? rRes.error?.message ?? trRes.error?.message ?? tkRes.error?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setOutages((oRes.data ?? []) as Outage[]);
    setRegions((rRes.data ?? []) as Region[]);
    setTasks((tkRes.data ?? []) as Task[]);

    const techIds = (trRes.data ?? []).map((r: any) => r.user_id);
    if (techIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", techIds);
      setTechnicians((profs ?? []) as Technician[]);
    } else {
      setTechnicians([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const regionMap = useMemo(() => {
    const m = new Map<string, Region>();
    regions.forEach((r) => m.set(r.id, r));
    return m;
  }, [regions]);

  const techMap = useMemo(() => {
    const m = new Map<string, Technician>();
    technicians.forEach((t) => m.set(t.id, t));
    return m;
  }, [technicians]);

  const tasksByOutage = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const arr = m.get(t.outage_id) ?? [];
      arr.push(t);
      m.set(t.outage_id, arr);
    });
    return m;
  }, [tasks]);

  const filtered = useMemo(() => {
    return outages.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (severityFilter !== "all" && o.severity !== severityFilter) return false;
      if (regionFilter !== "all" && o.region_id !== regionFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${o.title} ${o.description ?? ""} ${o.location ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [outages, statusFilter, severityFilter, regionFilter, search]);

  const counts = useMemo(() => {
    return {
      reported: outages.filter((o) => o.status === "reported").length,
      investigating: outages.filter((o) => o.status === "investigating").length,
      in_progress: outages.filter((o) => o.status === "in_progress").length,
      resolved: outages.filter((o) => o.status === "resolved").length,
    };
  }, [outages]);

  const updateStatus = async (o: Outage, next: Status) => {
    setBusyId(o.id);
    const patch: Partial<Outage> = { status: next };
    if (next === "resolved") patch.resolved_at = new Date().toISOString();
    else patch.resolved_at = null;
    const { error } = await supabase.from("outages").update(patch).eq("id", o.id);
    setBusyId(null);
    if (error) {
      toast({ title: isAm ? "ስህተት" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    setOutages((prev) => prev.map((x) => (x.id === o.id ? { ...x, ...patch } as Outage : x)));
    toast({ title: isAm ? "ሁኔታ ተቀይሯል" : "Status updated" });
  };

  const openAssign = (o: Outage) => {
    setAssignOutage(o);
    const existing = tasksByOutage.get(o.id)?.[0];
    setAssignTech(existing?.technician_id ?? "");
  };

  const submitAssign = async () => {
    if (!assignOutage || !assignTech) {
      toast({ title: isAm ? "ቴክኒሻን ይምረጡ" : "Select a technician", variant: "destructive" });
      return;
    }
    setAssigning(true);
    // simple model: replace any prior tasks for this outage
    const existing = tasksByOutage.get(assignOutage.id) ?? [];
    if (existing.length) {
      await supabase.from("technician_tasks").delete().eq("outage_id", assignOutage.id);
    }
    const { data, error } = await supabase
      .from("technician_tasks")
      .insert({
        outage_id: assignOutage.id,
        technician_id: assignTech,
        status: "assigned",
      })
      .select()
      .single();

    if (error || !data) {
      setAssigning(false);
      toast({ title: isAm ? "ስህተት" : "Error", description: error?.message, variant: "destructive" });
      return;
    }

    // bump outage to investigating if still reported
    if (assignOutage.status === "reported") {
      await supabase.from("outages").update({ status: "investigating" }).eq("id", assignOutage.id);
      setOutages((prev) => prev.map((x) => (x.id === assignOutage.id ? { ...x, status: "investigating" } : x)));
    }

    setTasks((prev) => [...prev.filter((t) => t.outage_id !== assignOutage.id), data as Task]);
    setAssigning(false);
    setAssignOutage(null);
    toast({ title: isAm ? "ቴክኒሻን ተመድቧል" : "Technician assigned" });
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className={cn("text-3xl font-bold tracking-tight flex items-center gap-2", fontClass)}>
            <AlertTriangle className="h-7 w-7 text-primary" />
            {isAm ? "የኤሌክትሪክ መቋረጥ" : "Outages"}
          </h1>
          <p className={cn("text-sm text-muted-foreground mt-1", fontClass)}>
            {isAm
              ? "ሁሉንም የመቋረጥ ሪፖርቶች ያስተዳድሩ እና ለቴክኒሻኖች ይመድቡ።"
              : "Manage all outage reports and assign them to technicians."}
          </p>
        </div>

        {/* Status counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ALL_STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            return (
              <Card
                key={s}
                className={cn("cursor-pointer transition-smooth hover:shadow-md", statusFilter === s && "ring-2 ring-primary")}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", meta.tone)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={cn("text-xs text-muted-foreground", fontClass)}>{isAm ? meta.am : meta.en}</p>
                    <p className="text-2xl font-bold">{counts[s]}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isAm ? "በርዕስ፣ መግለጫ ወይም አካባቢ ይፈልጉ…" : "Search title, description, location…"}
                className={cn("pl-9", fontClass)}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as Severity | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><span className={fontClass}>{isAm ? "ሁሉም ደረጃዎች" : "All severities"}</span></SelectItem>
                {ALL_SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className={fontClass}>{isAm ? SEVERITY_META[s].am : SEVERITY_META[s].en}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><span className={fontClass}>{isAm ? "ሁሉም ክልሎች" : "All regions"}</span></SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className={fontClass}>{isAm ? r.name_am : r.name_en}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className={cn("text-muted-foreground", fontClass)}>
                {isAm ? "ምንም መቋረጥ አልተገኘም" : "No outages match your filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((o) => {
              const sev = SEVERITY_META[o.severity];
              const st = STATUS_META[o.status];
              const StatusIcon = st.icon;
              const region = o.region_id ? regionMap.get(o.region_id) : null;
              const taskList = tasksByOutage.get(o.id) ?? [];
              const assignedTech = taskList[0] ? techMap.get(taskList[0].technician_id) : null;
              const busy = busyId === o.id;

              return (
                <Card key={o.id} className="transition-smooth hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className={cn("font-semibold text-base", fontClass)}>{o.title}</h3>
                          <Badge variant="outline" className={sev.tone}>
                            <span className={fontClass}>{isAm ? sev.am : sev.en}</span>
                          </Badge>
                          <Badge variant="outline" className={st.tone}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            <span className={fontClass}>{isAm ? st.am : st.en}</span>
                          </Badge>
                        </div>
                        {o.description && (
                          <p className={cn("text-sm text-muted-foreground line-clamp-2", fontClass)}>{o.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          {region && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className={fontClass}>{isAm ? region.name_am : region.name_en}</span>
                            </span>
                          )}
                          {o.location && <span className={fontClass}>· {o.location}</span>}
                          <span>· {new Date(o.created_at).toLocaleString()}</span>
                          {assignedTech && (
                            <span className="flex items-center gap-1 text-primary">
                              <Wrench className="h-3 w-3" />
                              <span className={fontClass}>{assignedTech.full_name ?? "Technician"}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                      <Select
                        value={o.status}
                        onValueChange={(v) => updateStatus(o, v as Status)}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-9 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              <span className={fontClass}>{isAm ? STATUS_META[s].am : STATUS_META[s].en}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => openAssign(o)} disabled={busy}>
                        <UserCog className="h-4 w-4 mr-1" />
                        <span className={fontClass}>
                          {assignedTech ? (isAm ? "ቴክኒሻን ቀይር" : "Reassign") : (isAm ? "ቴክኒሻን ይመድቡ" : "Assign technician")}
                        </span>
                      </Button>
                      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Assign dialog */}
        <Dialog open={!!assignOutage} onOpenChange={(open) => !open && setAssignOutage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className={fontClass}>
                {isAm ? "ቴክኒሻን ይመድቡ" : "Assign technician"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {assignOutage && (
                <div className="text-sm text-muted-foreground">
                  <p className={cn("font-medium text-foreground", fontClass)}>{assignOutage.title}</p>
                  {assignOutage.location && <p className={fontClass}>{assignOutage.location}</p>}
                </div>
              )}
              <div className="space-y-2">
                <Label className={fontClass}>{isAm ? "ቴክኒሻን" : "Technician"}</Label>
                {technicians.length === 0 ? (
                  <p className={cn("text-sm text-muted-foreground", fontClass)}>
                    {isAm
                      ? "ምንም ቴክኒሻን የለም። በደንበኞች ገጽ ላይ ቴክኒሻን ሚና ያድርጉ።"
                      : "No technicians yet. Grant the technician role on the Customers page."}
                  </p>
                ) : (
                  <Select value={assignTech} onValueChange={setAssignTech}>
                    <SelectTrigger><SelectValue placeholder={isAm ? "ቴክኒሻን ይምረጡ" : "Select a technician"} /></SelectTrigger>
                    <SelectContent>
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className={fontClass}>{t.full_name ?? "—"}</span>
                          {t.phone && <span className="text-xs text-muted-foreground ml-2">{t.phone}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOutage(null)} disabled={assigning}>
                <span className={fontClass}>{isAm ? "ሰርዝ" : "Cancel"}</span>
              </Button>
              <Button onClick={submitAssign} disabled={assigning || !assignTech}>
                {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <span className={fontClass}>{isAm ? "መድብ" : "Assign"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminOutages;
