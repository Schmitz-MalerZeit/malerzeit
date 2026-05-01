import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";

interface Props {
  children: ReactNode;
  title: string;
}

export const PublicShell = ({ children, title }: Props) => {
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
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 safe-bottom">
        <article className="prose prose-sm dark:prose-invert max-w-none">
          {children}
        </article>
      </main>
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-4 py-6 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 items-center justify-center">
          <Link to="/terms" className="hover:text-foreground transition-base">Nutzungsbedingungen</Link>
          <span aria-hidden>·</span>
          <Link to="/refund" className="hover:text-foreground transition-base">Widerruf & Rückerstattung</Link>
          <span aria-hidden>·</span>
          <Link to="/privacy" className="hover:text-foreground transition-base">Datenschutz</Link>
        </div>
      </footer>
    </div>
  );
};
