"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import VideocamIcon from "@mui/icons-material/Videocam";
import ChatIcon from "@mui/icons-material/Chat";
import LoginIcon from "@mui/icons-material/Login";
import AddIcon from "@mui/icons-material/Add";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import LangSwitcher from "./components/LangSwitcher";
import { useTranslation } from "./lib/i18n";

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const [videoLink, setVideoLink] = useState("");
  const [chatLink, setChatLink] = useState("");

  const extractRoomId = (input: string): string => {
    const match = input.match(/\/(?:call|chat)\/([a-f0-9-]+)/i);
    if (match) return match[1];
    if (/^[a-f0-9-]{36}$/i.test(input.trim())) return input.trim();
    return input.trim();
  };

  const handleCreateCall = () => {
    router.push(`/call/${crypto.randomUUID()}`);
  };
  const handleJoinCall = () => {
    if (!videoLink.trim()) return;
    router.push(`/call/${extractRoomId(videoLink)}`);
  };
  const handleCreateChat = () => {
    router.push(`/chat/${crypto.randomUUID()}`);
  };
  const handleJoinChat = () => {
    if (!chatLink.trim()) return;
    router.push(`/chat/${extractRoomId(chatLink)}`);
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <PhoneInTalkIcon sx={{ mr: 1.5, color: "primary.main" }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.main", flexGrow: 1 }}>
            CallMe
          </Typography>
          <LangSwitcher />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ color: "white", mb: 1 }}>
          {t("home.title")}
        </Typography>
        <Typography variant="body1" align="center" sx={{ color: "grey.400", mb: 6 }}>
          {t("home.subtitle")}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
          {/* Video Card */}
          <Card sx={{ flex: 1, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
            <CardContent sx={{ p: 4, display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                <VideocamIcon sx={{ fontSize: 36, color: "primary.main" }} />
                <Typography variant="h5" sx={{ color: "white" }}>{t("home.video.title")}</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: "grey.400" }}>{t("home.video.desc")}</Typography>

              <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={handleCreateCall} fullWidth sx={{ py: 1.5 }}>
                {t("home.video.create")}
              </Button>

              <Divider sx={{ borderColor: "divider" }}>
                <Typography variant="caption" sx={{ color: "grey.500" }}>{t("home.or")}</Typography>
              </Divider>

              <TextField
                placeholder={t("home.video.placeholder")}
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinCall()}
                fullWidth
                slotProps={{ input: { endAdornment: (<InputAdornment position="end"><IconButton onClick={handleJoinCall} disabled={!videoLink.trim()} color="primary"><LoginIcon /></IconButton></InputAdornment>) } }}
              />
            </CardContent>
          </Card>

          {/* Chat Card */}
          <Card sx={{ flex: 1, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
            <CardContent sx={{ p: 4, display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                <ChatIcon sx={{ fontSize: 36, color: "secondary.main" }} />
                <Typography variant="h5" sx={{ color: "white" }}>{t("home.chat.title")}</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: "grey.400" }}>{t("home.chat.desc")}</Typography>

              <Button variant="contained" color="secondary" size="large" startIcon={<AddIcon />} onClick={handleCreateChat} fullWidth sx={{ py: 1.5 }}>
                {t("home.chat.create")}
              </Button>

              <Divider sx={{ borderColor: "divider" }}>
                <Typography variant="caption" sx={{ color: "grey.500" }}>{t("home.or")}</Typography>
              </Divider>

              <TextField
                placeholder={t("home.chat.placeholder")}
                value={chatLink}
                onChange={(e) => setChatLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinChat()}
                fullWidth
                slotProps={{ input: { endAdornment: (<InputAdornment position="end"><IconButton onClick={handleJoinChat} disabled={!chatLink.trim()} color="secondary"><LoginIcon /></IconButton></InputAdornment>) } }}
              />
            </CardContent>
          </Card>
        </Box>

        <Typography variant="body2" align="center" sx={{ color: "grey.600", mt: 6 }}>
          CallMe &copy; {new Date().getFullYear()} &mdash; WebRTC P2P
        </Typography>
      </Container>
    </Box>
  );
}
