import { describe, it, expect } from "vitest";
import { getActiveSidebarLevel } from "./sidebarLevels";

describe("getActiveSidebarLevel", () => {
  it("returns vault level for /vault/email", () => {
    expect(getActiveSidebarLevel("/vault/email")).not.toBeNull();
  });

  it("returns null for /", () => {
    expect(getActiveSidebarLevel("/")).toBeNull();
  });

  it("returns null for /settings", () => {
    expect(getActiveSidebarLevel("/settings")).toBeNull();
  });

  it("returns null for /logs", () => {
    expect(getActiveSidebarLevel("/logs")).toBeNull();
  });

  it("returns mail level for /mail/contacts", () => {
    const level = getActiveSidebarLevel("/mail/contacts");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.mail");
  });
});
