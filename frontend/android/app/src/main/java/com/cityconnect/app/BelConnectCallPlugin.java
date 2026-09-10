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
    public static final String CHANNEL_ID = "belconnect_calls";
    public static final String CHANNEL_NAME = "BelConnect Incoming Calls";

    public static volatile boolean isAppInForeground = false;
    public static volatile String pendingAction = null;
    public static volatile String pendingCallId = null;
    public static volatile String pendingBookingId = null;
    public static volatile String latestDeviceToken = null;

    private static MediaPlayer mediaPlayer = null;

    @Override
    public void load() {
        super.load();
        createNotificationChannel(getContext());
        SharedPreferences prefs = getContext().getSharedPreferences("belconnect_push_prefs", Context.MODE_PRIVATE);
        latestDeviceToken = prefs.getString("fcm_token", null);
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
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

                    try {
                        Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.phone_ringing);
                        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .build();
                        channel.setSound(soundUri, audioAttributes);
                    } catch (Exception e) {
                        Log.w(TAG, "Could not set custom sound for notification channel", e);
                    }

                    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                    channel.setBypassDnd(true);
                    notificationManager.createNotificationChannel(channel);
                    Log.i(TAG, "Notification channel '" + CHANNEL_ID + "' created.");
                }
            }
        }
    }

    public static synchronized void startRingtone(Context context) {
        try {
            stopRingtone();
            Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.phone_ringing);
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
            Log.i(TAG, "Native ringtone started.");
        } catch (Exception e) {
            Log.w(TAG, "Could not play native media player ringtone: " + e.getMessage());
        }
    }

    public static synchronized void stopRingtone() {
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
        }
    }

    public static void showIncomingCall(Context context, String callId, String callerName, String serviceName, String bookingId) {
        if (callId == null || callId.isEmpty()) return;
        createNotificationChannel(context);

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

        String title = "BelConnect Incoming Call 📞";
        String content = (callerName != null && !callerName.isEmpty() ? callerName : "Someone")
            + (serviceName != null && !serviceName.isEmpty() ? " • " + serviceName : " is calling...");
        String displayName = (callerName != null && !callerName.isEmpty()) ? callerName : "BelConnect User";
        String displayContent = (serviceName != null && !serviceName.isEmpty()) ? serviceName : "Incoming Voice Call";
        String displayName = (callerName != null && !callerName.trim().isEmpty()) ? callerName.trim() : "BelConnect User";
        String displayContent = (serviceName != null && !serviceName.trim().isEmpty()) ? serviceName.trim() : "Incoming Voice Call";

        Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.phone_ringing);

        Person caller = new Person.Builder()
            .setName(displayName)
            .setImportant(true)
            .build();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(content)
            .setContentTitle(displayName)
            .setContentText(displayContent)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setStyle(
                NotificationCompat.CallStyle.forIncomingCall(
                    caller,
                    declinePendingIntent,
                    acceptPendingIntent
                )
            )
            .addAction(android.R.drawable.ic_menu_call, "Accept", acceptPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent);

        boolean canFullScreen = true;
        if (Build.VERSION.SDK_INT >= 34) {
            canFullScreen = notificationManager.canUseFullScreenIntent();
        }
        if (canFullScreen) {
            builder.setFullScreenIntent(fullScreenPendingIntent, true);
        }

        notificationManager.notify(notificationId, builder.build());
        startRingtone(context);
        Log.i(TAG, "Incoming call notification displayed for call: " + callId);
    }

    public static void dismissCall(Context context, String callId) {
        stopRingtone();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            if (callId != null && !callId.isEmpty()) {
                notificationManager.cancel(Math.abs(callId.hashCode()));
            } else {
                notificationManager.cancelAll();
            }
        }
        Log.i(TAG, "Dismissed call notification: " + callId);
    }

    @PluginMethod
    public void getPendingCallAction(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("action", pendingAction);
        ret.put("callId", pendingCallId);
        ret.put("bookingId", pendingBookingId);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingCallAction(PluginCall call) {
        pendingAction = null;
        pendingCallId = null;
        pendingBookingId = null;
        JSObject ret = new JSObject();
        ret.put("cleared", true);
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
        ret.put("token", latestDeviceToken);
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
}

