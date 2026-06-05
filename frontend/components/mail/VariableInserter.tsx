"use client";
import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Variable {
  key: string;
  label: string;
}

const VARIABLE_GROUPS: { heading: string; items: Variable[] }[] = [
  {
    heading: "Recipient",
    items: [
      { key: "{{recipient.name}}", label: "Name" },
      { key: "{{recipient.email}}", label: "Email" },
    ],
  },
  {
    heading: "System",
    items: [
      { key: "{{date}}", label: "Date" },
      { key: "{{time}}", label: "Time" },
      { key: "{{datetime}}", label: "Date & time" },
    ],
  },
  {
    heading: "Backup",
    items: [
      { key: "{{backup.name}}", label: "Backup name" },
      { key: "{{backup.size}}", label: "Archive size" },
      { key: "{{backup.archive}}", label: "Archive filename" },
      { key: "{{backup.files_count}}", label: "Files count" },
    ],
  },
];

interface VariableInserterProps {
  onInsert: (variable: string) => void;
}

export function VariableInserter({ onInsert }: VariableInserterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Insert variable">
          <Braces className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Variables
        </p>
        {VARIABLE_GROUPS.map((group) => (
          <div key={group.heading} className="mb-2">
            <p className="px-1 py-0.5 text-xs text-muted-foreground">{group.heading}</p>
            {group.items.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => onInsert(v.key)}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted"
              >
                <span>{v.label}</span>
                <code className="ml-2 text-xs text-muted-foreground">{v.key}</code>
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
