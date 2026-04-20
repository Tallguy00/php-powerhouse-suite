import { useLang } from "@/i18n/LanguageContext";

export const Stats = () => {
  const { t, lang } = useLang();
  const items = [
    { value: "2.4M+", labelKey: "stat_customers" as const },
    { value: "14", labelKey: "stat_regions" as const },
    { value: "99.6%", labelKey: "stat_uptime" as const },
    { value: "8.1M", labelKey: "stat_payments" as const },
  ];
  return (
    <section className="border-y border-border bg-card-gradient">
      <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 py-12">
        {items.map((s) => (
          <div key={s.labelKey} className="text-center">
            <div className="text-3xl md:text-4xl font-extrabold bg-flag-gradient bg-clip-text text-transparent">
              {s.value}
            </div>
            <div className={`mt-2 text-sm text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>
              {t(s.labelKey)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};