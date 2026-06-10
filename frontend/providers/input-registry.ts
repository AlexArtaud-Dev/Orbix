import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

export interface InputProviderEntry {
  type: string;
  label: string;
  icon: LucideIcon;
  description: string;
  ListPage: ComponentType<{ type: string }>;
  CreatePage: ComponentType<{ type: string }>;
  EditPage: ComponentType<{ type: string; id: string }>;
}

const registry = new Map<string, InputProviderEntry>();

export function registerInput(entry: InputProviderEntry): void {
  registry.set(entry.type, entry);
}

export function getInputEntry(type: string): InputProviderEntry | undefined {
  return registry.get(type);
}

export function getAllInputEntries(): InputProviderEntry[] {
  return [...registry.values()];
}
