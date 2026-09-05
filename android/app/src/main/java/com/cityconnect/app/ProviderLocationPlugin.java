package com.cityconnect.app;

import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.os.Build;
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

    private boolean isServiceRunning = false;

    @PluginMethod
    public void startTracking(PluginCall call) {
        String bookingId = call.getString("bookingId");
        String token = call.getString("token");
        String apiUrl = call.getString("apiUrl");

        if (bookingId == null || token == null || apiUrl == null) {
            call.reject("Must provide bookingId, token, and apiUrl");
            return;
        }

        if (isServiceRunning) {
            JSObject ret = new JSObject();
            ret.put("status", "already_running");
            call.resolve(ret);
            return;
        }

        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
        } else {
            checkGpsAndStart(call);
        }
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            checkGpsAndStart(call);
        } else {
            JSObject ret = new JSObject();
            ret.put("status", "permission_denied");
            call.resolve(ret);
        }
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

        Intent serviceIntent = new Intent(getContext(), BelConnectLocationService.class);
        serviceIntent.putExtra("bookingId", bookingId);
        serviceIntent.putExtra("token", token);
        serviceIntent.putExtra("apiUrl", apiUrl);
        serviceIntent.setAction("START_TRACKING");

        ContextCompat.startForegroundService(getContext(), serviceIntent);
        isServiceRunning = true;
        
        JSObject ret = new JSObject();
        ret.put("status", "started");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), BelConnectLocationService.class);
        serviceIntent.setAction("STOP_TRACKING");
        getContext().startService(serviceIntent);

        isServiceRunning = false;
        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }
}
