package com.cityconnect.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class BelConnectFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "BelConnectFCM";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        if (data == null || data.isEmpty()) {
            Log.d(TAG, "Empty FCM data received");
            return;
        }

        String type = data.get("type");
        String callId = data.get("callId");
        String callerName = data.get("callerName");
        String serviceName = data.get("serviceName");
        String bookingId = data.get("bookingId");

        Log.i(TAG, "Received FCM message type: " + type + ", callId: " + callId);

        if ("incoming_call".equals(type) || "call:incoming".equals(type)) {
            // Deduplication: If this call has already been presented (either by in-app
            // Socket.IO signaling or an earlier push), avoid firing duplicate alerts.
            if (BelConnectCallPlugin.isCallAlreadyPresented(callId)) {
                Log.i(TAG, "Call " + callId + " is already presented; skipping duplicate FCM incoming alert.");
                return;
            }

            BelConnectCallPlugin.showIncomingCall(
                getApplicationContext(),
                callId,
                callerName,
                serviceName,
                bookingId
            );
        } else if ("call:cancelled".equals(type) || "call_cancelled".equals(type) ||
                   "call:ended".equals(type) || "call_ended".equals(type) ||
                   "call:timeout".equals(type) || "call_timeout".equals(type) ||
                   "call:missed".equals(type) || "call_missed".equals(type)) {
            Log.i(TAG, "Call dismissal received for call: " + callId + " (type=" + type + ")");
            BelConnectCallPlugin.dismissCall(getApplicationContext(), callId);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "New FCM registration token received: " + token);
        BelConnectCallPlugin.latestDeviceToken = token;

        SharedPreferences prefs = getSharedPreferences("belconnect_push_prefs", Context.MODE_PRIVATE);
        prefs.edit().putString("fcm_token", token).apply();
    }
}

