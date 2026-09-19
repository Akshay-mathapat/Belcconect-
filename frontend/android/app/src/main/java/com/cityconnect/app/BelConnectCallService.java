package com.cityconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.PowerManager;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class BelConnectCallService extends Service {
    private static final String TAG = "BelConnectCallService";
    public static final String CHANNEL_ID = "belconnect_active_calls";
    public static final String CHANNEL_NAME = "BelConnect Ongoing Calls";
    private static final int NOTIFICATION_ID = 2001;

    private static volatile boolean isRunning = false;
    private static volatile String activeServiceCallId = null;
    private String callId;
    private String peerName;
    private String serviceName;
    private long callStartTime = 0;

    private AudioManager audioManager = null;
    private AudioFocusRequest audioFocusRequest = null;
    private PowerManager.WakeLock wakeLock = null;

    public static boolean isServiceRunning() {
        return isRunning;
    }

    public static String getActiveServiceCallId() {
        return activeServiceCallId;
    }

    public static void start(Context context, String callId, String peerName, String serviceName) {
        if (context == null) return;
        activeServiceCallId = callId;
        try {
            Intent intent = new Intent(context, BelConnectCallService.class);
            intent.setAction("START_CALL");
            intent.putExtra("callId", callId != null ? callId : "");
            intent.putExtra("peerName", peerName != null ? peerName : "");
            intent.putExtra("serviceName", serviceName != null ? serviceName : "");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not start BelConnectCallService: " + e.getMessage());
        }
    }

    public static void stop(Context context) {
        if (context == null) return;
        activeServiceCallId = null;
        try {
            Intent intent = new Intent(context, BelConnectCallService.class);
            intent.setAction("STOP_CALL");
            context.stopService(intent);
        } catch (Exception e) {
            Log.w(TAG, "Could not stop BelConnectCallService: " + e.getMessage());
        }
    }

    public static void stopIfMatchingCall(Context context, String callId) {
        if (context == null) return;
        if (callId == null || callId.isEmpty() || activeServiceCallId == null || callId.equals(activeServiceCallId)) {
            Log.i(TAG, "stopIfMatchingCall: stopping service for call: " + callId);
            stop(context);
        } else {
            Log.i(TAG, "stopIfMatchingCall: ignoring stop for non-matching call: " + callId + " (active=" + activeServiceCallId + ")");
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("START_CALL".equals(action)) {
                callId = intent.getStringExtra("callId");
                activeServiceCallId = callId;
                peerName = intent.getStringExtra("peerName");
                serviceName = intent.getStringExtra("serviceName");
                if (callStartTime == 0) {
                    callStartTime = SystemClock.elapsedRealtime();
                }

                createNotificationChannel();
                Notification notification = buildNotification();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
                isRunning = true;
                acquireAudioAndWakeLock();
                Log.i(TAG, "Started active call foreground service for callId: " + callId);
            } else if ("STOP_CALL".equals(action)) {
                stopInternal();
            }
        }
        return START_NOT_STICKY;
    }

    private void acquireAudioAndWakeLock() {
        try {
            if (audioManager == null) {
                audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            }
            if (audioManager != null) {
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build();
                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(playbackAttributes)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener(focusChange -> {
                            Log.i(TAG, "[CALL_TRACE] BelConnectCallService audio focus changed: " + focusChange);
                        })
                        .build();
                    audioManager.requestAudioFocus(audioFocusRequest);
                } else {
                    audioManager.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN);
                }
                Log.i(TAG, "[CALL_TRACE] Audio focus requested and MODE_IN_COMMUNICATION set.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error acquiring audio focus: " + e.getMessage());
        }

        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BelConnect:CallWakeLock");
                    wakeLock.setReferenceCounted(false);
                    wakeLock.acquire(4 * 60 * 60 * 1000L); // Safety timeout 4 hours
                    Log.i(TAG, "[CALL_TRACE] Acquired PARTIAL_WAKE_LOCK for ongoing call.");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error acquiring wake lock: " + e.getMessage());
        }
    }

    private void releaseAudioAndWakeLock() {
        try {
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest);
                    audioFocusRequest = null;
                } else {
                    audioManager.abandonAudioFocus(null);
                }
                audioManager.setMode(AudioManager.MODE_NORMAL);
                Log.i(TAG, "[CALL_TRACE] Abandoned audio focus and restored MODE_NORMAL.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error releasing audio focus: " + e.getMessage());
        }

        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                Log.i(TAG, "[CALL_TRACE] Released PARTIAL_WAKE_LOCK.");
            }
            wakeLock = null;
        } catch (Exception e) {
            Log.w(TAG, "Error releasing wake lock: " + e.getMessage());
        }
    }

    private void stopInternal() {
        Log.i(TAG, "Stopping active call foreground service");
        isRunning = false;
        activeServiceCallId = null;
        callStartTime = 0;
        releaseAudioAndWakeLock();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        activeServiceCallId = null;
        callStartTime = 0;
        releaseAudioAndWakeLock();
    }

    private Notification buildNotification() {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setAction(Intent.ACTION_MAIN);
        openAppIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Intent endCallIntent = new Intent(this, CallActionReceiver.class);
        endCallIntent.setAction("com.cityconnect.app.ACTION_END_CALL");
        endCallIntent.putExtra("callId", callId != null ? callId : "");
        PendingIntent endPendingIntent = PendingIntent.getBroadcast(
            this,
            NOTIFICATION_ID + 10,
            endCallIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        String title = "BelConnect Call - " + (peerName != null && !peerName.isEmpty() ? peerName : "In Progress");
        String contentText = (serviceName != null && !serviceName.isEmpty() ? serviceName + " - " : "") + "Tap to return to call";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(contentText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(openPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setUsesChronometer(true)
            .setWhen(System.currentTimeMillis())
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Call", endPendingIntent);

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Persistent notification while an active BelConnect voice call is in progress");
            serviceChannel.setShowBadge(false);
            serviceChannel.setSound(null, null);
            serviceChannel.enableVibration(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
