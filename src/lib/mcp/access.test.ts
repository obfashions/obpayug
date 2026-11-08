import { describe, expect, it } from "vitest";
import { assertAccountAccess } from "./access";
import { supabaseForUser } from "./supabase";
import type { ToolContext } from "@lovable.dev/mcp-js";

describe("MCP account protections", () => {
  it("blocks missing, suspended and deactivated accounts", () => {
    expect(() => assertAccountAccess(null, false)).toThrow();
    for (const status of ["suspended", "deactivated"]) expect(() => assertAccountAccess({ status, email_verified: true, login_verified_at: "2026-11-08" }, false)).toThrow();
  });
  it("requires confirmed email", () => {
    expect(() => assertAccountAccess({ status: "active", email_verified: false, login_verified_at: "2026-11-08" }, false)).toThrow();
  });
  it("preserves the configured login verification requirement", () => {
    const profile = { status: "active", email_verified: true, login_verified_at: null };
    expect(() => assertAccountAccess(profile, true)).toThrow();
    expect(() => assertAccountAccess(profile, false)).not.toThrow();
  });
  it("refuses anonymous fallback", () => {
    const ctx = { getToken: () => undefined, getUserId: () => undefined } as unknown as ToolContext;
    expect(() => supabaseForUser(ctx)).toThrow("Sign in");
  });
});