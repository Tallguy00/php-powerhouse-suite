import { Logo } from "@/components/Logo";
import { useLang } from "@/i18n/LanguageContext";

export const Footer = () => {
  const { t, lang } = useLang();
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className={`text-sm text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>
            · {t("tagline")}
          </span>
        </div>
        <p className={`text-sm text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>
          © {new Date().getFullYear()} {t("brand")}. {t("footer_rights")}
        </p>
      </div>
    </footer>
  );
};