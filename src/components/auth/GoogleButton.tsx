"use client";

import { memo, useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/store/useAuthStore";
import { registerAndSubscribeUser } from "@/lib/registerSW";
import { getSafeReturnUrl } from "@/lib/urlUtils";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleButtonProps {
  role?: "user" | "provider" | "job_provider";
}

export const GoogleButton = memo(function GoogleButton({ role = "user" }: GoogleButtonProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthUser } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const processedHandoffCodes = useRef(new Set<string>());

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  // 1. Process verified Google Credential from direct ID Token POST
  const handleGoogleResponse = async (response: any) => {
    if (!response || !response.credential) {
      setErrorMessage("Google sign-in was cancelled or failed.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: response.credential,
          role,
        }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success && data.user && data.token) {
        completeSuccessfulLogin(data.user, data.token);
      } else {
        setErrorMessage(data.error || "Unable to sign in with Google. Please try again.");
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("Network error. Please check your connection.");
    }
  };

  const completeSuccessfulLogin = (user: any, token: string) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("cityconnect_token", token);

    setAuthUser({
      ...user,
      token,
    });

    registerAndSubscribeUser(user.id).catch((err) =>
      console.error("SW Registration error:", err)
    );

    const rawReturnUrl = searchParams.get("returnUrl");
    const safeReturnUrl = getSafeReturnUrl(rawReturnUrl);

    if (safeReturnUrl) {
      router.push(safeReturnUrl);
    } else {
      switch (user.role) {
        case "provider":
          router.push("/provider/dashboard");
          break;
        case "job_provider":
          router.push("/jobprovider/dashboard");
          break;
        default:
          router.push("/");
          break;
      }
    }
  };

  // 2. Strict Parent Window PostMessage Listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // REQUIRE STRICT PARENT ORIGIN MATCH BEFORE TRUSTING EVENT DATA
      if (event.origin !== window.location.origin) return;

      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "GOOGLE_AUTH_SUCCESS") {
        if (event.data.token && event.data.user && typeof event.data.user === "object") {
          completeSuccessfulLogin(event.data.user, event.data.token);
        }
      } else if (event.data.type === "GOOGLE_AUTH_ERROR" || event.data.type === "GOOGLE_AUTH_CANCEL") {
        setIsLoading(false);
        if (event.data.error) {
          setErrorMessage(event.data.error);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setAuthUser, router, searchParams]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let appListener: { remove: () => Promise<void> } | undefined;

    App.addListener("appUrlOpen", ({ url }) => {
      if (!active) return;

      let callbackUrl: URL;
      try {
        callbackUrl = new URL(url);
      } catch {
        return;
      }

      if (
        callbackUrl.protocol !== "com.cityconnect.app:" ||
        callbackUrl.hostname !== "oauth" ||
        callbackUrl.pathname !== "/callback"
      ) {
        return;
      }

      const type = callbackUrl.searchParams.get("type");
      const code = callbackUrl.searchParams.get("code");

      if (type === "GOOGLE_AUTH_SUCCESS" && code) {
        if (processedHandoffCodes.current.has(code)) return;
        processedHandoffCodes.current.add(code);

        const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        let exchangeUrl: URL;
        try {
          exchangeUrl = new URL("/api/auth/google/mobile/exchange", configuredAppUrl);
        } catch {
          setIsLoading(false);
          setErrorMessage("Mobile Google sign-in needs a reachable HTTPS app URL.");
          void Browser.close().catch(() => {});
          return;
        }
        fetch(exchangeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        })
          .then(async (response) => {
            const data = await response.json();
            if (!response.ok || !data.success || !data.user || !data.token) {
              throw new Error(data.error || "Mobile sign-in exchange failed.");
            }
            completeSuccessfulLogin(data.user, data.token);
          })
          .catch((error: unknown) => {
            setIsLoading(false);
            setErrorMessage(error instanceof Error ? error.message : "Mobile sign-in exchange failed.");
          })
          .finally(() => {
            void Browser.close().catch(() => {});
          });
        return;
      }

      setIsLoading(false);
      setErrorMessage(
        callbackUrl.searchParams.get("error") || "Google authentication was cancelled."
      );
      void Browser.close().catch(() => {});
    }).then((listener) => {
      if (active) appListener = listener;
      else void listener.remove();
    });

    return () => {
      active = false;
      void appListener?.remove();
    };
  }, [searchParams, setAuthUser, router]);

  // 3. Keep Clean Single Google Identity Services Integration
  useEffect(() => {
    if (typeof window === "undefined" || !clientId) return;

    let mounted = true;
    const initGsi = () => {
      if (!mounted || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res: any) => {
          handleGoogleResponse(res);
        },
      });

      const container = document.getElementById("google-button-container");
      if (container) {
        container.innerHTML = "";
        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: "100%",
        });
      }
    };

    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        initGsi();
      }
    }, 150);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [clientId, role]);

  const handleManualFallbackClick = () => {
    if (!clientId) {
      alert("Google Client ID is missing. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment variables.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    if (Capacitor.isNativePlatform()) {
      const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      let mobileAppUrl: URL;
      try {
        mobileAppUrl = new URL(configuredAppUrl);
      } catch {
        mobileAppUrl = new URL("https://invalid.local");
      }
      if (
        mobileAppUrl.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "::1"].includes(mobileAppUrl.hostname)
      ) {
        setIsLoading(false);
        setErrorMessage("Mobile Google sign-in needs NEXT_PUBLIC_APP_URL set to the reachable HTTPS app URL.");
        return;
      }

      const initUrl = new URL("/api/auth/google/init", mobileAppUrl);
      initUrl.searchParams.set("role", role);
      initUrl.searchParams.set("mobile", "1");
      void Browser.open({ url: initUrl.toString(), presentationStyle: "popover" }).catch(() => {
        setIsLoading(false);
        setErrorMessage("Unable to open Google sign-in.");
      });
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res: any) => {
          handleGoogleResponse(res);
        },
      });

      window.google.accounts.id.prompt((notification: any) => {
        setIsLoading(false);
      });
    } else {
      // Fallback via server OAuth init route carrying CSRF state and role
      const initUrl = `/api/auth/google/init?role=${encodeURIComponent(role)}`;
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        initUrl,
        "GoogleSignIn",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        setIsLoading(false);
        alert("Pop-up blocked. Please allow pop-ups for this site to sign in with Google.");
      }
    }
  };

  return (
    <div className="w-full space-y-2">
      {errorMessage && (
        <p className="text-xs text-rose-500 font-medium text-center">{errorMessage}</p>
      )}
      <div id="google-button-container" className="w-full min-h-[44px] flex items-center justify-center">
        <button
          type="button"
          disabled={isLoading}
          onClick={handleManualFallbackClick}
          className="w-full py-3 px-4 bg-card border border-border hover:bg-muted/40 text-foreground font-medium text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          suppressHydrationWarning
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {t("auth.continueWithGoogle")}
            </>
          )}
        </button>
      </div>
    </div>
  );
});
