import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface Props {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  showLogo?: boolean;
}

export const AppShell = ({ children, title, showBack = true, showLogo = false }: Props) => {
  const nav = useNavigate();
  const loc = useLocation();
  const { t } = useTranslation();
  const atRoot = loc.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-20 flex items-center gap-3">
          {showBack && !atRoot && (
            <button onClick={() => nav(-1)} aria-label={t("common.back")} className="p-2 -ml-2 rounded-full hover:bg-secondary transition-base">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <Logo size="sm" />
          {title && !showLogo && (
            <h1 className="text-base font-semibold tracking-tight text-muted-foreground border-l border-border pl-3 ml-1 truncate">
              {title}
            </h1>
          )}
          <div className="ml-auto">
            <LanguageSwitcher variant="compact" />
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 safe-bottom">
        {children}
      </main>
    </div>
  );
};
