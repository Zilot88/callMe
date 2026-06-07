"use client";

import dynamic from "next/dynamic";
import { use, useEffect, useState } from "react";
import VideoCallErrorBoundary from "../../components/ErrorBoundary";
import InAppBrowserGate from "../../components/InAppBrowserGate";
import { reportDiagnostic } from "../../lib/diagnostics";
import { useTranslation } from "../../lib/i18n";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

function LoadingScreen() {
  const { t } = useTranslation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
      reportDiagnostic({
        eventType: "loading_timeout",
        details: "JS chunk did not load within 15 seconds",
      });
    }, 15_000);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
        <Box sx={{ textAlign: "center", maxWidth: 400, p: 4 }}>
          <Typography variant="h2" sx={{ mb: 2 }}>&#x23F3;</Typography>
          <Typography variant="h6" gutterBottom>{t("loading.timeout")}</Typography>
          <Typography variant="body2" sx={{ color: "grey.400", mb: 3 }}>
            {t("loading.timeout_hint")}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()} fullWidth sx={{ mb: 1 }}>
            {t("loading.reload")}
          </Button>
          <Button href="/" variant="text" size="small">{t("nav.home")}</Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      <Box sx={{ textAlign: "center" }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography sx={{ color: "grey.400" }}>{t("loading")}</Typography>
      </Box>
    </Box>
  );
}

const VideoCall = dynamic(() => import("../../components/VideoCall"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function CallPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);

  return (
    <VideoCallErrorBoundary>
      <InAppBrowserGate />
      <VideoCall roomId={roomId} />
    </VideoCallErrorBoundary>
  );
}
