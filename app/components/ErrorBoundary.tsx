"use client";

import React from "react";
import { reportDiagnostic } from "../lib/diagnostics";
import { translations } from "../lib/translations";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ErrorOutline from "@mui/icons-material/ErrorOutlineOutlined";
import Refresh from "@mui/icons-material/Refresh";
import Report from "@mui/icons-material/Report";
import Home from "@mui/icons-material/Home";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class VideoCallErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  private t(key: keyof typeof translations): string {
    let locale: "en" | "ru" = "en";
    try { const saved = localStorage.getItem("callme-locale"); if (saved === "en" || saved === "ru") locale = saved; } catch {}
    return translations[key]?.[locale] ?? translations[key]?.en ?? key;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportDiagnostic({
      eventType: "component_crash",
      details: `${error.name}: ${error.message}`,
      error: info.componentStack || undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReport = () => {
    const { error } = this.state;
    reportDiagnostic({
      eventType: "component_crash",
      details: `User-reported: ${error?.name}: ${error?.message}`,
      error: error?.stack || undefined,
    });
    alert("Report sent.");
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default", p: 2 }}>
          <Paper elevation={4} sx={{ maxWidth: 420, width: "100%", p: 4, textAlign: "center" }}>
            <ErrorOutline sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              {this.t("error.title")}
            </Typography>
            <Typography variant="body2" sx={{ color: "grey.400", mb: 3, wordBreak: "break-word" }}>
              {this.state.error?.message || this.t("error.unknown")}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Button variant="contained" startIcon={<Refresh />} onClick={this.handleRetry} fullWidth>
                {this.t("error.retry")}
              </Button>
              <Button variant="outlined" startIcon={<Report />} onClick={this.handleReport} fullWidth color="secondary">
                {this.t("error.report")}
              </Button>
              <Button href="/" startIcon={<Home />} size="small">
                {this.t("nav.home")}
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}
