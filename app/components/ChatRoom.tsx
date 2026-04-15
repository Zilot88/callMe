"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import SendIcon from "@mui/icons-material/Send";
import ChatIcon from "@mui/icons-material/Chat";
import PeopleIcon from "@mui/icons-material/People";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShareLinkButton from "./ShareLinkButton";
import NicknameDialog from "./NicknameDialog";

interface ChatMessage {
  id: string;
  from: string;
  nickname: string;
  message: string;
  timestamp: number;
  type: "user" | "system";
}

interface ChatRoomProps {
  roomId: string;
}

export default function ChatRoom({ roomId }: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [nickname, setNickname] = useState("");
  const [showNicknameDialog, setShowNicknameDialog] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mySocketIdRef = useRef<string>("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        from: "system",
        nickname: "",
        message: text,
        timestamp: Date.now(),
        type: "system",
      },
    ]);
  }, []);

  const connectToChat = useCallback(
    (nick: string) => {
      const socket = io({
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        mySocketIdRef.current = socket.id ?? "";
        setConnected(true);
        socket.emit("join-room", { roomId, type: "chat", nickname: nick });
      });

      socket.on("disconnect", () => {
        setConnected(false);
      });

      socket.on("participant-count", (count: number) => {
        setParticipantCount(count);
      });

      socket.on("chat-message", (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      });

      socket.on("chat-user-joined", ({ nickname: joinedNick }: { id: string; nickname: string }) => {
        addSystemMessage(`${joinedNick} присоединился к чату`);
      });

      socket.on("chat-user-left", ({ nickname: leftNick }: { id: string; nickname: string }) => {
        if (leftNick) {
          addSystemMessage(`${leftNick} покинул чат`);
        }
      });

      return () => {
        socket.emit("leave-room", roomId);
        socket.disconnect();
      };
    },
    [roomId, addSystemMessage],
  );

  const handleNicknameSubmit = (nick: string) => {
    setNickname(nick);
    setShowNicknameDialog(false);
    addSystemMessage(`Вы вошли как ${nick}`);
    connectToChat(nick);
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-room", roomId);
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);

  const sendMessage = () => {
    const text = inputValue.trim();
    if (!text || !socketRef.current?.connected) return;

    const msg: ChatMessage = {
      id: `${mySocketIdRef.current}-${Date.now()}`,
      from: mySocketIdRef.current,
      nickname,
      message: text,
      timestamp: Date.now(),
      type: "user",
    };

    // Add to own messages immediately
    setMessages((prev) => [...prev, msg]);

    // Send to others via server
    socketRef.current.emit("chat-message", {
      roomId,
      message: text,
      nickname,
    });

    setInputValue("");
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <NicknameDialog open={showNicknameDialog} onSubmit={handleNicknameSubmit} />

      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton href="/" color="inherit" size="small">
            <ArrowBackIcon />
          </IconButton>
          <ChatIcon sx={{ color: "secondary.main" }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, color: "white" }}>
            Чат
          </Typography>
          <Chip
            icon={<PeopleIcon />}
            label={participantCount}
            size="small"
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <ShareLinkButton color="secondary" />
          {!connected && (
            <Chip label="Нет связи" color="error" size="small" />
          )}
        </Toolbar>
      </AppBar>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 1 }}>
        {messages.map((msg) =>
          msg.type === "system" ? (
            <Box key={msg.id} sx={{ textAlign: "center", my: 1 }}>
              <Typography variant="caption" sx={{ color: "grey.500", fontStyle: "italic" }}>
                {msg.message}
              </Typography>
            </Box>
          ) : (
            <Box
              key={msg.id}
              sx={{
                display: "flex",
                justifyContent: msg.from === mySocketIdRef.current ? "flex-end" : "flex-start",
                mb: 1,
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1,
                  maxWidth: "75%",
                  borderRadius: 2,
                  bgcolor: msg.from === mySocketIdRef.current ? "primary.dark" : "grey.800",
                }}
              >
                {msg.from !== mySocketIdRef.current && (
                  <Typography variant="caption" sx={{ color: "secondary.light", fontWeight: 600 }}>
                    {msg.nickname}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ color: "white", wordBreak: "break-word" }}>
                  {msg.message}
                </Typography>
                <Typography variant="caption" sx={{ color: "grey.500", display: "block", textAlign: "right", mt: 0.5 }}>
                  {formatTime(msg.timestamp)}
                </Typography>
              </Paper>
            </Box>
          ),
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: "background.paper",
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          gap: 1,
        }}
      >
        <TextField
          fullWidth
          placeholder={showNicknameDialog ? "Введите имя..." : "Сообщение..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
          disabled={showNicknameDialog || !connected}
          size="small"
          autoComplete="off"
        />
        <IconButton
          color="secondary"
          onClick={sendMessage}
          disabled={!inputValue.trim() || showNicknameDialog || !connected}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
