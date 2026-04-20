import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [mode, setMode] = useState<"signin" | "signup">((params.get("mode") as any) || "signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: form.full_name, phone: form.phone },
          },
        });
        if (error) throw error;
        toast.success(lang === "am" ? "መለያዎ ተፈጥሯል!" : "Account created!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        toast.success(lang === "am" ? "እንኳን ደህና መጡ!" : "Welcome back!");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-flag-gradient p-12 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,hsl(0_0%_100%/0.18),transparent_50%)]" />
        <Link to="/" className="relative z-10"><Logo size="lg" /></Link>
        <div className="relative z-10 max-w-md">
          <h2 className={`text-4xl font-extrabold leading-tight ${lang === "am" ? "font-ethiopic" : ""}`}>
            {t("hero_title")}
          </h2>
          <p className={`mt-4 text-primary-foreground/85 ${lang === "am" ? "font-ethiopic" : ""}`}>
            {t("tagline")}
          </p>
        </div>
        <div className="relative z-10 text-sm opacity-80">© {new Date().getFullYear()} {t("brand")}</div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6">
          <Link to="/" className="lg:hidden"><Logo /></Link>
          <div className="ml-auto"><LanguageToggle /></div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <h1 className={`text-3xl font-bold tracking-tight ${lang === "am" ? "font-ethiopic" : ""}`}>
              {mode === "signin" ? t("auth_signin_title") : t("auth_signup_title")}
            </h1>
            <p className={`mt-2 text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>
              {mode === "signin" ? t("auth_signin_sub") : t("auth_signup_sub")}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className={lang === "am" ? "font-ethiopic" : ""}>{t("auth_full_name")}</Label>
                    <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className={lang === "am" ? "font-ethiopic" : ""}>{t("auth_phone")}</Label>
                    <Input id="phone" type="tel" placeholder="+251 ..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className={lang === "am" ? "font-ethiopic" : ""}>{t("auth_email")}</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className={lang === "am" ? "font-ethiopic" : ""}>{t("auth_password")}</Label>
                <Input id="password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 bg-primary-gradient hover:opacity-90 transition-smooth shadow-elegant text-base font-semibold">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signin" ? t("auth_signin_btn") : t("auth_signup_btn")}
              </Button>
            </form>

            <p className={`mt-6 text-center text-sm text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>
              {mode === "signin" ? t("auth_no_account") : t("auth_have_account")}{" "}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? t("auth_sign_up") : t("auth_sign_in")}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;