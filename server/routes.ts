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
- Говори на языке выгод
- Прямые, открытые вопросы
- Один вопрос/ответ за раз

4. ФОРМАТ ОТВЕТА
Отвечай ТОЛЬКО текстом сообщения для пользователя. Никакого JSON, никаких скрытых рассуждений - только чистый текст ответа.

${knowledgeBase ? `\n\nБАЗА ЗНАНИЙ О ПРОДУКТЕ:\n${knowledgeBase}` : ""}

Начинай диалог с приветствия: "Привет! Я Mira — AI-рекрутер от AIR. Мы автоматизируем весь цикл найма: ищем кандидатов, звоним, проводим собеседования 24/7. Всё это в 5 раз дешевле живого рекрутера. Расскажите, с какой задачей в найме сталкиваетесь?"`;
}

function buildHtmlSystemPrompt(): string {
  return `Ты — специалист по генерации красивого, современного HTML контента для визуальной панели приложения AIR Mira.

ТВОЯ ЗАДАЧА:
На основе контекста разговора, сгенерируй HTML код для визуальной панели справа.

ПРАВИЛО МАСШТАБА:
Размер HTML должен соответствовать масштабу вопроса:
- Широкий вопрос (обзор продукта, все возможности, полное описание) → развёрнутый HTML с несколькими секциями, картинками, карточками
- Вопрос про одну тему (цена, одна функция) → компактный HTML по этой теме
- Уточнение → можно не генерировать HTML

НЕ ЭКОНОМЬ на HTML когда вопрос требует развёрнутого ответа. Если пользователь спрашивает "расскажи всё о продукте" - генерируй полноценную презентацию с несколькими блоками.

КОГДА ГЕНЕРИРОВАТЬ HTML:
- Новая тема в разговоре (цена, функции, процесс, сравнение)
- Пользователь задаёт конкретный вопрос о продукте
- Нужно визуально показать информацию (тарифы, этапы, преимущества)
- Контекст требует обновления визуала

КОГДА НЕ ГЕНЕРИРОВАТЬ HTML (вернуть пустую строку):
- Уточняющие вопросы в рамках той же темы
- Короткие реплики и подтверждения
- Оффтоп вопросы
- Если текущий показанный контент всё ещё релевантен

ТРИГГЕРЫ ДЛЯ HTML:

ВОПРОСЫ ПРО ХОЛОДНЫЙ ПОИСК / ПОИСК КАНДИДАТОВ:
→ html с feature cards про холодный поиск + изображение /assets/resume_database.png или /assets/candidates_list.png

ВОПРОСЫ ПРО ВИДЕО-ИНТЕРВЬЮ / АВАТАРА:
→ html с процессом видео-интервью + изображения /assets/start_interview.png (основное)

ВОПРОСЫ ПРО ЦЕНУ / СТОИМОСТЬ:
→ html с таблицей тарифов (pricing cards) - БЕЗ ИЗОБРАЖЕНИЙ

СРАВНЕНИЕ С ЧЕЛОВЕКОМ:
→ html со сравнительной таблицей AI vs Живой рекрутер

АНАЛИЗ КАНДИДАТОВ:
→ html с /assets/skills_analysis.png или /assets/candidate_card.png

ИЗОБРАЖЕНИЯ:

АВАТАР MIRA (/assets/avatar_mira.png):
- Используй когда речь о видео-интервью или AI-аватаре
- Размер аватара: style="max-width: 220px; border-radius: 12px;"

ДРУГИЕ ИЗОБРАЖЕНИЯ:
/assets/start_interview.png - начало интервью
/assets/choosing_time.png - выбор времени
/assets/resume_database.png - база резюме
/assets/candidate_card.png - карточка кандидата
/assets/candidates_list.png - список кандидатов
/assets/skills_analysis.png - анализ навыков
/assets/skills_analysis_full.png - полный анализ
/assets/emotion_analysis.png - анализ эмоций
/assets/job_statistics.png - статистика вакансии
/assets/briefing_form.png - форма брифинга
/assets/briefing_skills.png - навыки в брифинге
/assets/briefing_chat.png - чат брифинга
/assets/briefing_checklist.png - чеклист
/assets/vacancies_list.png - список вакансий

