"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "../lib/i18n";
import type { QualityLevel, VideoQualityPreset } from "../lib/webrtc-types";

const LEVEL_HEX: Record<QualityLevel, string> = {
  excellent: "#4caf50",
  good: "#66bb6a",
  degraded: "#ffca28",
  poor: "#ff9800",
  critical: "#f44336",
};

const PRESET_LABELS: Record<VideoQualityPreset, string> = {
  high: "720p",
  medium: "480p",
  low: "360p",
  minimal: "240p",
  "audio-only": "audio-only",
};

interface QualityIndicatorProps {
  level: QualityLevel;
  preset?: VideoQualityPreset;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export default function QualityIndicator({
  level,
  preset,
  showLabel = false,
  size = "md",
}: QualityIndicatorProps) {
  const { t } = useTranslation();
  const color = LEVEL_HEX[level];
  const dotSize = size === "sm" ? 8 : 12;
  const levelLabel = t(`quality.${level}` as any);
  const presetLabel = preset === 'audio-only' ? t("quality.audio_only") : PRESET_LABELS[preset!];

  return (
    <Tooltip title={`${levelLabel}${preset ? ` (${presetLabel})` : ""}`}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box
          sx={{
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            bgcolor: color,
            ...(level === "critical" && {
              animation: "pulse 1.5s infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.4 },
              },
            }),
          }}
        />
        {showLabel && (
          <Typography variant="caption" sx={{ color: "grey.400" }}>
            {preset ? presetLabel : levelLabel}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

// For DOM-based quality dots on remote videos
export function getQualityDotColor(level: QualityLevel): string {
  return LEVEL_HEX[level];
}

// Keep for backward compat — now unused in favor of inline styles
export function getQualityDotClass(level: QualityLevel): string {
  return "";
}
