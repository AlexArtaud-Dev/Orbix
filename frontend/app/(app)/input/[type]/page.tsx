"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import { getInputEntry } from "@/providers/input-registry";

export default function InputListPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = use(params);
  const entry = getInputEntry(type);
  if (!entry) notFound();
  const { ListPage } = entry;
  return <ListPage type={type} />;
}
