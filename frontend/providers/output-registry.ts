import type { LucideIcon } from "lucide-react";

export interface OutputProviderEntry {
  type: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const registry = new Map<string, OutputProviderEntry>();

export function registerOutput(entry: OutputProviderEntry): void {
  registry.set(entry.type, entry);
}

export function getOutputEntry(type: string): OutputProviderEntry | undefined {
  return registry.get(type);
}

export function getAllOutputEntries(): OutputProviderEntry[] {
  return [...registry.values()];
}
