"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "../lib/i18n";

interface ShareLinkButtonProps {
  size?: "small" | "medium" | "large";
  variant?: "text" | "outlined" | "contained";
  color?: "primary" | "secondary" | "inherit";
}

export default function ShareLinkButton({
  size = "small",
  variant = "outlined",
  color = "primary",
}: ShareLinkButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = window.location.href;

    // 1) On mobile (iOS Safari, Android Chrome), prefer the native share sheet —
    //    it always works and is the expected UX. navigator.clipboard often
    //    fails silently inside non-focused contexts on iOS.
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: document.title, url });
        return;
      } catch (err) {
        // User cancelled the share sheet — don't fall through to clipboard
        if ((err as Error).name === "AbortError") return;
        // Other errors → fall through to clipboard
      }
    }

    // 2) Modern Clipboard API (works on desktop browsers over HTTPS)
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      return;
    } catch {
      // fall through to legacy fallback
    }

    // 3) Legacy fallback for browsers without Clipboard API
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
      if (ok) {
        setCopied(true);
        return;
      }
    } catch {
      // fall through to prompt
    }

    // 4) Last resort: show the URL so the user can long-press to copy
    window.prompt(t("share.copy"), url);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        color={color}
        startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
        onClick={handleCopy}
      >
        {copied ? t("share.copied") : t("share.copy")}
      </Button>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message={t("share.snackbar")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
