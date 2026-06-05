import { describe, it, expect } from "vitest";
import { getActiveSidebarLevel } from "./sidebarLevels";

describe("getActiveSidebarLevel", () => {
  it("returns null for /", () => {
    expect(getActiveSidebarLevel("/")).toBeNull();
  });

  it("returns null for /settings", () => {
    expect(getActiveSidebarLevel("/settings")).toBeNull();
  });

  it("returns null for /logs", () => {
    expect(getActiveSidebarLevel("/logs")).toBeNull();
  });

  it("returns null for /backups", () => {
    expect(getActiveSidebarLevel("/backups")).toBeNull();
  });

  // vault
  it("returns vault level for /vault/email", () => {
    const level = getActiveSidebarLevel("/vault/email");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.vault");
  });

  it("returns vault level for /vault/email/new", () => {
    const level = getActiveSidebarLevel("/vault/email/new");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.vault");
  });

  // output level 1 — output type selector
  it("returns output level for /output", () => {
    const level = getActiveSidebarLevel("/output");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.output");
    expect(level?.parentPath).toBe("/");
  });

  // output level 2 — mail sub-menu (longer prefix wins)
  it("returns output/mail level for /output/mail/contacts", () => {
    const level = getActiveSidebarLevel("/output/mail/contacts");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.outputMail");
    expect(level?.parentPath).toBe("/output");
  });

  it("returns output/mail level for /output/mail/templates", () => {
    const level = getActiveSidebarLevel("/output/mail/templates");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.outputMail");
  });

  it("returns output/mail level for /output/mail/templates/new", () => {
    const level = getActiveSidebarLevel("/output/mail/templates/new");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.outputMail");
  });

  it("returns output/mail level for /output/mail/templates/[id]", () => {
    const level = getActiveSidebarLevel("/output/mail/templates/abc123");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.outputMail");
  });

  // output/mail level wins over output level (longest prefix)
  it("output/mail level takes precedence over output level", () => {
    const level = getActiveSidebarLevel("/output/mail/contacts");
    expect(level?.titleKey).toBe("nav.outputMail");
    expect(level?.titleKey).not.toBe("nav.output");
  });
});
