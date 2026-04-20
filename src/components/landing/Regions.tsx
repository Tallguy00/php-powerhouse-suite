import { useLang } from "@/i18n/LanguageContext";
import { MapPin } from "lucide-react";

const REGIONS = [
  { en: "Addis Ababa", am: "አዲስ አበባ" },
  { en: "Oromia", am: "ኦሮሚያ" },
  { en: "Amhara", am: "አማራ" },
  { en: "Tigray", am: "ትግራይ" },
  { en: "Sidama", am: "ሲዳማ" },
  { en: "Somali", am: "ሶማሌ" },
  { en: "Afar", am: "አፋር" },
  { en: "Benishangul-Gumuz", am: "ቤንሻንጉል-ጉሙዝ" },
  { en: "Gambela", am: "ጋምቤላ" },
  { en: "Harari", am: "ሐረሪ" },
  { en: "Dire Dawa", am: "ድሬዳዋ" },
  { en: "South West Ethiopia", am: "ደቡብ ምዕራብ" },
  { en: "South Ethiopia", am: "ደቡብ ኢትዮጵያ" },
  { en: "Central Ethiopia", am: "ማዕከላዊ" },
];

export const Regions = () => {
  const { t, lang } = useLang();
  return (
    <section id="regions" className="py-24 bg-muted/40">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={`text-3xl md:text-5xl font-bold tracking-tight text-balance ${lang === "am" ? "font-ethiopic" : ""}`}>
            {t("regions_title")}
          </h2>
          <p className={`mt-4 text-lg text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>
            {t("regions_sub")}
          </p>
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {REGIONS.map((r) => (
            <div
              key={r.en}
              className="group flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 shadow-card hover:shadow-elegant hover:border-primary/40 transition-smooth"
            >
              <MapPin className="h-4 w-4 text-accent" />
              <span className={`text-sm font-medium ${lang === "am" ? "font-ethiopic" : ""}`}>
                {lang === "am" ? r.am : r.en}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};