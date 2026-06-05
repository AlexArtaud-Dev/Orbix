"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { contactsService, type Contact } from "@/services/contacts";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ContactsPage() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const load = async (reset = true, cursor?: string) => {
    setLoading(true);
    try {
      const res = await contactsService.list(reset ? undefined : cursor);
      setContacts((prev) => (reset ? res.data : [...prev, ...res.data]));
      setNextCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(true); }, []); // eslint-disable-line

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setDialogOpen(true); };

  const handleSaved = (contact: Contact) => {
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.id === contact.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = contact;
        return next;
      }
      return [contact, ...prev];
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await contactsService.delete(id);
      toast.success(t("contacts.deleteSuccess"));
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("contacts.title")}</h1>
          <p className="text-muted-foreground">{t("contacts.subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t("contacts.add")}
        </Button>
      </div>

      {loading && contacts.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
      {!loading && contacts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("contacts.empty")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {contacts.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            onEdit={() => openEdit(c)}
            onDelete={() => void handleDelete(c.id)}
          />
        ))}
      </div>

      {nextCursor && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load(false, nextCursor ?? undefined)}
          disabled={loading}
        >
          {t("logs.loadMore")}
        </Button>
      )}

      <ContactDialog
        open={dialogOpen}
        contact={editing}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}

interface ContactCardProps {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}

function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{contact.name}</span>
            <span className="text-xs text-muted-foreground">{contact.email}</span>
            {contact.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("common.edit")}>
            <Pencil className="size-3.5" />
          </Button>
          {!confirmDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
              aria-label={t("common.delete")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(false)} aria-label={t("common.cancel")}>
                <X className="size-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={() => { setConfirmDelete(false); onDelete(); }}
                aria-label={t("common.confirm")}
              >
                <Check className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ContactDialogProps {
  open: boolean;
  contact: Contact | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (contact: Contact) => void;
}

function ContactDialog({ open, contact, onOpenChange, onSaved }: ContactDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(contact?.name ?? "");
    setEmail(contact?.email ?? "");
    setTagsRaw(contact?.tags.join(", ") ?? "");
  }, [contact, open]);

  const parseTags = () =>
    tagsRaw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, email, tags: parseTags() };
      const saved = contact
        ? await contactsService.update(contact.id, payload)
        : await contactsService.create(payload);
      toast.success(contact ? t("contacts.updateSuccess") : t("contacts.createSuccess"));
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contact ? t("contacts.editTitle") : t("contacts.newTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("contacts.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t("contacts.email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t("contacts.tags")}</Label>
            <Input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder={t("contacts.tagsPlaceholder")}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
