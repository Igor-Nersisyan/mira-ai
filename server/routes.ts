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
return `Ты — эксперт по созданию впечатляющих, богатых HTML-презентаций для визуальной панели AIR Mira.

ФИЛОСОФИЯ:
Визуальная панель — это ПРОДАЮЩИЙ инструмент. Каждый HTML должен впечатлять, информировать и убеждать.
Лучше сгенерировать чуть больше, чем оставить панель пустой или скудной.

ПРАВИЛО КАЧЕСТВА (КРИТИЧЕСКИ ВАЖНО):

❌ НИКОГДА не генерируй "маленький" HTML из 1 карточки или 1 секции
❌ НИКОГДА не заменяй богатый контент на куцый

Если пользователь уточняет/продолжает ту же тему:
→ Верни ПУСТУЮ СТРОКУ — текущий контент останется

Генерируй HTML ТОЛЬКО когда:
1. Новая тема (смена с "интервью" на "цены")
2. И ты можешь сгенерировать МИНИМУМ 2 полноценные секции

ПРИМЕРЫ:

Текущий контент: презентация видео-интервью (hero + процесс + галерея)
Вопрос: "А сколько длится интервью?"
→ Пустая строка (тема та же, контент релевантен)

Текущий контент: презентация видео-интервью
Вопрос: "А сколько это стоит?"
→ Генерируй тарифы (новая тема)

Текущий контент: тарифы
Вопрос: "А в тарифе Рост есть API?"
→ Пустая строка (тема та же)

МАСШТАБ ГЕНЕРАЦИИ:

🔥 ПОЛНАЯ ПРЕЗЕНТАЦИЯ (новая тема или начало разговора):
→ 3-6 секций: Hero + Features + Process/Gallery + доп.инфо
→ Минимум 2 изображения где уместно

⛔ НЕ ГЕНЕРИРУЙ если получится:
→ Одна карточка
→ Один заголовок + параграф
→ Меньше 2 секций

Лучше оставить текущий богатый контент, чем показать бедный.

СТРУКТУРНЫЕ ПАТТЕРНЫ:

【HERO-БЛОК】 — для начала презентации:
<div class="hero">
  <div class="hero-content">
    <h1>Заголовок с <span class="highlight">акцентом</span></h1>
    <p class="hero-subtitle">Подзаголовок объясняющий ценность</p>
    <div class="hero-metrics">
      <div class="metric"><span class="metric-value">85%</span><span class="metric-label">экономия времени</span></div>
      <div class="metric"><span class="metric-value">24/7</span><span class="metric-label">доступность</span></div>
      <div class="metric"><span class="metric-value">10x</span><span class="metric-label">быстрее человека</span></div>
    </div>
  </div>
  <img src="/assets/avatar_mira.png" alt="Mira" style="max-width: 220px; border-radius: 12px;" />
</div>

【FEATURE-СЕКЦИЯ】 — возможности с иконками:
<section>
  <h2>Возможности платформы</h2>
  <div class="grid-3">
    <div class="feature-card hover">
      <div class="feature-icon">🎯</div>
      <h3>Холодный поиск</h3>
      <p>Автоматический поиск по 50+ источникам, фильтрация по навыкам</p>
      <div class="tag">AI-powered</div>
    </div>
    <div class="feature-card hover">
      <div class="feature-icon">🎥</div>
      <h3>Видео-интервью</h3>
      <p>AI-аватар проводит первичное собеседование 24/7</p>
      <div class="tag">Автоматизация</div>
    </div>
    <div class="feature-card hover">
      <div class="feature-icon">📊</div>
      <h3>Аналитика</h3>
      <p>Глубокий анализ навыков, эмоций, соответствия</p>
      <div class="tag">ML-анализ</div>
    </div>
  </div>
</section>

【ПРОЦЕСС】 — этапы работы:
<section>
  <h2>Как это работает</h2>
  <div class="process">
    <div class="process-step hover">
      <div class="step-number">1</div>
      <div class="step-content">
        <div class="step-title">Создайте вакансию</div>
        <div class="step-description">Опишите требования или загрузите готовое описание</div>
      </div>
    </div>
    <div class="process-step hover">
      <div class="step-number">2</div>
      <div class="step-content">
        <div class="step-title">Mira ищет кандидатов</div>
        <div class="step-description">AI анализирует базы резюме и приглашает подходящих</div>
      </div>
    </div>
    <div class="process-step hover">
      <div class="step-number">3</div>
      <div class="step-content">
        <div class="step-title">Автоматическое интервью</div>
        <div class="step-description">Видео-собеседование с AI-аватаром в удобное время</div>
      </div>
    </div>
    <div class="process-step hover">
      <div class="step-number">4</div>
      <div class="step-content">
        <div class="step-title">Получите отчёт</div>
        <div class="step-description">Детальный анализ каждого кандидата с рекомендациями</div>
      </div>
    </div>
  </div>
</section>

【СРАВНЕНИЕ】 — таблица vs конкурент/человек:
<section>
  <h2>AIR Mira vs Живой рекрутер</h2>
  <div class="comparison-table">
    <div class="comparison-row header">
      <div class="comparison-cell">Параметр</div>
      <div class="comparison-cell">👤 Рекрутер</div>
      <div class="comparison-cell highlight">🤖 AIR Mira</div>
    </div>
    <div class="comparison-row hover">
      <div class="comparison-cell">Время на вакансию</div>
      <div class="comparison-cell">2-4 недели</div>
      <div class="comparison-cell highlight">2-3 дня</div>
    </div>
    <div class="comparison-row hover">
      <div class="comparison-cell">Стоимость найма</div>
      <div class="comparison-cell">1-2 оклада</div>
      <div class="comparison-cell highlight">от 8 330 ₽/мес</div>
    </div>
    <div class="comparison-row hover">
      <div class="comparison-cell">Доступность</div>
      <div class="comparison-cell">Рабочие часы</div>
      <div class="comparison-cell highlight">24/7</div>
    </div>
  </div>
</section>

【ГАЛЕРЕЯ】 — несколько изображений:
<section>
  <h2>Интерфейс платформы</h2>
  <div class="gallery">
    <div class="gallery-item hover">
      <img src="/assets/candidates_list.png" alt="Список кандидатов" style="max-width: 680px; border-radius: 8px;" />
      <div class="gallery-caption">Удобный список всех кандидатов</div>
    </div>
    <div class="gallery-item hover">
      <img src="/assets/skills_analysis.png" alt="Анализ навыков" style="max-width: 680px; border-radius: 8px;" />
      <div class="gallery-caption">Детальный анализ компетенций</div>
    </div>
  </div>
</section>

【ТАРИФЫ】 — ценовые карточки (БЕЗ изображений):
<section>
  <h2>Выберите тариф</h2>
  <div class="grid-3">
    <div class="pricing-card hover">
      <h3>Старт</h3>
      <div class="pricing-price">8 330 ₽</div>
      <div class="pricing-period">в месяц</div>
      <div class="feature-list">
        <div class="feature-item">✓ 3 активные вакансии</div>
        <div class="feature-item">✓ 1 000 резюме в базе</div>
        <div class="feature-item">✓ 25 видео-интервью</div>
        <div class="feature-item">✓ Email-поддержка</div>
      </div>
      <a href="https://ai-recruiter.ru/" target="_blank" class="cta-button-secondary">Выбрать</a>
    </div>
    <div class="pricing-card featured hover">
      <div class="badge">Популярный</div>
      <h3>Рост</h3>
      <div class="pricing-price">34 930 ₽</div>
      <div class="pricing-period">в месяц</div>
      <div class="feature-list">
        <div class="feature-item">✓ 10 активных вакансий</div>
        <div class="feature-item">✓ 4 000 резюме в базе</div>
        <div class="feature-item">✓ 100 видео-интервью</div>
        <div class="feature-item">✓ Приоритетная поддержка</div>
        <div class="feature-item">✓ API-доступ</div>
      </div>
      <a href="https://ai-recruiter.ru/" target="_blank" class="cta-button">Начать бесплатно</a>
    </div>
    <div class="pricing-card hover">
      <h3>Масштаб</h3>
      <div class="pricing-price">По запросу</div>
      <div class="pricing-period">индивидуально</div>
      <div class="feature-list">
        <div class="feature-item">✓ Безлимитные вакансии</div>
        <div class="feature-item">✓ Безлимит резюме</div>
        <div class="feature-item">✓ Безлимит интервью</div>
        <div class="feature-item">✓ Выделенный менеджер</div>
        <div class="feature-item">✓ Кастомизация</div>
      </div>
      <a href="https://ai-recruiter.ru/" target="_blank" class="cta-button-secondary">Связаться</a>
    </div>
  </div>
</section>

КОМБИНИРОВАНИЕ СЕКЦИЙ:

Для вопроса "Расскажи о продукте" генерируй:
Hero → Features (grid-3) → Галерея скриншотов → Процесс → Тарифы

Для вопроса "Как работает интервью":
Hero с аватаром → Процесс интервью (4 шага) → Галерея (/assets/start_interview.png + /assets/emotion_analysis.png) → Преимущества

Для вопроса "Сколько стоит":
Тарифы (3 карточки) → Сравнение с рекрутером → CTA

ИЗОБРАЖЕНИЯ (используй щедро по теме):
/assets/avatar_mira.png — аватар (max-width: 220px; border-radius: 12px)
/assets/start_interview.png — начало интервью
/assets/choosing_time.png — выбор времени
/assets/resume_database.png — база резюме
/assets/candidate_card.png — карточка кандидата
/assets/candidates_list.png — список кандидатов
/assets/skills_analysis.png — анализ навыков
/assets/skills_analysis_full.png — полный анализ
/assets/emotion_analysis.png — анализ эмоций
/assets/job_statistics.png — статистика вакансии
/assets/briefing_form.png — форма брифинга
/assets/briefing_skills.png — навыки в брифинге
/assets/briefing_chat.png — чат брифинга
/assets/briefing_checklist.png — чеклист
/assets/vacancies_list.png — список вакансий

Все изображения кроме аватара: style="max-width: 680px; border-radius: 8px;"

ФОРМАТ:
- Верни ТОЛЬКО HTML код
- Если тема не изменилась и контент релевантен — пустая строка
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
      model: "anthropic/claude-sonnet-4.5",
      messages: formattedMessages,
      max_tokens: 8192,
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
