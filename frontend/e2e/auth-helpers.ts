import { Page } from '@playwright/test';
import crypto from 'crypto';

/**
 * Generates a valid HMAC-SHA256 JWT token compatible with BelConnect backend.
 */
export function createTestToken(payload: { userId: string; email: string; role: string; name: string }): string {
  const secret = (process.env.JWT_SECRET || "cityconnect_jwt_secret_key_2026_belagavi_prod").trim().replace(/^["']|["']$/g, "");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 7 * 24 * 3600;
  const body = Buffer.from(JSON.stringify({ ...payload, iat, exp })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Injects an active Customer session into the browser before page scripts run.
 */
export async function loginAsCustomer(page: Page) {
  const user = {
    id: "cust-test-101",
    email: "customer.test@belconnect.local",
    name: "Ramesh Kumar",
    role: "user" as const,
    phone: "9876543210",
  };
  const token = createTestToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("cityconnect_token", token);
    localStorage.setItem("cityconnect_auth_token", token);
    localStorage.setItem("cityconnect_user_id", user.id);
    localStorage.setItem(
      "belconnect-auth-store",
      JSON.stringify({
        state: { currentUser: { ...user, token } },
        version: 0,
      })
    );
    document.cookie = `auth_token=${token}; path=/; max-age=604800; SameSite=Lax`;
  }, { token, user });

  return { user, token };
}

/**
 * Injects an active Service Provider session into the browser before page scripts run.
 */
export async function loginAsProvider(page: Page) {
  const user = {
    id: "prov-test-202",
    email: "provider.test@belconnect.local",
    name: "Suresh Electrician",
    role: "provider" as const,
    phone: "9876543211",
  };
  const token = createTestToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("cityconnect_token", token);
    localStorage.setItem("cityconnect_auth_token", token);
    localStorage.setItem("cityconnect_user_id", user.id);
    localStorage.setItem(
      "belconnect-auth-store",
      JSON.stringify({
        state: { currentUser: { ...user, token } },
        version: 0,
      })
    );
    document.cookie = `auth_token=${token}; path=/; max-age=604800; SameSite=Lax`;
  }, { token, user });

  return { user, token };
}

/**
 * Injects an active Job Provider (Employer) session into the browser before page scripts run.
 */
export async function loginAsJobProvider(page: Page) {
  const user = {
    id: "jp-test-303",
    email: "employer.test@belconnect.local",
    name: "Alex Systems Tech",
    role: "job_provider" as const,
    phone: "9876543212",
  };
  const token = createTestToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("cityconnect_token", token);
    localStorage.setItem("cityconnect_auth_token", token);
    localStorage.setItem("cityconnect_user_id", user.id);
    localStorage.setItem(
      "belconnect-auth-store",
      JSON.stringify({
        state: { currentUser: { ...user, token } },
        version: 0,
      })
    );
    document.cookie = `auth_token=${token}; path=/; max-age=604800; SameSite=Lax`;
  }, { token, user });

  return { user, token };
}

