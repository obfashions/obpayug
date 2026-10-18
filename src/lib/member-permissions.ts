export const MEMBER_ROLES = ["super_admin", "finance_admin", "kyc_reviewer", "support_agent"] as const;
export type MemberRole = typeof MEMBER_ROLES[number];
export type Permission = "roles" | "finance" | "kyc" | "support" | "settings";
export const ROLE_LABELS: Record<MemberRole, string> = { super_admin: "Super Admin", finance_admin: "Finance Admin", kyc_reviewer: "KYC Reviewer", support_agent: "Support Agent" };
export function hasPermission(roles: readonly string[], permission: Permission): boolean {
  if (roles.includes("admin") || roles.includes("super_admin")) return true;
  return (permission === "finance" && roles.includes("finance_admin")) || (permission === "kyc" && roles.includes("kyc_reviewer")) || (permission === "support" && roles.includes("support_agent"));
}
export function permissionForAdminPath(path: string): Permission {
  if (/\/admin\/(support|tickets)$/.test(path)) return "support";
  if (path === "/admin/kyc-review") return "kyc";
  if (/\/admin\/(transactions|transaction-lookup|payout-requests|refunds|reports)$/.test(path)) return "finance";
  return "settings";
}
export function staffHome(roles: readonly string[]): string {
  if (hasPermission(roles, "settings")) return "/admin";
  if (hasPermission(roles, "finance")) return "/admin/transactions";
  if (hasPermission(roles, "kyc")) return "/admin/kyc-review";
  if (hasPermission(roles, "support")) return "/admin/support";
  return "/dashboard";
}