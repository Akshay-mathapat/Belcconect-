package com.cityconnect.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

@CapacitorPlugin(
    name = "ProviderLocation",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
public class ProviderLocationPlugin extends Plugin {

    private String currentBookingId = null;

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            showProminentDisclosureAndRequest(call);
            return;
        }

        checkBackgroundPermAndStart(call);
    }

    private void showProminentDisclosureAndRequest(PluginCall call) {
        if (getActivity() == null) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }

        getActivity().runOnUiThread(() -> {
            new androidx.appcompat.app.AlertDialog.Builder(getActivity())
                .setTitle("Location Permission Disclosure")
                .setMessage("BelConnect collects location data to enable real-time arrival tracking and turn-by-turn navigation between customers and service providers during active bookings, even when the app is running in the background or closed.\n\nBackground tracking starts only when you accept a job and ends immediately when the booking is completed or cancelled.\n\nYour location data is never sold or used for advertising.")
                .setPositiveButton("Agree & Continue", (dialog, which) -> {
                    requestPermissionForAlias("location", call, "locationPermsCallback");
                })
                .setNegativeButton("Not Now", (dialog, which) -> {
                    JSObject ret = new JSObject();
                    ret.put("status", "disclosure_declined");
                    call.resolve(ret);
                })
                .setCancelable(false)
                .show();
        });
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            checkBackgroundPermAndStart(call);
        } else {
            JSObject ret = new JSObject();
            ret.put("status", "permission_denied");
            call.resolve(ret);
        }
    }

    private void checkBackgroundPermAndStart(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getActivity() != null) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                try {
                    ActivityCompat.requestPermissions(
                        getActivity(),
                        new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                        1002
                    );
                } catch (Exception e) {
                    android.util.Log.w("ProviderLocationPlugin", "Could not request background location: " + e.getMessage());
                }
            }
        }
        checkGpsAndStart(call);
    }

    private void checkGpsAndStart(PluginCall call) {
        LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        boolean isGpsEnabled = false;
        boolean isNetworkEnabled = false;
        
        if (locationManager != null) {
            isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        }

        if (!isGpsEnabled && !isNetworkEnabled) {
            JSObject ret = new JSObject();
            ret.put("status", "gps_disabled");
            call.resolve(ret);
            return;
        }

        String bookingId = call.getString("bookingId");
        String token = call.getString("token");
        String apiUrl = call.getString("apiUrl");
        android.util.Log.i("ProviderLocationPlugin", "startTracking called for bookingId=" + bookingId);

        Intent serviceIntent = new Intent(getContext(), BelConnectLocationService.class);
        serviceIntent.putExtra("bookingId", bookingId);
        serviceIntent.putExtra("token", token);
        serviceIntent.putExtra("apiUrl", apiUrl);
        serviceIntent.setAction("START_TRACKING");

        ContextCompat.startForegroundService(getContext(), serviceIntent);
        currentBookingId = bookingId;
        
        JSObject ret = new JSObject();
        ret.put("status", "started");
        ret.put("bookingId", bookingId);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        String reqBookingId = call.getString("bookingId");
        if (reqBookingId != null && currentBookingId != null && !reqBookingId.equals(currentBookingId)) {
            // Request is to stop a different booking than the one actively running; do not stop active service
            JSObject ret = new JSObject();
            ret.put("status", "ignored_different_booking");
            ret.put("activeBookingId", currentBookingId);
            call.resolve(ret);
            return;
        }

        Intent serviceIntent = new Intent(getContext(), BelConnectLocationService.class);
        serviceIntent.setAction("STOP_TRACKING");
        getContext().startService(serviceIntent);

        currentBookingId = null;
        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }

    @PluginMethod
    public void getTrackingStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isTracking", BelConnectLocationService.isTracking());
        ret.put("bookingId", currentBookingId);
        call.resolve(ret);
    }
}
