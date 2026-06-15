"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SshBrowserBase } from "./SshBrowserBase";

interface Props {
  vaultId: string;
  value: string;
  defaultPath?: string;
  onSelect: (path: string) => void;
  disabled?: boolean;
}

export function SshFolderPickerDialog({ vaultId, value, defaultPath, onSelect, disabled }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const displayPath = value || defaultPath || "";

  const handleSelect = (path: string) => {
    onSelect(path);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          {displayPath ? (
            <span className="font-mono text-xs">{displayPath}</span>
          ) : (
            <span className="text-muted-foreground text-xs italic">{t("output.ssh.noFolderSelected")}</span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={disabled || !vaultId}
        >
          <FolderOpen className="size-3.5" />
          {t("output.ssh.pickFolder")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="size-4" />
              {t("output.ssh.pickFolder")}
            </DialogTitle>
          </DialogHeader>
          <div className="h-[560px]">
            <SshBrowserBase
              vaultId={vaultId}
              foldersOnly
              renderAction={() => null}
              headerExtra={(currentPath, browsed) =>
                browsed ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSelect(currentPath)}
                  >
                    <Check className="size-3.5" />
                    {t("output.ssh.selectThisFolder")}
                  </Button>
                ) : null
              }
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
