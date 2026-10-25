import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: mocks.from },
}));
import { convertBalance } from "./money.server";
import type { Identity } from "./identity.server";

describe("exchanges require actual partner conversion", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("does not create an unbacked RWF credit from Mukoya's 28,000 UGX", async () => {
    const id = { userId: "2e213e51-8069-4795-9873-c95192306c8b", isAdmin: false } as Identity;
    const result = await convertBalance(id, { from: "UGX", to: "RWF", amount: 28000 });
    expect(result.success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});