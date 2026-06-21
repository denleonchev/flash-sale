import { describe, expect, it } from "vitest";
import { deriveSaleState } from "./index.js";

const START = new Date("2025-01-01T10:00:00Z");
const END   = new Date("2025-01-01T12:00:00Z");
const MID   = new Date("2025-01-01T11:00:00Z");

const sale = { startsAt: START, endsAt: END };

describe("deriveSaleState", () => {
  it("returns upcoming when now is before startsAt", () => {
    expect(deriveSaleState({ ...sale, remainingStock: 10 }, new Date("2025-01-01T09:59:59Z"))).toBe("upcoming");
  });

  it("returns live exactly at startsAt (stock > 0)", () => {
    expect(deriveSaleState({ ...sale, remainingStock: 1 }, START)).toBe("live");
  });

  it("returns live between start and end with stock > 0", () => {
    expect(deriveSaleState({ ...sale, remainingStock: 5 }, MID)).toBe("live");
  });

  it("returns ended exactly at endsAt", () => {
    expect(deriveSaleState({ ...sale, remainingStock: 5 }, END)).toBe("ended");
  });

  it("returns ended after endsAt", () => {
    expect(deriveSaleState({ ...sale, remainingStock: 5 }, new Date("2025-01-01T12:00:01Z"))).toBe("ended");
  });

  it("returns ended when stock is 0 within the window", () => {
    expect(deriveSaleState({ ...sale, remainingStock: 0 }, MID)).toBe("ended");
  });

  it("returns ended when stock is negative within the window", () => {
    expect(deriveSaleState({ ...sale, remainingStock: -1 }, MID)).toBe("ended");
  });
});
