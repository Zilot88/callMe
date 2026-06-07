"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  detectInAppBrowser,
  isAndroid,
  isIOS,
  openInExternalBrowser,
  type InAppBrowser,
} from "../lib/in-app-browser";
import { reportDiagnostic } from "../lib/diagnostics";
import { useTranslation } from "../lib/i18n";

/**
 * Blocks the call UI with an overlay when the page is opened inside an in-app
 * browser (Telegram, Instagram, Facebook, ...), where WebRTC camera/mic access
 * is blocked. Offers a one-tap escape to the system browser on Android, and
 * manual instructions + copy-link on iOS (which has no programmatic escape).
 *
 * Renders nothing in a normal standalone browser.
 */
export default function InAppBrowserGate() {
  const { t } = useTranslation();
  const [browser, setBrowser] = useState<InAppBrowser>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect the runtime browser once on mount. Must run client-side (needs
  // navigator) and after hydration to avoid SSR mismatch — an effect is the
  // correct place despite the synchronous setState.
  useEffect(() => {
    const detected = detectInAppBrowser();
    if (detected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBrowser(detected);
      reportDiagnostic({
        eventType: "inapp_browser_detected",
        details: `${detected} (${navigator.userAgent})`,
      });
    }
  }, []);

  if (!browser || dismissed) return null;

  const handleOpen = () => {
    reportDiagnostic({ eventType: "inapp_open_external", details: browser });
    // Android: hand off to the system default browser via intent://
    if (openInExternalBrowser()) return;
    // iOS (or anything else): no programmatic escape — fall back to copying
    // the link so the user can paste it into Safari/Chrome.
    handleCopy();
  };

  const handleCopy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      return;
    } catch { /* fall through */ }
    try {
      const input = document.createElement("input");
      input.value = url;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, url.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      if (ok) { setCopied(true); return; }
    } catch { /* fall through */ }
    window.prompt(t("inapp.copy"), url);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        bgcolor: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Box sx={{ textAlign: "center", maxWidth: 420 }}>
        <Typography variant="h2" sx={{ mb: 2 }}>🌐</Typography>
        <Typography variant="h6" gutterBottom sx={{ color: "#fff" }}>
          {t("inapp.title")}
        </Typography>
        <Typography variant="body2" sx={{ color: "grey.400", mb: 3 }}>
          {t("inapp.desc")}
        </Typography>

        {isAndroid() && (
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpen}
            sx={{ mb: 2 }}
          >
            {t("inapp.open")}
          </Button>
        )}

        {isIOS() && (
          <Typography
            variant="body2"
            sx={{
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.08)",
              borderRadius: 2,
              p: 2,
              mb: 2,
            }}
          >
            {t("inapp.ios_hint")}
          </Typography>
        )}

        <Button
          variant="outlined"
          fullWidth
          startIcon={<ContentCopyIcon />}
          onClick={handleCopy}
          sx={{ mb: 1, color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}
        >
          {copied ? t("inapp.copied") : t("inapp.copy")}
        </Button>

        <Button
          variant="text"
          size="small"
          onClick={() => setDismissed(true)}
          sx={{ color: "grey.500" }}
        >
          {t("inapp.continue")}
        </Button>
      </Box>
    </Box>
  );
}
