import { useTranslation } from "react-i18next";
import { PublicShell } from "./PublicShell";
import { Seo } from "./Seo";
import { getLegalContent, type LegalPage } from "@/i18n/legalContent";

interface Props {
  page: keyof ReturnType<typeof getLegalContent>;
}

const META: Record<string, { title: string; description: string; path: string }> = {
  imprint: {
    title: "Impressum – MalerZeit AI",
    description: "Anbieterkennzeichnung von MalerZeit AI gemäß § 5 TMG: Anschrift, Kontakt und USt-IdNr.",
    path: "/imprint",
  },
  privacy: {
    title: "Datenschutz – MalerZeit AI",
    description: "Datenschutzhinweise von MalerZeit AI: Welche Daten wir verarbeiten und welche Rechte du als Nutzer hast.",
    path: "/privacy",
  },
  refund: {
    title: "Widerruf & Rückerstattung – MalerZeit AI",
    description: "Widerrufsrecht, Erstattungsbedingungen und Kündigungsmodalitäten für MalerZeit AI Abonnements.",
    path: "/refund",
  },
};

export function LegalPageView({ page }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || "de";
  const content: LegalPage = getLegalContent(lang)[page];
  const meta = META[page as string];

  return (
    <PublicShell title={content.title}>
      {meta && <Seo title={meta.title} description={meta.description} path={meta.path} />}
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
