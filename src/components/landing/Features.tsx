import { useLang } from "@/i18n/LanguageContext";
import { Receipt, Activity, AlertTriangle, CreditCard, Shield, Wrench } from "lucide-react";
import type { TranslationKey } from "@/i18n/translations";

export const Features = () => {
  const { t, lang } = useLang();
  const features: { icon: typeof Receipt; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { icon: Receipt, titleKey: "f1_title", descKey: "f1_desc" },
    { icon: Activity, titleKey: "f2_title", descKey: "f2_desc" },
    { icon: AlertTriangle, titleKey: "f3_title", descKey: "f3_desc" },
    { icon: CreditCard, titleKey: "f4_title", descKey: "f4_desc" },
    { icon: Shield, titleKey: "f5_title", descKey: "f5_desc" },
    { icon: Wrench, titleKey: "f6_title", descKey: "f6_desc" },
  ];
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={`text-3xl md:text-5xl font-bold tracking-tight text-balance ${lang === "am" ? "font-ethiopic" : ""}`}>
            {t("features_title")}
          </h2>
          <p className={`mt-4 text-lg text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>
            {t("features_sub")}
          </p>
        </div>
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.titleKey}
                className="group relative rounded-2xl border border-border bg-card-gradient p-7 shadow-card hover:shadow-elegant transition-spring hover:-translate-y-1"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="h-12 w-12 rounded-xl bg-primary-gradient flex items-center justify-center shadow-elegant group-hover:scale-110 transition-spring">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className={`mt-5 text-xl font-bold ${lang === "am" ? "font-ethiopic" : ""}`}>{t(f.titleKey)}</h3>
                <p className={`mt-2 text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>{t(f.descKey)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};