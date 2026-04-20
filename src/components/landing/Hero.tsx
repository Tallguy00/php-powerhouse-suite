import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageContext";
import { ArrowRight, Zap } from "lucide-react";
import heroImg from "@/assets/hero-ethiopia-power.jpg";

export const Hero = () => {
  const { t, lang } = useLang();
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg} alt="Ethiopian highlands with electric infrastructure" className="h-full w-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-hero-gradient" />
      </div>
      <div className="container relative py-24 md:py-36 lg:py-44">
        <div className="max-w-3xl text-primary-foreground animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/10 px-4 py-1.5 text-sm font-medium text-secondary backdrop-blur">
            <Zap className="h-3.5 w-3.5" fill="currentColor" />
            <span className={lang === "am" ? "font-ethiopic" : ""}>{t("hero_badge")}</span>
          </div>
          <h1 className={`mt-6 text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance ${lang === "am" ? "font-ethiopic" : ""}`}>
            {t("hero_title")}
          </h1>
          <p className={`mt-6 text-lg md:text-xl text-primary-foreground/85 max-w-2xl text-balance ${lang === "am" ? "font-ethiopic" : ""}`}>
            {t("hero_sub")}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="bg-electric-gradient text-secondary-foreground font-bold hover:opacity-95 shadow-glow transition-smooth h-14 px-8 text-base">
                {t("hero_cta_primary")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base bg-background/10 border-primary-foreground/30 text-primary-foreground hover:bg-background/20 backdrop-blur">
                {t("hero_cta_secondary")}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};