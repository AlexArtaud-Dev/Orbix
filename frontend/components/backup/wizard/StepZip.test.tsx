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
