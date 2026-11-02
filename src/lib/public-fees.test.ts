import { describe, expect, it } from "vitest";
import { resolvePublicFees } from "./public-fees.server";

describe("resolvePublicFees", () => {
  // Mirrors the live platform_settings at the time of the pricing-page update.
  const live = {
    UGX: { collect: 2.5, collect_margin: 2, withdraw: 2 },
    RWF: { collect: 0, collect_margin: 2, withdraw: 2 },
    USD: { collect: 3, collect_margin: 2, withdraw: 2 },
  };

  it("shows the ObPay margin and payout rate per currency", () => {
    const fees = resolvePublicFees(live, 2.5, 2, null);
    const ugx = fees.currencies.find((c) => c.currency === "UGX")!;
    expect(ugx.collectionPercent).toBe(2);
    expect(ugx.payoutPercent).toBe(2);
    expect(ugx.legacyCollection).toBe(false);
    const rwf = fees.currencies.find((c) => c.currency === "RWF")!;
    expect(rwf.collectionPercent).toBe(2);
    expect(rwf.payoutPercent).toBe(2);
  });

  it("flags legacy all-inclusive collection rates when no margin is set", () => {
    const fees = resolvePublicFees({ KES: { collect: 3 } }, 2.5, 2, null);
    const kes = fees.currencies.find((c) => c.currency === "KES")!;
    expect(kes.legacyCollection).toBe(true);
    expect(kes.collectionPercent).toBe(3);
  });

  it("falls back to the platform defaults when a currency has no override", () => {
    const fees = resolvePublicFees({}, 2.5, 2, null);
    const xaf = fees.currencies.find((c) => c.currency === "XAF")!;
    expect(xaf.collectionPercent).toBe(2.5);
    expect(xaf.payoutPercent).toBe(2);
  });

  it("defaults the exchange fee to 1.5% and ignores out-of-range settings", () => {
    expect(resolvePublicFees({}, 2.5, 2, null).exchangeFeePercent).toBe(1.5);
    expect(resolvePublicFees({}, 2.5, 2, 1.5).exchangeFeePercent).toBe(1.5);
    expect(resolvePublicFees({}, 2.5, 2, 45).exchangeFeePercent).toBe(1.5);
  });

  it("labels USD as the international card & crypto market", () => {
    const usd = resolvePublicFees({}, 2.5, 2, null).currencies.find((c) => c.currency === "USD")!;
    expect(usd.country).toBe("International (card & crypto)");
  });
});
