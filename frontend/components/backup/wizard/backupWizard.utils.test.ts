import { describe, it, expect } from "vitest";
import {
  defaultForm,
  backupToForm,
  buildScheduleString,
  buildScheduleConfig,
  formToPayload,
  type WizardForm,
} from "./backupWizard.utils";
import type { Backup } from "@/services/backups";

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

  it("maps recurring schedule config", () => {
    const backup = makeBackup({
      scheduleType: "recurring",
      scheduleConfig: { days: [1, 2, 5], hour: 8, minute: 30, timezone: "Europe/Paris" },
    });
    const form = backupToForm(backup);
    expect(form.schedule.type).toBe("recurring");
    expect(form.schedule.days).toEqual([1, 2, 5]);
    expect(form.schedule.hour).toBe(8);
    expect(form.schedule.timezone).toBe("Europe/Paris");
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

  it("generates cron string for recurring type", () => {
    const result = buildScheduleString({ ...base, type: "recurring", days: [1, 2, 3], hour: 3, minute: 0 });
    expect(result).toBe("0 3 * * 1,2,3");
  });

  it("uses * for days when days array is empty", () => {
    const result = buildScheduleString({ ...base, type: "recurring", days: [], hour: 6, minute: 30 });
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

  it("returns days, hour, minute, timezone for recurring type", () => {
    const result = buildScheduleConfig({
      ...base,
      type: "recurring",
      days: [1, 5],
      hour: 8,
      minute: 0,
      timezone: "Europe/Paris",
    });
    expect(result).toEqual({ days: [1, 5], hour: 8, minute: 0, timezone: "Europe/Paris" });
  });

  it("returns every and unit for interval type", () => {
    const result = buildScheduleConfig({ ...base, type: "interval", every: 2, unit: "hours" });
    expect(result).toEqual({ every: 2, unit: "hours" });
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
        { id: "o1", backupId: "b-1", type: "mail", vaultId: "v-1", templateId: null, recipientsTo: [], recipientsCc: [], recipientsBcc: [], overrideSubject: null, overrideBody: null, overrideBodyType: null, order: 0, createdAt: NOW, updatedAt: NOW },
        { id: "o2", backupId: "b-1", type: "mail", vaultId: "v-2", templateId: null, recipientsTo: [], recipientsCc: [], recipientsBcc: [], overrideSubject: null, overrideBody: null, overrideBodyType: null, order: 1, createdAt: NOW, updatedAt: NOW },
      ],
    });
    const payload = formToPayload(backupToForm(backup), false);
    expect(payload.outputs![0].order).toBe(0);
    expect(payload.outputs![1].order).toBe(1);
  });
});
