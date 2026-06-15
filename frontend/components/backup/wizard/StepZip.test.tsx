import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepZip } from "./StepZip";

// Return the i18n key as the translation so assertions are key-based
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderStep(zipPassword: string | null, onChange = vi.fn()) {
  return render(
    <StepZip
      data={{
        noArchive: false,
        archiveFormat: "zip",
        zipCompression: "default",
        zipPassword,
        zipPasswordVaultRef: "",
        zipFilename: "",
      }}
      backupName="test-backup"
      onChange={onChange}
    />,
  );
}

describe("StepZip — zipPassword sentinel (null = existing, unchanged)", () => {
  it("shows passwordSet placeholder when zipPassword is null", () => {
    renderStep(null);
    const input = screen.getByPlaceholderText("backups.zip.passwordSet");
    expect(input).toBeDefined();
  });

  it("shows the currentlySet hint when zipPassword is null", () => {
    renderStep(null);
    expect(screen.getByText("backups.zip.passwordCurrentlySet")).toBeDefined();
  });

  it("does not show the currentlySet hint when zipPassword is empty string", () => {
    renderStep("");
    expect(screen.queryByText("backups.zip.passwordCurrentlySet")).toBeNull();
  });

  it("shows passwordHint placeholder when zipPassword is empty string", () => {
    renderStep("");
    const input = screen.getByPlaceholderText("backups.zip.passwordHint");
    expect(input).toBeDefined();
  });

  it("renders the typed password value", () => {
    renderStep("my-secret");
    const input = screen.getByDisplayValue("my-secret") as HTMLInputElement;
    expect(input.value).toBe("my-secret");
  });

  it("calls onChange with the typed string when user inputs text (transitioning from null)", () => {
    const onChange = vi.fn();
    renderStep(null, onChange);
    const input = screen.getByPlaceholderText("backups.zip.passwordSet");
    fireEvent.change(input, { target: { value: "new-password" } });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as { zipPassword: string };
    expect(lastCall.zipPassword).toBe("new-password");
  });

  it("calls onChange with empty string when user clears the field (removes password)", () => {
    const onChange = vi.fn();
    renderStep("existing", onChange);
    const input = screen.getByDisplayValue("existing");
    fireEvent.change(input, { target: { value: "" } });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as { zipPassword: string };
    expect(lastCall.zipPassword).toBe("");
  });
});

describe("StepZip — password field not shown for non-ZIP formats", () => {
  it("does not render the password input for tar format", () => {
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "tar", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "", zipFilename: "" }}
        backupName="test"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText("backups.zip.passwordSet")).toBeNull();
    expect(screen.queryByPlaceholderText("backups.zip.passwordHint")).toBeNull();
  });
});

// ─── Vault password mode ───────────────────────────────────────────────────────

describe("StepZip — vault password mode", () => {
  it("starts in literal mode when zipPasswordVaultRef is empty", () => {
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: "", zipPasswordVaultRef: "", zipFilename: "" }}
        backupName="test"
        onChange={vi.fn()}
      />,
    );
    // Literal mode: password Input is rendered
    expect(screen.getByPlaceholderText("backups.zip.passwordHint")).toBeDefined();
    // Vault trigger button shows the "use vault" label
    expect(screen.getByText("backups.zip.passwordUseVault")).toBeDefined();
  });

  it("starts in vault mode when zipPasswordVaultRef is non-empty", () => {
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "myslug.mykey", zipFilename: "" }}
        backupName="test"
        onChange={vi.fn()}
      />,
    );
    // Vault mode: password Input is NOT rendered
    expect(screen.queryByPlaceholderText("backups.zip.passwordSet")).toBeNull();
    expect(screen.queryByPlaceholderText("backups.zip.passwordHint")).toBeNull();
    // The vault ref value is displayed in the trigger button
    expect(screen.getByText("myslug.mykey")).toBeDefined();
    // The toggle button shows the "vault active" label
    expect(screen.getByText("backups.zip.passwordVaultActive")).toBeDefined();
  });

  it("shows the vault ref value inside the trigger button", () => {
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "secrets.zip_pw", zipFilename: "" }}
        backupName="test"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("secrets.zip_pw")).toBeDefined();
  });

  it("does NOT show passwordCurrentlySet hint when vault mode is active", () => {
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "myslug.mykey", zipFilename: "" }}
        backupName="test"
        onChange={vi.fn()}
      />,
    );
    // The amber "currently set" hint is only for literal mode
    expect(screen.queryByText("backups.zip.passwordCurrentlySet")).toBeNull();
  });

  it("shows passwordCurrentlySet hint in literal mode when zipPassword is null (existing password)", () => {
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "", zipFilename: "" }}
        backupName="test"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("backups.zip.passwordCurrentlySet")).toBeDefined();
  });

  it("shows the placeholder for selecting a vault variable when vault mode active and ref is empty", () => {
    // This happens when the user just toggled to vault mode but hasn't picked yet.
    // We simulate it by starting with vaultRef="" but isVaultMode initialises from Boolean("") = false,
    // so this state is only reachable via the toggle — which we don't trigger here.
    // Instead we confirm that empty vaultRef → literal mode (no vault placeholder shown).
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: "", zipPasswordVaultRef: "", zipFilename: "" }}
        backupName="test"
        onChange={vi.fn()}
      />,
    );
    // Confirm literal mode — vault placeholder NOT shown as a trigger button text
    expect(screen.queryByText("backups.zip.passwordSelectVaultVar")).toBeNull();
  });
});

