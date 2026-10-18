import { expect, it } from "vitest";
import { hasPermission, staffHome } from "./member-permissions";
it("support cannot manage money or roles", () => {
  expect(hasPermission(["support_agent"], "support")).toBe(true);
  expect(hasPermission(["support_agent"], "finance")).toBe(false);
  expect(hasPermission(["support_agent"], "roles")).toBe(false);
});
it("finance and KYC combine without granting full admin", () => {
  expect(hasPermission(["finance_admin", "kyc_reviewer"], "finance")).toBe(true);
  expect(hasPermission(["finance_admin", "kyc_reviewer"], "kyc")).toBe(true);
  expect(hasPermission(["finance_admin", "kyc_reviewer"], "settings")).toBe(false);
});
it("super admin grants role management and all staff areas", () => {
  for (const permission of ["roles", "finance", "kyc", "support", "settings"] as const) expect(hasPermission(["super_admin"], permission)).toBe(true);
});
it("merchant tags cannot authorize anything", () => {
  expect(hasPermission([], "roles")).toBe(false);
  expect(staffHome([])).toBe("/dashboard");
  expect(staffHome(["support_agent"])).toBe("/admin/support");
});