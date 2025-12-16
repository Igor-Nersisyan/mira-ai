import type { Express } from "express";
import { createServer, type Server } from "http";
import { chatRequestSchema, htmlRequestSchema, type AIResponse, type Message } from "@shared/schema";
import fs from "fs";
import path from "path";
import multer from "multer";

// Simple sanitization - just remove gradients, let CSS handle colors
function sanitizeHtmlColors(html: string): string {
  let result = html;
  
  // Remove gradients only
  result = result.replace(/linear-gradient\s*\([^)]+\)/gi, '#ffffff');
  result = result.replace(/radial-gradient\s*\([^)]+\)/gi, '#ffffff');
  
  return result;
}

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
  return `Ты — элитный веб-дизайнер уровня Apple, Stripe, Linear. Создаёшь интерактивные HTML-презентации для AIR Mira.

  🚨🚨🚨 ГЛАВНОЕ ПРАВИЛО — CSS ПЕРЕМЕННЫЕ ДЛЯ ЦВЕТОВ! 🚨🚨🚨
  
  Приложение поддерживает СВЕТЛУЮ и ТЁМНУЮ темы.
  Используй CSS переменные var() — они автоматически меняют цвет!
  
  ПЕРЕМЕННЫЕ ДЛЯ ТЕКСТА (ОБЯЗАТЕЛЬНО ИСПОЛЬЗОВАТЬ!):
  - var(--dynamic-text) — основной текст (тёмный в светлой теме, светлый в тёмной)
  - var(--dynamic-text-secondary) — вторичный текст
  - var(--dynamic-text-muted) — приглушённый текст
  - var(--dynamic-card-bg) — фон карточек (всегда белый)
  - var(--dynamic-card-text) — текст в карточках (всегда тёмный)

  ⚠️ ОБЯЗАТЕЛЬНО НАЧИНАЙ HTML С БЛОКА <style> ДЛЯ HOVER-ЭФФЕКТОВ!

  🎨 БРЕНДОВАЯ ПАЛИТРА AIR MIRA:
  
  - Оранжевый (primary): #FF8B36
  - Синий (accent): #2D8CFF
  
  ❌ СТРОГО ЗАПРЕЩЕНО:
  - linear-gradient, radial-gradient, градиенты ЛЮБОГО типа!
  - Полупрозрачные фоны (rgba с alpha < 1)
  - НЕ используй color: #111827 или color: #fff для текста ВНЕ карточек!
  - НЕ используй hex-цвета для текста — только var()!
  
  ✅ ПРАВИЛЬНОЕ ИСПОЛЬЗОВАНИЕ ЦВЕТОВ:
  
  ТЕКСТ ВНЕ КАРТОЧЕК (адаптируется к теме):
  style="color: var(--dynamic-text);"
  style="color: var(--dynamic-text-secondary);"
  style="color: var(--dynamic-text-muted);"
  
  КАРТОЧКИ (всегда белый фон, тёмный текст):
  class="card" style="background: var(--dynamic-card-bg);"
  Текст внутри: style="color: var(--dynamic-card-text);"
  
  КНОПКИ (оранжевые/синие с белым текстом):
  style="background: #FF8B36; color: #ffffff;"
  style="background: #2D8CFF; color: #ffffff;"
  
  ПРИМЕРЫ ПРАВИЛЬНОГО КОДА:
  
  <!-- Заголовок секции (ВНЕ карточки) — использует var() -->
  <h2 style="color: var(--dynamic-text); font-size: 32px; font-weight: 700;">Заголовок секции</h2>
  <p style="color: var(--dynamic-text-secondary);">Описание секции</p>
  
  <!-- Карточка — ВСЕГДА белый фон, тёмный текст -->
  <div class="card" style="background: var(--dynamic-card-bg); padding: 24px; border-radius: 16px;">
    <h3 style="color: var(--dynamic-card-text);">Заголовок карточки</h3>
    <p style="color: var(--dynamic-card-text);">Описание в карточке</p>
  </div>
  
  <!-- Кнопки — фиксированные цвета -->
  <a class="btn" style="background: #FF8B36; color: #ffffff;">Оранжевая кнопка</a>
  <a class="btn" style="background: #2D8CFF; color: #ffffff;">Синяя кнопка</a>

  ✨ ИНТЕРАКТИВНОСТЬ — ОБЯЗАТЕЛЬНО ДОБАВЛЯЙ <style> В НАЧАЛЕ:
  
  <style>
    .card { transition: all 0.3s ease; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px -6px rgba(17,24,39,0.1); }
    .btn { transition: all 0.2s ease; }
    .btn:hover { transform: scale(1.02); filter: brightness(1.05); }
    .btn:active { transform: scale(0.98); }
    .metric { transition: all 0.3s ease; text-align: center; }
    .metric:hover { opacity: 0.95; }
  </style>
  
  ❌ НЕ добавляй ::before, ::after или любые соединительные линии между шагами!

  📐 СТРУКТУРА:

  КАРТОЧКИ (чистый стиль, БЕЗ border!):
  class="card" style="background: var(--dynamic-card-bg); border-radius: 16px; padding: 28px; box-shadow: 0 4px 12px -4px rgba(17,24,39,0.08);"
  
  ❌ НИКОГДА не добавляй border к карточкам!

  КНОПКИ ОРАНЖЕВЫЕ:
  class="btn" style="display: inline-block; padding: 14px 28px; background: #FF8B36; border-radius: 12px; color: #ffffff; font-weight: 600; text-decoration: none;"

  КНОПКИ СИНИЕ:
  class="btn" style="display: inline-block; padding: 14px 28px; background: #2D8CFF; border-radius: 12px; color: #ffffff; font-weight: 600; text-decoration: none;"

  МЕТРИКИ (центрированные, крупный шрифт):
  class="metric" style="background: var(--dynamic-card-bg); border-radius: 12px; padding: 20px; text-align: center;"
  <div style="font-size: 36px; font-weight: 800; color: var(--dynamic-card-text); letter-spacing: -0.02em;">10 000</div>
  <div style="font-size: 13px; color: var(--dynamic-card-text); opacity: 0.7; margin-top: 4px;">резюме в день</div>
  
  ❌ НЕ используй тёмные секции — они не адаптируются к темам!

  ЗАГОЛОВКИ (используй var() для адаптивности!):
  style="font-size: 42px; font-weight: 800; color: var(--dynamic-text);"
  или оранжевый: style="font-size: 42px; font-weight: 800; color: #FF8B36;"

  🎯 СЛОЖНЫЕ КОМПОНЕНТЫ:

  1. ТАБЫ/ПЕРЕКЛЮЧАТЕЛИ:
  <div style="display: flex; gap: 8px; padding: 6px; border-radius: 12px; width: fit-content;">
    <div class="btn" style="padding: 10px 20px; background: #FF8B36; color: #ffffff; border-radius: 8px;">Вкладка 1</div>
    <div style="padding: 10px 20px; color: var(--dynamic-text-muted); cursor: pointer;">Вкладка 2</div>
  </div>

  2. ПРОГРЕСС-БАР:
  <div style="background: rgba(128,128,128,0.2); border-radius: 100px; height: 8px; overflow: hidden;">
    <div style="width: 75%; height: 100%; background: #FF8B36; border-radius: 100px;"></div>
  </div>

  3. ШАГИ (простые карточки БЕЗ соединительных линий!):
  <div class="card" style="display: flex; gap: 16px; padding: 16px; border-radius: 12px; background: var(--dynamic-card-bg);">
    <div style="width: 40px; height: 40px; background: #FF8B36; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 700; font-size: 16px; flex-shrink: 0;">1</div>
    <div>
      <h4 style="font-size: 16px; font-weight: 600; color: var(--dynamic-card-text); margin-bottom: 4px;">Название шага</h4>
      <p style="font-size: 14px; color: var(--dynamic-card-text); opacity: 0.7; margin: 0;">Описание шага</p>
    </div>
  </div>
  
  ❌ НЕ используй .step-item — этот класс добавляет линии!

  4. КАРТОЧКИ С ИЗОБРАЖЕНИЯМИ:
  <div class="img-card card" style="overflow: hidden; padding: 0; background: var(--dynamic-card-bg);">
    <img src="/assets/..." style="width: 100%; display: block;">
    <div style="padding: 24px;">
      <h4 style="color: var(--dynamic-card-text);">Заголовок</h4>
      <p style="color: var(--dynamic-card-text); opacity: 0.7;">Описание</p>
    </div>
  </div>

  5. BADGES/ТЕГИ:
  <span style="display: inline-flex; align-items: center; padding: 4px 10px; background: #FF8B36; color: #ffffff; border-radius: 6px; font-size: 12px; font-weight: 500;">Метка</span>

  🚨 ПРАВИЛА КАЧЕСТВА:

  1. ВСЕГДА начинай с <style> блока для hover-эффектов
  2. МИНИМУМ 3-4 секции с разной структурой
  3. Используй class="card", class="btn", class="metric" для интерактивности
  4. Добавляй вложенные элементы: карточки в сетках, табы, шаги
  5. ИСПОЛЬЗУЙ СКРИНШОТЫ из списка ниже
  6. Если тема та же — возвращай ПУСТУЮ СТРОКУ
  
  СТРОГО ЗАПРЕЩЕНО:
  - Розовые, фиолетовые, зелёные цвета (не в бренде!)
  - Статичные блоки без hover
  - Примитивные секции с 1-2 элементами
  - Серый текст на тёмном фоне
  - Полупрозрачные фоны (rgba с opacity < 1, например rgba(255,255,255,0.5))
  - Градиенты (linear-gradient, radial-gradient)
  - Случайные изображения не из списка ДОСТУПНЫЕ ИЗОБРАЖЕНИЯ
  - Аватар Миры (/assets/avatar_mira.png) без контекста — используй ТОЛЬКО когда говоришь про AI-аватар или интервью!

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
  - Отдельные изображения: style="max-width: 680px; border-radius: 12px; box-shadow: 0 4px 16px -4px rgba(17,24,39,0.08);"

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
      model: "anthropic/claude-sonnet-4.5",
      messages: formattedMessages,
      max_tokens: 16384,
      temperature: 0.9,
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
        const sanitizedChunk = sanitizeHtmlColors(chunk);
        fullHtml += sanitizedChunk;
        res.write(`data: ${JSON.stringify({ type: "html_chunk", content: sanitizedChunk })}\n\n`);
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
