"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import { useTranslation } from "../lib/i18n";

interface MediaControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  isCallActive: boolean;
  hideMyVideo?: boolean;
  onToggleHideMyVideo?: () => void;
  participantCount?: number;
  /** Provided only when more than one camera is available */
  onSwitchCamera?: () => void;
  /** Local playback of remote audio. true = audio audible. */
  isSpeakerEnabled?: boolean;
  onToggleSpeaker?: () => void;
}

export default function MediaControls({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  isCallActive,
  hideMyVideo = false,
  onToggleHideMyVideo,
  participantCount = 1,
  onSwitchCamera,
  isSpeakerEnabled = true,
  onToggleSpeaker,
}: MediaControlsProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", alignItems: "center", p: 2 }}>
      <Tooltip title={isAudioEnabled ? t("mic.on") : t("mic.off")}>
        <span>
          <IconButton
            onClick={onToggleAudio}
            disabled={!isCallActive}
            sx={{
              width: 56, height: 56,
              bgcolor: isAudioEnabled ? "primary.main" : "error.main",
              color: "white",
              "&:hover": { bgcolor: isAudioEnabled ? "primary.dark" : "error.dark" },
              "&.Mui-disabled": { bgcolor: "grey.700", color: "grey.500" },
            }}
          >
            {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={isVideoEnabled ? t("cam.on") : t("cam.off")}>
        <span>
          <IconButton
            onClick={onToggleVideo}
            disabled={!isCallActive}
            sx={{
              width: 56, height: 56,
              bgcolor: isVideoEnabled ? "primary.main" : "error.main",
              color: "white",
              "&:hover": { bgcolor: isVideoEnabled ? "primary.dark" : "error.dark" },
              "&.Mui-disabled": { bgcolor: "grey.700", color: "grey.500" },
            }}
          >
            {isVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
          </IconButton>
        </span>
      </Tooltip>

      {onToggleSpeaker && (
        <Tooltip title={isSpeakerEnabled ? t("speaker.on") : t("speaker.off")}>
          <span>
            <IconButton
              onClick={onToggleSpeaker}
              disabled={!isCallActive}
              sx={{
                width: 56, height: 56,
                bgcolor: isSpeakerEnabled ? "primary.main" : "error.main",
                color: "white",
                "&:hover": { bgcolor: isSpeakerEnabled ? "primary.dark" : "error.dark" },
                "&.Mui-disabled": { bgcolor: "grey.700", color: "grey.500" },
              }}
            >
              {isSpeakerEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
          </span>
        </Tooltip>
      )}

      {onSwitchCamera && (
        <Tooltip title={t("camera.switch")}>
          <span>
            <IconButton
              onClick={onSwitchCamera}
              disabled={!isCallActive || !isVideoEnabled}
              sx={{
                width: 56, height: 56,
                bgcolor: "grey.800",
                color: "white",
                "&:hover": { bgcolor: "grey.700" },
                "&.Mui-disabled": { bgcolor: "grey.700", color: "grey.500" },
              }}
            >
              <FlipCameraIosIcon />
            </IconButton>
          </span>
        </Tooltip>
      )}

      {participantCount > 1 && onToggleHideMyVideo && (
        <Tooltip title={hideMyVideo ? t("self.show") : t("self.hide")}>
          <span>
            <IconButton
              onClick={onToggleHideMyVideo}
              disabled={!isCallActive}
              sx={{
                width: 56, height: 56,
                bgcolor: hideMyVideo ? "grey.700" : "secondary.main",
                color: "white",
                "&:hover": { bgcolor: hideMyVideo ? "grey.600" : "secondary.dark" },
                "&.Mui-disabled": { bgcolor: "grey.700", color: "grey.500" },
              }}
            >
              {hideMyVideo ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </IconButton>
          </span>
        </Tooltip>
      )}

      <Tooltip title={t("call.end")}>
        <span>
          <IconButton
            onClick={onEndCall}
            disabled={!isCallActive}
            sx={{
              width: 56, height: 56,
              bgcolor: "error.main",
              color: "white",
              "&:hover": { bgcolor: "error.dark" },
              "&.Mui-disabled": { bgcolor: "grey.700", color: "grey.500" },
            }}
          >
            <CallEndIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
