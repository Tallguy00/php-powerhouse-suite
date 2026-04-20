import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLang } from "@/i18n/LanguageContext";

export const Header = () => {
  const { t } = useLang();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-smooth">{t("nav_features")}</a>
          <a href="#regions" className="hover:text-foreground transition-smooth">{t("nav_regions")}</a>
          <a href="#about" className="hover:text-foreground transition-smooth">{t("nav_about")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link to="/auth?mode=signin" className="hidden sm:block">
            <Button variant="ghost" size="sm">{t("nav_signin")}</Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm" className="bg-primary-gradient hover:opacity-90 transition-smooth shadow-elegant">
              {t("nav_get_started")}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};