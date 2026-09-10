package com.cityconnect.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class CallActionReceiver extends BroadcastReceiver {
    private static final String TAG = "CallActionReceiver";
    public static final String DEFAULT_PRODUCTION_URL = "https://belconnect.vercel.app";

    private static final OkHttpClient httpClient = new OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        String callId = intent.getStringExtra("callId");

        if ("com.cityconnect.app.ACTION_DECLINE".equals(action)) {
            String callId = intent.getStringExtra("callId");
            Log.i(TAG, "Decline action received for call: " + callId);

            // 1. Immediately silence ringtone and dismiss native notification
            Log.i(TAG, "ACTION_DECLINE received for call: " + callId);
            // 1. Immediately silence ringtone and dismiss native incoming notification
            BelConnectCallPlugin.dismissCall(context, callId);

            if (callId == null || callId.isEmpty()) return;

            // 2. Fire-and-forget background HTTP call to reject the call on server
            SharedPreferences prefs = context.getSharedPreferences("belconnect_auth_prefs", Context.MODE_PRIVATE);
            String token = prefs.getString("auth_token", null);
            String apiUrl = prefs.getString("api_url", "https://belcconect.vercel.app");
            String apiUrl = prefs.getString("api_url", "https://belconnect.vercel.app");
            sendCallStatusUpdate(context, callId, "reject");
            // 2. Post /api/calls/{callId}/reject securely to server
            if (callId != null && !callId.isEmpty()) {
                sendCallStatusUpdate(context, callId, "reject");
            }
        } else if ("com.cityconnect.app.ACTION_END_CALL".equals(action)) {
            String callId = intent.getStringExtra("callId");
            Log.i(TAG, "End call action received from notification for call: " + callId);

            try {
                String targetUrl = apiUrl.replaceAll("/+$", "") + "/api/calls/" + callId + "/reject";
                RequestBody body = RequestBody.create("", MediaType.parse("application/json"));
                Request.Builder reqBuilder = new Request.Builder()
                    .url(targetUrl)
                    .post(body);
            Log.i(TAG, "ACTION_END_CALL received for call: " + callId);
            // 1. Stop active call foreground service immediately
            BelConnectCallService.stop(context);

                if (token != null && !token.isEmpty()) {
                    reqBuilder.addHeader("Authorization", "Bearer " + token);
                }
            if (callId == null || callId.isEmpty()) return;

                httpClient.newCall(reqBuilder.build()).enqueue(new Callback() {
                    @Override
                    public void onFailure(Call call, IOException e) {
                        Log.w(TAG, "Failed to send background reject: " + e.getMessage());
                    }
            // 2. Fire-and-forget background HTTP call to end the call on server
            sendCallStatusUpdate(context, callId, "end");
            // 2. Post /api/calls/{callId}/end securely to server
            if (callId != null && !callId.isEmpty()) {
                sendCallStatusUpdate(context, callId, "end");
            }
        }
    }

                    @Override
                    public void onResponse(Call call, Response response) throws IOException {
                        Log.i(TAG, "Background reject responded with status: " + response.code());
                        response.close();
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "Error initiating background reject request", e);
    private void sendCallStatusUpdate(Context context, String callId, String actionEndpoint) {
    private static void sendCallStatusUpdate(Context context, String callId, String actionEndpoint) {
        SharedPreferences prefs = context.getSharedPreferences("belconnect_auth_prefs", Context.MODE_PRIVATE);
        String token = prefs.getString("auth_token", null);
        String apiUrl = prefs.getString("api_url", "https://belconnect.vercel.app");
        String apiUrl = prefs.getString("api_url", DEFAULT_PRODUCTION_URL);
        if (apiUrl == null || apiUrl.trim().isEmpty()) {
            apiUrl = DEFAULT_PRODUCTION_URL;
        }

        try {
            String targetUrl = apiUrl.replaceAll("/+$", "") + "/api/calls/" + callId + "/" + actionEndpoint;
            String cleanBase = apiUrl.replaceAll("/+$", "");
            String targetUrl = cleanBase + "/api/calls/" + callId + "/" + actionEndpoint;
            RequestBody body = RequestBody.create("", MediaType.parse("application/json"));

            Request.Builder reqBuilder = new Request.Builder()
                .url(targetUrl)
                .post(body);

            if (token != null && !token.isEmpty()) {
                reqBuilder.addHeader("Authorization", "Bearer " + token);
            if (token != null && !token.trim().isEmpty()) {
                reqBuilder.addHeader("Authorization", "Bearer " + token.trim());
            }

            httpClient.newCall(reqBuilder.build()).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    Log.w(TAG, "Failed to send background " + actionEndpoint + ": " + e.getMessage());
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    Log.i(TAG, "Background " + actionEndpoint + " responded with status: " + response.code());
                    Log.i(TAG, "Background " + actionEndpoint + " responded with HTTP " + response.code());
                    response.close();
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "Error initiating background " + actionEndpoint + " request", e);
        }
    }
}

