package com.cityconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class BelConnectLocationService extends Service {
    private static final String TAG = "BelConnectLocation";
    private static final String CHANNEL_ID = "LocationTrackerChannel";
    private static final int NOTIFICATION_ID = 1001;
    private static final String PREFS_NAME = "BelConnectLocationPrefs";

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private OkHttpClient httpClient;
    private PowerManager.WakeLock wakeLock = null;

    private String bookingId;
    private String token;
    private String apiUrl;

    private long lastSentTimestamp = 0;
    private boolean isRequestPending = false;
    private boolean isTracking = false;
    private Location latestPendingLocation = null;

    @Override
    public void onCreate() {
        super.onCreate();
        // Set reasonable timeouts and retry logic for native HTTP client
        
        httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build();
            
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BelConnect:LocationServiceWakeLock");
                wakeLock.setReferenceCounted(false);
            }
        } catch (Exception e) {
            Log.w(TAG, "[LocationService] Failed to initialize WakeLock: " + e.getMessage());
        }

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) {
                    return;
                }
                Location bestLocation = null;
                for (Location location : locationResult.getLocations()) {
                    if (bestLocation == null || location.getTime() > bestLocation.getTime()) {
                        bestLocation = location;
                    }
                }
                if (bestLocation != null) {
                    Log.i(TAG, "[LocationService] GPS update: lat=" + bestLocation.getLatitude() +
                            ", lng=" + bestLocation.getLongitude() +
                            ", accuracy=" +
                            (bestLocation.hasAccuracy() ? bestLocation.getAccuracy() : "N/A") +
                            "m, time=" + bestLocation.getTime());

                    sendLocationToBackend(bestLocation);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        if (intent != null) {
            String action = intent.getAction();
            if ("START_TRACKING".equals(action)) {
                String newBookingId = intent.getStringExtra("bookingId");
                String newToken = intent.getStringExtra("token");
                String newApiUrl = intent.getStringExtra("apiUrl");

                if (isTracking && newBookingId != null && newBookingId.equals(bookingId)) {
                    Log.i(TAG, "[LocationService] Already tracking booking: " + bookingId);
                    if (newToken != null && !newToken.isEmpty()) token = newToken;
                    if (newApiUrl != null && !newApiUrl.isEmpty()) apiUrl = newApiUrl;
                    prefs.edit()
                        .putString("bookingId", bookingId)
                        .putString("token", token)
                        .putString("apiUrl", apiUrl)
                        .apply();
                    return START_STICKY;
                }
                
                if (isTracking) {
                    stopTrackingInternal();
                }

                bookingId = newBookingId;
                token = newToken;
                apiUrl = newApiUrl;

                prefs.edit()
                    .putString("bookingId", bookingId)
                    .putString("token", token)
                    .putString("apiUrl", apiUrl)
                    .apply();
                
                createNotificationChannel();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, getNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } else {
                    startForeground(NOTIFICATION_ID, getNotification());
                }
                acquireWakeLock();
                requestLocationUpdates();
                isTracking = true;
                Log.i(TAG, "[LocationService] Started foreground tracking for booking: " + bookingId);
            } else if ("STOP_TRACKING".equals(action)) {
                stopTracking();
            }
        } else {
            // Restarted by OS after process death
            bookingId = prefs.getString("bookingId", null);
            token = prefs.getString("token", null);
            apiUrl = prefs.getString("apiUrl", null);
            if (bookingId != null && token != null && apiUrl != null) {
                createNotificationChannel();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, getNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } else {
                    startForeground(NOTIFICATION_ID, getNotification());
                }
                acquireWakeLock();
                requestLocationUpdates();
                isTracking = true;
                Log.i(TAG, "[LocationService] Restored tracking from preferences for booking: " + bookingId);
            }
        }
        return START_STICKY;
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(12 * 60 * 60 * 1000L); // Max 12 hours safety timeout
                Log.i(TAG, "[LocationService] Acquired PARTIAL_WAKE_LOCK");
            }
        } catch (Exception e) {
            Log.w(TAG, "[LocationService] Error acquiring WakeLock: " + e.getMessage());
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                Log.i(TAG, "[LocationService] Released PARTIAL_WAKE_LOCK");
            }
        } catch (Exception ignored) {}
    }

    private void requestLocationUpdates() {
        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
                    .setMinUpdateIntervalMillis(3000)
                    .setMaxUpdateDelayMillis(5000)
                    .setWaitForAccurateLocation(false)
                    .setMinUpdateDistanceMeters(0.0f)
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
            Log.i(TAG, "[LocationService] Location updates requested with high accuracy 5s interval.");
        } catch (SecurityException e) {
            Log.e(TAG, "[LocationService] Lost location permission. Could not request updates. " + e);
        }
    }

    private void stopTrackingInternal() {
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        releaseWakeLock();
        isTracking = false;
    }

    private void stopTracking() {
        Log.i(TAG, "[LocationService] Stopping tracking service");
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().clear().apply();

        stopTrackingInternal();
        stopForeground(true);
        stopSelf();
    }

    private void sendLocationToBackend(Location location) {
        if (bookingId == null || token == null || apiUrl == null) return;
        
        // Single flight queueing: don't start new upload if one is actively pending
        if (isRequestPending) {
            latestPendingLocation = location;
            return;
        }

        // Out-of-order updates prevention
        if (location.getTime() <= lastSentTimestamp) {
            return;
        }

        try {
            JSONObject jsonBody = new JSONObject();
            jsonBody.put("latitude", location.getLatitude());
            jsonBody.put("longitude", location.getLongitude());
            if (location.hasAccuracy()) jsonBody.put("accuracy", location.getAccuracy());
            if (location.hasSpeed()) jsonBody.put("speed", location.getSpeed());
            if (location.hasBearing()) jsonBody.put("heading", location.getBearing());
            
            jsonBody.put("timestamp", location.getTime()); // Use real device location time for accuracy

            RequestBody body = RequestBody.create(jsonBody.toString(), MediaType.parse("application/json; charset=utf-8"));
            
            String base = (apiUrl != null && !apiUrl.trim().isEmpty()) ? apiUrl.trim() : "https://belcconect.vercel.app/api";
            while (base.endsWith("/")) {
                base = base.substring(0, base.length() - 1);
            }
            if (!base.endsWith("/api")) {
                base = base + "/api";
            }
            String endpoint = base + "/bookings/" + bookingId + "/provider-location-native";

            Log.i(TAG, "LOCATION_NATIVE: POST endpoint=" + endpoint + ", bookingId=" + bookingId + 
                       " lat=" + location.getLatitude() + " lng=" + location.getLongitude());

            Request.Builder requestBuilder = new Request.Builder()
                    .url(endpoint)
                    .post(body)
                    .addHeader("Authorization", "Bearer " + token)
                    .addHeader("Content-Type", "application/json");

            isRequestPending = true;
            final long currentTimestamp = location.getTime();
            
            httpClient.newCall(requestBuilder.build()).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    Log.w(TAG, "LOCATION_NATIVE: Network failure posting location: " + e.getMessage() + " (will retry on next GPS tick)");
                    isRequestPending = false;
                    processLatestPending();
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    try {
                        Log.i(TAG, "LOCATION_NATIVE: Response code=" + response.code() + " for booking " + bookingId);
                        if (response.isSuccessful()) {
                            lastSentTimestamp = currentTimestamp;
                            Log.d(TAG, "[LocationService] Location update successfully posted to backend for booking " + bookingId);
                        } else if (response.code() == 400) {
                            String bodyStr = "";
                            try {
                                if (response.body() != null) {
                                    bodyStr = response.body().string();
                                }
                            } catch (Exception ignored) {}
                            Log.w(TAG, "[LocationService] Backend returned 400: " + bodyStr);

                            boolean shouldStop = false;
                            try {
                                JSONObject errJson = new JSONObject(bodyStr);
                                String bookingStatus = errJson.optString("status", "");
                                if ("Completed".equalsIgnoreCase(bookingStatus) ||
                                    "Cancelled".equalsIgnoreCase(bookingStatus) ||
                                    "Rejected".equalsIgnoreCase(bookingStatus)) {
                                    shouldStop = true;
                                } else if (errJson.optString("error", "").contains("not in active tracking window")) {
                                    shouldStop = true;
                                }
                            } catch (Exception e) {
                                if (bodyStr.contains("not in active tracking window")) {
                                    shouldStop = true;
                                }
                            }

                            if (shouldStop) {
                                Log.i(TAG, "[LocationService] Booking is no longer active. Stopping tracking.");
                                stopTracking();
                                isRequestPending = false;
                                return;
                            }
                        } else {
                            Log.w(TAG, "[LocationService] Backend responded with code: " + response.code() + " (will retry on next GPS tick)");
                        }
                    } finally {
                        response.close();
                        isRequestPending = false;
                        processLatestPending();
                    }
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "[LocationService] Error constructing location payload", e);
            isRequestPending = false;
            processLatestPending();
        }
    }

    private void processLatestPending() {
        if (latestPendingLocation != null) {
            Location toSend = latestPendingLocation;
            latestPendingLocation = null;
            sendLocationToBackend(toSend);
        }
    }

    private Notification getNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent, 
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("BelConnect - Active Service")
                .setContentText("Sharing live GPS location with customer...")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "BelConnect Live Service Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Persistent notification while provider shares location during an active job");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopTrackingInternal();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
