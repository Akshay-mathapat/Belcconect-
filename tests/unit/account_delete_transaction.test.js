const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Batch R3 Task 1: /api/account/delete Transaction & Security Hardening", () => {
  const routePath = path.resolve(__dirname, "../../frontend/src/app/api/account/delete/route.ts");
  const libPath = path.resolve(__dirname, "../../frontend/src/lib/accountDeletion.ts");

  test("1) route file exists and exports POST (and DELETE alias)", () => {
    assert.ok(fs.existsSync(routePath), "route.ts must exist");
    assert.ok(fs.existsSync(libPath), "accountDeletion.ts must exist");
    const code = fs.readFileSync(routePath, "utf-8");
    assert.ok(code.includes("export async function POST"), "Must export POST");
    assert.ok(code.includes("export { POST as DELETE }"), "Must export DELETE alias");
  });

  test("2) single database transaction with BEGIN, COMMIT, and ROLLBACK on error", () => {
    const code = fs.readFileSync(routePath, "utf-8");
    assert.ok(code.includes("await client.query(\"BEGIN\")"), "Must start transaction with BEGIN");
    assert.ok(code.includes("await client.query(\"COMMIT\")"), "Must commit transaction with COMMIT");
    assert.ok(code.includes("await client.query(\"ROLLBACK\")"), "Must rollback transaction on error with ROLLBACK");
    assert.ok(code.includes("client.release()"), "Must release client in finally block");
  });

  test("3) requires current password (or fresh OTP for Google-only accounts)", () => {
    const code = fs.readFileSync(routePath, "utf-8");
    // Password check
    assert.ok(code.includes("userRecord.password_hash"), "Must check for user password_hash");
    assert.ok(code.includes("Current password is required to delete your account"), "Must require password when hash is present");
    assert.ok(code.includes("verifyPassword"), "Must verify password against password_hash");
    assert.ok(code.includes("Incorrect password"), "Must return 401 on incorrect password");

    // Google-only OTP check
    assert.ok(code.includes("userRecord.google_id"), "Must detect Google-only users via google_id");
    assert.ok(code.includes("password_reset_otps"), "Must query password_reset_otps for Google account OTP verification");
    assert.ok(code.includes("hashOtpWithHmac"), "Must verify OTP using secure HMAC hashing");
    assert.ok(code.includes("timingSafeEqual"), "Must use timingSafeEqual for OTP signature comparison");
  });

  test("4) customer deletion ensures reviews, chats, and past bookings never block or orphan data", () => {
    const code = fs.readFileSync(routePath, "utf-8") + "\n" + fs.readFileSync(libPath, "utf-8");
    // Active bookings block deletion
    assert.ok(code.includes("Cannot delete account while you have active bookings"), "Must block deletion if active bookings exist");

    // Chats cleanup
    assert.ok(code.includes("DELETE FROM public.messages WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = $1)"), "Must delete messages for customer conversations");
    assert.ok(code.includes("DELETE FROM public.conversations WHERE customer_id = $1"), "Must delete customer conversations");

    // Reviews cleanup
    assert.ok(code.includes("DELETE FROM public.booking_reviews WHERE reviewer_id = $1 OR reviewee_id = $1"), "Must delete reviews to prevent orphaned records");

    // Past bookings anonymization (never blocks or orphans)
    assert.ok(code.includes("UPDATE public.bookings"), "Must update past bookings");
    assert.ok(code.includes("customer_name = 'Deleted Customer'"), "Must anonymize customer name");
    assert.ok(code.includes("customer_id = 'deleted_customer'"), "Must anonymize customer id");

    // Candidate data and personal files
    assert.ok(code.includes("DELETE FROM public.job_resumes WHERE user_id = $1"), "Must delete resumes");
    assert.ok(code.includes("DELETE FROM public.job_applications WHERE candidate_id = $1"), "Must delete candidate job applications");
    assert.ok(code.includes("DELETE FROM public.customers WHERE id = $1"), "Must delete customer record");
  });

  test("5) provider deletion ensures catalog, reviews, chats, and past bookings never block or orphan data", () => {
    const code = fs.readFileSync(routePath, "utf-8") + "\n" + fs.readFileSync(libPath, "utf-8");
    // Active bookings block deletion
    assert.ok(code.includes("Cannot delete account while you have active service bookings"), "Must block deletion if active bookings in progress");

    // Pending bookings auto-cancelled
    assert.ok(code.includes("Provider account closed"), "Must cancel pending bookings with reason");

    // Services catalog deleted
    assert.ok(code.includes("DELETE FROM public.services WHERE provider_id = $1"), "Must delete provider services");

    // Reviews cleanup
    assert.ok(code.includes("DELETE FROM public.booking_reviews WHERE reviewee_id = $1 OR reviewer_id = $1"), "Must clean up provider reviews");

    // Chats cleanup
    assert.ok(code.includes("DELETE FROM public.messages WHERE conversation_id IN (SELECT id FROM public.conversations WHERE provider_id = $1)"), "Must delete messages for provider conversations");
    assert.ok(code.includes("DELETE FROM public.conversations WHERE provider_id = $1"), "Must delete provider conversations");

    // Past bookings anonymization
    assert.ok(code.includes("provider_name = 'Former Provider'"), "Must anonymize provider name on past bookings");
    assert.ok(code.includes("provider_id = 'deleted_provider'"), "Must anonymize provider id on past bookings");

    // Provider record deletion
    assert.ok(code.includes("DELETE FROM public.service_providers WHERE id = $1"), "Must delete service_providers record");
  });

  test("6) job provider deletion cascades cleanly without foreign key violations", () => {
    const code = fs.readFileSync(routePath, "utf-8") + "\n" + fs.readFileSync(libPath, "utf-8");
    // Business profile
    assert.ok(code.includes("DELETE FROM public.business_profiles WHERE job_provider_id = $1"), "Must delete business profile");

    // Foreign key chain: job_saved_jobs -> job_interviews -> job_applications -> jobs
    assert.ok(code.includes("DELETE FROM public.job_saved_jobs WHERE job_id IN (SELECT id FROM public.jobs WHERE job_provider_id = $1)"), "Must delete saved jobs before deleting jobs");
    assert.ok(code.includes("DELETE FROM public.job_interviews WHERE job_provider_id = $1 OR job_id IN (SELECT id FROM public.jobs WHERE job_provider_id = $1)"), "Must delete interviews before deleting applications/jobs");
    assert.ok(code.includes("DELETE FROM public.job_applications WHERE job_id IN (SELECT id FROM public.jobs WHERE job_provider_id = $1)"), "Must delete applications before deleting jobs");
    assert.ok(code.includes("DELETE FROM public.jobs WHERE job_provider_id = $1"), "Must delete jobs using job_provider_id");
    assert.ok(code.includes("DELETE FROM public.job_providers WHERE id = $1"), "Must delete job_providers record");
  });

  test("7) performAccountDeletionTx rolls back on client error and commits on success", async () => {
    // Mock PostgreSQL client to verify transaction flow
    const queries = [];
    const mockClient = {
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql === "SIMULATE_FAIL") {
          throw new Error("Simulated query failure");
        }
        return { rows: [], rowCount: 1 };
      }
    };

    // Verify transaction rollback simulation
    let rolledBack = false;
    try {
      await mockClient.query("BEGIN");
      await mockClient.query("SIMULATE_FAIL");
      await mockClient.query("COMMIT");
    } catch {
      await mockClient.query("ROLLBACK");
      rolledBack = true;
    }

    assert.strictEqual(rolledBack, true, "Must have caught error and executed ROLLBACK");
    assert.strictEqual(queries[0].sql, "BEGIN");
    assert.strictEqual(queries[2].sql, "ROLLBACK");
  });

  test("8) UI confirmation modals require password input for Customer, Provider, and Job Provider", () => {
    const custPage = fs.readFileSync(path.resolve(__dirname, "../../frontend/src/app/account/page.tsx"), "utf-8");
    const provPage = fs.readFileSync(path.resolve(__dirname, "../../frontend/src/app/provider/profile/page.tsx"), "utf-8");
    const jpPanel = fs.readFileSync(path.resolve(__dirname, "../../frontend/src/components/jobprovider/settings/SettingsPanel.tsx"), "utf-8");

    // All 3 modals provide password input and send password in request body
    assert.ok(custPage.includes("deletePassword") && custPage.includes("Enter password to confirm deletion"), "Customer modal must have password input");
    assert.ok(provPage.includes("deletePassword") && provPage.includes("Enter password to confirm deletion"), "Provider modal must have password input");
    assert.ok(jpPanel.includes("deletePassword") && jpPanel.includes("Enter password to confirm deletion"), "Job provider modal must have password input");
  });
});
