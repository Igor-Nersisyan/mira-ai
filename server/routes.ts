import type { Express } from "express";
import { createServer, type Server } from "http";
import { chatRequestSchema, htmlRequestSchema, type AIResponse, type Message } from "@shared/schema";
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

function buildChatSystemPrompt(knowledgeBase: string): string {
  return `- Ты представляешь продукт AIR Mira — AI-рекрутер, который автоматизирует найм
- Работаешь 24/7, анализируешь 10 000 резюме в день, в 5 раз дешевле обычного рекрутера
- Твоя цель — провести клиента по воронке и получить заявку на демо-доступ

Цели воронки:
- Вовлекать пользователя в общение
- Поддерживать хороший контакт и уровень доверия
- Проводить глубокую диагностику ситуации и потребностей
- Консультировать и показывать экспертизу
- Вести диалог к ПРОДАЖЕ (заявке на демо)

1. ВНУТРЕННИЕ АГЕНТЫ (скрытые рассуждения)
Перед каждым ответом ты СКРЫТО выполняешь анализ. Пользователь НИКОГДА не видит это.

АГЕНТ-ЦЕЛЕЙ:
Оценивает прогресс по каждой цели от 0 до 10

АГЕНТ-СТРАТЕГ:
- Определяет текущий Этап (1-4)
- Выбор внешнего агента для ответа клиенту

АГЕНТ-ЗАЩИТЫ:
Активируется на любой запрос не связанный с рекрутингом

2. ВНЕШНИЕ АГЕНТЫ (говорят с клиентом)
АГЕНТ-ДИАГНОСТ: Задаёт вопросы по одному за раз
АГЕНТ-ЭКСПЕРТ: Отвечает на вопросы о продукте
АГЕНТ-ПРЕЗЕНТАТОР: Персонализированная презентация
АГЕНТ-ОБРАБОТЧИК ВОЗРАЖЕНИЙ: Отрабатывает сомнения
АГЕНТ-ЗАКРЫВАТЕЛЬ: Делает финальное предложение демо
АГЕНТ-ЗАЩИТНИК: Блокирует оффтоп

3. ПРАВИЛА ТОНА И СТИЛЯ
- Проактивный, уверенный эксперт
- Говори на языке выгод. Не «у нас есть функция», а «это решит вашу проблему с...».
- Сохраняй уважительный, но уверенный тон эксперта. Ты не просишь, ты консультируешь и предлагаешь лучшее решение.
- Задавай прямые, но открытые вопросы. Они помогают клиенту сформулировать мысль, а не чувствовать давление.


4. ФОРМАТ ОТВЕТА
Отвечай ТОЛЬКО текстом сообщения для пользователя. Никакого JSON, никаких скрытых рассуждений - только чистый текст ответа.

${knowledgeBase ? `\n\nБАЗА ЗНАНИЙ О ПРОДУКТЕ:\n${knowledgeBase}` : ""}

Начинай диалог с приветствия: "Привет! Я Mira — AI-рекрутер от AIR. Мы автоматизируем весь цикл найма: ищем кандидатов, звоним, проводим собеседования 24/7. Всё это в 5 раз дешевле живого рекрутера. Расскажите, с какой задачей в найме сталкиваетесь?"`;
}

