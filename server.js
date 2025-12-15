import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json({ limit: "2mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "stockpilot.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultState = { items: [], moves: [] };

app.get("/api/state", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json(defaultState);
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json(data);
  } catch {
    res.status(500).json(defaultState);
  }
});

app.post("/api/state", (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), "utf8");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(3000, () =>
  console.log("StockPilot läuft auf http://localhost:3000")
);
