import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { getLegalContent, type LegalPage } from "@/i18n/legalContent";

export default function Legal() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || "de";
  const content = getLegalContent(lang);
  const en = lang.startsWith("en");
  const pageTitle = en ? "Legal" : "Rechtliches";

  const Block = ({ page }: { page: LegalPage }) => (
    <section className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-4">
      <header>
        <h2 className="font-semibold text-base">{page.title}</h2>
        <p className="text-xs uppercase tracking-wide text-muted-foreground/70 mt-1">
          {page.sub}
        </p>
      </header>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
        {page.sections.map((s, i) => (
          <div key={i} className="space-y-1">
            {s.h2 && (
              <h3 className="text-foreground font-medium text-sm mt-2">{s.h2}</h3>
            )}
            <div dangerouslySetInnerHTML={{ __html: s.html }} />
          </div>
        ))}
        {page.footnote && (
          <div
            className="legal-highlight"
            dangerouslySetInnerHTML={{ __html: page.footnote }}
          />
        )}
      </div>
    </section>
  );

  return (
    <AppShell title={pageTitle}>
      <div className="space-y-4">
        <Block page={content.imprint} />
        <Block page={content.privacy} />
        <Block page={content.refund} />
      </div>
    </AppShell>
  );
}