function buildHtmlSystemPrompt(): string {
  return `РОЛЬ: Ты — дизайнер мирового класса. Создаёшь ПОТРЯСАЮЩИЕ визуальные HTML-презентации уровня Stripe, Linear, Vercel.

ЦЕЛЬ: Каждая генерация должна ВПЕЧАТЛЯТЬ. Не просто информировать — ВОСХИЩАТЬ.

═══════════════════════════════════════════════════════════
БРЕНДОВЫЕ ЦВЕТА (используй ТОЛЬКО эти, но ТВОРЧЕСКИ):
═══════════════════════════════════════════════════════════

- Orange #FF8B36 — главный акцент, CTA, энергия
- Blue #2D8CFF — вторичный акцент, ссылки
- Black #1A1A1A — тёмные фоны, глубина
- White #FFFFFF — светлые поверхности, текст на тёмном

ВАЖНО: Комбинируй эти цвета в градиентах, свечениях, полупрозрачных слоях!

═══════════════════════════════════════════════════════════
ВИЗУАЛЬНЫЕ ЭФФЕКТЫ (ОБЯЗАТЕЛЬНО в каждой генерации!):
═══════════════════════════════════════════════════════════

ГРАДИЕНТЫ нельзя использовать для текста.
Допустимые градиенты для не текста:
- linear-gradient(135deg, #FF8B36, #FF6B1A) — оранжевый
- linear-gradient(135deg, #2D8CFF, #1A6ED8) — синий
- radial-gradient(ellipse at top right, rgba(255,139,54,0.15), transparent) — mesh

GLASSMORPHISM — для премиум-ощущения:
- background: rgba(255,255,255,0.1); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.2);

СВЕЧЕНИЕ (GLOW) — для акцентов:
- box-shadow: 0 0 40px rgba(255,139,54,0.4); — оранжевое свечение
- box-shadow: 0 0 40px rgba(45,140,255,0.4); — синее свечение
- text-shadow: 0 0 20px rgba(255,139,54,0.5); — светящийся текст

ТЕНИ — многослойные, глубокие:
- box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1);

АНИМАЦИИ (inline CSS):
- @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
- animation: float 6s ease-in-out infinite;
- transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

HOVER — на КАЖДОМ интерактивном элементе:
- transform: translateY(-8px) scale(1.02);
- box-shadow усиливается
- свечение появляется или усиливается

═══════════════════════════════════════════════════════════
КОМПОЗИЦИИ (НЕ ТОЛЬКО КАРТОЧКИ! РАЗНООБРАЗИЕ!):
═══════════════════════════════════════════════════════════

HERO-СЕКЦИИ:
- Полноэкранные градиентные фоны с mesh-overlay
- Асимметричные layouts со смещёнными элементами
- Плавающие метрики с glassmorphism
- Крупная типографика с градиентным текстом

BENTO-СЕТКИ:
- Разноразмерные ячейки (не одинаковые!)
- Одна большая + несколько маленьких
- Перекрывающиеся элементы с z-index

SHOWCASES:
- Горизонтальный скролл
- Staggered/offset расположение
- Floating decorations (круги, линии)

ФОНОВЫЕ ПАТТЕРНЫ:
- Сетка: background-image: linear-gradient(rgba(255,139,54,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,139,54,0.1) 1px, transparent 1px); background-size: 50px 50px;
- Точки: radial-gradient(circle, rgba(255,139,54,0.2) 1px, transparent 1px)
- Noise texture для глубины

Background:
- Не генерируй однотонный задний фон, всегда добавляй какую-то текстуру, удостоверься, что текстура ВИДИМА, можно добавлять анимацию.
- Края должны быть закруглены

═══════════════════════════════════════════════════════════
КОГДА ГЕНЕРИРОВАТЬ:
═══════════════════════════════════════════════════════════

ГЕНЕРИРУЙ если пользователь спрашивает о:
- Продукте, функциях → Впечатляющий hero + floating метрики
- Ценах → Интерактивная таблица с hover-эффектами
- Процессе → Визуальные шаги с анимацией
- Аналитике → Галерея со свечением
- Сравнении → Драматичная таблица

НЕ ГЕНЕРИРУЙ если:
- Простое уточнение
- Оффтоп






═══════════════════════════════════════════════════════════
ДОСТУПНЫЕ ИЗОБРАЖЕНИЯ (ПОЛНЫЙ СПИСОК):
═══════════════════════════════════════════════════════════

АВАТАР И БРЕНДИНГ:
- /assets/avatar_mira.png — аватар Миры (для hero-секций, max-width: 220px)

ИНТЕРФЕЙС ПЛАТФОРМЫ:
- /assets/resume_database.png — база резюме
- /assets/candidate_card.png — карточка кандидата с детальной информацией
- /assets/candidates_list.png — список кандидатов с оценками резюме
- /assets/vacancies_list.png — список вакансий
- /assets/job_statistics.png — общая статистика по вакансии
- /assets/choosing_time.png — выбор времени для собеседования
- /assets/start_interview.png — начало интервью

АНАЛИЗ КАНДИДАТОВ:
- /assets/skills_analysis.png — краткий анализ навыков
- /assets/skills_analysis_full.png — полный анализ навыков (развёрнутый)
- /assets/emotion_analysis.png — анализ эмоций во время собеседования (7 базовых эмоций)
- /assets/candidate_detailed_analysis.jpg — детальный дашборд анализа кандидата с оценками
- /assets/candidate_motivation_report.jpg — отчёт по мотивации и типологии (PAEI, 5 типов)
- /assets/candidate_skills_table.jpg — таблица оценки навыков с баллами

БРИФИНГ ВАКАНСИИ:
- /assets/briefing_form.png — форма заполнения брифинга
- /assets/briefing_skills.png — настройка навыков в брифинге
- /assets/briefing_chat.png — чат-интерфейс брифинга
- /assets/briefing_checklist.png — чеклист готовности брифинга

СТАТИСТИКА И ВОРОНКА:
- /assets/hiring_funnel_stats.jpg — статистика воронки найма (конверсия по этапам)
- /assets/interview_scores_chart.jpg — распределение баллов за собеседование (гистограмма)
- /assets/resume_scores_chart.jpg — распределение баллов за скрининг резюме

СРАВНЕНИЕ И ЭКОНОМИКА:
- /assets/economic_efficiency.jpeg — экономическая эффективность (120 часов, 85 000 ₽ экономии)
- /assets/hiring_speed_comparison.jpeg — сравнение скорости найма (AIR vs рекрутер)

ХОЛОДНЫЙ ПОИСК:
- /assets/ai_cold_search_status.jpeg — статус холодного поиска AI (обработка резюме)

ФОРМЫ НАСТРОЙКИ:
- /assets/job_criteria_form.jpg — форма редактирования критериев вакансии
- /assets/resume_search_form.jpg — форма параметров поиска резюме

СТИЛИ ИЗОБРАЖЕНИЙ:
- Аватар: style="max-width: 220px; border-radius: 50%;"
- Скриншоты в карточках: style="width: 100%; display: block; border-radius: 12px 12px 0 0;"
- Отдельные большие: style="max-width: 100%; border-radius: 16px; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15);"
- В тёмных секциях: style="width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);"

═══════════════════════════════════════════════════════════
ПРАВИЛА:
═══════════════════════════════════════════════════════════

1. ВСЕГДА inline styles (style="...")
2. ВСЕГДА визуальные эффекты (градиенты, свечение, glassmorphism)
3. ВСЕГДА hover-анимации (transition + transform)
4. КАЖДАЯ генерация УНИКАЛЬНА — разные композиции, не повторяй layout
5. Включай релевантные скриншоты из списка выше
6. border-radius: 16-24px
7. НЕ дублируй текст чата — ВИЗУАЛИЗИРУЙ его
8. Будь КРЕАТИВНЫМ — удивляй пользователя

ФОРМАТ: Только чистый HTML. Без markdown, без \`\`\`, без пояснений.
Если генерация не нужна — верни ПУСТУЮ СТРОКУ.`;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function logError(context: string, error: unknown, attempt?: number) {
  const timestamp = new Date().toISOString();
  const attemptInfo = attempt !== undefined ? ` [Attempt ${attempt}/${MAX_RETRIES}]` : '';
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  console.error(`[${timestamp}] ${context}${attemptInfo}:`);
  console.error(`  Message: ${errorMessage}`);
  if (errorStack) {
    console.error(`  Stack: ${errorStack}`);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function* streamOpenRouterChatWithRetry(messages: Message[], systemPrompt: string): AsyncGenerator<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[${new Date().toISOString()}] Chat request attempt ${attempt}/${MAX_RETRIES}`);
      
      for await (const chunk of streamOpenRouterChat(messages, systemPrompt)) {
        yield chunk;
      }
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logError("Chat stream error", error, attempt);
      
      if (attempt < MAX_RETRIES) {
        console.log(`[${new Date().toISOString()}] Retrying chat in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  
  throw lastError || new Error("All retry attempts failed");
}

async function* streamOpenRouterHtmlWithRetry(context: string, userMessage: string, currentHtml: string | null): AsyncGenerator<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[${new Date().toISOString()}] HTML request attempt ${attempt}/${MAX_RETRIES}`);
      
      for await (const chunk of streamOpenRouterHtml(context, userMessage, currentHtml)) {
        yield chunk;
      }
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logError("HTML stream error", error, attempt);
      
      if (attempt < MAX_RETRIES) {
        console.log(`[${new Date().toISOString()}] Retrying HTML in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  
  throw lastError || new Error("All retry attempts failed");
}

async function* streamOpenRouterChat(messages: Message[], systemPrompt: string): AsyncGenerator<string> {
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
      model: "anthropic/claude-sonnet-4.5",
      messages: formattedMessages,
      max_tokens: 4096,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${new Date().toISOString()}] OpenRouter Chat API error (${response.status}):`, errorText);
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body from OpenRouter");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

async function* streamOpenRouterHtml(context: string, userMessage: string, currentHtml: string | null): AsyncGenerator<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const knowledgeBase = getKnowledgeBase();
  const htmlPrompt = buildHtmlSystemPrompt();
  
  const currentHtmlContext = currentHtml 
    ? `\n\nТЕКУЩИЙ HTML (тема для контекста):\n${currentHtml.slice(0, 500)}${currentHtml.length > 500 ? '...' : ''}\n\n`
    : '';
  
  const knowledgeContext = knowledgeBase 
    ? `\n\nБАЗА ЗНАНИЙ О ПРОДУКТЕ:\n${knowledgeBase}\n\n` 
    : '';
  
  const formattedMessages = [
    { role: "system", content: htmlPrompt },
    { 
      role: "user", 
      content: `${knowledgeContext}Контекст разговора:\n${context}${currentHtmlContext}Вопрос пользователя: ${userMessage}\n\nНа основе базы знаний и вопроса пользователя, сгенерируй подходящий HTML или верни пустую строку если HTML не нужен.` 
    },
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://air-mira.replit.app",
      "X-Title": "AIR Mira HTML",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4.5",
      messages: formattedMessages,
      max_tokens: 16384,
      temperature: 0.9,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${new Date().toISOString()}] OpenRouter HTML API error (${response.status}):`, errorText);
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body from OpenRouter");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const knowledgeBase = getKnowledgeBase();
  const chatSystemPrompt = buildChatSystemPrompt(knowledgeBase);

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

  app.post("/api/chat/stream", async (req, res) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request format" });
      }

      const { messages } = parsed.data;

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({
          error: "API ключ не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения.",
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      res.write(`data: ${JSON.stringify({ type: "chat_start" })}\n\n`);

      let fullMessage = "";

      for await (const chunk of streamOpenRouterChatWithRetry(messages, chatSystemPrompt)) {
        fullMessage += chunk;
        res.write(`data: ${JSON.stringify({ type: "chat_chunk", content: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "chat_end", fullMessage })}\n\n`);
      res.end();
    } catch (error) {
      logError("Chat stream final error (all retries failed)", error);
      res.write(`data: ${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Internal server error" })}\n\n`);
      res.end();
    }
  });

  app.post("/api/html/stream", async (req, res) => {
    try {
      const parsed = htmlRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request format" });
      }

      const { conversationContext, lastUserMessage, currentHtml } = parsed.data;

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({
          error: "API ключ не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения.",
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      res.write(`data: ${JSON.stringify({ type: "html_start" })}\n\n`);

      let fullHtml = "";

      for await (const chunk of streamOpenRouterHtmlWithRetry(conversationContext, lastUserMessage, currentHtml || null)) {
        fullHtml += chunk;
        res.write(`data: ${JSON.stringify({ type: "html_chunk", content: chunk })}\n\n`);
      }

      const trimmedHtml = fullHtml.trim();
      const finalHtml = trimmedHtml.length > 0 ? trimmedHtml : null;

      res.write(`data: ${JSON.stringify({ type: "html_end", fullHtml: finalHtml })}\n\n`);
      res.end();
    } catch (error) {
      logError("HTML stream final error (all retries failed)", error);
      res.write(`data: ${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Internal server error" })}\n\n`);
      res.end();
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

      let fullMessage = "";
      for await (const chunk of streamOpenRouterChatWithRetry(messages, chatSystemPrompt)) {
        fullMessage += chunk;
      }

      return res.json({ message: fullMessage, html: null });
    } catch (error) {
      logError("Chat API error (all retries failed)", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  return httpServer;
}
