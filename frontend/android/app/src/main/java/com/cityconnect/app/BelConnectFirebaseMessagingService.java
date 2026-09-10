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

        if ("incoming_call".equals(type)) {
            // Deduplication: If the app is actively in the foreground, the in-app
            // Socket.IO event and CallAudioManager already ring and show IncomingCall UI.
            // Only trigger native high-priority notification if app is backgrounded or screen locked.
            if (BelConnectCallPlugin.isAppInForeground) {
                Log.i(TAG, "App is currently in foreground; delegating incoming call to in-app Socket.IO.");
                return;
            }

            BelConnectCallPlugin.showIncomingCall(
                getApplicationContext(),
                callId,
                callerName,
                serviceName,
                bookingId
            );
        } else if ("call:cancelled".equals(type) || "call:ended".equals(type)) {
            Log.i(TAG, "Call cancellation/end received for call: " + callId);
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