РАЗМЕРЫ ИЗОБРАЖЕНИЙ:
- Аватар: style="max-width: 220px; border-radius: 12px;"
- Остальные: style="max-width: 680px; border-radius: 8px;"
- НЕ используй width: 100% - это растягивает маленькие картинки!
- Используй столько изображений, сколько нужно для темы

КНОПКИ CTA:
- Добавляй кнопки только когда уместно (тарифы, демо, финал разговора)
- НЕ добавляй кнопку в каждый HTML
- Если добавляешь: <a href="https://ai-recruiter.ru/" target="_blank" class="cta-button">Текст</a>

КЛАССЫ ДИЗАЙН-СИСТЕМЫ ДЛЯ HTML:
- Сетки: grid-2, grid-3, grid-4
- Карточки: card, pricing-card, feature-card (+ класс "hover" для интерактивности)
- Метрики: metric, metric-value, metric-label
- Кнопки: cta-button, cta-button-secondary
- Процессы: process-step, step-number, step-content, step-title, step-description
- FAQ: faq-item (+ класс "hover"), faq-question, faq-answer
- Тарифы: pricing-card, featured, pricing-price, pricing-period, feature-list, feature-item
- Выделение: highlight, badge, tag

ВСЕ интерактивные элементы ДОЛЖНЫ иметь класс "hover"

ФОРМАТ ОТВЕТА:
- Если нужен HTML: верни ТОЛЬКО HTML код, без обёрток, без markdown
- Если HTML не нужен: верни пустую строку

ПРИМЕРЫ HTML:

Таблица тарифов (БЕЗ изображений):
<h2>Тарифы AIR Mira</h2>
<div class="grid-3">
  <div class="pricing-card hover">
    <h3>Старт</h3>
    <div class="pricing-price">8 330 ₽</div>
    <div class="pricing-period">в месяц</div>
    <div class="feature-list">
      <div class="feature-item">3 вакансии</div>
      <div class="feature-item">1 000 резюме</div>
      <div class="feature-item">25 видео-интервью</div>
    </div>
  </div>
  <div class="pricing-card featured hover">
    <div class="badge">Популярный</div>
    <h3>Рост</h3>
    <div class="pricing-price">34 930 ₽</div>
    <div class="pricing-period">в месяц</div>
    <div class="feature-list">
      <div class="feature-item">10 вакансий</div>
      <div class="feature-item">4 000 резюме</div>
      <div class="feature-item">100 видео-интервью</div>
    </div>
  </div>
</div>

Карточки с изображениями:
<div class="grid-2">
  <div class="card hover">
    <img src="/assets/candidate_card.png" alt="Карточка кандидата" style="max-width: 680px; border-radius: 8px;" />
    <h3>Подробная карточка каждого кандидата</h3>
  </div>
  <div class="card hover">
    <img src="/assets/skills_analysis.png" alt="Анализ навыков" style="max-width: 680px; border-radius: 8px;" />
    <h3>Глубокий анализ навыков</h3>
  </div>
</div>

Пример с аватаром (для темы видео-интервью):
<div class="card hover">
  <img src="/assets/avatar_mira.png" alt="AI-аватар Mira" style="max-width: 220px; border-radius: 12px;" />
  <h3>AI-аватар проводит интервью</h3>
  <p>Mira общается с кандидатами как живой рекрутер</p>
</div>`;
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
      model: "anthropic/claude-sonnet-4",
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

async function* streamOpenRouterHtml(context: string, userMessage: string, assistantMessage: string): AsyncGenerator<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const htmlPrompt = buildHtmlSystemPrompt();
  
  const formattedMessages = [
    { role: "system", content: htmlPrompt },
    { 
      role: "user", 
      content: `Контекст разговора:\n${context}\n\nПоследний вопрос пользователя: ${userMessage}\n\nОтвет ассистента: ${assistantMessage}\n\nСгенерируй подходящий HTML или верни пустую строку если HTML не нужен.` 
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
      max_tokens: 8192,
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

      const { conversationContext, lastUserMessage, lastAssistantMessage } = parsed.data;

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

      for await (const chunk of streamOpenRouterHtml(conversationContext, lastUserMessage, lastAssistantMessage)) {
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
