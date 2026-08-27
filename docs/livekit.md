# CityConnect — LiveKit Cloud Voice Communication Documentation

This document describes the architecture, setup, token generation, and call workflows for the LiveKit Cloud voice calling implementation in CityConnect.

---

## 1. Overview & Architecture

CityConnect uses **LiveKit Cloud** for reliable, low-latency customer ↔ provider audio calls. Real-time media streams bypass custom WebSocket signaling server, while call session state management, user authentication, and booking verification remain backed by Next.js and PostgreSQL.

```text
                  CITYCONNECT
                       |
              Next.js / React
                       |
             -------------------
             |                 |
          Customer          Provider
             |                 |
             ---------+---------
                       |
                 LiveKit Client
                       |
                 LiveKit Cloud
                       |
                    WebRTC
                       |
                     TURN
```

---

## 2. Environment Variables

Server-side environment variables required for LiveKit authentication:

```env
LIVEKIT_URL="wss://YOUR_PROJECT.livekit.cloud"
LIVEKIT_API_KEY="YOUR_API_KEY"
LIVEKIT_API_SECRET="YOUR_API_SECRET"
```

> **IMPORTANT SECURITY RULES:**
> - `LIVEKIT_API_SECRET` must **NEVER** be prefixed with `NEXT_PUBLIC_` or exposed to browser clients.
> - Access tokens are minted exclusively server-side using `livekit-server-sdk`.

---

## 3. Secure Token Endpoint

**Endpoint:** `POST /api/livekit/token`

### Request Payload:

```json
{
  "bookingId": "B-1001"
}
```

### Authorization Check:
1. Validates authenticated user session from JWT token / cookie (`getAuthenticatedUser`).
2. Retrieves booking details from database.
3. Enforces that the requesting user is either the assigned **Customer** (`customer_id`) or **Provider** (`provider_id`) for that booking.
4. Returns `403 Forbidden` if the user is unauthorized.

### Response Payload:

```json
{
  "success": true,
  "serverUrl": "wss://belconnect-x9c51367.livekit.cloud",
  "participantToken": "eyJhbGciOiJIUzI1Ni...",
  "roomName": "cityconnect-booking-B-1001"
}
```

---

## 4. Room Naming & Participant Identity

- **Room Naming:** Deterministic string formatted as `cityconnect-booking-{bookingId}`.
- **Participant Identity:** User's unique internal ID (e.g., `customer-1`, `provider-1`).
- **Media Track:** Audio only (`audio: true`, `video: false`).

---

## 5. Customer & Provider Call Flow

1. **Initiate Call:**
   - Customer or Provider clicks **Call** button on booking panel or chat window.
   - Client sends POST request to `/api/calls` to initiate call session in PostgreSQL.
   - Receiver receives incoming call notification via Socket.IO signaling.

2. **Accept Call:**
   - Receiver clicks **Accept**.
   - Server issues LiveKit AccessTokens to both caller and receiver.
   - Client connects to room via `<LiveKitRoom>` and `<RoomAudioRenderer />`.

3. **In-Call Controls & State:**
   - **Mute / Unmute:** Toggles local audio track publishing.
   - **Connection Quality:** Displays real-time WebRTC health (🟢 Excellent, 🟡 Fair, 🔴 Poor).
   - **Reconnection:** LiveKit automatically recovers temporary network changes (Wi-Fi ↔ 4G).
   - **End Call / Unmount:** Disconnects room and releases microphone media tracks.

---

## 6. Testing Scenarios

1. **Two-Party Audio:** Customer calls provider; two-way audio streams clearly.
2. **Mute Functionality:** Muting halts local audio publishing.
3. **Graceful Disconnect:** Ending call cleans up tracks and resets UI state.
4. **Unauthorized Rejection:** Non-participants requesting token for another booking receive HTTP 403.
5. **Network Resilience:** Seamless reconnection during brief packet drops or network handoffs.

---

## 7. Troubleshooting

- **Microphone Permission Denied:** Click "Retry Microphone Access" button or enable mic permissions in browser settings.
- **Audio Autoplay Blocked:** Click overlay trigger to enable Web Audio playback.
- **Token Authorization Failure:** Ensure user JWT token is valid and user is associated with the target booking.
