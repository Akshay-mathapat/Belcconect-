package com.cityconnect.app;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.content.Intent;
import android.view.WindowManager;
import android.Manifest;
import android.content.pm.PackageManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProviderLocationPlugin.class);
        registerPlugin(BelConnectCallPlugin.class);

        super.onCreate(savedInstanceState);

        /*
         * TEMPORARY FCM DIAGNOSTIC
         *
         * This directly asks Firebase Messaging for this Android
         * installation's FCM registration token.
         *
         * IMPORTANT:
         * We intentionally DO NOT print the actual token to Logcat.
         */
        Log.i("FCM_TEST", "FCM_TOKEN_TEST: Starting token request...");

        FirebaseMessaging.getInstance()
                .getToken()
                .addOnCompleteListener(task -> {

                    if (!task.isSuccessful()) {
                        Log.e(
                                "FCM_TEST",
                                "FCM_TOKEN_TEST: FAILED",
                                task.getException()
                        );
                        return;
                    }

                    String token = task.getResult();

                    if (token != null && !token.isEmpty()) {
                        Log.i(
                                "FCM_TEST",
                                "FCM_TOKEN_TEST: SUCCESS"
                        );
                    } else {
                        Log.e(
                                "FCM_TEST",
                                "FCM_TOKEN_TEST: FAILED - token was empty"
                        );
                    }
                });

        // Allow activity to show over lockscreen and turn screen on
        // for incoming calls.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        // Initialize Call Notification Channel.
        BelConnectCallPlugin.createNotificationChannel(this);

        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
            }
        } catch (Exception e) {
            Log.w("MainActivity", "Could not set media playback gesture setting: " + e.getMessage());
        }

        // Ensure RECORD_AUDIO runtime permission is granted
        // for WebRTC / voice calling on Android 6+.
        if (
                ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.RECORD_AUDIO
                ) != PackageManager.PERMISSION_GRANTED
        ) {

            Log.i(
                    "MainActivity",
                    "[CALL_TRACE] Requesting RECORD_AUDIO runtime permission from user..."
            );

            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    1
            );

        } else {

            Log.i(
                    "MainActivity",
                    "[CALL_TRACE] RECORD_AUDIO runtime permission already GRANTED."
            );
        }

        // Request notification permission on Android 13+.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {

            if (
                    ContextCompat.checkSelfPermission(
                            this,
                            Manifest.permission.POST_NOTIFICATIONS
                    ) != PackageManager.PERMISSION_GRANTED
            ) {

                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        2
                );
            }
        }

        // Handle incoming native call action when the app
        // was launched from the notification.
        handleCallIntent(getIntent());
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {

        super.onRequestPermissionsResult(
                requestCode,
                permissions,
                grantResults
        );

        if (requestCode == 1) {

            boolean granted =
                    grantResults.length > 0 &&
                            grantResults[0] == PackageManager.PERMISSION_GRANTED;

            Log.i(
                    "MainActivity",
                    "[CALL_TRACE] RECORD_AUDIO onRequestPermissionsResult received: granted="
                            + granted
            );

            if (granted) {
                BelConnectCallPlugin.notifyPermissionGranted(
                        this,
                        "microphone"
                );
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        setIntent(intent);

        handleCallIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();

        BelConnectCallPlugin.isAppInForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();

        BelConnectCallPlugin.isAppInForeground = false;

        if (BelConnectCallService.isServiceRunning() && getBridge() != null && getBridge().getWebView() != null) {
            Log.i("MainActivity", "[CALL_TRACE] Call in progress during onPause: keeping WebView active for background audio");
            getBridge().getWebView().onResume();
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();

        if (BelConnectCallService.isServiceRunning() && getBridge() != null && getBridge().getWebView() != null) {
            Log.i("MainActivity", "[CALL_TRACE] Call in progress during onStop: keeping WebView active for background audio");
            getBridge().getWebView().onResume();
            getBridge().getWebView().resumeTimers();
        }
    }

    private void handleCallIntent(Intent intent) {

        if (intent != null && intent.hasExtra("action")) {

            String action =
                    intent.getStringExtra("action");

            String callId =
                    intent.getStringExtra("callId");

            String bookingId =
                    intent.getStringExtra("bookingId");

            Log.i(
                    "MainActivity",
                    "[CALL_TRACE] Step 1 & 2: Notification Accept tapped -> "
                            + "MainActivity.handleCallIntent received "
                            + "(action=" + action
                            + ", callId=" + callId
                            + ", bookingId=" + bookingId
                            + ")"
            );

            BelConnectCallPlugin.pendingAction =
                    action;

            BelConnectCallPlugin.pendingCallId =
                    callId;

            BelConnectCallPlugin.pendingBookingId =
                    bookingId;

            // Persist pending call action to SharedPreferences
            // and update the static cache.
            BelConnectCallPlugin.setPendingCallAction(
                    this,
                    action,
                    callId,
                    bookingId
            );

            // Stop native ringtone immediately because the
            // application has now opened/resumed.
            BelConnectCallPlugin.dismissCall(
                    this,
                    callId
            );

            if ("view_missed_call".equals(action)) {
                BelConnectCallPlugin.clearMissedCalls(this, null);
            }

            // Start active microphone foreground service
            // when Accept was pressed.
            if ("accept".equals(action)) {
                if (callId != null && !callId.isEmpty()) {
                    SharedPreferences terminalPrefs = getSharedPreferences("belconnect_call_terminal_prefs", Context.MODE_PRIVATE);
                    terminalPrefs.edit().putString("term_" + callId, "accepted").commit();
                }

                if (
                        ContextCompat.checkSelfPermission(
                                this,
                                Manifest.permission.RECORD_AUDIO
                        ) == PackageManager.PERMISSION_GRANTED
                ) {

                    Log.i(
                            "MainActivity",
                            "[CALL_TRACE] Starting BelConnectCallService early "
                                    + "from handleCallIntent for accept action "
                                    + "(callId=" + callId + ")"
                    );

                    BelConnectCallService.start(
                            this,
                            callId,
                            "BelConnect Caller",
                            "Voice Call Active"
                    );
                }
            }
        }
    }
}