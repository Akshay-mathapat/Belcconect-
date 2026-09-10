package com.cityconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
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
    private String callId;
    private String peerName;
    private String serviceName;
    private long callStartTime = 0;

    public static boolean isServiceRunning() {
        return isRunning;
    }

    public static void start(Context context, String callId, String peerName, String serviceName) {
        if (context == null) return;
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
        try {
            Intent intent = new Intent(context, BelConnectCallService.class);
            intent.setAction("STOP_CALL");
            context.stopService(intent);
        } catch (Exception e) {
            Log.w(TAG, "Could not stop BelConnectCallService: " + e.getMessage());
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
                Log.i(TAG, "Started active call foreground service for callId: " + callId);
            } else if ("STOP_CALL".equals(action)) {
                stopInternal();
            }
        }
        return START_NOT_STICKY;
    }

    private void stopInternal() {
        Log.i(TAG, "Stopping active call foreground service");
        isRunning = false;
        callStartTime = 0;
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        callStartTime = 0;
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

        String title = "BelConnect Call — " + (peerName != null && !peerName.isEmpty() ? peerName : "In Progress");
        String contentText = (serviceName != null && !serviceName.isEmpty() ? serviceName + " • " : "") + "Tap to return to call";

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
