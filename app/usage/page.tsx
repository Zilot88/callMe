"use client";

import { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

interface Usage {
  quotaInGB: number;
  usageInGB: number;
  overageInGB: number;
  percent: number;
  remainingGB: number;
  error?: string;
  message?: string;
}

export default function UsagePage() {
  const [data, setData] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/turn-usage", { cache: "no-store" });
      const json = (await res.json()) as Usage;
      if (json.error) {
        setErr(json.message || json.error);
        setData(null);
      } else {
        setData(json);
        setErr(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(id);
  }, [load]);

  // Color the bar: green < 70%, amber 70–90%, red > 90%
  const barColor = (p: number): "success" | "warning" | "error" =>
    p > 90 ? "error" : p >= 70 ? "warning" : "success";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
      <Box sx={{ width: "100%", maxWidth: 520 }}>
        <Typography variant="h5" sx={{ color: "#fff", mb: 0.5 }}>
          TURN-трафик (Metered)
        </Typography>
        <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>
          Расход relay за текущий месяц. При 100% звонки через relay
          остановятся до сброса квоты — деньги не списываются.
        </Typography>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : err ? (
          <Box sx={{ bgcolor: "rgba(244,67,54,0.1)", border: 1, borderColor: "error.main", borderRadius: 2, p: 2 }}>
            <Typography sx={{ color: "error.main", fontWeight: 600, mb: 1 }}>Не удалось получить статистику</Typography>
            <Typography variant="body2" sx={{ color: "grey.400", mb: 1 }}>{err}</Typography>
            <Typography variant="caption" sx={{ color: "grey.600" }}>
              Проверь, что в окружении задан METERED_SECRET_KEY (или METERED_API_KEY).
              secretKey берётся в Metered → Developers.
            </Typography>
          </Box>
        ) : data ? (
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
              <Typography variant="h3" sx={{ color: "#fff" }}>
                {data.usageInGB.toFixed(2)} <Typography component="span" variant="h6" sx={{ color: "grey.500" }}>/ {data.quotaInGB} ГБ</Typography>
              </Typography>
              <Typography variant="h6" sx={{ color: barColor(data.percent) === "error" ? "error.main" : barColor(data.percent) === "warning" ? "warning.main" : "success.main" }}>
                {data.percent.toFixed(0)}%
              </Typography>
            </Box>

            <LinearProgress
              variant="determinate"
              value={data.percent}
              color={barColor(data.percent)}
              sx={{ height: 14, borderRadius: 7, bgcolor: "grey.800" }}
            />

            <Typography sx={{ color: "grey.400", mt: 2 }}>
              Осталось: <strong style={{ color: "#fff" }}>{data.remainingGB.toFixed(2)} ГБ</strong>
            </Typography>

            {data.overageInGB > 0 && (
              <Typography sx={{ color: "error.main", mt: 1 }}>
                Перерасход: {data.overageInGB.toFixed(2)} ГБ
              </Typography>
            )}

            {data.percent >= 90 && (
              <Box sx={{ bgcolor: "rgba(255,152,0,0.12)", border: 1, borderColor: "warning.main", borderRadius: 2, p: 2, mt: 2 }}>
                <Typography variant="body2" sx={{ color: "warning.main" }}>
                  ⚠️ Квота почти исчерпана. Скоро relay-звонки перестанут проходить
                  через TURN до сброса квоты в начале месяца.
                </Typography>
              </Box>
            )}
          </Box>
        ) : null}

        <Box sx={{ display: "flex", gap: 1, mt: 4 }}>
          <Button variant="outlined" onClick={() => { setLoading(true); load(); }}>
            Обновить
          </Button>
          <Button href="/" variant="text" sx={{ color: "grey.500" }}>
            На главную
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
