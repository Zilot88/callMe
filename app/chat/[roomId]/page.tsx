"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

const ChatRoom = dynamic(() => import("../../components/ChatRoom"), {
  ssr: false,
  loading: () => (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      <Box sx={{ textAlign: "center" }}>
        <CircularProgress color="secondary" sx={{ mb: 2 }} />
        <Typography sx={{ color: "grey.400" }}>Loading chat...</Typography>
      </Box>
    </Box>
  ),
});

export default function ChatPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);

  return <ChatRoom roomId={roomId} />;
}
