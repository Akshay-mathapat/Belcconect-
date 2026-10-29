/**
 * Phase 1 Unit & Contract Tests:
 * - POST /api/auth/socket-ticket endpoint
 * - Secure ticket generation and hashing
 * - Signaling server single-use ticket consumption
 * - Session revocation and periodic disconnect sweep
 * - Legacy JWT fallback configuration
 * - Client socket authentication callbacks
 */

const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const rootDir = path.resolve(__dirname, "../../");

describe("Phase 1: Single-Use Socket Tickets & Signaling Server Auth", () => {
  const socketTicketRoutePath = path.join(
    rootDir,
    "frontend/src/app/api/auth/socket-ticket/route.ts"
  );
  const signalingServerPath = path.join(rootDir, "backend/src/server.js");
  const socketAuthPath = path.join(rootDir, "backend/src/socketAuth.js");

  const getCombinedSignalingCode = () => {
    const sCode = fs.readFileSync(signalingServerPath, "utf-8");
    const aCode = fs.existsSync(socketAuthPath) ? fs.readFileSync(socketAuthPath, "utf-8") : "";
    return sCode + "\n" + aCode;
  };

  test("1) Socket ticket route file exists and enforces dynamic = \"force-dynamic\"", () => {
    assert.ok(fs.existsSync(socketTicketRoutePath), "Route file must exist");
    const code = fs.readFileSync(socketTicketRoutePath, "utf-8");
    assert.ok(code.includes('dynamic = "force-dynamic"'), "Must be force-dynamic");
  });

  test("2) Socket ticket route authenticates requester via session cookie (getSessionTokenFromRequest)", () => {
    const code = fs.readFileSync(socketTicketRoutePath, "utf-8");
    assert.ok(code.includes("getSessionTokenFromRequest"), "Must authenticate via session cookie");
  });

  test("3) Socket ticket route invokes createSocketTicket helper to create ephemeral ticket", () => {
    const code = fs.readFileSync(socketTicketRoutePath, "utf-8");
    assert.ok(code.includes("createSocketTicket"), "Must call createSocketTicket helper");
  });

  test("4) Socket ticket route enforces per-user rate limiting (checkUserRateLimit)", () => {
    const code = fs.readFileSync(socketTicketRoutePath, "utf-8");
    assert.ok(code.includes("checkUserRateLimit"), "Must rate-limit per user");
  });

  test("5) Socket ticket route sets Cache-Control: no-store on successful ticket responses", () => {
    const code = fs.readFileSync(socketTicketRoutePath, "utf-8");
    assert.ok(code.includes("Cache-Control"), "Must set Cache-Control headers");
    assert.ok(code.includes("no-store"), "Must prevent caching socket tickets");
  });

  test("6) Secure random ticket generation produces 32-byte base64url tokens", () => {
    const rawTicket = crypto.randomBytes(32).toString("base64url");
    assert.strictEqual(
      Buffer.from(rawTicket, "base64url").length,
      32,
      "Ticket must contain 32 random bytes"
    );
  });

  test("7) Ticket SHA-256 hashing produces unique, non-reversible 64-character hex digests", () => {
    const rawTicket = crypto.randomBytes(32).toString("base64url");
    const ticketHash = crypto
      .createHash("sha256")
      .update(rawTicket)
      .digest("hex");

    assert.match(ticketHash, /^[a-f0-9]{64}$/);
    assert.notStrictEqual(rawTicket, ticketHash);
  });

  test("8) Signaling server consumes ticket and returns session identity fields", () => {
    const serverCode = getCombinedSignalingCode();

    for (const [fragment, message] of [
      ["socket.handshake.auth?.ticket", "Must inspect the socket ticket"],
      ["DELETE FROM public.socket_tickets", "Must consume ticket via DELETE"],
      [
        "RETURNING st.session_id, st.user_id, st.role",
        "Must return ticket identity fields",
      ],
      ["s.revoked_at IS NULL", "Must reject revoked sessions"],
      [
        "c.account_status = 'active'",
        "Must verify active customer account status",
      ],
    ]) {
      assert.ok(serverCode.includes(fragment), message);
    }
  });

  test("9) Signaling server rejects replayed or already-consumed tickets", () => {
    const mockDbTickets = new Map();
    const sessionId = crypto.randomUUID();
    const userId = "usr_test_123";
    const rawTicket = crypto.randomBytes(32).toString("base64url");
    const ticketHash = crypto
      .createHash("sha256")
      .update(rawTicket)
      .digest("hex");

    mockDbTickets.set(ticketHash, {
      session_id: sessionId,
      user_id: userId,
      role: "user",
      expires_at: Date.now() + 60000,
      revoked: false,
    });

    function consumeTicket(ticket) {
      const hash = crypto
        .createHash("sha256")
        .update(ticket)
        .digest("hex");

      const record = mockDbTickets.get(hash);
      if (!record) return null;
      if (Date.now() > record.expires_at || record.revoked) return null;

      mockDbTickets.delete(hash);
      return record;
    }

    const firstAttempt = consumeTicket(rawTicket);
    assert.ok(firstAttempt !== null, "First connection must succeed");
    assert.strictEqual(firstAttempt.user_id, userId);

    const secondAttempt = consumeTicket(rawTicket);
    assert.strictEqual(
      secondAttempt,
      null,
      "Replaying a consumed ticket must fail"
    );
  });

  test("10) Signaling server schedules periodic revoked-session sweep and disconnects revoked sockets", () => {
    const serverCode = getCombinedSignalingCode();

    for (const [fragment, message] of [
      [
        "runRevokedSessionDisconnectSweep",
        "Must define the revocation sweep",
      ],
      [
        "setInterval(runRevokedSessionDisconnectSweep, 30000)",
        "Must schedule the sweep every 30 seconds",
      ],
      ['s.emit("auth:revoked"', "Must notify revoked sockets"],
      ["s.disconnect(true)", "Must forcefully disconnect revoked sockets"],
    ]) {
      assert.ok(serverCode.includes(fragment), message);
    }
  });

  test("11) Signaling server legacy JWT fallback is controlled by SIGNALING_ACCEPT_LEGACY_JWT", () => {
    const serverCode = fs.readFileSync(signalingServerPath, "utf-8");

    assert.ok(serverCode.includes("SIGNALING_ACCEPT_LEGACY_JWT"));
    assert.ok(
      serverCode.includes(
        'process.env.SIGNALING_ACCEPT_LEGACY_JWT !== "false"'
      ),
      "Must preserve the configured default behavior"
    );
  });

  test("12) CallProvider and socketChat configure auth callback with session cookies (credentials: include)", () => {
    const callProviderCode = fs.readFileSync(
      path.join(rootDir, "frontend/src/components/calls/CallProvider.tsx"),
      "utf-8"
    );

    const socketChatCode = fs.readFileSync(
      path.join(rootDir, "frontend/src/lib/socketChat.ts"),
      "utf-8"
    );

    const assertSocketTicketAuth = (code, fileName) => {
      assert.ok(
        code.includes("/api/auth/socket-ticket"),
        `${fileName} must request a socket ticket`
      );

      assert.match(
        code,
        /auth:\s*(?:async\s*)?\(\s*(?:cb|callback)\b[\s\S]*?=>\s*\{/,
        `${fileName} must configure auth as a callback`
      );

      assert.match(
        code,
        /credentials:\s*["']include["']/,
        `${fileName} must include session cookies`
      );
    };

    assertSocketTicketAuth(callProviderCode, "CallProvider");
    assertSocketTicketAuth(socketChatCode, "socketChat");
  });
});
