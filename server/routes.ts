import type { Express } from "express";
import { createServer, type Server } from "http";
import { chatRequestSchema, type AIResponse, type Message } from "@shared/schema";
import fs from "fs";
import path from "path";
import multer from "multer";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

const upload = multer({ storage: multer.memoryStorage() });

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error("ASSEMBLYAI_API_KEY is not configured");
  }

  const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      authorization: ASSEMBLYAI_API_KEY,
      "Content-Type": "application/octet-stream",
    },
    body: audioBuffer,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload audio to AssemblyAI");
  }

  const { upload_url } = await uploadResponse.json() as { upload_url: string };

  const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: upload_url,
      language_code: "ru",
    }),
  });

  if (!transcriptResponse.ok) {
    throw new Error("Failed to start transcription");
  }

  const { id } = await transcriptResponse.json() as { id: string };

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY },
    });

    const result = await pollingResponse.json() as { status: string; text: string; error?: string };

    if (result.status === "completed") {
      return result.text;
    } else if (result.status === "error") {
      throw new Error(result.error || "Transcription failed");
    }
  }
}

function getKnowledgeBase(): string {
  try {
    const filePath = path.join(process.cwd(), "server", "knowledge-base.md");
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function buildSystemPrompt(knowledgeBase: string): string {
  return `Ты — Mira, первый AI-рекрутер в России от компании AIR. Ты общаешься с потенциальными клиентами на сайте AIR Mira.

ТВОЯ РОЛЬ:
- Ты представляешь продукт AIR Mira — AI-рекрутер, который автоматизирует найм персонала
- Ты работаешь 24/7, анализируешь 10 000 резюме в день, в 5 раз дешевле обычного рекрутера
- Ты умеешь: искать кандидатов, звонить им, проводить первичные собеседования, оценивать навыки

СТИЛЬ ОБЩЕНИЯ:
- Общайся дружелюбно, профессионально и по делу
- Используй "ты" форму обращения
- Отвечай на русском языке
- Будь конкретной и полезной
- Не затягивай ответы — будь лаконичной

ФОРМАТ ОТВЕТА:
Ты ВСЕГДА отвечаешь в JSON формате:
{
  "message": "текст твоего ответа для чата",
  "html": "HTML код для правой части экрана" или null
}

ПРАВИЛА ДЛЯ HTML:
- Генерируй html ТОЛЬКО когда это добавляет ценность к разговору
- Используй html для: таблиц тарифов, сравнительных таблиц, карточек функций, калькуляторов ROI, схем процессов, FAQ блоков
- Если обновлять правую часть не нужно — ставь html: null
- HTML должен использовать классы из дизайн-системы:
  - Сетки: grid-2, grid-3, grid-4
  - Карточки: card, pricing-card, feature-card (добавляй class="card hover" для интерактивности)
  - Метрики: metric, metric-value, metric-label
  - Кнопки: cta-button, cta-button-secondary
  - Процессы: process-step, step-number, step-content, step-title, step-description
  - FAQ: faq-item (добавляй class="faq-item hover" для интерактивности), faq-question, faq-answer
  - Тарифы: pricing-card, featured, pricing-price, pricing-period, feature-list, feature-item
  - Выделение: highlight, badge, tag
- ВСЕ карточки и интерактивные элементы ДОЛЖНЫ иметь hover эффекты — добавляй класс "hover" к card, pricing-card, faq-item

ПРИМЕРЫ HTML:

Таблица тарифов:
<h2>Тарифы AIR Mira</h2>
<div class="grid-3">
  <div class="pricing-card hover">
    <h3>Старт</h3>
    <div class="pricing-price">25 000 ₽</div>
    <div class="pricing-period">в месяц</div>
    <div class="feature-list">
      <div class="feature-item">До 50 вакансий</div>
      <div class="feature-item">Базовая аналитика</div>
    </div>
  </div>
  <div class="pricing-card featured hover">
    <h3>Бизнес</h3>
    <div class="pricing-price">75 000 ₽</div>
    <div class="pricing-period">в месяц</div>
    <div class="feature-list">
      <div class="feature-item">До 200 вакансий</div>
      <div class="feature-item">Полная аналитика</div>
      <div class="feature-item">Приоритетная поддержка</div>
    </div>
  </div>
</div>

Метрики:
<div class="grid-2">
  <div class="metric hover">
    <div class="metric-value">87%</div>
    <div class="metric-label">Экономия времени HR</div>
  </div>
  <div class="metric hover">
    <div class="metric-value">3 дня</div>
    <div class="metric-label">Среднее время найма</div>
  </div>
</div>

Процесс:
<h2>Как работает Mira</h2>
<div class="process-step hover">
  <div class="step-number">1</div>
  <div class="step-content">
    <div class="step-title">Загрузи вакансию</div>
    <div class="step-description">Опиши требования к кандидату</div>
  </div>
</div>

${knowledgeBase ? `\nБАЗА ЗНАНИЙ О ПРОДУКТЕ:\n${knowledgeBase}` : ""}

ВАЖНО: Отвечай ТОЛЬКО валидным JSON. Никакого текста до или после JSON.`;
}

async function callOpenRouter(messages: Message[], systemPrompt: string): Promise<AIResponse> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://air-mira.replit.app",
      "X-Title": "AIR Mira",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      messages: formattedMessages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter error:", errorText);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from AI");
  }

  try {
    const parsed = JSON.parse(content) as AIResponse;
    return {
      message: parsed.message || "Извините, не могу ответить сейчас.",
      html: parsed.html || null,
    };
  } catch {
    return {
      message: content,
      html: null,
    };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const knowledgeBase = getKnowledgeBase();
  const systemPrompt = buildSystemPrompt(knowledgeBase);

  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      if (!ASSEMBLYAI_API_KEY) {
        return res.status(500).json({
          error: "ASSEMBLYAI_API_KEY не настроен. Добавьте ключ в переменные окружения.",
        });
      }

      const text = await transcribeAudio(req.file.buffer);
      return res.json({ text });
    } catch (error) {
      console.error("Transcription error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Transcription failed",
      });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid request format",
        });
      }

      const { messages } = parsed.data;

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({
          success: false,
          error: "API ключ не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения.",
        });
      }

      const aiResponse = await callOpenRouter(messages, systemPrompt);

      return res.json(aiResponse);
    } catch (error) {
      console.error("Chat error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  return httpServer;
}
