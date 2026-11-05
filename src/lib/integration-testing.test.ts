import { describe, expect, it, vi } from "vitest";
import { DEMO_BALANCE, isTestApiSecret, simulateIntegration } from "./integration-testing";

describe("safe integration demonstration", () => {
  it("recognizes test keys separately from live keys", () => {
    expect(isTestApiSecret(" sk_test_example ")).toBe(true);
    expect(isTestApiSecret("sk_sandbox_example")).toBe(true);
    expect(isTestApiSecret("sk_live_example")).toBe(false);
  });
  it("simulates initiation and confirmation without network submission", () => {
    const network = vi.spyOn(globalThis, "fetch");
    const initiated = simulateIntegration("/collect", "POST", { reference: "PESASUITE-2026-11", amount: 1000 }, []);
    expect(initiated.records[0]?.status).toBe("pending");
    const confirmed = simulateIntegration("/transactions/PESASUITE-2026-11", "GET", {}, initiated.records);
    expect(confirmed.records[0]?.status).toBe("success");
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
  });
  it("does not create a second payment for the same monthly reference", () => {
    const first = simulateIntegration("/payouts", "POST", { reference: "MONTH-11", amount: 10000 }, []);
    const retry = simulateIntegration("/payouts", "POST", { reference: "MONTH-11", amount: 10000 }, first.records);
    expect(retry.records).toHaveLength(1);
  });
  it("rejects fractional Uganda amounts", () => {
    expect(simulateIntegration("/collect", "POST", { amount: 1000.5 }, []).response.success).toBe(false);
  });
  it("never presents simulated funds as a changed merchant balance", () => {
    expect(DEMO_BALANCE).toBe(100000);
    const payment = simulateIntegration("/collect", "POST", { amount: 1000 }, []);
    const confirmed = simulateIntegration("/transactions/DEMO-1", "GET", {}, payment.records);
    expect(simulateIntegration("/balance", "GET", {}, confirmed.records).response).toMatchObject({ simulated: true, data: { available_balance: 100000 } });
  });
});
import { describe as d2, it as i2, expect as e2 } from "vitest";
import { simulateIntegration as sim } from "./integration-testing";
d2("simulation wallets", () => {
  i2("simulates a KES collection and rejects unknown currency", () => {
    e2(sim("/collect", "POST", { reference: "K1", amount: 500, currency: "KES" }, []).response.success).toBe(true);
    e2(sim("/collect", "POST", { reference: "K2", amount: 500, currency: "EUR" }, []).response.success).toBe(false);
  });
});
