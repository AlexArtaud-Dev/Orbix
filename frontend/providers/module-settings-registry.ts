import type { LucideIcon } from "lucide-react";

export interface ModuleNavEntry {
  module: string;
  labelKey: string;
  icon: LucideIcon;
}

const registry: ModuleNavEntry[] = [];

export function registerModuleSettingsNav(entry: ModuleNavEntry): void {
  registry.push(entry);
}

export function getAllModuleNavEntries(): ModuleNavEntry[] {
  return [...registry];
}
