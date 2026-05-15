import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pdfBlob: Blob | null;
  fileName: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onSent?: () => void;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.replace(/^data:[^;]+;base64,/, ""));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export function EmailComposeDialog({
  open, onOpenChange, pdfBlob, fileName, defaultTo, defaultSubject, defaultBody, onSent,
}: Props) {
  const nav = useNavigate();
  const [to, setTo] = useState(defaultTo || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [body, setBody] = useState(defaultBody || "");
  const [sending, setSending] = useState(false);

  // Reset fields when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setTo(defaultTo || "");
      setSubject(defaultSubject || "");
      setBody(defaultBody || "");
      setCc("");
    }
    onOpenChange(o);
  };

  const send = async () => {
    if (!pdfBlob) { toast.error("PDF noch nicht bereit."); return; }
    if (!to.trim()) { toast.error("Bitte Empfänger-E-Mail angeben."); return; }
    if (!subject.trim()) { toast.error("Bitte Betreff angeben."); return; }
    if (!body.trim()) { toast.error("Bitte Nachrichtentext angeben."); return; }

    setSending(true);
    try {
      const attachmentBase64 = await blobToBase64(pdfBlob);
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          body,
          attachmentBase64,
          attachmentName: fileName || "Preisorientierung.pdf",
        },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; error?: string; message?: string };
      if (!res?.ok) {
        if (res?.error === "smtp_not_configured") {
          toast.error("E-Mail-Versand ist noch nicht eingerichtet.", {
            action: { label: "Einrichten", onClick: () => nav("/settings") },
          });
          return;
        }
        throw new Error(res?.message || res?.error || "Versand fehlgeschlagen");
      }
      toast.success(`E-Mail an ${to.trim()} gesendet`);
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e.message || "Versand fehlgeschlagen");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>PDF per E-Mail senden</DialogTitle>
          <DialogDescription className="text-xs">
            Wird über deinen eigenen E-Mail-Anbieter verschickt. Noch nicht eingerichtet?{" "}
            <button type="button" onClick={() => nav("/settings")} className="underline inline-flex items-center gap-1">
              <SettingsIcon className="h-3 w-3" /> In den Einstellungen einrichten
            </button>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mail-to">An</Label>
            <Input id="mail-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="kunde@beispiel.de" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mail-cc">CC (optional)</Label>
            <Input id="mail-cc" type="email" value={cc} onChange={(e) => setCc(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mail-subject">Betreff</Label>
            <Input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mail-body">Nachricht</Label>
            <Textarea id="mail-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} className="text-sm" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            📎 Anhang: <span className="font-medium">{fileName}</span>
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Abbrechen</Button>
          <Button onClick={send} disabled={sending} className="gradient-primary text-primary-foreground border-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Senden</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
