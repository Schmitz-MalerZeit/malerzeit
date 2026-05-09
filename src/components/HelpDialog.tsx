import { useState, ReactNode } from "react";
import { HelpCircle, Mic, FileText, Send, Settings, Users, Sparkles, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface Step {
  icon: ReactNode;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    icon: <Settings className="h-4 w-4" />,
    title: "1. Einmalig einrichten",
    text: "Hinterlege im Firmenprofil deine Firmendaten, Logo und Adresse. Lege unter Einstellungen deine Stundensätze an (z. B. Geselle, Azubi, Helfer). Diese werden bei jeder Kalkulation automatisch verwendet.",
  },
  {
    icon: <Mic className="h-4 w-4" />,
    title: "2. Angebot diktieren oder eintippen",
    text: "Tippe auf »Preisorientierung erstellen« und beschreibe das Vorhaben – am einfachsten per Spracheingabe. Nenne pro Raum die Arbeiten, die eingesetzten Personen mit Stunden und das Material in Euro netto.",
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    title: "3. KI-Analyse & Rückfragen",
    text: "Die KI strukturiert deine Eingabe, ordnet die Stundensätze automatisch zu und stellt – falls nötig – kurze Rückfragen zu Arbeitsumfang oder Material. Stundenlöhne werden NIE erfragt.",
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: "4. Ergebnis prüfen & PDF erzeugen",
    text: "Du siehst die Kalkulation pro Raum mit Stunden, Lohn-, Material- und Gesamtbetrag. Trage Kunde und Bauvorhaben ein und erstelle ein professionelles PDF.",
  },
  {
    icon: <Send className="h-4 w-4" />,
    title: "5. Versenden per WhatsApp oder E-Mail",
    text: "Versende das PDF direkt aus der App per WhatsApp oder E-Mail. Der Bauvorhaben-Ort wird automatisch in jede Nachricht eingefügt.",
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: "6. Später bearbeiten",
    text: "Unter »Gespeicherte Vorschläge« kannst du jeden Vorschlag wieder öffnen, abändern und eine zweite Variante als neues PDF erstellen.",
  },
];

interface Section {
  title: string;
  icon: ReactNode;
  items: string[];
}

const SECTIONS: Section[] = [
  {
    icon: <FileText className="h-4 w-4" />,
    title: "Preisvorschläge",
    items: [
      "»Neuer Vorschlag« – KI-gestützte Kalkulation per Sprache oder Text",
      "»Gespeicherte Vorschläge« – alle bisherigen Kalkulationen ansehen, bearbeiten und neu versenden",
      "PDF mit Briefkopf, Anschrift, Bauvorhaben und Leistungsverzeichnis pro Raum",
    ],
  },
  {
    icon: <Users className="h-4 w-4" />,
    title: "Kunden",
    items: [
      "Kunden werden beim Erstellen automatisch gespeichert",
      "Autovervollständigung bei erneuter Eingabe",
    ],
  },
  {
    icon: <Settings className="h-4 w-4" />,
    title: "Einstellungen",
    items: [
      "Stundensätze pflegen (Geselle, Azubi, Helfer, Meister …)",
      "Materialaufschlag in % festlegen",
      "MwSt-Satz, Qualitätsniveau und Standardtexte anpassen",
    ],
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    title: "Firmenprofil",
    items: [
      "Firmenname, Adresse, Logo, Bankverbindung",
      "Erscheint automatisch im Briefkopf jedes PDF",
    ],
  },
  {
    icon: <Send className="h-4 w-4" />,
    title: "Abo & Rechnungen",
    items: [
      "Tarif verwalten, Nutzung einsehen, Zahlungsdaten ändern",
    ],
  },
];

interface Props {
  trigger?: ReactNode;
}

export const HelpDialog = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            aria-label="Anleitung öffnen"
            className="p-2 rounded-full hover:bg-secondary transition-base text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-primary" />
            Anleitung
          </DialogTitle>
          <DialogDescription className="text-sm">
            So nutzt du Malerzeit Schritt für Schritt.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="steps" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 grid grid-cols-2">
            <TabsTrigger value="steps">Schritt für Schritt</TabsTrigger>
            <TabsTrigger value="overview">App-Übersicht</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            <TabsContent value="steps" className="mt-0 space-y-3">
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm leading-tight mb-1">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="overview" className="mt-0 space-y-4">
              {SECTIONS.map((sec, i) => (
                <div key={i}>
                  <h3 className="flex items-center gap-2 font-semibold text-sm mb-2">
                    <span className="text-primary">{sec.icon}</span>
                    {sec.title}
                  </h3>
                  <ul className="space-y-1.5 pl-1">
                    {sec.items.map((it, j) => (
                      <li
                        key={j}
                        className="text-sm text-muted-foreground flex gap-2 leading-relaxed"
                      >
                        <span className="text-primary shrink-0">•</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
