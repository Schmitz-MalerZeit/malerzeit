import { useTranslation } from "react-i18next";
import { PublicShell } from "./PublicShell";
import { getLegalContent, type LegalPage } from "@/i18n/legalContent";

interface Props {
  page: keyof ReturnType<typeof getLegalContent>;
}

export function LegalPageView({ page }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || "de";
  const content: LegalPage = getLegalContent(lang)[page];

  return (
    <PublicShell title={content.title}>
      <p className="legal-sub">{content.sub}</p>
      {content.sections.map((s, i) => (
        <section key={i} className="legal-section">
          {s.h2 && <h2>{s.h2}</h2>}
          <div dangerouslySetInnerHTML={{ __html: s.html }} />
        </section>
      ))}
      {content.footnote && (
        <div className="legal-highlight" dangerouslySetInnerHTML={{ __html: content.footnote }} />
      )}
    </PublicShell>
  );
}
