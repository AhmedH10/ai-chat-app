import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../client")));

const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN,
});

let history = [];

app.post("/api/chat-stream", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  res.setHeader("Content-Type", "application/json");

  try {
    const stream = await client.chat.completions.create({
      model: "openai/gpt-oss-120b:fastest",
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let collected = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        collected += delta;
        // Send as partial JSON object per chunk
        res.write(JSON.stringify({ delta }) + "\n");
      }
    }

    // Save final response to history
    history.push({ prompt, reply: collected });

    // Indicate end
    res.write(JSON.stringify({ done: true }) + "\n");
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Streaming failed" });
  }
});

app.get("/api/history", (req, res) => res.json(history));
app.delete("/api/history", (req, res) => {
  history = [];
  res.json({ message: "History cleared" });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../client/index.html")));

app.listen(3000, () => console.log("Server running at http://localhost:3000"));
