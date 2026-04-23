import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageContext";

// Fix default marker icons (Vite/Leaflet)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Sev = "low" | "medium" | "high" | "critical";
type Stat = "reported" | "investigating" | "in_progress" | "resolved";
interface Outage {
  id: string; title: string; description: string | null; location: string | null;
  severity: Sev; status: Stat; region_id: string | null; created_at: string; resolved_at: string | null;
}
interface Region { id: string; name_en: string; name_am: string; code: string }

// Approximate region centers (Ethiopia)
const REGION_COORDS: Record<string, [number, number]> = {
  AA: [9.0320, 38.7469],   // Addis Ababa
  AM: [11.5949, 37.3909],  // Amhara (Bahir Dar)
  OR: [8.5400, 39.2700],   // Oromia (Adama)
  TG: [13.4969, 39.4769],  // Tigray (Mekele)
  SN: [6.6680, 38.4700],   // SNNPR (Hawassa)
  SO: [9.5666, 44.0650],   // Somali (Jijiga)
  AF: [11.7800, 41.0000],  // Afar (Semera)
  BG: [10.6500, 35.5800],  // Benishangul-Gumuz (Asosa)
  GM: [8.2500, 35.6000],   // Gambela
  HR: [9.3100, 42.1200],   // Harari (Harar)
  DD: [9.5900, 41.8600],   // Dire Dawa
  SW: [7.3300, 36.7700],   // South West
  SI: [7.0600, 38.4800],   // Sidama (Hawassa)
};

const SEV_COLOR: Record<Sev, string> = {
  low: "#22c55e", medium: "#f59e0b", high: "#f97316", critical: "#ef4444",
};
const SEV_RADIUS: Record<Sev, number> = { low: 10, medium: 14, high: 18, critical: 22 };

const OutageMap = () => {
  const { lang } = useLang();
  const am = lang === "am";
  const [loading, setLoading] = useState(true);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  useEffect(() => {
    const load = async () => {
      const [o, r] = await Promise.all([
        supabase.from("outages").select("*").is("resolved_at", null).order("created_at", { ascending: false }),
        supabase.from("regions").select("*"),
      ]);
      setOutages((o.data ?? []) as Outage[]);
      setRegions((r.data ?? []) as Region[]);
      setLoading(false);
    };
    void load();

    const ch = supabase
      .channel("outage-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "outages" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const regionMap = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);

  // Group outages by region for jitter offsets so multiple pins don't overlap exactly
  const points = useMemo(() => {
    const byRegion: Record<string, Outage[]> = {};
    outages.forEach((o) => {
      const key = o.region_id ?? "none";
      (byRegion[key] ||= []).push(o);
    });
    const out: Array<{ outage: Outage; pos: [number, number]; regionName: string }> = [];
    Object.entries(byRegion).forEach(([rid, list]) => {
      const region = regionMap.get(rid);
      const base = region ? REGION_COORDS[region.code] : undefined;
      list.forEach((o, idx) => {
        if (!base) return;
        // simple jitter ring
        const angle = (idx / Math.max(list.length, 1)) * Math.PI * 2;
        const r = list.length > 1 ? 0.25 : 0;
        out.push({
          outage: o,
          pos: [base[0] + Math.cos(angle) * r, base[1] + Math.sin(angle) * r],
          regionName: am ? region!.name_am : region!.name_en,
        });
      });
    });
    return out;
  }, [outages, regionMap, am]);

  const counts = useMemo(() => ({
    total: outages.length,
    critical: outages.filter((o) => o.severity === "critical").length,
    high: outages.filter((o) => o.severity === "high").length,
    inProgress: outages.filter((o) => o.status === "in_progress").length,
  }), [outages]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-7 w-7 text-primary" />
            {am ? "የኤሌክትሪክ መቋረጥ ካርታ" : "Outage Map"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {am ? "በቀጥታ የሚታዩ ንቁ የኤሌክትሪክ መቋረጦች በኢትዮጵያ" : "Live active power outages across Ethiopia"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{am ? "ጠቅላላ" : "Active"}</div>
          <div className="mt-1 text-2xl font-bold">{counts.total}</div>
        </CardContent></Card>
        <Card className="border-red-500/30 bg-red-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{am ? "ወሳኝ" : "Critical"}</div>
          <div className="mt-1 text-2xl font-bold text-red-600">{counts.critical}</div>
        </CardContent></Card>
        <Card className="border-orange-500/30 bg-orange-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{am ? "ከፍተኛ" : "High"}</div>
          <div className="mt-1 text-2xl font-bold text-orange-600">{counts.high}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{am ? "በሂደት" : "In Progress"}</div>
          <div className="mt-1 text-2xl font-bold">{counts.inProgress}</div>
        </CardContent></Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center h-[500px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="h-[600px] w-full">
              <MapContainer center={[9.145, 40.4897]} zoom={6} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {points.map(({ outage, pos, regionName }) => (
                  <CircleMarker
                    key={outage.id}
                    center={pos}
                    radius={SEV_RADIUS[outage.severity]}
                    pathOptions={{
                      color: SEV_COLOR[outage.severity],
                      fillColor: SEV_COLOR[outage.severity],
                      fillOpacity: 0.5,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px] space-y-1">
                        <div className="font-semibold">{outage.title}</div>
                        {outage.description && (
                          <div className="text-xs opacity-80">{outage.description}</div>
                        )}
                        <div className="flex gap-1 flex-wrap pt-1">
                          <Badge variant="outline" style={{ borderColor: SEV_COLOR[outage.severity], color: SEV_COLOR[outage.severity] }}>
                            {outage.severity}
                          </Badge>
                          <Badge variant="secondary">{outage.status.replace("_", " ")}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground pt-1">
                          📍 {outage.location ?? regionName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(outage.created_at).toLocaleString()}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center text-sm">
            <span className="font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{am ? "የመጠን አመላካች" : "Severity legend"}:</span>
            {(["low", "medium", "high", "critical"] as Sev[]).map((s) => (
              <span key={s} className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: SEV_COLOR[s] }} />
                <span className="capitalize">{s}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default OutageMap;
