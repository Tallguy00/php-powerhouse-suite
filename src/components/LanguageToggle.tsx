import { useLang } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export const LanguageToggle = () => {
  const { lang, setLang } = useLang();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "en" ? "am" : "en")}
      className="gap-1.5 font-medium"
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      <span className={lang === "am" ? "font-ethiopic" : ""}>
        {lang === "en" ? "አማ" : "EN"}
      </span>
    </Button>
  );
};