import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Building2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useTr } from "@/lib/tr";

type Customer = {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type CustObject = {
  id: string;
  customer_id: string;
  label: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  notes: string | null;
};

const emptyCustomer = (): Customer => ({
  id: "", name: "", address: "", postal_code: "", city: "", phone: "", email: "", notes: "",
});
const emptyObject = (customer_id: string): CustObject => ({
  id: "", customer_id, label: "", address: "", postal_code: "", city: "", notes: "",
});

export default function Customers() {
  const tr = useTr();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [objects, setObjects] = useState<CustObject[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [editCust, setEditCust] = useState<Customer | null>(null);
  const [editObj, setEditObj] = useState<CustObject | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDeleteCust, setConfirmDeleteCust] = useState<Customer | null>(null);
  const [confirmDeleteObj, setConfirmDeleteObj] = useState<CustObject | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c, error: ec }, { data: o, error: eo }] = await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase.from("customer_objects").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    if (ec) toast.error(ec.message);
    if (eo) toast.error(eo.message);
    setCustomers((c as Customer[]) || []);
    setObjects((o as CustObject[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.address, c.postal_code, c.city, c.phone, c.email]
        .filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [customers, search]);

  const objectsFor = (cid: string) => objects.filter((o) => o.customer_id === cid);

  const saveCustomer = async () => {
    if (!editCust) return;
    const name = editCust.name.trim();
    if (name.length < 1) { toast.error(tr("Bitte einen Namen eingeben.", "Please enter a name.")); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload = {
      user_id: user.id,
      name,
      address: editCust.address?.trim() || null,
      postal_code: editCust.postal_code?.trim() || null,
      city: editCust.city?.trim() || null,
      phone: editCust.phone?.trim() || null,
      email: editCust.email?.trim() || null,
      notes: editCust.notes?.trim() || null,
    };
    const { error } = editCust.id
      ? await supabase.from("customers").update(payload).eq("id", editCust.id)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editCust.id ? tr("Kunde aktualisiert", "Customer updated") : tr("Kunde angelegt", "Customer added"));
    setEditCust(null);
    load();
  };

  const saveObject = async () => {
    if (!editObj) return;
    const label = editObj.label.trim();
    if (label.length < 1) { toast.error(tr("Bitte eine Bezeichnung eingeben.", "Please enter a label.")); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload = {
      user_id: user.id,
      customer_id: editObj.customer_id,
      label,
      address: editObj.address?.trim() || null,
      postal_code: editObj.postal_code?.trim() || null,
      city: editObj.city?.trim() || null,
      notes: editObj.notes?.trim() || null,
    };
    const { error } = editObj.id
      ? await supabase.from("customer_objects").update(payload).eq("id", editObj.id)
      : await supabase.from("customer_objects").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editObj.id ? tr("Objekt aktualisiert", "Object updated") : tr("Objekt angelegt", "Object added"));
    setExpanded((e) => ({ ...e, [editObj.customer_id]: true }));
    setEditObj(null);
    load();
  };

  const deleteCustomer = async () => {
    if (!confirmDeleteCust) return;
    const { error } = await supabase.from("customers").delete().eq("id", confirmDeleteCust.id);
    if (error) { toast.error(error.message); return; }
    toast.success(tr("Kunde gelöscht", "Customer deleted"));
    setConfirmDeleteCust(null);
    load();
  };

  const deleteObject = async () => {
    if (!confirmDeleteObj) return;
    const { error } = await supabase.from("customer_objects").delete().eq("id", confirmDeleteObj.id);
    if (error) { toast.error(error.message); return; }
    toast.success(tr("Objekt gelöscht", "Object deleted"));
    setConfirmDeleteObj(null);
    load();
  };

  return (
    <AppShell title={tr("Kunden", "Customers")}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr("Suchen …", "Search …")}
              className="h-11 pl-9"
            />
          </div>
          <Button onClick={() => setEditCust(emptyCustomer())} className="h-11">
            <Plus className="h-4 w-4 mr-1" /> {tr("Neu", "New")}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {customers.length === 0
              ? tr("Noch keine Kunden gespeichert. Lege jetzt deinen ersten Kunden an.", "No customers yet. Add your first customer.")
              : tr("Keine Treffer.", "No matches.")}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const objs = objectsFor(c.id);
              const isOpen = !!expanded[c.id];
              return (
                <div key={c.id} className="rounded-2xl border border-border bg-card shadow-soft">
                  <div className="p-4 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [c.id]: !isOpen }))}
                      className="mt-0.5 p-1 -ml-1 rounded hover:bg-secondary transition-base"
                      aria-label={tr("Objekte anzeigen", "Show objects")}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      {(c.address || c.postal_code || c.city) && (
                        <div className="text-sm text-muted-foreground truncate">
                          {[c.address, [c.postal_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {(c.phone || c.email) && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {[c.phone, c.email].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {objs.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {objs.length} {objs.length === 1 ? tr("Objekt", "object") : tr("Objekte", "objects")}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditCust({ ...c })} aria-label={tr("Bearbeiten", "Edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteCust(c)} aria-label={tr("Löschen", "Delete")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border px-4 py-3 space-y-2 bg-muted/30 rounded-b-2xl">
                      {objs.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          {tr("Noch keine Objekte für diesen Kunden.", "No objects for this customer yet.")}
                        </p>
                      )}
                      {objs.map((o) => (
                        <div key={o.id} className="flex items-start gap-2 rounded-xl bg-background border border-border px-3 py-2">
                          <Building2 className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{o.label}</div>
                            {(o.address || o.postal_code || o.city) && (
                              <div className="text-xs text-muted-foreground truncate">
                                {[o.address, [o.postal_code, o.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                              </div>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditObj({ ...o })} aria-label={tr("Bearbeiten", "Edit")}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setConfirmDeleteObj(o)} aria-label={tr("Löschen", "Delete")}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setEditObj(emptyObject(c.id))}
                      >
                        <Plus className="h-4 w-4 mr-1" /> {tr("Objekt hinzufügen", "Add object")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer edit dialog */}
      <Dialog open={!!editCust} onOpenChange={(o) => { if (!o) setEditCust(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCust?.id ? tr("Kunde bearbeiten", "Edit customer") : tr("Neuer Kunde", "New customer")}</DialogTitle>
            <DialogDescription>
              {tr("Diese Daten werden bei neuen Preisorientierungen vorgeschlagen.", "These details will be suggested for new price estimates.")}
            </DialogDescription>
          </DialogHeader>
          {editCust && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ec_name">{tr("Kundenname", "Customer name")}</Label>
                <Input id="ec_name" value={editCust.name} onChange={(e) => setEditCust({ ...editCust, name: e.target.value })} placeholder={tr("z. B. Familie Müller", "e.g. Smith family")} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ec_addr">{tr("Straße & Hausnummer", "Street & house number")}</Label>
                <Input id="ec_addr" value={editCust.address || ""} onChange={(e) => setEditCust({ ...editCust, address: e.target.value })} className="h-11" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="ec_plz">{tr("PLZ", "Postcode")}</Label>
                  <Input id="ec_plz" value={editCust.postal_code || ""} inputMode="numeric" maxLength={5}
                    onChange={(e) => setEditCust({ ...editCust, postal_code: e.target.value })} className="h-11" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="ec_city">{tr("Ort", "City")}</Label>
                  <Input id="ec_city" value={editCust.city || ""}
                    onChange={(e) => setEditCust({ ...editCust, city: e.target.value })} className="h-11" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ec_phone">{tr("Telefon", "Phone")}</Label>
                  <Input id="ec_phone" type="tel" value={editCust.phone || ""}
                    onChange={(e) => setEditCust({ ...editCust, phone: e.target.value })} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ec_email">{tr("E-Mail", "Email")}</Label>
                  <Input id="ec_email" type="email" value={editCust.email || ""}
                    onChange={(e) => setEditCust({ ...editCust, email: e.target.value })} className="h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ec_notes">{tr("Notizen", "Notes")} <span className="text-muted-foreground font-normal">({tr("optional", "optional")})</span></Label>
                <Textarea id="ec_notes" value={editCust.notes || ""} rows={2}
                  onChange={(e) => setEditCust({ ...editCust, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCust(null)}>{tr("Abbrechen", "Cancel")}</Button>
            <Button onClick={saveCustomer} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {tr("Speichern", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Object edit dialog */}
      <Dialog open={!!editObj} onOpenChange={(o) => { if (!o) setEditObj(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editObj?.id ? tr("Objekt bearbeiten", "Edit object") : tr("Neues Objekt", "New object")}</DialogTitle>
            <DialogDescription>
              {tr("Z. B. eine vermietete Wohnung oder ein zweiter Standort dieses Kunden.", "E.g. a rented apartment or a second location for this customer.")}
            </DialogDescription>
          </DialogHeader>
          {editObj && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="eo_label">{tr("Bezeichnung", "Label")}</Label>
                <Input id="eo_label" value={editObj.label}
                  onChange={(e) => setEditObj({ ...editObj, label: e.target.value })}
                  placeholder={tr("z. B. Wohnung Hauptstr. 5, 3. OG rechts", "e.g. Flat Main St. 5, 3rd floor right")}
                  className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eo_addr">{tr("Straße & Hausnummer", "Street & house number")}</Label>
                <Input id="eo_addr" value={editObj.address || ""}
                  onChange={(e) => setEditObj({ ...editObj, address: e.target.value })} className="h-11" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="eo_plz">{tr("PLZ", "Postcode")}</Label>
                  <Input id="eo_plz" value={editObj.postal_code || ""} inputMode="numeric" maxLength={5}
                    onChange={(e) => setEditObj({ ...editObj, postal_code: e.target.value })} className="h-11" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="eo_city">{tr("Ort", "City")}</Label>
                  <Input id="eo_city" value={editObj.city || ""}
                    onChange={(e) => setEditObj({ ...editObj, city: e.target.value })} className="h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eo_notes">{tr("Notizen", "Notes")} <span className="text-muted-foreground font-normal">({tr("optional", "optional")})</span></Label>
                <Textarea id="eo_notes" value={editObj.notes || ""} rows={2}
                  onChange={(e) => setEditObj({ ...editObj, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditObj(null)}>{tr("Abbrechen", "Cancel")}</Button>
            <Button onClick={saveObject} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {tr("Speichern", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteCust} onOpenChange={(o) => { if (!o) setConfirmDeleteCust(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Kunde löschen?", "Delete customer?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("Der Kunde und alle zugehörigen Objekte werden dauerhaft gelöscht. Bereits erstellte Preisorientierungen bleiben erhalten.",
                  "The customer and all associated objects will be permanently deleted. Existing price estimates are not affected.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Abbrechen", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCustomer}>{tr("Löschen", "Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteObj} onOpenChange={(o) => { if (!o) setConfirmDeleteObj(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Objekt löschen?", "Delete object?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("Das Objekt wird dauerhaft gelöscht.", "The object will be permanently deleted.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Abbrechen", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteObject}>{tr("Löschen", "Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
