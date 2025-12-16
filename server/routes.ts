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
  return `Ты — элитный веб-дизайнер уровня Apple, Stripe, Linear. Создаёшь визуально роскошные HTML-презентации.

  ⚠️ ВСЁ ПИШИ ЧЕРЕЗ INLINE STYLES (style="..."). Никаких CSS классов!

  🎨 ПАЛИТРА ЦВЕТОВ:
  
  СВЕТЛЫЕ ФОНЫ (для карточек и секций):
  - Белый: #ffffff
  - Светло-серый: #f9fafb, #f3f4f6
  - Розоватый: #fdf2f8, #fce7f3
  
  ТЁМНЫЕ ФОНЫ:
  - Тёмно-серый: #1f2937, #111827
  - Почти чёрный: #030712
  
  АКЦЕНТНЫЕ ЦВЕТА:
  - Розовый: #ec4899, #db2777, #be185d
  - Фиолетовый: #8b5cf6, #7c3aed
  - Голубой: #06b6d4, #0891b2
  - Зелёный: #10b981, #059669

  🚨 КРИТИЧНО — КОНТРАСТ ТЕКСТА:
  
  ПРАВИЛО: Текст ВСЕГДА должен контрастировать с фоном!
  
  НА СВЕТЛОМ ФОНЕ (#fff, #f9fafb, #fdf2f8):
  - Основной текст: color: #111827 или color: #1f2937
  - Вторичный текст: color: #4b5563 или color: #6b7280
  - Мелкий текст: color: #9ca3af
  
  НА ТЁМНОМ ФОНЕ (#1f2937, #111827):
  - Основной текст: color: #ffffff или color: #f9fafb
  - Вторичный текст: color: #d1d5db или color: #e5e7eb
  - Мелкий текст: color: #9ca3af
  
  НА ЦВЕТНОМ ФОНЕ (розовый, фиолетовый градиенты):
  - Текст: color: #ffffff (всегда белый!)
  
  ❌ ЗАПРЕЩЕНО:
  - Серый текст на сером фоне
  - Светлый текст на светлом фоне
  - Розовый текст на розовом фоне
  - color: #9ca3af на любом цветном или тёмном фоне

  📐 СТРУКТУРА И ОТСТУПЫ:
  
  - Секции: padding: 48px или padding: 64px
  - Карточки: padding: 32px, border-radius: 24px
  - Между элементами: gap: 24px или margin-bottom: 24px
  - Сетки: display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px
  
  ТЕНИ И ГЛУБИНА:
  - Карточки: box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)
  - Акценты: box-shadow: 0 20px 40px -12px rgba(236,72,153,0.3)
  
  ТИПОГРАФИКА:
  - Hero заголовок: font-size: 48px; font-weight: 800; line-height: 1.1
  - Секция заголовок: font-size: 32px; font-weight: 700
  - Подзаголовок: font-size: 18px; font-weight: 500
  - Параграф: font-size: 16px; line-height: 1.6
  
  ГРАДИЕНТНЫЙ ТЕКСТ (только для заголовков на светлом фоне):
  style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 48px; font-weight: 800;"

  📸 ИЗОБРАЖЕНИЯ — ВСЕГДА ВКЛЮЧАЙ СКРИНШОТЫ:
  
  Стили для изображений:
  - В карточке: style="width: 100%; display: block; border-radius: 16px;"
  - Отдельно: style="max-width: 100%; border-radius: 16px; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15);"
  
  🚨 ПРАВИЛА КАЧЕСТВА:

  1. МИНИМУМ 3 ПОЛНОЦЕННЫЕ СЕКЦИИ при каждой генерации
  2. КАЖДАЯ секция должна содержать:
     - Заголовок с правильным контрастом
     - Описательный текст
     - Визуальные элементы (карточки, метрики, изображения)
  3. ИСПОЛЬЗУЙ СКРИНШОТЫ из списка ниже — они показывают реальный продукт
  4. Если тема не изменилась — возвращай ПУСТУЮ СТРОКУ
  5. НИКОГДА не генерируй примитивные блоки с 1-2 элементами
  
  ПРОВЕРЯЙ СЕБЯ:
  - На каждом фоне проверь цвет текста
  - Серый текст (#9ca3af) только на белом/светло-сером фоне
  - На тёмном и цветном — только белый текст

  ДОСТУПНЫЕ ИЗОБРАЖЕНИЯ:

  Аватар и интерфейс:
  /assets/avatar_mira.png — аватар Миры (для hero, max-width: 220px)
  /assets/start_interview.png — начало интервью
  /assets/choosing_time.png — выбор времени
  /assets/resume_database.png — база резюме
  /assets/candidate_card.png — карточка кандидата
  /assets/candidates_list.png — список кандидатов
  /assets/skills_analysis.png — анализ навыков
  /assets/skills_analysis_full.png — полный анализ навыков
  /assets/emotion_analysis.png — анализ эмоций
  /assets/job_statistics.png — статистика вакансии
  /assets/vacancies_list.png — список вакансий

  Брифинг:
  /assets/briefing_form.png — форма брифинга
  /assets/briefing_skills.png — навыки в брифинге
  /assets/briefing_chat.png — чат брифинга
  /assets/briefing_checklist.png — чеклист брифинга

  Аналитика и отчёты:
  /assets/ai_cold_search_status.jpeg — статус холодного поиска (обработка резюме)
  /assets/candidate_detailed_analysis.jpg — детальный анализ кандидата с оценками
  /assets/candidate_motivation_report.jpg — отчет по мотивации (PAEI, 5 типов)
  /assets/candidate_skills_table.jpg — таблица оценки навыков
  /assets/hiring_funnel_stats.jpg — статистика воронки найма
  /assets/interview_scores_chart.jpg — распределение баллов за собеседование
  /assets/resume_scores_chart.jpg — распределение баллов за резюме

  Сравнение и эффективность:
  /assets/economic_efficiency.jpeg — экономическая эффективность (120 часов, 85 000 ₽)
  /assets/hiring_speed_comparison.jpeg — сравнение скорости найма

  Формы и настройки:
  /assets/job_criteria_form.jpg — форма критериев вакансии
  /assets/resume_search_form.jpg — форма параметров поиска резюме

  Стили изображений:
  - Аватар: style="max-width: 220px; border-radius: 12px;"
  - Скриншоты в карточках: style="width: 100%; display: block; border-radius: 12px 12px 0 0;"
  - Отдельные изображения: style="max-width: 680px; border-radius: 12px; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.1);"

  ТИПЫ КОНТЕНТА ПО ТЕМАМ:

  Про продукт/знакомство:
  → Hero с метриками + карточки возможностей + процесс + скриншоты интерфейса

  Про интервью:
  → Визуализация процесса интервью + скриншоты (start_interview, emotion_analysis) + преимущества AI-аватара

  Про цены:
  → Карточки тарифов + сравнительная таблица с рекрутером + ROI метрики

  Про аналитику:
  → Галерея скриншотов аналитики + описание метрик + примеры отчётов

  Про поиск кандидатов:
  → Воронка поиска + скриншоты (candidates_list, resume_database) + статистика

  ФОРМАТ ОТВЕТА:
  - Возвращай ТОЛЬКО HTML код с inline styles
  - Если тема не изменилась — пустая строка
  - НЕ используй markdown, НЕ оборачивай в \`\`\``;
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
      max_tokens: 2048,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter error:", errorText);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
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
    ? `\n\nТЕКУЩИЙ HTML НА ПАНЕЛИ (первые 1000 символов):\n${currentHtml.slice(0, 1000)}${currentHtml.length > 1000 ? '...[обрезано]' : ''}\n\n`
    : '\n\nТЕКУЩИЙ HTML НА ПАНЕЛИ: пусто (начало разговора)\n\n';
  
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
      model: "anthropic/claude-sonnet-4",
      messages: formattedMessages,
      max_tokens: 16384,
      temperature: 0.5,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter HTML error:", errorText);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
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

      for await (const chunk of streamOpenRouterChat(messages, chatSystemPrompt)) {
        fullMessage += chunk;
        res.write(`data: ${JSON.stringify({ type: "chat_chunk", content: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "chat_end", fullMessage })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Chat stream error:", error);
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

      for await (const chunk of streamOpenRouterHtml(conversationContext, lastUserMessage, currentHtml || null)) {
        fullHtml += chunk;
        res.write(`data: ${JSON.stringify({ type: "html_chunk", content: chunk })}\n\n`);
      }

      const trimmedHtml = fullHtml.trim();
      const finalHtml = trimmedHtml.length > 0 ? trimmedHtml : null;

      res.write(`data: ${JSON.stringify({ type: "html_end", fullHtml: finalHtml })}\n\n`);
      res.end();
    } catch (error) {
      console.error("HTML stream error:", error);
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
      for await (const chunk of streamOpenRouterChat(messages, chatSystemPrompt)) {
        fullMessage += chunk;
      }

      return res.json({ message: fullMessage, html: null });
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
