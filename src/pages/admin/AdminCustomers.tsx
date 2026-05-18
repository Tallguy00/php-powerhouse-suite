import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Loader2, Search, ShieldCheck, Wrench, User as UserIcon, Phone, MapPin
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { api } from "@/integrations/Database/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  region: string | null;
  customer_number: string | null;
  created_at: string;
};

type EnrichedUser = ProfileRow & { roles: AppRole[] };

const ROLE_META = {
  admin: {
    en: "Admin",
    am: "አስተዳዳሪ",
    icon: ShieldCheck,
    tone: "bg-primary/10 text-primary border-primary/30",
  },
  technician: {
    en: "Technician",
    am: "ቴክኒሻን",
    icon: Wrench,
    tone: "bg-accent/10 text-accent border-accent/30",
  },
  customer: {
    en: "Customer",
    am: "ደንበኛ",
    icon: UserIcon,
    tone: "bg-secondary/10 text-secondary-foreground border-secondary/30",
  },
};

const ALL_ROLES: AppRole[] = ["customer", "technician", "admin"];

const AdminCustomers = () => {
  const { user, roles, loading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";

  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const isAdmin = roles.includes("admin");

  // ✅ LOAD USERS FROM API
  const loadUsers = async () => {
    setFetching(true);
    try {
      const res = await api.get("/users"); 
      setUsers(res.data);
    } catch {
      toast.error(am ? "ተጠቃሚዎችን መጫን አልተቻለም" : "Failed to load users");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) =>
      [u.full_name, u.customer_number, u.phone, u.region]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [users, search]);

  // ✅ TOGGLE ROLE VIA API
  const toggleRole = async (
    target: EnrichedUser,
    role: AppRole,
    has: boolean
  ) => {
    if (target.id === user?.id && role === "admin" && has) {
      toast.error(am ? "እርስዎን ማስወገድ አይቻልም" : "Cannot remove your own admin role");
      return;
    }

    setPendingId(target.id + role);

    try {
      if (has) {
        await api.delete(`/users/${target.id}/roles/${role}`);
        toast.success(am ? "ተወግዷል" : "Role removed");
      } else {
        await api.post(`/users/${target.id}/roles`, { role });
        toast.success(am ? "ተመድቧል" : "Role granted");
      }

      loadUsers();
    } catch {
      toast.error(am ? "ስህተት ተፈጥሯል" : "Operation failed");
    } finally {
      setPendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold">
        {am ? "ደንበኞች እና ሚናዎች" : "Customers & Roles"}
      </h1>

      {/* SEARCH */}
      <div className="mt-6 flex gap-3">
        <Search className="text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={am ? "ፈልግ..." : "Search..."}
        />
      </div>

      {/* LIST */}
      <div className="mt-6">
        {fetching ? (
          <Loader2 className="animate-spin" />
        ) : (
          filtered.map((u) => (
            <div key={u.id} className="p-4 border rounded mb-2">
              <div className="font-bold">{u.full_name}</div>

              <div className="text-sm text-gray-500">
                {u.phone} · {u.region}
              </div>

              <div className="flex gap-2 mt-2">
                {ALL_ROLES.map((role) => {
                  const has = u.roles.includes(role);
                  const meta = ROLE_META[role];
                  const Icon = meta.icon;

                  return (
                    <Button
                      key={role}
                      size="sm"
                      variant={has ? "default" : "outline"}
                      disabled={pendingId === u.id + role}
                      onClick={() => toggleRole(u, role, has)}
                    >
                      <Icon className="w-3 h-3" />
                      {has ? "Revoke" : "Grant"} {meta.en}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCustomers;