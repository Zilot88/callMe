"use client";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import { useTranslation } from "../lib/i18n";

export default function LangSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <Box sx={{ display: "flex", gap: 0.25 }}>
      <Tooltip title="English">
        <IconButton
          size="small"
          onClick={() => setLocale("en")}
          sx={{
            fontSize: 20,
            opacity: locale === "en" ? 1 : 0.4,
            transition: "opacity 0.2s",
            "&:hover": { opacity: 1 },
          }}
        >
          <span role="img" aria-label="English">&#x1F1EC;&#x1F1E7;</span>
        </IconButton>
      </Tooltip>
      <Tooltip title="Русский">
        <IconButton
          size="small"
          onClick={() => setLocale("ru")}
          sx={{
            fontSize: 20,
            opacity: locale === "ru" ? 1 : 0.4,
            transition: "opacity 0.2s",
            "&:hover": { opacity: 1 },
          }}
        >
          <span role="img" aria-label="Русский">&#x1F1F7;&#x1F1FA;</span>
        </IconButton>
      </Tooltip>
    </Box>
  );
}
