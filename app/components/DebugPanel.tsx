"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import { useTranslation } from "../lib/i18n";

interface DebugPanelProps {
  logs: string[];
  isOpen: boolean;
  onToggle: () => void;
}

export default function DebugPanel({ logs, isOpen, onToggle }: DebugPanelProps) {
  const { t } = useTranslation();
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join("\n"));
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webrtc-debug-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const getLogColor = (log: string) => {
    if (log.includes("\u274C")) return "error.light";
    if (log.includes("\u2705")) return "success.light";
    if (log.includes("\u{1F9CA}")) return "info.light";
    if (log.includes("\u{1F4E5}") || log.includes("\u{1F4E8}")) return "warning.light";
    if (log.includes("\u{1F527}") || log.includes("\u{1F517}")) return "secondary.light";
    if (log.includes("\u{1F465}") || log.includes("\u{1F464}")) return "info.main";
    return "grey.300";
  };

  return (
    <Box sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 50 }}>
      <Paper
        elevation={8}
        sx={{
          width: 600,
          maxHeight: 500,
          display: "flex",
          flexDirection: "column",
          bgcolor: "grey.900",
          border: 1,
          borderColor: "grey.700",
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: 1, borderColor: "grey.700" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "white" }}>
            WebRTC Debug
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyLogs} sx={{ color: "grey.300", minWidth: 0 }}>
              Copy
            </Button>
            <Button size="small" startIcon={<DownloadIcon />} onClick={downloadLogs} sx={{ color: "grey.300", minWidth: 0 }}>
              Save
            </Button>
            <IconButton size="small" onClick={onToggle} sx={{ color: "grey.400" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Logs */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2, fontFamily: "monospace", fontSize: 11 }}>
          {logs.length === 0 ? (
            <Typography variant="body2" sx={{ color: "grey.500", textAlign: "center", py: 4 }}>
              {t("debug.empty")}
            </Typography>
          ) : (
            logs.map((log, index) => (
              <Typography key={index} variant="body2" sx={{ color: getLogColor(log), fontSize: 11, fontFamily: "monospace", lineHeight: 1.6 }}>
                {log}
              </Typography>
            ))
          )}
          <div ref={logsEndRef} />
        </Box>

        {/* Footer */}
        <Box sx={{ display: "flex", justifyContent: "space-between", px: 2, py: 1, borderTop: 1, borderColor: "grey.700" }}>
          <Typography variant="caption" sx={{ color: "grey.500" }}>
            Events: {logs.length}
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.500" }}>
            {logs.length > 0 ? logs[logs.length - 1].match(/\[(.*?)\]/)?.[1] || "" : ""}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
