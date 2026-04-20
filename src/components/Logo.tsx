import { Zap } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export const Logo = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const { t, lang } = useLang();
  const iconSize = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const textSize = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${iconSize} rounded-xl bg-flag-gradient flex items-center justify-center shadow-elegant`}>
        <Zap className="h-1/2 w-1/2 text-primary-foreground" fill="currentColor" />
      </div>
      <span className={`${textSize} font-bold tracking-tight ${lang === "am" ? "font-ethiopic" : ""}`}>
        {t("brand")}
      </span>
    </div>
  );
};