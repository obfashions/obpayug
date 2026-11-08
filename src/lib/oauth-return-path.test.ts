import { describe, expect, it } from "vitest";
import { oauthReturnPath, withOAuthNext } from "./oauth-return-path";

describe("OAuth continuation", () => {
  it("preserves the full consent URL", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#review")).toBe("/.lovable/oauth/consent?authorization_id=abc#review");
  });
  it("refuses external and malformed redirects", () => {
    for (const value of ["https://outside.invalid", "//outside.invalid", "/\\outside.invalid", "/login\n", null, 12]) expect(oauthReturnPath(value)).toBe("/");
  });
  it("carries consent through signup and verification without losing existing parameters", () => {
    const next = "/.lovable/oauth/consent?authorization_id=abc#review";
    const path = withOAuthNext("/verify-email?email=a%40example.com", next);
    expect(new URL(path, "https://app.invalid").searchParams.get("next")).toBe(next);
    expect(new URL(path, "https://app.invalid").searchParams.get("email")).toBe("a@example.com");
  });
});