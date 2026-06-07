// Detect in-app browsers (Telegram, Instagram, Facebook, generic WebViews) and
// help users escape into a real browser. WebRTC camera/microphone access is
// blocked or broken inside most in-app WebViews — especially Telegram — which
// is why a forwarded room link "joins" but shows no video and no audio.

export type InAppBrowser =
  | "telegram"
  | "instagram"
  | "facebook"
  | "other"
  | null;

interface WebViewGlobals {
  TelegramWebviewProxy?: unknown;
  Telegram?: { WebView?: unknown };
}

/**
 * Returns which in-app browser we're running inside, or null for a normal
 * standalone browser (Safari, Chrome, Firefox, etc.).
 *
 * Detection is reliable on Android (in-app browsers tag the User-Agent).
 * On iOS it's best-effort: Telegram's iOS in-app browser does not reliably
 * mark the UA, so we keep iOS detection conservative to avoid blocking real
 * browsers like Safari and Chrome (CriOS).
 */
export function detectInAppBrowser(): InAppBrowser {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  const g = window as unknown as WebViewGlobals;

  // Telegram — Android in-app browser tags UA with "Telegram"; WebApp context
  // injects these globals.
  if (/Telegram/i.test(ua) || g.TelegramWebviewProxy || g.Telegram?.WebView) {
    return "telegram";
  }

  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";

  // Generic Android WebView: "; wv)" appears in the UA of apps embedding a
  // WebView (the marker real Chrome/Firefox do not have).
  if (/; wv\)/i.test(ua)) return "other";

  return null;
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac; detect it via touch points.
  return /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Try to break out of an Android in-app WebView into the system default
 * browser using an Android intent URL. Telegram/Instagram/Facebook WebViews
 * honor intent:// and hand the URL off to the user's default browser.
 *
 * No `package=` is set, so Android opens the user's chosen default browser
 * (more reliable than hard-coding com.android.chrome, which may be absent).
 *
 * Returns true if a redirect was attempted (Android only). On iOS there is no
 * supported way to force an external browser from inside a WebView — the caller
 * should show manual instructions instead.
 */
export function openInExternalBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (!isAndroid()) return false;

  const url = new URL(window.location.href);
  // intent://host/path?query#Intent;scheme=https;end
  const intentUrl =
    `intent://${url.host}${url.pathname}${url.search}` +
    `#Intent;scheme=${url.protocol.replace(":", "")};end`;

  window.location.href = intentUrl;
  return true;
}
