"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import { getInputEntry } from "@/providers/input-registry";

export default function InputEditPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const entry = getInputEntry(type);
  if (!entry) notFound();
  const { EditPage } = entry;
  return <EditPage type={type} id={id} />;
}
