import { describe, it, expect } from "vitest";
import { getActiveSidebarLevel, ROOT_NAV_CATEGORIES, ROOT_NAV_ITEMS } from "./sidebarLevels";

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

  // vault — /vault/email has its own sidebar level (longest-prefix wins)
  it("returns vault level for /vault/email", () => {
    const level = getActiveSidebarLevel("/vault/email");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.emailConfigs");
    expect(level?.parentPath).toBe("/vault");
  });

  it("returns vault level for /vault/email/new", () => {
    const level = getActiveSidebarLevel("/vault/email/new");
    expect(level).not.toBeNull();
    expect(level?.titleKey).toBe("nav.emailConfigs");
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

// ─── ROOT_NAV_CATEGORIES structure ────────────────────────────────────────────

describe("ROOT_NAV_CATEGORIES", () => {
  it("has exactly 4 categories", () => {
    expect(ROOT_NAV_CATEGORIES).toHaveLength(4);
  });

  it("first category has an empty titleKey (no visible header)", () => {
    expect(ROOT_NAV_CATEGORIES[0].titleKey).toBe("");
  });

  it("first category contains the Dashboard route", () => {
    const routes = ROOT_NAV_CATEGORIES[0].items.map((i) => i.to);
    expect(routes).toContain("/");
  });

  it("second category has titleKey nav.categories.resources", () => {
    expect(ROOT_NAV_CATEGORIES[1].titleKey).toBe("nav.categories.resources");
  });

  it("resources category contains vault, files and input routes", () => {
    const routes = ROOT_NAV_CATEGORIES[1].items.map((i) => i.to);
    expect(routes).toContain("/vault");
    expect(routes).toContain("/files");
    expect(routes).toContain("/input");
  });

  it("third category has titleKey nav.categories.automation", () => {
    expect(ROOT_NAV_CATEGORIES[2].titleKey).toBe("nav.categories.automation");
  });

  it("automation category contains backups and output routes", () => {
    const routes = ROOT_NAV_CATEGORIES[2].items.map((i) => i.to);
    expect(routes).toContain("/backups");
    expect(routes).toContain("/output");
  });

  it("fourth category has titleKey nav.categories.system", () => {
    expect(ROOT_NAV_CATEGORIES[3].titleKey).toBe("nav.categories.system");
  });

  it("system category contains logs and settings routes", () => {
    const routes = ROOT_NAV_CATEGORIES[3].items.map((i) => i.to);
    expect(routes).toContain("/logs");
    expect(routes).toContain("/settings");
  });

  it("every item has a non-empty labelKey and a non-empty to path", () => {
    for (const cat of ROOT_NAV_CATEGORIES) {
      for (const item of cat.items) {
        expect(item.labelKey.length).toBeGreaterThan(0);
        expect(item.to.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── ROOT_NAV_ITEMS flat consistency ─────────────────────────────────────────

describe("ROOT_NAV_ITEMS", () => {
  it("is the flattened list of all category items", () => {
    const flat = ROOT_NAV_CATEGORIES.flatMap((c) => c.items);
    expect(ROOT_NAV_ITEMS).toEqual(flat);
  });

  it("has 8 items in total (1 + 3 + 2 + 2)", () => {
    expect(ROOT_NAV_ITEMS).toHaveLength(8);
  });

  it("has no duplicate routes", () => {
    const routes = ROOT_NAV_ITEMS.map((i) => i.to);
    const unique = new Set(routes);
    expect(unique.size).toBe(routes.length);
  });
});
