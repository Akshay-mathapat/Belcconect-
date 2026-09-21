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
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "BelConnectCall")
public class BelConnectCallPlugin extends Plugin {
    private static final String TAG = "BelConnectCallPlugin";
    public static final String CHANNEL_ID = "belconnect_calls_v2";
    public static final String CHANNEL_NAME = "BelConnect Incoming Calls";
    public static final String MISSED_CHANNEL_ID = "belconnect_missed_calls";
    public static final String MISSED_CHANNEL_NAME = "BelConnect Missed Calls";

    public static volatile boolean isAppInForeground = false;
    public static volatile String pendingAction = null;
    public static volatile String pendingCallId = null;
    public static volatile String pendingBookingId = null;
    public static volatile String latestDeviceToken = null;
    public static volatile String activePresentedCallId = null;
    private static final Handler incomingWatchdogHandler = new Handler(Looper.getMainLooper());
    private static final Map<String, Runnable> incomingWatchdogRunnables = new ConcurrentHashMap<>();
    private static final Set<String> memorySeenMissedCallIds = Collections.synchronizedSet(new HashSet<>());
    private static final Set<String> terminalOrAcceptedCallIds = Collections.synchronizedSet(new HashSet<>());
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

                NotificationChannel existingMissed = notificationManager.getNotificationChannel(MISSED_CHANNEL_ID);
                if (existingMissed == null) {
                    NotificationChannel missedChannel = new NotificationChannel(
                        MISSED_CHANNEL_ID,
                        MISSED_CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    missedChannel.setDescription("Missed voice calls for BelConnect");
                    missedChannel.enableVibration(true);
                    missedChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                    notificationManager.createNotificationChannel(missedChannel);
                    Log.i(TAG, "Notification channel '" + MISSED_CHANNEL_ID + "' created.");
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

        // Cancel any previous watchdog for this call
        Runnable existingWatchdog = incomingWatchdogRunnables.remove(callId);
        if (existingWatchdog != null) {
            incomingWatchdogHandler.removeCallbacks(existingWatchdog);
        }
        terminalOrAcceptedCallIds.remove(callId);

        // Arm 45-second native watchdog timer for unanswered incoming call
        Runnable timeoutRunnable = new Runnable() {
            @Override
            public void run() {
                incomingWatchdogRunnables.remove(callId);
                if (terminalOrAcceptedCallIds.contains(callId)) {
                    Log.i(TAG, "[CALL_WATCHDOG] Call " + callId + " is already terminal/accepted. Ignoring watchdog.");
                    return;
                }
                if (isCallAlreadyPresented(callId)) {
                    Log.i(TAG, "Native 45s watchdog expired for unanswered call: " + callId);
                    Log.i(TAG, "[CALL_WATCHDOG] Native 45s watchdog expired for unanswered call: " + callId);
                    terminalOrAcceptedCallIds.add(callId);
                    dismissCall(context, callId);
                    showMissedCallNotification(context, callId, callerName, serviceName, bookingId);
                    CallActionReceiver.sendCallStatusUpdate(context, callId, "timeout");
                }
            }
        };
        incomingWatchdogRunnables.put(callId, timeoutRunnable);
        incomingWatchdogHandler.postDelayed(timeoutRunnable, 45_000L);
    }

    public static void dismissCall(Context context, String callId) {
        if (callId != null && !callId.isEmpty()) {
            terminalOrAcceptedCallIds.add(callId);
            Runnable watchdog = incomingWatchdogRunnables.remove(callId);
            if (watchdog != null) {
                incomingWatchdogHandler.removeCallbacks(watchdog);
                Log.i(TAG, "Watchdog timer cancelled for call: " + callId);
                Log.i(TAG, "[CALL_WATCHDOG] Watchdog timer cancelled for call: " + callId);
            }
        } else {
            for (Runnable r : incomingWatchdogRunnables.values()) {
                incomingWatchdogHandler.removeCallbacks(r);
            }
            incomingWatchdogRunnables.clear();
        }

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
        Log.i(TAG, "[CALL_DISMISS] Dismissed call notification and checked service: " + callId);
    }

    public static synchronized void showMissedCallNotification(Context context, String callId, String callerName, String serviceName, String bookingId) {
        if (context == null) return;
        createNotificationChannel(context);

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        // Check if call was explicitly accepted, declined, or cancelled
        SharedPreferences terminalPrefs = context.getSharedPreferences("belconnect_call_terminal_prefs", Context.MODE_PRIVATE);
        if (callId != null && !callId.isEmpty()) {
            String termReason = terminalPrefs.getString("term_" + callId, null);
            if ("accepted".equals(termReason) || "declined".equals(termReason) || "cancelled".equals(termReason)) {
                Log.i(TAG, "[CALL_MISSED] Skipping missed call notification because call " + callId + " was " + termReason);
                return;
            }
        }

        SharedPreferences prefs = context.getSharedPreferences("belconnect_missed_prefs", Context.MODE_PRIVATE);

        // Deduplication by callId: in-memory and SharedPreferences
        if (callId != null && !callId.isEmpty()) {
            if (memorySeenMissedCallIds.contains(callId)) {
                Log.i(TAG, "[CALL_MISSED] In-memory deduplication: callId=" + callId + " already recorded; skipping duplicate.");
                return;
            }
            Set<String> seen = prefs.getStringSet("seen_missed_call_ids", new HashSet<String>());
            if (seen != null && seen.contains(callId)) {
                Log.i(TAG, "[CALL_MISSED] Prefs deduplication: callId=" + callId + " already recorded; skipping duplicate.");
                memorySeenMissedCallIds.add(callId);
                return;
            }
            memorySeenMissedCallIds.add(callId);
            Set<String> updatedSeen = seen != null ? new HashSet<>(seen) : new HashSet<String>();
            updatedSeen.add(callId);
            prefs.edit().putStringSet("seen_missed_call_ids", updatedSeen).commit();
        }

        // Aggregation count per caller
        String displayName = (callerName != null && !callerName.trim().isEmpty()) ? callerName.trim() : "BelConnect User";
        String countKey = "count_" + displayName;
        int count = prefs.getInt(countKey, 0) + 1;
        prefs.edit().putInt(countKey, count).commit();

        String title = count > 1 ? count + " Missed Calls" : "Missed Call";
        String content = count > 1 ? "You have " + count + " missed calls from " + displayName : "You have a missed call from " + displayName;

        int notificationId = 3000 + Math.abs(displayName.hashCode() % 5000);

        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("action", "view_missed_call");
        intent.putExtra("callId", callId != null ? callId : "");
        intent.putExtra("bookingId", bookingId != null ? bookingId : "");
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, MISSED_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(content)
            .setSubText("BelConnect")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        notificationManager.notify(notificationId, builder.build());
        Log.i(TAG, "[CALL_MISSED] Missed call notification displayed for " + displayName + " (count=" + count + ", callId=" + callId + ")");
    }

    public static void clearMissedCalls(Context context, String callerName) {
        if (context == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences("belconnect_missed_prefs", Context.MODE_PRIVATE);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (callerName != null && !callerName.trim().isEmpty()) {
                String cleanName = callerName.trim();
                prefs.edit().remove("count_" + cleanName).commit();
                int notificationId = 3000 + Math.abs(cleanName.hashCode() % 5000);
                if (nm != null) nm.cancel(notificationId);
                Log.i(TAG, "[CALL_MISSED] Cleared missed calls for: " + cleanName);
            } else {
                SharedPreferences.Editor editor = prefs.edit();
                for (String key : prefs.getAll().keySet()) {
                    if (key.startsWith("count_")) {
                        editor.remove(key);
                        String name = key.substring(6);
                        int nid = 3000 + Math.abs(name.hashCode() % 5000);
                        if (nm != null) nm.cancel(nid);
                    }
                }
                editor.commit();
                Log.i(TAG, "[CALL_MISSED] Cleared all missed calls");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error clearing missed calls: " + e.getMessage());
        }
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

    @PluginMethod
    public void clearMissedCalls(PluginCall call) {
        String callerName = call.getString("callerName", null);
        clearMissedCalls(getContext(), callerName);
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void showMissedCallNotification(PluginCall call) {
        String callId = call.getString("callId");
        String callerName = call.getString("callerName");
        String serviceName = call.getString("serviceName");
        String bookingId = call.getString("bookingId");

        showMissedCallNotification(getContext(), callId, callerName, serviceName, bookingId);

        JSObject ret = new JSObject();
        ret.put("shown", true);
        call.resolve(ret);
    }
}

