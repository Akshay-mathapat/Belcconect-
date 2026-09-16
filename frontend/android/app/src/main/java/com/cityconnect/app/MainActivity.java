package com.cityconnect.app;

import com.getcapacitor.BridgeActivity;

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
        

        // Allow activity to show over lockscreen and turn screen on for incoming calls
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

        // Initialize Call Notification Channel
        BelConnectCallPlugin.createNotificationChannel(this);

        // Ensure RECORD_AUDIO runtime permission is granted for WebRTC (Android 6+)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            Log.i("MainActivity", "[CALL_TRACE] Requesting RECORD_AUDIO runtime permission from user...");
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 1);
        } else {
            Log.i("MainActivity", "[CALL_TRACE] RECORD_AUDIO runtime permission already GRANTED.");
        }

        // Request POST_NOTIFICATIONS runtime permission on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2);
            }
        }

        handleCallIntent(getIntent());
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            Log.i("MainActivity", "[CALL_TRACE] RECORD_AUDIO onRequestPermissionsResult received: granted=" + granted);
            if (granted) {
                BelConnectCallPlugin.notifyPermissionGranted(this, "microphone");
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
    }

    private void handleCallIntent(Intent intent) {
        if (intent != null && intent.hasExtra("action")) {
            String action = intent.getStringExtra("action");
            String callId = intent.getStringExtra("callId");
            String bookingId = intent.getStringExtra("bookingId");

            Log.i("MainActivity", "[CALL_TRACE] Step 1 & 2: Notification Accept tapped -> MainActivity.handleCallIntent received (action=" + action + ", callId=" + callId + ", bookingId=" + bookingId + ")");

            BelConnectCallPlugin.pendingAction = action;
            BelConnectCallPlugin.pendingCallId = callId;
            BelConnectCallPlugin.pendingBookingId = bookingId;
            // Persist to SharedPreferences and update static cache
            BelConnectCallPlugin.setPendingCallAction(this, action, callId, bookingId);

            // Stop native ringtone immediately as app has now opened/resumed
            BelConnectCallPlugin.dismissCall(this, callId);
        }
    }
}
