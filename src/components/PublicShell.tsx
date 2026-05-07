import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface Props {
  children: ReactNode;
  title: string;
}

export const PublicShell = ({ children, title }: Props) => {
  const { t, i18n } = useTranslation();
  const en = (i18n.resolvedLanguage || "de").startsWith("en");
  const labels = en
    ? { imprint: "Legal Notice", terms: "Terms", refund: "Withdrawal & Refund", privacy: "Privacy" }
    : { imprint: "Impressum", terms: "Nutzungsbedingungen", refund: "Widerruf & Rückerstattung", privacy: "Datenschutz" };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-20 flex items-center gap-3">
          <Link to="/" aria-label="Start">
            <Logo size="sm" />
          </Link>
          <h1 className="text-base font-semibold tracking-tight text-muted-foreground border-l border-border pl-3 ml-1 truncate">
            {title}
          </h1>
          <div className="ml-auto">
            <LanguageSwitcher variant="compact" />
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 safe-bottom">
        {children}
      </main>
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-4 py-6 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 items-center justify-center">
          <Link to="/imprint" className="hover:text-foreground transition-base">{labels.imprint}</Link>
          <span aria-hidden>·</span>
          <Link to="/terms" className="hover:text-foreground transition-base">{labels.terms}</Link>
          <span aria-hidden>·</span>
          <Link to="/refund" className="hover:text-foreground transition-base">{labels.refund}</Link>
          <span aria-hidden>·</span>
          <Link to="/privacy" className="hover:text-foreground transition-base">{labels.privacy}</Link>
        </div>
      </footer>
    </div>
  );
};
