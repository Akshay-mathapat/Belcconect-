package com.cityconnect.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BelConnectCall")
public class BelConnectCallPlugin extends Plugin {
    private static final String TAG = "BelConnectCallPlugin";
    public static final String CHANNEL_ID = "belconnect_calls_v2";
    public static final String CHANNEL_NAME = "BelConnect Incoming Calls";

    public static volatile boolean isAppInForeground = false;
    public static volatile String pendingAction = null;
    public static volatile String pendingCallId = null;
    public static volatile String pendingBookingId = null;
    public static volatile String latestDeviceToken = null;
    public static volatile String activePresentedCallId = null;
    private static BelConnectCallPlugin instance = null;

    public static boolean isCallAlreadyPresented(String callId) {
        if (callId == null || callId.isEmpty()) return false;
        return callId.equals(activePresentedCallId);
    }

    public static void setCallPresented(String callId) {
        activePresentedCallId = callId;
        Log.i(TAG, "Call presented: " + callId);
    }

    public static void clearCallPresented(String callId) {
        if (callId != null && callId.equals(activePresentedCallId)) {
            activePresentedCallId = null;
            Log.i(TAG, "Call presented state cleared for call: " + callId);
        } else if (callId == null) {
            activePresentedCallId = null;
            Log.i(TAG, "Call presented state cleared (all)");
        }
    }

    public static final String PREFS_NAME = "belconnect_push_prefs";
    public static final String PREF_PENDING_ACTION = "pending_action";
    public static final String PREF_PENDING_CALL_ID = "pending_call_id";
    public static final String PREF_PENDING_BOOKING_ID = "pending_booking_id";
    public static final String PREF_PENDING_CREATED_AT = "pending_created_at";
    public static final long PENDING_STALENESS_MS = 60_000L;

