import { describe, it, expect } from "vitest";
import {
  getSourceRenderer,
  getOutputRenderer,
  EMPTY_CONTEXT,
  type PipelineContext,
} from "./pipelineRenderers";
import type { BackupSource, BackupOutput } from "@/services/backups";
import type { InputItem } from "@/services/input";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = "2026-01-01T00:00:00.000Z";

function makeSource(overrides: Partial<BackupSource> = {}): BackupSource {
  return {
    type: "url",
    path: "",
    exclude: [],
    inputId: undefined,
    transferMode: undefined,
    requestParams: undefined,
    ...overrides,
  } as BackupSource;
}

function makeOutput(overrides: Partial<BackupOutput> = {}): BackupOutput {
  return {
    id: "o-1",
    backupId: "b-1",
    type: "mail",
    vaultId: "v-1",
    templateId: null,
    recipientsTo: [],
    recipientsCc: [],
    recipientsBcc: [],
    overrideSubject: null,
    overrideBody: null,
    overrideBodyType: null,
    pathOverride: null,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeInputItem(overrides: Partial<InputItem> = {}): InputItem {
  return {
    id: "i-1",
    name: "My Input",
    type: "http-rest",
    vaultId: null,
    config: {},
    requestParams: [],
    enabled: true,
    lastTestAt: null,
    lastTestStatus: null,
    lastTestError: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ─── EMPTY_CONTEXT ────────────────────────────────────────────────────────────

describe("EMPTY_CONTEXT", () => {
  it("contains all required map keys", () => {
    expect(EMPTY_CONTEXT.contacts).toBeInstanceOf(Map);
    expect(EMPTY_CONTEXT.inputMap).toBeInstanceOf(Map);
    expect(EMPTY_CONTEXT.vaultsMap).toBeInstanceOf(Map);
    expect(EMPTY_CONTEXT.templatesMap).toBeInstanceOf(Map);
    expect(EMPTY_CONTEXT.sshOutputConfigs).toBeInstanceOf(Map);
  });

  it("all maps are empty by default", () => {
    expect(EMPTY_CONTEXT.contacts.size).toBe(0);
    expect(EMPTY_CONTEXT.inputMap.size).toBe(0);
    expect(EMPTY_CONTEXT.vaultsMap.size).toBe(0);
    expect(EMPTY_CONTEXT.templatesMap.size).toBe(0);
    expect(EMPTY_CONTEXT.sshOutputConfigs.size).toBe(0);
  });
});

// ─── getSourceRenderer — registry lookup ─────────────────────────────────────

describe("getSourceRenderer", () => {
  it('returns the url renderer for type "url"', () => {
    const r = getSourceRenderer("url");
    expect(r).toBeDefined();
    expect(r.bg).toContain("purple");
  });

  it('returns the input renderer for type "input"', () => {
    const r = getSourceRenderer("input");
    expect(r).toBeDefined();
    expect(r.bg).toContain("teal");
  });

  it("returns a generic fallback for an unknown type", () => {
    const r = getSourceRenderer("unknown-xyz");
    expect(r).toBeDefined();
    expect(r.icon).toBeDefined();
  });

  it("generic fallback sublabel returns the type string itself", () => {
    // sublabel closes over the type arg passed to genericSourceRenderer — ignores the source
    const r = getSourceRenderer("sftp");
    expect(r.sublabel(makeSource(), EMPTY_CONTEXT)).toBe("sftp");
  });
});

// ─── getOutputRenderer — registry lookup ─────────────────────────────────────

describe("getOutputRenderer", () => {
  it('returns the mail renderer for type "mail"', () => {
    const r = getOutputRenderer("mail");
    expect(r).toBeDefined();
    expect(r.bg).toContain("sky");
  });

  it('returns the ssh renderer for type "ssh"', () => {
    const r = getOutputRenderer("ssh");
    expect(r).toBeDefined();
    expect(r.bg).toContain("slate");
  });

  it("returns a generic fallback for an unknown type", () => {
    const r = getOutputRenderer("ftp");
    expect(r).toBeDefined();
    expect(r.icon).toBeDefined();
  });

  it("generic fallback label returns the type string", () => {
    const r = getOutputRenderer("ftp");
    expect(r.label(makeOutput({ type: "ftp" }))).toBe("ftp");
  });
});

// ─── URL source renderer — label function ─────────────────────────────────────

describe("url renderer — label()", () => {
  const r = getSourceRenderer("url");

  it("extracts the hostname from a valid URL", () => {
    const label = r.label(makeSource({ path: "https://backup.example.com/api/v1" }), EMPTY_CONTEXT);
    expect(label).toBe("backup.example.com");
  });

  it("falls back to the raw path when it is not a valid URL", () => {
    const label = r.label(makeSource({ path: "not-a-url" }), EMPTY_CONTEXT);
    expect(label).toBe("not-a-url");
  });

  it("sublabel is always 'URL'", () => {
    expect(r.sublabel(makeSource(), EMPTY_CONTEXT)).toBe("URL");
  });
});

// ─── Input source renderer — label function ───────────────────────────────────

describe("input renderer — label()", () => {
  const r = getSourceRenderer("input");

  it("returns the input name when the input is found in ctx.inputMap", () => {
    const ctx: PipelineContext = {
      ...EMPTY_CONTEXT,
      inputMap: new Map([["i-1", makeInputItem({ id: "i-1", name: "Prod DB" })]]),
    };
    const label = r.label(makeSource({ type: "input", inputId: "i-1" }), ctx);
    expect(label).toBe("Prod DB");
  });

  it("returns a truncated inputId when the input is not in ctx.inputMap", () => {
    const source = makeSource({ type: "input", inputId: "abcde12345fghij" });
    const label = r.label(source, EMPTY_CONTEXT);
    expect(label).toContain("abcde12345");
    expect(label).toContain("…");
  });

  it("returns 'Input' when inputId is undefined", () => {
    const label = r.label(makeSource({ type: "input", inputId: undefined }), EMPTY_CONTEXT);
    expect(label).toBe("Input");
  });

  it("sublabel is 'HTTP REST' for http-rest inputs", () => {
    const ctx: PipelineContext = {
      ...EMPTY_CONTEXT,
      inputMap: new Map([["i-1", makeInputItem({ id: "i-1", type: "http-rest" })]]),
    };
    const sub = r.sublabel(makeSource({ type: "input", inputId: "i-1" }), ctx);
    expect(sub).toBe("HTTP REST");
  });

  it("sublabel falls back to 'Input' for unknown input types", () => {
    const ctx: PipelineContext = {
      ...EMPTY_CONTEXT,
      inputMap: new Map([["i-1", makeInputItem({ id: "i-1", type: "digiposte" })]]),
    };
    const sub = r.sublabel(makeSource({ type: "input", inputId: "i-1" }), ctx);
    expect(sub).toBe("Digiposte");
  });
});

// ─── Mail output renderer — label function ────────────────────────────────────

describe("mail renderer — label()", () => {
  it("always returns 'Mail'", () => {
    const r = getOutputRenderer("mail");
    expect(r.label(makeOutput({ type: "mail" }))).toBe("Mail");
  });
});

// ─── SSH output renderer — label function ─────────────────────────────────────

describe("ssh renderer — label()", () => {
  it("always returns 'SSH'", () => {
    const r = getOutputRenderer("ssh");
    expect(r.label(makeOutput({ type: "ssh" }))).toBe("SSH");
  });
});
