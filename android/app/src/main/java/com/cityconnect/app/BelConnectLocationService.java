package com.cityconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
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

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private OkHttpClient httpClient;

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
        // Set reasonable timeouts for native HTTP client
        httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build();
            
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

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
                    sendLocationToBackend(bestLocation);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("START_TRACKING".equals(action)) {
                String newBookingId = intent.getStringExtra("bookingId");
                
                if (isTracking && newBookingId != null && newBookingId.equals(bookingId)) {
                    Log.i(TAG, "Already tracking this booking");
                    token = intent.getStringExtra("token");
                    apiUrl = intent.getStringExtra("apiUrl");
                    return START_NOT_STICKY;
                }
                
                if (isTracking) {
                    stopTrackingInternal();
                }

                bookingId = newBookingId;
                token = intent.getStringExtra("token");
                apiUrl = intent.getStringExtra("apiUrl");
                
                createNotificationChannel();
                startForeground(NOTIFICATION_ID, getNotification());
                requestLocationUpdates();
                isTracking = true;
            } else if ("STOP_TRACKING".equals(action)) {
                stopTracking();
            }
        }
        return START_NOT_STICKY; // Use START_NOT_STICKY for safety if killed, wait for user to re-open app
    }

    private void requestLocationUpdates() {
        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
                    .setMinUpdateIntervalMillis(3000)
                    .setMinUpdateDistanceMeters(5.0f)
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
            Log.i(TAG, "Location updates requested.");
        } catch (SecurityException e) {
            Log.e(TAG, "Lost location permission. Could not request updates. " + e);
        }
    }

    private void stopTrackingInternal() {
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        isTracking = false;
    }

    private void stopTracking() {
        Log.i(TAG, "Stopping tracking service");
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
            
            String endpoint = apiUrl + "/bookings/" + bookingId + "/provider-location-native";

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
                    Log.e(TAG, "Failed to send location: " + e.getMessage());
                    isRequestPending = false;
                    processLatestPending();
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.isSuccessful()) {
                        lastSentTimestamp = currentTimestamp;
                    } else if (response.code() == 401 || response.code() == 403 || response.code() == 404) {
                        Log.e(TAG, "Backend rejected location permanently: " + response.code());
                        stopTracking(); // Critical auth/booking failure
                        response.close();
                        isRequestPending = false;
                        return;
                    } else {
                        Log.e(TAG, "Backend rejected location: " + response.code());
                    }
                    response.close();
                    isRequestPending = false;
                    processLatestPending();
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "JSON Exception", e);
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
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("BelConnect")
                .setContentText("Live location sharing active. Tap to return to current service.")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "BelConnect Live Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Persistent notification for active provider tracking");
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
