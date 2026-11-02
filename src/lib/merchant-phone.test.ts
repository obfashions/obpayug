import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeContactPhone, saveMerchantPhone } from "./merchant-phone";

function fixture(result: unknown = { data: { id: "signed-in-merchant", phone_number: "0745482977" }, error: null }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "signed-in-merchant" } }, error: null });
  const client = { from, auth: { getUser } } as unknown as SupabaseClient<Database>;
  return { client, from, update, eq, getUser };
}

describe("merchant contact number", () => {
  it("accepts local and international numbers without changing their country", () => {
    expect(normalizeContactPhone("0745 482977")).toBe("0745482977");
    expect(normalizeContactPhone("+256 (745) 482-977")).toBe("+256745482977");
  });
  it("rejects blank, malformed and unusable numbers", () => {
    for (const value of ["", "0745", "0000000000", "0745abc2977", "2567454829771234", "++256745482977"]) {
      expect(() => normalizeContactPhone(value)).toThrow();
    }
  });
  it("persists only the phone on the authenticated merchant and checks readback", async () => {
    const f = fixture();
    await expect(saveMerchantPhone(f.client, "0745 482977")).resolves.toBe("0745482977");
    expect(f.from).toHaveBeenCalledWith("profiles");
    expect(f.update).toHaveBeenCalledWith({ phone_number: "0745482977" });
    expect(f.eq).toHaveBeenCalledWith("id", "signed-in-merchant");
  });
  it("does not write when signed out", async () => {
    const f = fixture();
    f.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(saveMerchantPhone(f.client, "0745482977")).rejects.toThrow("sign in");
    expect(f.from).not.toHaveBeenCalled();
  });
  it("does not report success on denied, missing or mismatched readback", async () => {
    for (const result of [
      { data: null, error: { message: "denied" } },
      { data: null, error: null },
      { data: { phone_number: "0772123456" }, error: null },
    ]) {
      await expect(saveMerchantPhone(fixture(result).client, "0745482977")).rejects.toThrow("could not be saved");
    }
  });
});