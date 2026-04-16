"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/form-safety";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

export function TurnstileField({
  token,
  onTokenChange
}: {
  token: string;
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !scriptLoaded || !containerRef.current || widgetIdRef.current || !window.turnstile) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "light",
      callback: (nextToken) => onTokenChange(nextToken),
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange("")
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [onTokenChange, scriptLoaded]);

  if (!TURNSTILE_SITE_KEY) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
      <div ref={containerRef} />
      {!token ? <p className="text-xs text-ink/50">Complete the security check before submitting.</p> : null}
    </div>
  );
}