    public static void notifyPermissionGranted(Context context, String permission) {
        Log.i(TAG, "[CALL_TRACE] notifyPermissionGranted: " + permission);
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("permission", permission);
            instance.notifyListeners("permissionGranted", data);
        }
    }

    public static void setPendingCallAction(Context context, String action, String callId, String bookingId) {
        pendingAction = action;
        pendingCallId = callId;
        pendingBookingId = bookingId;
        Log.i(TAG, "[CALL_TRACE] Step 3: BelConnectCallPlugin pending action stored: action=" + action + ", callId=" + callId + ", bookingId=" + bookingId);

        if (context != null) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                if (action != null && callId != null) {
                    prefs.edit()
                        .putString(PREF_PENDING_ACTION, action)
                        .putString(PREF_PENDING_CALL_ID, callId)
                        .putString(PREF_PENDING_BOOKING_ID, bookingId != null ? bookingId : "")
                        .putLong(PREF_PENDING_CREATED_AT, System.currentTimeMillis())
                        .apply();
                } else {
                    prefs.edit()
                        .remove(PREF_PENDING_ACTION)
                        .remove(PREF_PENDING_CALL_ID)
                        .remove(PREF_PENDING_BOOKING_ID)
                        .remove(PREF_PENDING_CREATED_AT)
                        .apply();
                }
            } catch (Exception e) {
                Log.w(TAG, "Error writing pending call action to prefs: " + e.getMessage());
            }
        }
    }

    private static MediaPlayer mediaPlayer = null;

    @Override
    public void load() {
        super.load();
        instance = this;
        createNotificationChannel(getContext());
        SharedPreferences prefs = getContext().getSharedPreferences("belconnect_push_prefs", Context.MODE_PRIVATE);
        latestDeviceToken = prefs.getString("fcm_token", null);
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                // Delete legacy channel with attached sound if it exists
                try {
                    notificationManager.deleteNotificationChannel("belconnect_calls");
                } catch (Exception ignored) {}

                NotificationChannel existing = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (existing == null) {
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Incoming voice calls for BelConnect");
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
                    // Sound is handled directly and exclusively by MediaPlayer to prevent dual ringtones and allow instant stop
                    channel.setSound(null, null);
                    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                    channel.setBypassDnd(true);
                    notificationManager.createNotificationChannel(channel);
                    Log.i(TAG, "Notification channel '" + CHANNEL_ID + "' created.");
                }
            }
        }
    }

    private static volatile String currentRingingCallId = null;

    public static synchronized void startRingtone(Context context) {
        startRingtone(context, null);
    }

    public static synchronized void startRingtone(Context context, String callId) {
        if (context == null) return;
        if (callId != null && callId.equals(currentRingingCallId) && mediaPlayer != null && mediaPlayer.isPlaying()) {
            Log.i(TAG, "Native ringtone already playing for call: " + callId + "; ignoring duplicate start.");
            return;
        }

        try {
            stopRingtone();
            currentRingingCallId = callId;

            int soundResId = context.getResources().getIdentifier("belconnect_incoming_call", "raw", context.getPackageName());
            if (soundResId == 0) {
                soundResId = context.getResources().getIdentifier("phone_ringing", "raw", context.getPackageName());
            }
            if (soundResId == 0) {
                soundResId = R.raw.phone_ringing;
            }

            Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + soundResId);
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(context, soundUri);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
            Log.i(TAG, "Native ringtone started for call: " + callId);
        } catch (Exception e) {
            Log.w(TAG, "Could not play native media player ringtone: " + e.getMessage());
        }
    }

    public static synchronized void stopRingtone() {
        currentRingingCallId = null;
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
                Log.i(TAG, "Native ringtone stopped.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping native ringtone: " + e.getMessage());
            mediaPlayer = null;
        }
    }

    public static void showIncomingCall(Context context, String callId, String callerName, String serviceName, String bookingId) {
        if (callId == null || callId.isEmpty()) return;
        setCallPresented(callId);
        createNotificationChannel(context);

        // Step 8: Persist incoming call to SharedPreferences BEFORE displaying notification
        setPendingCallAction(context, "incoming", callId, bookingId);

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        int notificationId = Math.abs(callId.hashCode());

        // 1. Full Screen Intent (when screen is locked)
        Intent fullScreenIntent = new Intent(context, MainActivity.class);
        fullScreenIntent.setAction(Intent.ACTION_MAIN);
        fullScreenIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        fullScreenIntent.putExtra("action", "incoming");
        fullScreenIntent.putExtra("callId", callId);
        fullScreenIntent.putExtra("bookingId", bookingId != null ? bookingId : "");
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // 2. Accept Action Intent (opens app and signals accept)
        Intent acceptIntent = new Intent(context, MainActivity.class);
        acceptIntent.setAction(Intent.ACTION_MAIN);
        acceptIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        acceptIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        acceptIntent.putExtra("action", "accept");
        acceptIntent.putExtra("callId", callId);
        acceptIntent.putExtra("bookingId", bookingId != null ? bookingId : "");
        PendingIntent acceptPendingIntent = PendingIntent.getActivity(
            context,
            notificationId + 1,
            acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // 3. Decline Action Intent (broadcast receiver to reject immediately)
        Intent declineIntent = new Intent(context, CallActionReceiver.class);
        declineIntent.setAction("com.cityconnect.app.ACTION_DECLINE");
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("bookingId", bookingId != null ? bookingId : "");
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + 2,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String displayName = (callerName != null && !callerName.trim().isEmpty()) ? callerName.trim() : "BelConnect User";
        String displayContent = (serviceName != null && !serviceName.trim().isEmpty() && serviceName.length() <= 24 && !serviceName.toLowerCase().contains("want to") && !serviceName.equalsIgnoreCase("Voice Call") && !serviceName.equalsIgnoreCase("Incoming Voice Call"))
            ? "Incoming voice call • " + serviceName.trim()
            : "Incoming voice call";

        Person caller = new Person.Builder()
            .setName(displayName)
            .setImportant(true)
            .build();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(displayName)
            .setContentText(displayContent)
            .setSubText("BelConnect")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true)
            .setSound(null)
            .setOnlyAlertOnce(true)
            .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setStyle(
                NotificationCompat.CallStyle.forIncomingCall(
                    caller,
                    declinePendingIntent,
                    acceptPendingIntent
                )
            );

        boolean canFullScreen = true;
        if (Build.VERSION.SDK_INT >= 34) {
            canFullScreen = notificationManager.canUseFullScreenIntent();
        }
        if (canFullScreen) {
            builder.setFullScreenIntent(fullScreenPendingIntent, true);
        }

        notificationManager.notify(notificationId, builder.build());
        startRingtone(context, callId);
        Log.i(TAG, "Incoming call notification displayed for call: " + callId);
    }

    public static void dismissCall(Context context, String callId) {
        stopRingtone();
        clearCallPresented(callId);
        if (context != null) {
            BelConnectCallService.stopIfMatchingCall(context, callId);
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                if (callId != null && !callId.isEmpty()) {
                    notificationManager.cancel(Math.abs(callId.hashCode()));
                } else {
                    notificationManager.cancelAll();
                }
            }
        }
        Log.i(TAG, "Dismissed call notification and checked service: " + callId);
    }

    @PluginMethod
    public void getPendingCallAction(PluginCall call) {
        Context context = getContext();
        String action = null;
        String callId = null;
        String bookingId = null;

        if (context != null) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                long createdAt = prefs.getLong(PREF_PENDING_CREATED_AT, 0);
                long now = System.currentTimeMillis();

                if (createdAt > 0 && (now - createdAt) <= PENDING_STALENESS_MS) {
                    action = prefs.getString(PREF_PENDING_ACTION, null);
                    callId = prefs.getString(PREF_PENDING_CALL_ID, null);
                    bookingId = prefs.getString(PREF_PENDING_BOOKING_ID, null);
                } else if (createdAt > 0) {
                    Log.i(TAG, "Discarding stale pending call action (age=" + (now - createdAt) + "ms)");
                    prefs.edit()
                        .remove(PREF_PENDING_ACTION)
                        .remove(PREF_PENDING_CALL_ID)
                        .remove(PREF_PENDING_BOOKING_ID)
                        .remove(PREF_PENDING_CREATED_AT)
                        .apply();
                }
            } catch (Exception e) {
                Log.w(TAG, "Error reading pending call action from prefs: " + e.getMessage());
            }
        }

        // Fall back to in-memory static fields if prefs was empty but memory still has it
        if (action == null) {
            action = pendingAction;
            callId = pendingCallId;
            bookingId = pendingBookingId;
        }

        JSObject ret = new JSObject();
        ret.put("action", action);
        ret.put("callId", callId);
        ret.put("bookingId", bookingId);
        Log.i(TAG, "[CALL_TRACE] Step 3b: BelConnectCallPlugin.getPendingCallAction returning: action=" + action + ", callId=" + callId + ", bookingId=" + bookingId);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingCallAction(PluginCall call) {
        pendingAction = null;
        pendingCallId = null;
        pendingBookingId = null;
        clearCallPresented(null);
        setPendingCallAction(getContext(), null, null, null);
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void markCallPresented(PluginCall call) {
        String callId = call.getString("callId");
        if (callId != null && !callId.isEmpty()) {
            setCallPresented(callId);
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void dismissCallNotification(PluginCall call) {
        String callId = call.getString("callId");
        dismissCall(getContext(), callId);
        JSObject ret = new JSObject();
        ret.put("dismissed", true);
        call.resolve(ret);
    }

   @PluginMethod
public void getDevicePushToken(PluginCall call) {
    JSObject ret = new JSObject();

    String token = latestDeviceToken;

    if (token == null || token.isEmpty()) {
        SharedPreferences prefs =
            getContext().getSharedPreferences(
                "belconnect_push_prefs",
                Context.MODE_PRIVATE
            );

        token = prefs.getString("fcm_token", null);

        if (token != null && !token.isEmpty()) {
            latestDeviceToken = token;
        }
    }

    ret.put("token", token);
    call.resolve(ret);
}

    @PluginMethod
    public void setAuthCredentials(PluginCall call) {
        String token = call.getString("token");
        String apiUrl = call.getString("apiUrl");

        SharedPreferences prefs = getContext().getSharedPreferences("belconnect_auth_prefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        if (token != null && !token.isEmpty()) {
            editor.putString("auth_token", token);
        } else {
            editor.remove("auth_token");
        }
        if (apiUrl != null && !apiUrl.isEmpty()) {
            editor.putString("api_url", apiUrl);
        }
        editor.apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void startActiveCallService(PluginCall call) {
        String callId = call.getString("callId");
        String peerName = call.getString("peerName");
        String serviceName = call.getString("serviceName");
        BelConnectCallService.start(getContext(), callId, peerName, serviceName);
        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopActiveCallService(PluginCall call) {
        BelConnectCallService.stop(getContext());
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void showIncomingCallNotification(PluginCall call) {
        String callId = call.getString("callId");
        String callerName = call.getString("callerName", "Someone");
        String serviceName = call.getString("serviceName", "");
        String bookingId = call.getString("bookingId", "");

        showIncomingCall(getContext(), callId, callerName, serviceName, bookingId);
        JSObject ret = new JSObject();
        ret.put("shown", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopIncomingRingtone(PluginCall call) {
        stopRingtone();
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }
}