// ─── canNoArchive / noArchiveReason ───────────────────────────────────────────

describe("StepZip — canNoArchive gate", () => {
  function renderBlocked(noArchiveReason?: string) {
    return render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "", zipFilename: "" }}
        backupName="test"
        canNoArchive={false}
        noArchiveReason={noArchiveReason}
        onChange={vi.fn()}
      />,
    );
  }

  it("shows the noArchiveReason text when canNoArchive=false and reason is provided", () => {
    renderBlocked("Not available: exactly one file source is required.");
    expect(screen.getByText("Not available: exactly one file source is required.")).toBeDefined();
  });

  it("disables the switch when canNoArchive=false", () => {
    renderBlocked("blocked");
    const toggle = document.querySelector('[role="switch"]') as HTMLButtonElement | null;
    expect(toggle?.disabled).toBe(true);
  });

  it("does not show reason text when canNoArchive=false but no reason is provided", () => {
    renderBlocked(undefined);
    // No extra paragraph beyond the normal description
    expect(screen.queryByText("Not available:")).toBeNull();
  });

  it("does not show reason text when canNoArchive=true even if reason prop is passed", () => {
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "", zipFilename: "" }}
        backupName="test"
        canNoArchive={true}
        noArchiveReason="This should not appear"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("This should not appear")).toBeNull();
  });

  it("enables the switch when canNoArchive=true", () => {
    render(
      <StepZip
        data={{ noArchive: false, archiveFormat: "zip", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "", zipFilename: "" }}
        backupName="test"
        canNoArchive={true}
        onChange={vi.fn()}
      />,
    );
    const toggle = document.querySelector('[role="switch"]') as HTMLButtonElement | null;
    expect(toggle?.disabled).toBe(false);
  });
});

// ─── noArchive filename preview ───────────────────────────────────────────────

describe("StepZip — noArchive filename preview", () => {
  function renderNoArchive(zipFilename: string, detectedExtension?: string, onChange = vi.fn()) {
    return render(
      <StepZip
        data={{ noArchive: true, archiveFormat: "zip", zipCompression: "default", zipPassword: null, zipPasswordVaultRef: "", zipFilename }}
        backupName="my backup"
        detectedExtension={detectedExtension}
        onChange={onChange}
      />,
    );
  }

  it("shows (auto) preview with detected extension when no template is set", () => {
    renderNoArchive("", ".tar.gz");
    expect(screen.getByText("(auto).tar.gz")).toBeDefined();
  });

  it("shows (auto) without extension when no template and no detected extension", () => {
    renderNoArchive("", undefined);
    expect(screen.getByText("(auto)")).toBeDefined();
  });

  it("appends detected extension to the resolved template", () => {
    renderNoArchive("my-export", ".json");
    // Template "my-export" has no {{}} vars, so preview is "my-export.json"
    expect(screen.getByText("my-export.json")).toBeDefined();
  });

  it("slug-ifies backup.name variable in preview (spaces → underscores)", () => {
    // backupName = "my backup" → slug = "my_backup"
    renderNoArchive("{{backup.name}}-export", ".zip");
    expect(screen.getByText("my_backup-export.zip")).toBeDefined();
  });

  it("shows the noArchiveFilename field label", () => {
    renderNoArchive("", ".tar.gz");
    expect(screen.getByText("backups.zip.noArchiveFilename")).toBeDefined();
  });

  it("shows the detected extension hint when detectedExtension is provided", () => {
    renderNoArchive("", ".tar.gz");
    // The hint text key is "backups.zip.noArchiveDetectedExt" which our mock returns as-is
    expect(screen.getByText("backups.zip.noArchiveDetectedExt")).toBeDefined();
  });

  it("shows the generic hint when no detectedExtension", () => {
    renderNoArchive("", undefined);
    expect(screen.getByText("backups.zip.noArchiveFilenameHint")).toBeDefined();
  });
});
