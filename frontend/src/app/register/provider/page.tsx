import { redirect } from "next/navigation";

/**
 * Legacy provider registration route with fake OTP simulation has been removed.
 * Redirect permanently to the real signup workflow with provider role pre-selected.
 */
export default function RegisterProviderPage() {
  redirect("/auth?mode=signup&role=provider");
}
