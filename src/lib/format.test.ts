import { describe, it, expect } from "vitest";
import { footballDayKey } from "./format";

// World Cup 2026 runs in June–July → UK is on BST (UTC+1).
describe("footballDayKey — noon-UK day boundary", () => {
  it("groups an early-AM UK kickoff under the previous day", () => {
    // Wed 17 Jun 05:00 UK = 04:00 UTC → belongs to Tue 16 Jun
    expect(footballDayKey("2026-06-17T04:00:00Z")).toBe("2026-06-16");
  });
  it("keeps an evening kickoff on its own day", () => {
    // Wed 17 Jun 20:00 UK = 19:00 UTC
    expect(footballDayKey("2026-06-17T19:00:00Z")).toBe("2026-06-17");
  });
  it("treats noon UK as the start of the new day", () => {
    // Wed 17 Jun 12:00 UK = 11:00 UTC
    expect(footballDayKey("2026-06-17T11:00:00Z")).toBe("2026-06-17");
  });
  it("places just-before-noon under the previous day", () => {
    // Wed 17 Jun 11:59 UK = 10:59 UTC
    expect(footballDayKey("2026-06-17T10:59:00Z")).toBe("2026-06-16");
  });
});
