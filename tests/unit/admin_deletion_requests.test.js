const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Batch R3 Task 2: Admin Pending Account Deletions Management", () => {
  const listRoutePath = path.resolve(__dirname, "../../frontend/src/app/api/admin/deletion-requests/route.ts");
  const completeRoutePath = path.resolve(__dirname, "../../frontend/src/app/api/admin/deletion-requests/[id]/complete/route.ts");
  const rejectRoutePath = path.resolve(__dirname, "../../frontend/src/app/api/admin/deletion-requests/[id]/reject/route.ts");
  const adminPagePath = path.resolve(__dirname, "../../frontend/src/app/admin/page.tsx");
  const migration033Path = path.resolve(__dirname, "../../database/migrations/033_account_deletion_admin_review.sql");

  test("1) API routes exist for list, complete, and reject deletion requests", () => {
    assert.ok(fs.existsSync(listRoutePath), "GET deletion-requests route must exist");
    assert.ok(fs.existsSync(completeRoutePath), "POST [id]/complete route must exist");
    assert.ok(fs.existsSync(rejectRoutePath), "POST [id]/reject route must exist");
  });

  test("2) GET /api/admin/deletion-requests requires admin auth and verifies requester", () => {
    const code = fs.readFileSync(listRoutePath, "utf-8");
    assert.ok(code.includes("authUser.role !== \"admin\""), "Must require admin role");
    assert.ok(code.includes("verification:"), "Must return verification object");
    assert.ok(code.includes("matchedUser"), "Must match user against customers/service_providers/job_providers");
    assert.ok(code.includes("activeBookingsCount"), "Must calculate active bookings in progress");
  });

  test("3) POST /api/admin/deletion-requests/[id]/complete enforces admin auth and atomic transaction", () => {
    const code = fs.readFileSync(completeRoutePath, "utf-8");
    assert.ok(code.includes("authUser.role !== \"admin\""), "Must require admin role");
    assert.ok(code.includes("Cannot complete deletion: Customer still has active service bookings") || code.includes("active service bookings in progress"), "Must block completion if active bookings exist");
    assert.ok(code.includes("performAccountDeletionTx"), "Must call performAccountDeletionTx");
    assert.ok(code.includes("await client.query(\"BEGIN\")"), "Must run inside atomic transaction BEGIN");
    assert.ok(code.includes("await client.query(\"COMMIT\")"), "Must commit transaction");
    assert.ok(code.includes("await client.query(\"ROLLBACK\")"), "Must rollback on error");
    assert.ok(code.includes("COMPLETE_DELETION_REQUEST"), "Must record audit log with action COMPLETE_DELETION_REQUEST");
  });

  test("4) POST /api/admin/deletion-requests/[id]/reject records rejection reason and audit log", () => {
    const code = fs.readFileSync(rejectRoutePath, "utf-8");
    assert.ok(code.includes("authUser.role !== \"admin\""), "Must require admin role");
    assert.ok(code.includes("status = 'rejected'"), "Must update status to rejected");
    assert.ok(code.includes("rejection_reason = $1"), "Must save rejection_reason");
    assert.ok(code.includes("REJECT_DELETION_REQUEST"), "Must record audit log with action REJECT_DELETION_REQUEST");
  });

  test("5) admin page includes Account Deletion Requests section and requester verification UI", () => {
    const pageCode = fs.readFileSync(adminPagePath, "utf-8");
    assert.ok(pageCode.includes("Account Deletion Requests"), "Admin page must include Account Deletion Requests section");
    assert.ok(pageCode.includes("/api/admin/deletion-requests"), "Must fetch from /api/admin/deletion-requests");
    assert.ok(pageCode.includes("Verified:"), "Must display verified requester badge");
    assert.ok(pageCode.includes("active booking"), "Must display active bookings warning");
    assert.ok(pageCode.includes("handleCompleteDeletion"), "Must provide handler to complete deletion");
    assert.ok(pageCode.includes("handleConfirmRejectDeletion"), "Must provide handler to reject deletion");
  });

  test("6) migration 033 exists and adds rejection_reason and processed_by to account_deletion_requests", () => {
    assert.ok(fs.existsSync(migration033Path), "migration 033 must exist in database/migrations");
    const mCode = fs.readFileSync(migration033Path, "utf-8");
    assert.ok(mCode.includes("rejection_reason"), "Must add rejection_reason column");
    assert.ok(mCode.includes("processed_by"), "Must add processed_by column");
  });
});

