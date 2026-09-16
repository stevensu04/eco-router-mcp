import { describe, expect, it } from "vitest";
import { COUNTRY_GROUPS, expandCountries } from "../src/data/countryGroups.js";

describe("country groups", () => {
  it("has 27 EU members and 30 EEA members", () => {
    expect(new Set(COUNTRY_GROUPS.EU).size).toBe(27);
    expect(new Set(COUNTRY_GROUPS.EEA).size).toBe(30);
  });

  it("keeps non-members out of the EU", () => {
    const eu = expandCountries(["EU"]);
    for (const outside of ["CH", "GB", "NO", "IS"]) expect(eu).not.toContain(outside);
  });

  it("puts Norway in the EEA but not Switzerland or the UK", () => {
    const eea = expandCountries(["eea"]);
    expect(eea).toContain("NO");
    expect(eea).not.toContain("CH");
    expect(eea).not.toContain("GB");
  });

  it("mixes groups and countries without duplicates", () => {
    const codes = expandCountries(["EU", "ch", "DE"]);
    expect(codes).toContain("CH");
    expect(codes.filter((c) => c === "DE")).toHaveLength(1);
  });

  it("rejects unknown groups", () => {
    expect(() => expandCountries(["EUR"])).toThrow(/Unknown country or group/);
  });
});
