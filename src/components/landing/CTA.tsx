import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageContext";
import { ArrowRight } from "lucide-react";

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