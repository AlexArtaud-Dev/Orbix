import { describe, it, expect } from "vitest";
import {
  defaultForm,
  backupToForm,
  buildScheduleString,
  buildScheduleConfig,
  formToPayload,
  computeNoArchiveState,
  type WizardForm,
} from "./backupWizard.utils";
import type { Backup } from "@/services/backups";
import type { InputItem } from "@/services/input";
import type { SourceFormItem } from "./StepSources";

const NOW = "2026-01-01T00:00:00.000Z";

function makeBackup(overrides: Partial<Backup> = {}): Backup {
  return {
    id: "b-1",
    name: "Test Backup",
    backupType: "local",
    sources: { sources: [{ path: "/data", type: "folder", exclude: [] }] },
    scheduleType: "manual",
    scheduleConfig: null,
    schedule: null,
    enabled: false,
    noArchive: false,
    archiveFormat: "zip",
    zipCompression: "default",
    zipPassword: null,
    zipPasswordVaultRef: null,
    zipFilename: null,
    isValidated: false,
    validationStatus: null,
    validationError: null,
    validatedAt: null,
    lastRunAt: null,
    lastStatus: null,
    outputs: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ─── defaultForm ───────────────────────────────────────────────────────────────

describe("defaultForm", () => {
  it("returns empty name and disabled state", () => {
    const form = defaultForm();
    expect(form.basic.name).toBe("");
    expect(form.enabled).toBe(false);
  });

  it("returns manual schedule type by default", () => {
    expect(defaultForm().schedule.type).toBe("manual");
  });

  it("returns empty sources list", () => {
    expect(defaultForm().sources).toEqual([]);
  });

  it("returns zip as default archive format", () => {
    expect(defaultForm().zip.archiveFormat).toBe("zip");
    expect(defaultForm().zip.zipCompression).toBe("default");
  });

  it("returns empty zipPassword string (no password)", () => {
    expect(defaultForm().zip.zipPassword).toBe("");
  });

  it("returns empty outputs list", () => {
    expect(defaultForm().outputs).toEqual([]);
  });
});

// ─── backupToForm ──────────────────────────────────────────────────────────────

describe("backupToForm", () => {
  it("maps basic name and enabled from backup", () => {
    const backup = makeBackup({ name: "My Backup", enabled: true });
    const form = backupToForm(backup);
    expect(form.basic.name).toBe("My Backup");
    expect(form.enabled).toBe(true);
  });

  it("maps sources correctly", () => {
    const backup = makeBackup({
      sources: { sources: [{ path: "/home/docs", type: "folder", exclude: ["*.bak"] }] },
    });
    const form = backupToForm(backup);
    expect(form.sources).toHaveLength(1);
    expect(form.sources[0].path).toBe("/home/docs");
    expect(form.sources[0].exclude).toEqual(["*.bak"]);
  });

  it("sets zipPassword to null when backup has a password (sentinel = keep unchanged)", () => {
    const backup = makeBackup({ zipPassword: "secret" });
    expect(backupToForm(backup).zip.zipPassword).toBeNull();
  });

  it("sets zipPassword to empty string when backup has no password", () => {
    const backup = makeBackup({ zipPassword: null });
    expect(backupToForm(backup).zip.zipPassword).toBe("");
  });

  it("initialises recipient stubs with correct IDs so payload is valid before step 4", () => {
    const backup = makeBackup({
      outputs: [
        {
          id: "out-1",
          backupId: "b-1",
          type: "mail",
          vaultId: "vault-1",
          templateId: null,
          recipientsTo: ["contact-a", "contact-b"],
          recipientsCc: [],
          recipientsBcc: ["contact-c"],
          overrideSubject: null,
          overrideBody: null,
          overrideBodyType: null,
          pathOverride: null,
          order: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    const form = backupToForm(backup);
    expect(form.outputs[0].recipientsTo.map((c) => c.id)).toEqual(["contact-a", "contact-b"]);
    expect(form.outputs[0].recipientsBcc.map((c) => c.id)).toEqual(["contact-c"]);
  });

  it("maps scheduleType manual correctly", () => {
    const form = backupToForm(makeBackup({ scheduleType: "manual", scheduleConfig: null }));
    expect(form.schedule.type).toBe("manual");
  });

  it("maps recurring schedule config (legacy flat format)", () => {
    const backup = makeBackup({
      scheduleType: "recurring",
      scheduleConfig: { days: [1, 2, 5], hour: 8, minute: 30, timezone: "Europe/Paris" },
    });
    const form = backupToForm(backup);
    expect(form.schedule.type).toBe("recurring");
    expect(form.schedule.recurringRules[0].days).toEqual([1, 2, 5]);
    expect(form.schedule.recurringRules[0].hour).toBe(8);
    expect(form.schedule.timezone).toBe("Europe/Paris");
  });

  it("maps recurring schedule config (new rules format)", () => {
    const backup = makeBackup({
      scheduleType: "recurring",
      scheduleConfig: {
        rules: [
          { days: [1, 2, 3, 4, 5], hour: 10, minute: 0 },
          { days: [6, 0], hour: 12, minute: 0 },
        ],
        timezone: "Europe/Paris",
      },
    });
    const form = backupToForm(backup);
    expect(form.schedule.type).toBe("recurring");
    expect(form.schedule.recurringRules).toHaveLength(2);
    expect(form.schedule.recurringRules[1].days).toEqual([6, 0]);
    expect(form.schedule.recurringRules[1].hour).toBe(12);
  });

  it("maps interval schedule config", () => {
    const backup = makeBackup({
      scheduleType: "interval",
      scheduleConfig: { every: 4, unit: "hours" },
    });
    const form = backupToForm(backup);
    expect(form.schedule.every).toBe(4);
    expect(form.schedule.unit).toBe("hours");
  });

  it("maps interval schedule config with start and end dates", () => {
    const backup = makeBackup({
      scheduleType: "interval",
      scheduleConfig: { every: 1, unit: "hours", startDate: "2026-06-15T08:00", endDate: "2026-12-31T23:59" },
    });
    const form = backupToForm(backup);
    expect(form.schedule.intervalStartDate).toBe("2026-06-15T08:00");
    expect(form.schedule.intervalEndDate).toBe("2026-12-31T23:59");
  });
});

// ─── buildScheduleString ───────────────────────────────────────────────────────

describe("buildScheduleString", () => {
  const base = defaultForm().schedule;

  it("returns null for manual type", () => {
    expect(buildScheduleString({ ...base, type: "manual" })).toBeNull();
  });

  it("returns the datetime string for oneshoot type", () => {
    expect(buildScheduleString({ ...base, type: "oneshoot", datetime: "2026-06-10T09:00" })).toBe(
      "2026-06-10T09:00",
    );
  });

  it("returns null for oneshoot with empty datetime", () => {
    expect(buildScheduleString({ ...base, type: "oneshoot", datetime: "" })).toBeNull();
  });

  it("generates cron string for recurring type (first rule)", () => {
    const result = buildScheduleString({
      ...base, type: "recurring",
      recurringRules: [{ days: [1, 2, 3], hour: 3, minute: 0 }],
    });
    expect(result).toBe("0 3 * * 1,2,3");
  });

  it("uses first rule for cron string when multiple rules", () => {
    const result = buildScheduleString({
      ...base, type: "recurring",
      recurringRules: [
        { days: [1, 2, 3, 4, 5], hour: 10, minute: 0 },
        { days: [6, 0], hour: 12, minute: 0 },
      ],
    });
    expect(result).toBe("0 10 * * 1,2,3,4,5");
  });

  it("uses * for days when days array is empty", () => {
    const result = buildScheduleString({
      ...base, type: "recurring",
      recurringRules: [{ days: [], hour: 6, minute: 30 }],
    });
    expect(result).toBe("30 6 * * *");
  });

  it("generates cron string for interval type in minutes", () => {
    expect(buildScheduleString({ ...base, type: "interval", every: 15, unit: "minutes" })).toBe(
      "*/15 * * * *",
    );
  });

  it("generates cron string for interval type in hours", () => {
    expect(buildScheduleString({ ...base, type: "interval", every: 6, unit: "hours" })).toBe(
      "0 */6 * * *",
    );
  });

  it("clamps interval to minimum 1", () => {
    expect(buildScheduleString({ ...base, type: "interval", every: 0, unit: "minutes" })).toBe(
      "*/1 * * * *",
    );
  });
});

// ─── buildScheduleConfig ──────────────────────────────────────────────────────

describe("buildScheduleConfig", () => {
  const base = defaultForm().schedule;

  it("returns null for manual type", () => {
    expect(buildScheduleConfig({ ...base, type: "manual" })).toBeNull();
  });

  it("returns datetime and timezone for oneshoot type", () => {
    const result = buildScheduleConfig({
      ...base,
      type: "oneshoot",
      datetime: "2026-06-10T09:00",
      timezone: "UTC",
    });
    expect(result).toEqual({ datetime: "2026-06-10T09:00", timezone: "UTC" });
  });

  it("returns rules array and timezone for recurring type", () => {
    const result = buildScheduleConfig({
      ...base,
      type: "recurring",
      recurringRules: [{ days: [1, 5], hour: 8, minute: 0 }],
      timezone: "Europe/Paris",
    });
    expect(result).toEqual({
      rules: [{ days: [1, 5], hour: 8, minute: 0 }],
      timezone: "Europe/Paris",
    });
  });

  it("returns every and unit for interval type", () => {
    const result = buildScheduleConfig({ ...base, type: "interval", every: 2, unit: "hours" });
    expect(result).toEqual({ every: 2, unit: "hours" });
  });

  it("includes startDate and endDate in interval config when set", () => {
    const result = buildScheduleConfig({
      ...base,
      type: "interval",
      every: 1,
      unit: "hours",
      intervalStartDate: "2026-06-15T08:00",
      intervalEndDate: "2026-12-31T23:59",
    });
    expect(result).toEqual({
      every: 1,
      unit: "hours",
      startDate: "2026-06-15T08:00",
      endDate: "2026-12-31T23:59",
    });
  });

  it("omits startDate/endDate from interval config when empty", () => {
    const result = buildScheduleConfig({
      ...base,
      type: "interval",
      every: 30,
      unit: "minutes",
      intervalStartDate: "",
      intervalEndDate: "",
    });
    expect(result).toEqual({ every: 30, unit: "minutes" });
  });
});

// ─── formToPayload ────────────────────────────────────────────────────────────

describe("formToPayload — zipPassword handling", () => {
  function makeForm(zipPassword: string | null): WizardForm {
    return { ...defaultForm(), zip: { ...defaultForm().zip, zipPassword } };
  }

  it("sends undefined (omits field) when zipPassword is null — preserves existing password", () => {
    const payload = formToPayload(makeForm(null), false);
    expect(payload.zipPassword).toBeUndefined();
  });

  it("sends null when zipPassword is empty string — clears existing password", () => {
    const payload = formToPayload(makeForm(""), false);
    expect(payload.zipPassword).toBeNull();
  });

  it("sends the new password string when provided", () => {
    const payload = formToPayload(makeForm("my-secret"), false);
    expect(payload.zipPassword).toBe("my-secret");
  });
});

describe("formToPayload — recipients from stubs", () => {
  it("maps recipient stub IDs correctly to the payload", () => {
    const backup = makeBackup({
      outputs: [
        {
          id: "out-1",
          backupId: "b-1",
          type: "mail",
          vaultId: "v-1",
          templateId: null,
          recipientsTo: ["c-1", "c-2"],
          recipientsCc: [],
          recipientsBcc: [],
          overrideSubject: null,
          overrideBody: null,
          overrideBodyType: null,
          pathOverride: null,
          order: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    const form = backupToForm(backup);
    const payload = formToPayload(form, false);

    expect(payload.outputs![0].recipientsTo).toEqual(["c-1", "c-2"]);
  });
});

describe("formToPayload — zipPasswordVaultRef handling", () => {
  it("sends zipPasswordVaultRef when non-empty", () => {
    const form = {
      ...defaultForm(),
      zip: { ...defaultForm().zip, zipPasswordVaultRef: "myslug.password" },
    };
    const payload = formToPayload(form, false);
    expect(payload.zipPasswordVaultRef).toBe("myslug.password");
  });

  it("sends null when zipPasswordVaultRef is empty string", () => {
    const form = {
      ...defaultForm(),
      zip: { ...defaultForm().zip, zipPasswordVaultRef: "" },
    };
    const payload = formToPayload(form, false);
    expect(payload.zipPasswordVaultRef).toBeNull();
  });
});

describe("defaultForm — zipPasswordVaultRef", () => {
  it("initialises zipPasswordVaultRef as empty string", () => {
    expect(defaultForm().zip.zipPasswordVaultRef).toBe("");
  });
});

describe("backupToForm — zipPasswordVaultRef", () => {
  it("maps zipPasswordVaultRef from backup when present", () => {
    const backup = makeBackup({ zipPasswordVaultRef: "slug.key" });
    expect(backupToForm(backup).zip.zipPasswordVaultRef).toBe("slug.key");
  });

  it("defaults to empty string when backup has null", () => {
    const backup = makeBackup({ zipPasswordVaultRef: null });
    expect(backupToForm(backup).zip.zipPasswordVaultRef).toBe("");
  });
});

describe("formToPayload — general", () => {
  it("maps name and enabled correctly", () => {
    const form = { ...defaultForm(), basic: { name: "My Backup" }, enabled: true };
    const payload = formToPayload(form, true);
    expect(payload.name).toBe("My Backup");
    expect(payload.enabled).toBe(true);
  });

  it("sends null for zipFilename when empty", () => {
    const payload = formToPayload(defaultForm(), false);
    expect(payload.zipFilename).toBeNull();
  });

  it("maps sources", () => {
    const form = {
      ...defaultForm(),
      sources: [{ path: "/home", type: "folder" as const, exclude: ["*.tmp"] }],
    };
    const payload = formToPayload(form, false);
    expect(payload.sources!.sources[0].path).toBe("/home");
    expect(payload.sources!.sources[0].exclude).toEqual(["*.tmp"]);
  });

  it("assigns output order by array index", () => {
    const backup = makeBackup({
      outputs: [
        { id: "o1", backupId: "b-1", type: "mail", vaultId: "v-1", templateId: null, recipientsTo: [], recipientsCc: [], recipientsBcc: [], overrideSubject: null, overrideBody: null, overrideBodyType: null, pathOverride: null, order: 0, createdAt: NOW, updatedAt: NOW },
        { id: "o2", backupId: "b-1", type: "mail", vaultId: "v-2", templateId: null, recipientsTo: [], recipientsCc: [], recipientsBcc: [], overrideSubject: null, overrideBody: null, overrideBodyType: null, pathOverride: null, order: 1, createdAt: NOW, updatedAt: NOW },
      ],
    });
    const payload = formToPayload(backupToForm(backup), false);
    expect(payload.outputs![0].order).toBe(0);
    expect(payload.outputs![1].order).toBe(1);
  });
});

// ─── computeNoArchiveState ────────────────────────────────────────────────────

function makeSource(type: SourceFormItem["type"], inputId?: string): SourceFormItem {
  return { type, path: "", exclude: [], inputId };
}

function makeInputItem(id: string, inputType: string, config: Record<string, unknown> = {}): InputItem {
  return {
    id,
    name: "Input " + id,
    type: inputType,
    vaultId: null,
    config,
    requestParams: [],
    enabled: true,
    lastTestAt: null,
    lastTestStatus: null,
    lastTestError: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("computeNoArchiveState — local mode", () => {
  it("allows noArchive for a single file source", () => {
    const { canNoArchive, noArchiveBlockedKey } = computeNoArchiveState("local", [makeSource("file")], []);
    expect(canNoArchive).toBe(true);
    expect(noArchiveBlockedKey).toBeUndefined();
  });

  it("blocks noArchive for a single folder source", () => {
    const { canNoArchive, noArchiveBlockedKey } = computeNoArchiveState("local", [makeSource("folder")], []);
    expect(canNoArchive).toBe(false);
    expect(noArchiveBlockedKey).toBe("backups.zip.noArchiveRequiresSingleFile");
  });

  it("blocks noArchive when there are multiple sources", () => {
    const { canNoArchive } = computeNoArchiveState("local", [makeSource("file"), makeSource("file")], []);
    expect(canNoArchive).toBe(false);
  });

  it("blocks noArchive when sources list is empty", () => {
    const { canNoArchive } = computeNoArchiveState("local", [], []);
    expect(canNoArchive).toBe(false);
  });
});

describe("computeNoArchiveState — input mode, no input sources", () => {
  it("blocks when sources list is empty", () => {
    const { canNoArchive, noArchiveBlockedKey } = computeNoArchiveState("input", [], []);
    expect(canNoArchive).toBe(false);
    expect(noArchiveBlockedKey).toBe("backups.zip.noArchiveBlockMultipleInputs");
  });

  it("blocks when there are two input sources", () => {
    const { canNoArchive, noArchiveBlockedKey } = computeNoArchiveState(
      "input",
      [makeSource("input", "i-1"), makeSource("input", "i-2")],
      [],
    );
    expect(canNoArchive).toBe(false);
    expect(noArchiveBlockedKey).toBe("backups.zip.noArchiveBlockMultipleInputs");
  });

  it("returns canNoArchive=false with no key when input not yet loaded", () => {
    const { canNoArchive, noArchiveBlockedKey } = computeNoArchiveState(
      "input",
      [makeSource("input", "not-in-list")],
      [],
    );
    expect(canNoArchive).toBe(false);
    expect(noArchiveBlockedKey).toBeUndefined();
  });
});

describe("computeNoArchiveState — input mode, http-rest input", () => {
  it("allows noArchive for a single http-rest input", () => {
    const input = makeInputItem("i-1", "http-rest", { baseUrl: "http://example.com" });
    const { canNoArchive, noArchiveBlockedKey } = computeNoArchiveState(
      "input",
      [makeSource("input", "i-1")],
      [input],
    );
    expect(canNoArchive).toBe(true);
    expect(noArchiveBlockedKey).toBeUndefined();
  });
});

describe("computeNoArchiveState — input mode, SSH input", () => {
  it("allows noArchive for a single file SSH source", () => {
    const input = makeInputItem("i-1", "ssh", {
      sources: [{ path: "/etc/nginx.conf", isDirectory: false }],
    });
    const { canNoArchive } = computeNoArchiveState("input", [makeSource("input", "i-1")], [input]);
    expect(canNoArchive).toBe(true);
  });

  it("blocks noArchive for a single directory SSH source", () => {
    const input = makeInputItem("i-1", "ssh", {
      sources: [{ path: "/srv/configs", isDirectory: true }],
    });
    const { canNoArchive, noArchiveBlockedKey } = computeNoArchiveState(
      "input",
      [makeSource("input", "i-1")],
      [input],
    );
    expect(canNoArchive).toBe(false);
    expect(noArchiveBlockedKey).toBe("backups.zip.noArchiveBlockSSHDirectory");
  });

  it("blocks noArchive for two SSH file sources", () => {
    const input = makeInputItem("i-1", "ssh", {
      sources: [
        { path: "/etc/file1.conf", isDirectory: false },
        { path: "/etc/file2.conf", isDirectory: false },
      ],
    });
    const { canNoArchive, noArchiveBlockedKey, noArchiveBlockedParams } = computeNoArchiveState(
      "input",
      [makeSource("input", "i-1")],
      [input],
    );
    expect(canNoArchive).toBe(false);
    expect(noArchiveBlockedKey).toBe("backups.zip.noArchiveBlockSSHMultipleSources");
    expect(noArchiveBlockedParams).toEqual({ count: 2 });
  });

  it("blocks noArchive for zero SSH sources (empty sources array)", () => {
    const input = makeInputItem("i-1", "ssh", { sources: [] });
    const { canNoArchive, noArchiveBlockedKey } = computeNoArchiveState(
      "input",
      [makeSource("input", "i-1")],
      [input],
    );
    expect(canNoArchive).toBe(false);
    expect(noArchiveBlockedKey).toBe("backups.zip.noArchiveBlockSSHMultipleSources");
  });

  it("blocks noArchive for SSH input with no sources field", () => {
    const input = makeInputItem("i-1", "ssh", {});
    const { canNoArchive } = computeNoArchiveState("input", [makeSource("input", "i-1")], [input]);
    expect(canNoArchive).toBe(false);
  });
});
