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
import { useTr } from "@/lib/tr";

interface Step { icon: ReactNode; title: string; text: string; }
interface Section { title: string; icon: ReactNode; items: string[]; }

interface Props { trigger?: ReactNode; }

export const HelpDialog = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const tr = useTr();

  const STEPS: Step[] = [
    {
      icon: <Settings className="h-4 w-4" />,
      title: tr("1. Einmalig einrichten", "1. One-time setup"),
      text: tr(
        "Hinterlege im Firmenprofil deine Firmendaten, Logo und Adresse. Lege unter Einstellungen deine Stundensätze an (z. B. Geselle, Azubi, Helfer). Diese werden bei jeder Kalkulation automatisch verwendet.",
        "In the company profile, store your business details, logo and address. Under Settings, define your hourly rates (e.g. journeyman, apprentice, helper). They will be used automatically in every calculation.",
      ),
    },
    {
      icon: <Mic className="h-4 w-4" />,
      title: tr("2. Angebot diktieren oder eintippen", "2. Dictate or type a quote"),
      text: tr(
        "Tippe auf »Preisorientierung erstellen« und beschreibe das Vorhaben – am einfachsten per Spracheingabe. Nenne pro Raum die Arbeiten, die eingesetzten Personen mit Stunden und das Material in Euro netto.",
        "Tap »Create price quote« and describe the job – the easiest way is voice input. For each room, list the work, the staff with hours and the material cost in euros (net).",
      ),
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: tr("3. KI-Analyse & Rückfragen", "3. AI analysis & follow-up questions"),
      text: tr(
        "Die KI strukturiert deine Eingabe, ordnet die Stundensätze automatisch zu und stellt – falls nötig – kurze Rückfragen zu Arbeitsumfang oder Material. Stundenlöhne werden NIE erfragt.",
        "The AI structures your input, automatically assigns hourly rates and asks short follow-up questions about scope or materials if needed. Hourly wages are NEVER requested.",
      ),
    },
    {
      icon: <FileText className="h-4 w-4" />,
      title: tr("4. Ergebnis prüfen & PDF erzeugen", "4. Review the result & create the PDF"),
      text: tr(
        "Du siehst die Kalkulation pro Raum mit Stunden, Lohn-, Material- und Gesamtbetrag. Trage Kunde und Bauvorhaben ein und erstelle ein professionelles PDF.",
        "You see the calculation per room with hours, labor, material and total amount. Enter the customer and project and create a professional PDF.",
      ),
    },
    {
      icon: <Send className="h-4 w-4" />,
      title: tr("5. Versenden per WhatsApp oder E-Mail", "5. Send via WhatsApp or email"),
      text: tr(
        "Versende das PDF direkt aus der App per WhatsApp oder E-Mail. Der Bauvorhaben-Ort wird automatisch in jede Nachricht eingefügt.",
        "Send the PDF straight from the app via WhatsApp or email. The project location is added to every message automatically.",
      ),
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: tr("6. Später bearbeiten", "6. Edit later"),
      text: tr(
        "Unter »Gespeicherte Vorschläge« kannst du jeden Vorschlag wieder öffnen, abändern und eine zweite Variante als neues PDF erstellen.",
        "Under »Saved quotes« you can re-open any quote, change it and create a second version as a new PDF.",
      ),
    },
  ];

  const SECTIONS: Section[] = [
    {
      icon: <FileText className="h-4 w-4" />,
      title: tr("Preisvorschläge", "Price quotes"),
      items: [
        tr("»Neuer Vorschlag« – KI-gestützte Kalkulation per Sprache oder Text", "»New quote« – AI-powered calculation via voice or text"),
        tr("»Gespeicherte Vorschläge« – alle bisherigen Kalkulationen ansehen, bearbeiten und neu versenden", "»Saved quotes« – view, edit and resend all previous calculations"),
        tr("PDF mit Briefkopf, Anschrift, Bauvorhaben und Leistungsverzeichnis pro Raum", "PDF with letterhead, recipient, project and itemised list per room"),
      ],
    },
    {
      icon: <Users className="h-4 w-4" />,
      title: tr("Kunden", "Customers"),
      items: [
        tr("Kunden werden beim Erstellen automatisch gespeichert", "Customers are saved automatically when you create a quote"),
        tr("Autovervollständigung bei erneuter Eingabe", "Auto-complete the next time you type the name"),
      ],
    },
    {
      icon: <Settings className="h-4 w-4" />,
      title: tr("Einstellungen", "Settings"),
      items: [
        tr("Stundensätze pflegen (Geselle, Azubi, Helfer, Meister …)", "Manage hourly rates (journeyman, apprentice, helper, master …)"),
        tr("Materialaufschlag in % festlegen", "Set the material markup in %"),
        tr("MwSt-Satz, Qualitätsniveau und Standardtexte anpassen", "Adjust VAT rate, quality level and default texts"),
      ],
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: tr("Firmenprofil", "Company profile"),
      items: [
        tr("Firmenname, Adresse, Logo, Bankverbindung", "Company name, address, logo, bank details"),
        tr("Erscheint automatisch im Briefkopf jedes PDF", "Appears automatically in the letterhead of every PDF"),
      ],
    },
    {
      icon: <Send className="h-4 w-4" />,
      title: tr("Abo & Rechnungen", "Subscription & invoices"),
      items: [
        tr("Tarif verwalten, Nutzung einsehen, Zahlungsdaten ändern", "Manage plan, view usage, change payment details"),
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            aria-label={tr("Anleitung öffnen", "Open guide")}
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
            {tr("Anleitung", "Guide")}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {tr("So nutzt du Malerzeit Schritt für Schritt.", "How to use Malerzeit step by step.")}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="steps" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 grid grid-cols-2">
            <TabsTrigger value="steps">{tr("Schritt für Schritt", "Step by step")}</TabsTrigger>
            <TabsTrigger value="overview">{tr("App-Übersicht", "App overview")}</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            <TabsContent value="steps" className="mt-0 space-y-3">
              {STEPS.map((step, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm leading-tight mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
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
                      <li key={j} className="text-sm text-muted-foreground flex gap-2 leading-relaxed">
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
