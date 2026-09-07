export type OAuthAccountType = "customer" | "service_provider" | "job_provider";

export function normalizeOAuthAccountType(value: unknown): OAuthAccountType | null {
  switch (value) {
    case "customer":
    case "user":
      return "customer";
    case "service_provider":
    case "provider":
      return "service_provider";
    case "job_provider":
    case "jobprovider":
      return "job_provider";
    default:
      return null;
  }
}

export function oauthAccountTypeToJwtRole(accountType: OAuthAccountType): "user" | "provider" | "job_provider" {
  return accountType === "customer"
    ? "user"
    : accountType === "service_provider"
      ? "provider"
      : "job_provider";
}

export function oauthAccountTypeToTable(accountType: OAuthAccountType): "customers" | "service_providers" | "job_providers" {
  return accountType === "customer"
    ? "customers"
    : accountType === "service_provider"
      ? "service_providers"
      : "job_providers";
}