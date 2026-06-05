"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Contact } from "@/services/contacts";
import { cn } from "@/lib/utils";

interface ContactPickerProps {
  contacts: Contact[];
  selected: Contact[];
  onChange: (selected: Contact[]) => void;
  placeholder?: string;
}

export function ContactPicker({ contacts, selected, onChange, placeholder }: ContactPickerProps) {
  const [open, setOpen] = useState(false);

  const toggle = (contact: Contact) => {
    const isSelected = selected.some((c) => c.id === contact.id);
    onChange(isSelected ? selected.filter((c) => c.id !== contact.id) : [...selected, contact]);
  };

  const unselected = contacts.filter((c) => !selected.some((s) => s.id === c.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background",
            "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            "hover:border-ring/50 transition-colors",
          )}
        >
          {selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {c.name}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); toggle(c); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggle(c); } }}
                className="ml-0.5 cursor-pointer rounded-full hover:bg-primary/20"
              >
                <X className="size-3" />
              </span>
            </span>
          ))}
          {selected.length === 0 && (
            <span className="text-muted-foreground">{placeholder ?? "Select contacts…"}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Search by name or email…" />
          <CommandList>
            <CommandEmpty>No contact found.</CommandEmpty>

            {selected.length > 0 && (
              <>
                <CommandGroup heading="Selected">
                  {selected.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.email}`}
                      onSelect={() => toggle(c)}
                      className="flex items-center gap-2"
                    >
                      <Check className="size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {unselected.length > 0 && <CommandSeparator />}
              </>
            )}

            {unselected.length > 0 && (
              <CommandGroup heading={selected.length > 0 ? "Contacts" : undefined}>
                {unselected.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.email}`}
                    onSelect={() => toggle(c)}
                    className="flex items-center gap-2"
                  >
                    <div className="size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
