import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageContext";
import { ArrowRight, CreditCard, BarChart3, MapPin } from "lucide-react";

export const CTA = () => {
  const { t, lang } = useLang();
  return (
    <section id="about" className="py-24">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl bg-flag-gradient p-10 md:p-16 text-center shadow-elegant">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(0_0%_100%/0.15),transparent_50%)]" />
          <div className="relative">
            <h2 className={`text-3xl md:text-5xl font-extrabold text-primary-foreground text-balance ${lang === "am" ? "font-ethiopic" : ""}`}>
              {t("cta_title")}
            </h2>
            <p className={`mt-4 text-lg text-primary-foreground/90 ${lang === "am" ? "font-ethiopic" : ""}`}>
              {t("cta_sub")}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 text-left">
              <Link to="/admin/payments" className="group rounded-xl bg-background/10 hover:bg-background/20 p-4 backdrop-blur transition-colors border border-background/20">
                <CreditCard className="h-6 w-6 text-primary-foreground mb-2" />
                <div className="font-semibold text-primary-foreground">{lang === "am" ? "ቀጥታ ክፍያዎች" : "Live Payments"}</div>
                <div className="text-xs text-primary-foreground/80 mt-1">{lang === "am" ? "Telebirr፣ CBE፣ Awash፣ Dashen" : "Telebirr, CBE, Awash, Dashen"}</div>
              </Link>
              <Link to="/dashboard/consumption" className="group rounded-xl bg-background/10 hover:bg-background/20 p-4 backdrop-blur transition-colors border border-background/20">
                <BarChart3 className="h-6 w-6 text-primary-foreground mb-2" />
                <div className="font-semibold text-primary-foreground">{lang === "am" ? "የፍጆታ ግራፎች" : "Consumption Charts"}</div>
                <div className="text-xs text-primary-foreground/80 mt-1">{lang === "am" ? "ወርሃዊ ኪሎዋት እና ወጪ" : "Monthly kWh & cost trends"}</div>
              </Link>
              <Link to="/dashboard/outage-map" className="group rounded-xl bg-background/10 hover:bg-background/20 p-4 backdrop-blur transition-colors border border-background/20">
                <MapPin className="h-6 w-6 text-primary-foreground mb-2" />
                <div className="font-semibold text-primary-foreground">{lang === "am" ? "የመቋረጥ ካርታ" : "Outage Map"}</div>
                <div className="text-xs text-primary-foreground/80 mt-1">{lang === "am" ? "በቀጥታ በኢትዮጵያ ካርታ ላይ" : "Live across Ethiopia"}</div>
              </Link>
            </div>
            <Link to="/auth?mode=signup">
              <Button size="lg" className="mt-8 bg-background text-primary hover:bg-background/90 h-14 px-8 text-base font-bold shadow-elegant">
                {t("hero_cta_primary")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};