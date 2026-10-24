import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "cloudflare-turnstile-script";

export default function TurnstileWidget({ onToken, resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [error, setError] = useState("");
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return undefined;

    let cancelled = false;
    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current !== null) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => {
          setError("");
          onToken(token);
        },
        "expired-callback": () => onToken(""),
        "error-callback": () => {
          onToken("");
          setError("Verification could not load. Please refresh and try again.");
        },
      });
    };

    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    if (window.turnstile) render();

    return () => {
      cancelled = true;
      script?.removeEventListener("load", render);
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, resetKey, onToken]);

  const visibleError = siteKey
    ? error
    : "Verification is not configured. Please contact support.";

  return (
    <div className="turnstile-field">
      <div ref={containerRef} />
      {visibleError && <p className="field-error" role="alert">{visibleError}</p>}
    </div>
  );
}
