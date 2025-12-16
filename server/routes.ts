import type { Express } from "express";
import { createServer, type Server } from "http";
import { chatRequestSchema, htmlRequestSchema, type AIResponse, type Message } from "@shared/schema";
import fs from "fs";
import path from "path";
import multer from "multer";

function sanitizeHtmlColors(html: string): string {
  let result = html;
  
  result = result.replace(/color:\s*#fff(?:fff)?(?![0-9a-f])/gi, 'color: #111827');
  result = result.replace(/color:\s*white(?![a-z])/gi, 'color: #111827');
  result = result.replace(/color:\s*rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi, 'color: #111827');
  
  result = result.replace(/linear-gradient\s*\([^)]+\)/gi, '#ffffff');
  result = result.replace(/radial-gradient\s*\([^)]+\)/gi, '#ffffff');
  
  result = result.replace(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*0?\.?\d*\s*\)/gi, (match, r, g, b) => {
    return `rgb(${r}, ${g}, ${b})`;
  });
  
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

  🚨🚨🚨 САМОЕ ВАЖНОЕ — ИСПОЛЬЗУЙ КЛАСС "card" ДЛЯ КАРТОЧЕК! 🚨🚨🚨
  
  Каждая карточка ОБЯЗАТЕЛЬНО должна иметь class="card"!
  CSS автоматически применит правильные цвета.

  ⚠️ ОБЯЗАТЕЛЬНО НАЧИНАЙ HTML С БЛОКА <style> ДЛЯ HOVER-ЭФФЕКТОВ!

  🎨 БРЕНДОВАЯ ПАЛИТРА AIR MIRA (ТОЛЬКО ЭТИ ЦВЕТА!):
  
  ОСНОВНЫЕ ЦВЕТА (БЕЗ ГРАДИЕНТОВ!):
  - Оранжевый (primary): #FF8B36
  - Синий (accent): #2D8CFF
  - Чёрный: #111827, #1f2937
  - Белый: #ffffff, #f9fafb, #f3f4f6
  
  ❌ СТРОГО ЗАПРЕЩЕНО:
  - linear-gradient, radial-gradient, градиенты ЛЮБОГО типа!
  - Полупрозрачные фоны (rgba с alpha < 1, opacity < 1)
  - backdrop-filter, filter: blur
  - background-image с градиентами
  - color: white или color: #fff внутри карточек
  
  ✅ Используй ТОЛЬКО сплошные непрозрачные цвета для фонов!

  🚨🚨🚨 КРИТИЧЕСКИ ВАЖНО — КОНТРАСТ ТЕКСТА (НАРУШЕНИЕ = ПРОВАЛ):
  
  ЭТО ГЛАВНОЕ ПРАВИЛО! При написании КАЖДОГО элемента с текстом:
  1. Определи цвет фона (background) ближайшего родителя
  2. Выбери цвет текста (color) по таблице ниже
  3. ВСЕГДА указывай color: #111827 для текста на светлом фоне!
  
  ТАБЛИЦА КОНТРАСТА (ЗАПОМНИ НАИЗУСТЬ):
  
  | ФОНЫ (background)              | ТЕКСТ (color)           |
  |--------------------------------|-------------------------|
  | #ffffff, #fff, white           | #111827 (ТЁМНЫЙ!)       |
  | #f9fafb, #f3f4f6, #e5e7eb      | #111827 (ТЁМНЫЙ!)       |
  | #111827, #1f2937, #374151      | #ffffff (белый)         |
  | #FF8B36 (оранжевый)            | #ffffff (белый)         |
  | #2D8CFF (синий)                | #ffffff (белый)         |
  
  ❌ ЗАПРЕЩЁННЫЕ КОМБИНАЦИИ (НИКОГДА!):
  - color: white на светлом фоне 
  - color: #fff на светлом фоне
  - color: #f3f4f6 на светлом фоне
  - Любой светлый текст на светлом фоне
  
  ✅ ОБЯЗАТЕЛЬНО для карточек: class="card" + color: #111827 для текста!
  
  ПРИМЕРЫ ПРАВИЛЬНОГО КОДА:
  
  <!-- Карточка на белом фоне -->
  <div style="background: #ffffff; padding: 24px;">
    <h3 style="color: #111827;">Заголовок</h3>
    <p style="color: #374151;">Описание</p>
  </div>
  
  <!-- Тёмная секция -->
  <div style="background: #1f2937; padding: 24px;">
    <h3 style="color: #ffffff;">Заголовок</h3>
    <p style="color: #f3f4f6;">Описание</p>
  </div>
  
  <!-- Оранжевая кнопка -->
  <a style="background: #FF8B36; color: #ffffff;">Текст</a>

  ✨ ИНТЕРАКТИВНОСТЬ — ОБЯЗАТЕЛЬНО ДОБАВЛЯЙ <style> В НАЧАЛЕ:
  
  <style>
    .card { transition: all 0.3s ease; background: #ffffff; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px -6px rgba(17,24,39,0.1); }
    .btn { transition: all 0.2s ease; }
    .btn:hover { transform: scale(1.02); filter: brightness(1.05); }
    .btn:active { transform: scale(0.98); }
    .metric { transition: all 0.3s ease; background: #f3f4f6; text-align: center; }
    .metric:hover { background: #e5e7eb; }
    .img-card { transition: transform 0.4s ease; }
    .img-card:hover { transform: scale(1.01); }
    .feature { transition: all 0.3s ease; }
    .feature:hover { background: #f9fafb; }
    .step-item { position: relative; background: #ffffff; }
    .step-item:hover { background: #f9fafb; }
    .step-item::before { content: ''; position: absolute; left: 24px; top: 60px; width: 2px; height: calc(100% - 60px); background: #2D8CFF; }
    @media (prefers-color-scheme: dark) {
      .dark-text { color: #f3f4f6 !important; }
      .dark-text-secondary { color: #d1d5db !important; }
      .dark-text-muted { color: #9ca3af !important; }
    }
  </style>
  
  🌙 ТЁМНАЯ ТЕМА — ТЕКСТ БЕЗ ФОНА:
  
  Для одиночного текста БЕЗ фонового блока добавляй класс dark-text:
  - Заголовки вне карточек: class="dark-text" style="color: #111827; ..."
  - Подзаголовки вне карточек: class="dark-text-secondary" style="color: #374151; ..."  
  - Описания вне карточек: class="dark-text-muted" style="color: #6b7280; ..."
  
  ❌ НЕ добавляй dark-text для текста ВНУТРИ:
  - Карточек (class="card") — там всегда белый фон
  - Метрик (class="metric") — там светлый фон
  - Тёмных секций — там всегда белый текст
  - Кнопок — там всегда белый текст

  📐 СТРУКТУРА:

  КАРТОЧКИ (чистый стиль, БЕЗ border!):
  class="card" style="background: #ffffff; border-radius: 16px; padding: 28px; box-shadow: 0 4px 12px -4px rgba(17,24,39,0.08);"
  
  ❌ НИКОГДА не добавляй border к карточкам!

  КНОПКИ ОРАНЖЕВЫЕ:
  class="btn" style="display: inline-block; padding: 14px 28px; background: #FF8B36; border-radius: 12px; color: white; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px -4px rgba(255,139,54,0.3);"

  КНОПКИ СИНИЕ:
  class="btn" style="display: inline-block; padding: 14px 28px; background: #2D8CFF; border-radius: 12px; color: white; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px -4px rgba(45,140,255,0.3);"

  МЕТРИКИ (центрированные, крупный шрифт):
  class="metric" style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center;"
  <div style="font-size: 36px; font-weight: 800; color: #111827; letter-spacing: -0.02em;">10 000</div>
  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">резюме в день</div>
  
  ТЁМНЫЕ СЕКЦИИ:
  style="background: #1f2937; border-radius: 24px; padding: 48px; color: white;"

  ЗАГОЛОВКИ (без градиентов!):
  style="font-size: 42px; font-weight: 800; color: #111827;"
  или оранжевый: style="font-size: 42px; font-weight: 800; color: #FF8B36;"

  🎯 СЛОЖНЫЕ КОМПОНЕНТЫ:

  1. ТАБЫ/ПЕРЕКЛЮЧАТЕЛИ:
  <div style="display: flex; gap: 8px; background: #f3f4f6; padding: 6px; border-radius: 12px; width: fit-content;">
    <div class="btn" style="padding: 10px 20px; background: #FF8B36; color: white; border-radius: 8px;">Вкладка 1</div>
    <div style="padding: 10px 20px; color: #6b7280; cursor: pointer;">Вкладка 2</div>
  </div>

  2. ПРОГРЕСС-БАР:
  <div style="background: #e5e7eb; border-radius: 100px; height: 8px; overflow: hidden;">
    <div style="width: 75%; height: 100%; background: #FF8B36; border-radius: 100px;"></div>
  </div>

  3. ШАГИ/TIMELINE (без hover-заливки!):
  <div class="step-item" style="display: flex; gap: 16px; padding: 16px; border-radius: 12px;">
    <div style="width: 40px; height: 40px; background: #FF8B36; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; flex-shrink: 0;">1</div>
    <div>
      <h4 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 4px;">Название шага</h4>
      <p style="font-size: 14px; color: #6b7280; margin: 0;">Описание шага</p>
    </div>
  </div>
  
  ❌ При hover НЕ менять цвет фона на оранжевый! Только лёгкое осветление (#f9fafb)

  4. КАРТОЧКИ С ИЗОБРАЖЕНИЯМИ:
  <div class="img-card card" style="overflow: hidden; padding: 0;">
    <img src="/assets/..." style="width: 100%; display: block;">
    <div style="padding: 24px;">
      <h4 style="color: #111827;">Заголовок</h4>
      <p style="color: #6b7280;">Описание</p>
    </div>
  </div>

  5. BADGES/ТЕГИ (аккуратные пилюли):
  <span style="display: inline-flex; align-items: center; padding: 4px 10px; background: #f3f4f6; color: #374151; border-radius: 6px; font-size: 12px; font-weight: 500;">Метка</span>

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
