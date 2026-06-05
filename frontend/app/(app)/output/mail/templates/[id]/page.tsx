"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { templatesService, type MailTemplate } from "@/services/templates";
import { TemplateEditor } from "@/components/mail/TemplateEditor";

export default function EditTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<MailTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    templatesService.getOne(id)
      .then(setTemplate)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );

  return <TemplateEditor initial={template ?? undefined} />;
}
