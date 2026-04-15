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
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
    }
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
