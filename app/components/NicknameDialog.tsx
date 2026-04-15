"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import PersonIcon from "@mui/icons-material/Person";
import InputAdornment from "@mui/material/InputAdornment";

interface NicknameDialogProps {
  open: boolean;
  onSubmit: (nickname: string) => void;
}

export default function NicknameDialog({ open, onSubmit }: NicknameDialogProps) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    const nickname = name.trim() || `User-${Math.random().toString(36).substring(2, 6)}`;
    onSubmit(nickname);
  };

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>Как вас зовут?</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          placeholder="Введите имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          sx={{ mt: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={handleSubmit} fullWidth>
          Войти в чат
        </Button>
      </DialogActions>
    </Dialog>
  );
}
