import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus, MapPin, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";

type Severity = "low" | "medium" | "high" | "critical";
type OutageStatus = "reported" | "investigating" | "in_progress" | "resolved";

interface Region { id: string; name_en: string; name_am: string; code: string }
interface Outage {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  severity: Severity;
  status: OutageStatus;
  region_id: string | null;
  reported_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

const outageSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(200).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  region_id: z.string().uuid().optional().nullable(),
});

const severityTone: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent text-accent-foreground",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  critical: "bg-destructive/15 text-destructive",
};

const statusTone: Record<OutageStatus, string> = {
  reported: "bg-muted text-muted-foreground",
  investigating: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  in_progress: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  resolved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const CustomerOutages = () => {
  const { user } = useAuth();
  const { lang } = useLang();
  const { toast } = useToast();
  const am = lang === "am";

  const [regions, setRegions] = useState<Region[]>([]);
  const [myOutages, setMyOutages] = useState<Outage[]>([]);
  const [activeOutages, setActiveOutages] = useState<Outage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    severity: "medium" as Severity,
    region_id: "" as string,
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: regs }, { data: mine }, { data: active }] = await Promise.all([
      supabase.from("regions").select("id,name_en,name_am,code").order("name_en"),
      supabase.from("outages").select("*").eq("reported_by", user.id).order("created_at", { ascending: false }),
      supabase.from("outages").select("*").in("status", ["reported", "investigating", "in_progress"]).order("created_at", { ascending: false }).limit(20),
    ]);
    setRegions((regs ?? []) as Region[]);
    setMyOutages((mine ?? []) as Outage[]);
    setActiveOutages((active ?? []) as Outage[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const reset = () => setForm({ title: "", description: "", location: "", severity: "medium", region_id: "" });

  const submit = async () => {
    if (!user) return;
    const parsed = outageSchema.safeParse({
      title: form.title,
      description: form.description || undefined,
      location: form.location || undefined,
      severity: form.severity,
      region_id: form.region_id || null,
    });
    if (!parsed.success) {
      toast({ title: am ? "ስህተት" : "Validation error", description: parsed.error.errors[0]?.message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("outages").insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      severity: parsed.data.severity,
      region_id: parsed.data.region_id ?? null,
      reported_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: am ? "ማስገባት አልተሳካም" : "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: am ? "ሪፖርት ተልኳል" : "Outage reported", description: am ? "ቡድናችን በቅርቡ ይገመግማል።" : "Our team will review it shortly." });
    reset();
    setOpen(false);
    load();
  };

  const regionName = (id: string | null) => {
    if (!id) return am ? "—" : "—";
    const r = regions.find((x) => x.id === id);
    return r ? (am ? r.name_am : r.name_en) : "—";
  };

  const fmt = (d: string) => new Date(d).toLocaleString(am ? "am-ET" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  const stats = {
    total: myOutages.length,
    open: myOutages.filter((o) => o.status !== "resolved").length,
    resolved: myOutages.filter((o) => o.status === "resolved").length,
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${am ? "font-ethiopic" : ""}`}>
            {am ? "የመቋረጥ ሪፖርቶች" : "Outage Reports"}
          </h1>
          <p className={`text-sm text-muted-foreground mt-1 ${am ? "font-ethiopic" : ""}`}>
            {am ? "የኤሌክትሪክ ችግሮችን ሪፖርት ያድርጉ እና ሁኔታቸውን ይከታተሉ።" : "Report power issues and track their resolution."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              <span className={am ? "font-ethiopic" : ""}>{am ? "አዲስ ሪፖርት" : "Report Outage"}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className={am ? "font-ethiopic" : ""}>
                {am ? "የኤሌክትሪክ መቋረጥ ሪፖርት" : "Report a Power Outage"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="title" className={am ? "font-ethiopic" : ""}>{am ? "ርዕስ" : "Title"} *</Label>
                <Input id="title" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={am ? "ለምሳሌ: በቦሌ የኤሌክትሪክ መቋረጥ" : "e.g. Power outage in Bole"} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="loc" className={am ? "font-ethiopic" : ""}>{am ? "ቦታ" : "Location"}</Label>
                <Input id="loc" maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder={am ? "ጎዳና / ሰፈር" : "Street / neighborhood"} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label className={am ? "font-ethiopic" : ""}>{am ? "ክልል" : "Region"}</Label>
                  <Select value={form.region_id} onValueChange={(v) => setForm({ ...form, region_id: v })}>
                    <SelectTrigger><SelectValue placeholder={am ? "ይምረጡ" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{am ? r.name_am : r.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className={am ? "font-ethiopic" : ""}>{am ? "ክብደት" : "Severity"}</Label>
                  <Select value={form.severity} onValueChange={(v: Severity) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{am ? "ዝቅተኛ" : "Low"}</SelectItem>
                      <SelectItem value="medium">{am ? "መካከለኛ" : "Medium"}</SelectItem>
                      <SelectItem value="high">{am ? "ከፍተኛ" : "High"}</SelectItem>
                      <SelectItem value="critical">{am ? "አሳሳቢ" : "Critical"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc" className={am ? "font-ethiopic" : ""}>{am ? "ዝርዝር" : "Description"}</Label>
                <Textarea id="desc" maxLength={1000} rows={4} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={am ? "የተከሰተውን በዝርዝር ይግለጹ..." : "Describe what happened..."} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                {am ? "ሰርዝ" : "Cancel"}
              </Button>
              <Button onClick={submit} disabled={submitting || !form.title.trim()}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {am ? "አስገባ" : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className={`text-sm text-muted-foreground ${am ? "font-ethiopic" : ""}`}>{am ? "ጠቅላላ ሪፖርቶች" : "Total Reports"}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className={`text-sm text-muted-foreground ${am ? "font-ethiopic" : ""}`}>{am ? "ክፍት" : "Open"}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.open}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className={`text-sm text-muted-foreground ${am ? "font-ethiopic" : ""}`}>{am ? "የተፈቱ" : "Resolved"}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.resolved}</div></CardContent>
        </Card>
      </div>

      {/* My reports */}
      <section className="mt-8">
        <h2 className={`text-lg font-semibold mb-3 ${am ? "font-ethiopic" : ""}`}>
          {am ? "የእኔ ሪፖርቶች" : "My Reports"}
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> {am ? "በመጫን ላይ..." : "Loading..."}
          </div>
        ) : myOutages.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className={am ? "font-ethiopic" : ""}>{am ? "ገና ሪፖርት አላደረጉም።" : "You haven't reported any outages yet."}</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {myOutages.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{o.title}</h3>
                      <Badge className={severityTone[o.severity]}>{o.severity}</Badge>
                      <Badge className={statusTone[o.status]}>{o.status.replace("_", " ")}</Badge>
                    </div>
                    {o.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{o.description}</p>}
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                      {o.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{o.location}</span>}
                      <span>{regionName(o.region_id)}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(o.created_at)}</span>
                      {o.resolved_at && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />{am ? "ተፈትቷል" : "Resolved"} {fmt(o.resolved_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Active in your area */}
      <section className="mt-10">
        <h2 className={`text-lg font-semibold mb-3 ${am ? "font-ethiopic" : ""}`}>
          {am ? "ንቁ መቋረጦች" : "Active Outages"}
        </h2>
        {activeOutages.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">
            <p className={am ? "font-ethiopic" : ""}>{am ? "በአሁኑ ጊዜ ምንም ንቁ መቋረጦች የሉም።" : "No active outages right now."}</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {activeOutages.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.title}</div>
                  <div className="text-xs text-muted-foreground">{regionName(o.region_id)} · {fmt(o.created_at)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={severityTone[o.severity]}>{o.severity}</Badge>
                  <Badge className={statusTone[o.status]}>{o.status.replace("_", " ")}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
};

export default CustomerOutages;
