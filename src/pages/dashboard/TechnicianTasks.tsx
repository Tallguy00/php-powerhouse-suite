import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Navigate } from "react-router-dom";
import { Loader2, Wrench, AlertTriangle, CheckCircle2, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type TaskStatus = "assigned" | "in_progress" | "completed";
type OutageStatus = "reported" | "investigating" | "in_progress" | "resolved";
type Severity = "low" | "medium" | "high" | "critical";

interface Task {
  id: string;
  outage_id: string;
  status: TaskStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
interface Outage {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  severity: Severity;
  status: OutageStatus;
  region_id: string | null;
  created_at: string;
}
interface Region { id: string; name_en: string; name_am: string }

const SEV_TONE: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-accent text-accent-foreground",
  critical: "bg-destructive text-destructive-foreground",
};
const TASK_TONE: Record<TaskStatus, string> = {
  assigned: "bg-secondary text-secondary-foreground",
  in_progress: "bg-accent text-accent-foreground",
  completed: "bg-success text-success-foreground",
};

const TechnicianTasks = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";
  const fontEth = am ? "font-ethiopic" : "";
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [outages, setOutages] = useState<Record<string, Outage>>({});
  const [regions, setRegions] = useState<Record<string, Region>>({});
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const [editStatus, setEditStatus] = useState<TaskStatus>("assigned");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: t } = await supabase.from("technician_tasks")
      .select("id,outage_id,status,notes,created_at,updated_at")
      .eq("technician_id", user.id).order("updated_at", { ascending: false });
    const taskList = (t ?? []) as Task[];
    setTasks(taskList);
    const ids = Array.from(new Set(taskList.map((x) => x.outage_id)));
    if (ids.length) {
      const { data: o } = await supabase.from("outages")
        .select("id,title,description,location,severity,status,region_id,created_at").in("id", ids);
      const map: Record<string, Outage> = {};
      (o ?? []).forEach((x) => { map[x.id] = x as Outage; });
      setOutages(map);
    }
    const { data: r } = await supabase.from("regions").select("id,name_en,name_am");
    const rmap: Record<string, Region> = {};
    (r ?? []).forEach((x) => { rmap[x.id] = x as Region; });
    setRegions(rmap);
    setLoading(false);
  };

  useEffect(() => { if (user && roles.includes("technician")) load(); }, [user, roles]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!roles.includes("technician")) return <Navigate to="/dashboard" replace />;

  const visible = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const counts = {
    assigned: tasks.filter((t) => t.status === "assigned").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setEditStatus(task.status);
    setEditNotes(task.notes ?? "");
  };

  const submitEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("technician_tasks")
      .update({ status: editStatus, notes: editNotes || null, updated_at: new Date().toISOString() })
      .eq("id", editing.id);
    if (error) {
      toast.error(am ? "ማሻሻል አልተሳካም" : "Update failed");
    } else {
      // mirror to outage status when completed
      if (editStatus === "completed") {
        await supabase.from("outages").update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", editing.outage_id);
      } else if (editStatus === "in_progress") {
        await supabase.from("outages").update({ status: "in_progress" }).eq("id", editing.outage_id);
      }
      toast.success(am ? "ተቀምጧል" : "Saved");
      setEditing(null);
      load();
    }
    setSaving(false);
  };

  const fmt = (d: string) => new Date(d).toLocaleString(am ? "am-ET" : "en-US",
    { dateStyle: "medium", timeStyle: "short" });
  const regionName = (id: string | null) => id ? (am ? regions[id]?.name_am : regions[id]?.name_en) ?? "—" : "—";

  return (
    <DashboardLayout>
      <div>
        <h1 className={`text-3xl font-bold tracking-tight ${fontEth}`}>
          {am ? "የእኔ ተግባራት" : "My Tasks"}
        </h1>
        <p className={`text-sm text-muted-foreground mt-1 ${fontEth}`}>
          {am ? "የተመደቡ የመጠገን ሥራዎችን ያስተዳድሩ።" : "Manage your assigned repair tasks."}
        </p>
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between"><span className={`text-sm text-muted-foreground ${fontEth}`}>{am ? "የተመደቡ" : "Assigned"}</span><Wrench className="h-5 w-5 text-secondary" /></div>
          <div className="mt-2 text-3xl font-bold">{counts.assigned}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between"><span className={`text-sm text-muted-foreground ${fontEth}`}>{am ? "በመካሄድ ላይ" : "In Progress"}</span><AlertTriangle className="h-5 w-5 text-accent" /></div>
          <div className="mt-2 text-3xl font-bold">{counts.in_progress}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between"><span className={`text-sm text-muted-foreground ${fontEth}`}>{am ? "ተጠናቋል" : "Completed"}</span><CheckCircle2 className="h-5 w-5 text-success" /></div>
          <div className="mt-2 text-3xl font-bold">{counts.completed}</div>
        </div>
      </div>

      <div className="mt-6">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskStatus | "all")}>
          <TabsList>
            <TabsTrigger value="all">{am ? "ሁሉም" : "All"} ({tasks.length})</TabsTrigger>
            <TabsTrigger value="assigned">{am ? "የተመደቡ" : "Assigned"}</TabsTrigger>
            <TabsTrigger value="in_progress">{am ? "በመካሄድ" : "In Progress"}</TabsTrigger>
            <TabsTrigger value="completed">{am ? "ተጠናቋል" : "Completed"}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className={fontEth}>{am ? "ምንም ተግባራት አልተገኙም።" : "No tasks found."}</p>
          </div>
        ) : visible.map((task) => {
          const o = outages[task.outage_id];
          return (
            <div key={task.id} className="rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-elegant transition-smooth">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-lg truncate">{o?.title ?? "—"}</h3>
                    {o && <Badge className={SEV_TONE[o.severity]}>{o.severity}</Badge>}
                    <Badge className={TASK_TONE[task.status]}>{task.status.replace("_", " ")}</Badge>
                  </div>
                  {o?.description && <p className="text-sm text-muted-foreground mt-1.5">{o.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    {o?.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{o.location}</span>}
                    <span>{regionName(o?.region_id ?? null)}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmt(task.updated_at)}</span>
                  </div>
                  {task.notes && <p className="mt-3 text-sm bg-muted/50 rounded-lg p-3 border border-border">{task.notes}</p>}
                </div>
                <Button onClick={() => openEdit(task)} size="sm">
                  {am ? "አሻሽል" : "Update"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={fontEth}>{am ? "ተግባር አሻሽል" : "Update Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={`text-sm font-medium ${fontEth}`}>{am ? "ሁኔታ" : "Status"}</label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TaskStatus)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">{am ? "የተመደበ" : "Assigned"}</SelectItem>
                  <SelectItem value="in_progress">{am ? "በመካሄድ ላይ" : "In Progress"}</SelectItem>
                  <SelectItem value="completed">{am ? "ተጠናቋል" : "Completed"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${fontEth}`}>{am ? "ማስታወሻ" : "Notes"}</label>
              <Textarea className="mt-1.5" rows={4} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                placeholder={am ? "የሥራ ዝርዝር..." : "Work notes..."} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{am ? "ሰርዝ" : "Cancel"}</Button>
            <Button onClick={submitEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {am ? "አስቀምጥ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TechnicianTasks;