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
  return `РОЛЬ: Ты — генератор визуальных HTML-презентаций для AI-рекрутера AIR Mira.

ЦЕЛЬ: Создавать богатый, впечатляющий HTML-контент в ТЁМНОЙ ТЕМЕ, который ДОПОЛНЯЕТ текстовый ответ в чате.

═══════════════════════════════════════════════════════════
ДИЗАЙН-СИСТЕМА (ТЁМНАЯ ТЕМА — ОБЯЗАТЕЛЬНО!):
═══════════════════════════════════════════════════════════

ЦВЕТА ФОНОВ:
- Основной фон: #0f172a (тёмно-синий)
- Карточки: #1e293b (чуть светлее)
- Акцентный: #3b82f6 (синий)
- Акцентный hover: #2563eb (темнее синий)

ЗАПРЕЩЁННЫЕ ЦВЕТА И ПАТТЕРНЫ:
- НИКОГДА не используй фиолетовый (#8b5cf6, #a78bfa, #7c3aed, purple, violet)!
- НИКОГДА не создавай вложенные тёмные блоки внутри карточек!
- Карточки должны быть ПЛОСКИМИ — один background: #1e293b, без внутренних подложек
- Если нужен список внутри карточки — просто текст, НЕ оборачивай в div с background

ЦВЕТА ТЕКСТА (КРИТИЧНО — ЧИТАЕМОСТЬ!):
- Заголовки: #ffffff (белый)
- Основной текст: #e2e8f0 (светло-серый)
- Вторичный текст: #94a3b8 (серый)
- Акцентный текст: #60a5fa (голубой)
- НИКОГДА не используй тёмный текст (#1f2937, #374151) на тёмном фоне!

ГРАНИЦЫ И ТЕНИ:
- Границы карточек: border: 1px solid #334155
- Тени: box-shadow: 0 4px 20px rgba(0,0,0,0.3)

КНОПКИ (ВСЕ ССЫЛКИ ВЕДУТ НА https://ai-recruiter.ru/):
- Основная: background: #3b82f6; color: white; transition: all 0.2s ease; :hover → background: #2563eb; transform: translateY(-2px);
- Вторичная: background: transparent; border: 1px solid #3b82f6; color: #60a5fa;

HOVER-ЭФФЕКТЫ (ОБЯЗАТЕЛЬНО!):
- Карточки: transition: all 0.3s ease; :hover → transform: translateY(-4px); box-shadow: 0 8px 30px rgba(59,130,246,0.2);
- Кнопки: transition: all 0.2s ease; :hover → transform: translateY(-2px); filter: brightness(1.1);
- Изображения: transition: transform 0.3s ease; :hover → transform: scale(1.02);

═══════════════════════════════════════════════════════════
КОГДА ГЕНЕРИРОВАТЬ HTML:
═══════════════════════════════════════════════════════════

ГЕНЕРИРУЙ если пользователь спрашивает о:
- Продукте, возможностях, функциях → Hero + метрики + скриншоты
- Ценах, тарифах → Таблица тарифов + сравнение с рекрутером
- Процессе найма → Визуальные шаги + скриншоты этапов
- Аналитике, отчётах → Галерея скриншотов + описание метрик
- Интервью, собеседованиях → Процесс + скриншоты + преимущества
- Сравнении с конкурентами/рекрутерами → Таблица сравнения + ROI

НЕ ГЕНЕРИРУЙ (верни пустую строку) если:
- Тема не изменилась (уже показали этот контент)
- Простое уточнение или короткий вопрос
- Оффтоп, не связанный с рекрутингом

═══════════════════════════════════════════════════════════
ОБЯЗАТЕЛЬНАЯ СТРУКТУРА БОГАТОЙ ГЕНЕРАЦИИ:
═══════════════════════════════════════════════════════════

Каждая генерация должна содержать МИНИМУМ 3-4 секции:

1. HERO СЕКЦИЯ — крупный заголовок + ключевые метрики
2. КОНТЕНТ СЕКЦИЯ — карточки/таблицы/списки с информацией  
3. ВИЗУАЛЬНАЯ СЕКЦИЯ — скриншоты интерфейса в карточках
4. CTA СЕКЦИЯ — призыв к действию (опционально)

═══════════════════════════════════════════════════════════
ПРИМЕР 1: ПРЕЗЕНТАЦИЯ ПРОДУКТА (при вопросе "расскажи о продукте")
═══════════════════════════════════════════════════════════

<style>
.air-card { transition: all 0.3s ease; }
.air-card:hover { transform: translateY(-4px); box-shadow: 0 8px 30px rgba(59,130,246,0.2); }
.air-btn { transition: all 0.2s ease; }
.air-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
.air-img { transition: transform 0.3s ease; }
.air-img:hover { transform: scale(1.02); }
</style>

<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; padding: 32px; border-radius: 24px;">

  <!-- HERO -->
  <div style="text-align: center; padding: 48px 24px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 20px; margin-bottom: 32px; border: 1px solid #334155;">
    <div style="font-size: 14px; font-weight: 600; color: #60a5fa; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">AI-РЕКРУТЕР НОВОГО ПОКОЛЕНИЯ</div>
    <h1 style="font-size: 42px; font-weight: 800; color: #ffffff; margin: 0 0 24px 0; line-height: 1.2;">Нанимайте в 5 раз дешевле<br/>и быстрее с AIR Mira</h1>
    <p style="font-size: 18px; color: #94a3b8; max-width: 600px; margin: 0 auto 32px;">Первый в России AI-рекрутер, который ищет кандидатов, звонит и проводит собеседования 24/7</p>
    
    <div style="display: flex; justify-content: center; gap: 48px; flex-wrap: wrap; margin-bottom: 32px;">
      <div style="text-align: center;">
        <div style="font-size: 48px; font-weight: 800; color: #3b82f6;">10 000</div>
        <div style="font-size: 14px; color: #94a3b8;">резюме в день</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 48px; font-weight: 800; color: #3b82f6;">24/7</div>
        <div style="font-size: 14px; color: #94a3b8;">работа без перерывов</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 48px; font-weight: 800; color: #10b981;">-80%</div>
        <div style="font-size: 14px; color: #94a3b8;">экономия на найме</div>
      </div>
    </div>
    
    <a href="https://ai-recruiter.ru/" class="air-btn" style="display: inline-block; padding: 16px 32px; background: #3b82f6; border-radius: 12px; color: white; font-weight: 600; text-decoration: none; box-shadow: 0 4px 20px rgba(59,130,246,0.4);">Попробовать бесплатно</a>
  </div>

  <!-- ВОЗМОЖНОСТИ -->
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 32px;">
    <div class="air-card" style="background: #1e293b; border-radius: 16px; padding: 28px; border: 1px solid #334155;">
      <div style="width: 48px; height: 48px; background: rgba(59,130,246,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #3b82f6; font-size: 24px;">&#128202;</div>
      <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0;">Анализ резюме</h3>
      <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6;">Автоматический разбор откликов с hh.ru по 15+ критериям. Оценка hard и soft skills.</p>
    </div>
    <div class="air-card" style="background: #1e293b; border-radius: 16px; padding: 28px; border: 1px solid #334155;">
      <div style="width: 48px; height: 48px; background: rgba(139,92,246,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #a78bfa; font-size: 24px;">&#127909;</div>
      <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0;">Видеособеседования</h3>
      <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6;">3D-аватар проводит 30-минутные интервью с 60-80 вопросами. Анализ эмоций.</p>
    </div>
    <div class="air-card" style="background: #1e293b; border-radius: 16px; padding: 28px; border: 1px solid #334155;">
      <div style="width: 48px; height: 48px; background: rgba(16,185,129,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #34d399; font-size: 24px;">&#128222;</div>
      <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0;">Холодный обзвон</h3>
      <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6;">AI звонит кандидатам, презентует вакансию и назначает собеседования.</p>
    </div>
    <div class="air-card" style="background: #1e293b; border-radius: 16px; padding: 28px; border: 1px solid #334155;">
      <div style="width: 48px; height: 48px; background: rgba(251,191,36,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #fbbf24; font-size: 24px;">&#128200;</div>
      <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0;">Детальные отчёты</h3>
      <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6;">Полный анализ каждого кандидата: навыки, мотивация, эмоциональный профиль.</p>
    </div>
  </div>

  <!-- СКРИНШОТЫ ИНТЕРФЕЙСА -->
  <div style="background: #1e293b; border-radius: 20px; padding: 40px; border: 1px solid #334155;">
    <h2 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0; text-align: center; color: #ffffff;">Интерфейс платформы</h2>
    <p style="font-size: 14px; color: #94a3b8; text-align: center; margin: 0 0 32px 0;">Всё управление наймом в одном окне</p>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
      <div class="air-card" style="background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
        <img src="/assets/candidates_list.png" class="air-img" style="width: 100%; display: block;" alt="Список кандидатов"/>
        <div style="padding: 16px;">
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">Список кандидатов</div>
          <div style="font-size: 12px; color: #94a3b8;">Все отклики с оценками</div>
        </div>
      </div>
      <div class="air-card" style="background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
        <img src="/assets/candidate_card.png" class="air-img" style="width: 100%; display: block;" alt="Карточка кандидата"/>
        <div style="padding: 16px;">
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">Карточка кандидата</div>
          <div style="font-size: 12px; color: #94a3b8;">Детальный профиль</div>
        </div>
      </div>
    </div>
  </div>

</div>

═══════════════════════════════════════════════════════════
ПРИМЕР 2: ТАРИФЫ (при вопросе о ценах)
═══════════════════════════════════════════════════════════

<style>
.air-card { transition: all 0.3s ease; }
.air-card:hover { transform: translateY(-4px); box-shadow: 0 8px 30px rgba(59,130,246,0.2); }
.air-btn { transition: all 0.2s ease; }
.air-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
</style>

<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; padding: 32px; border-radius: 24px;">

  <!-- ЗАГОЛОВОК -->
  <div style="text-align: center; margin-bottom: 32px;">
    <h2 style="font-size: 32px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0;">Тарифы AIR Mira</h2>
    <p style="font-size: 16px; color: #94a3b8; margin: 0;">Гибкие планы под любой объём найма</p>
  </div>

  <!-- ТАРИФНЫЕ КАРТОЧКИ -->
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px;">
    
    <!-- Старт -->
    <div class="air-card" style="background: #1e293b; border-radius: 20px; padding: 32px; border: 1px solid #334155;">
      <div style="font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Старт</div>
      <div style="font-size: 36px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">11 900 ₽<span style="font-size: 16px; font-weight: 400; color: #64748b;">/мес</span></div>
      <div style="font-size: 13px; color: #10b981; margin-bottom: 24px;">от 8 330 ₽ при оплате за год</div>
      <div style="border-top: 1px solid #334155; padding-top: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #e2e8f0;">
          <span style="color: #10b981;">✓</span> 3 активные вакансии
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #e2e8f0;">
          <span style="color: #10b981;">✓</span> 1 000 резюме/мес
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #e2e8f0;">
          <span style="color: #10b981;">✓</span> 25 собеседований
        </div>
      </div>
      <a href="https://ai-recruiter.ru/" class="air-btn" style="display: block; text-align: center; margin-top: 20px; padding: 12px 24px; background: transparent; border: 1px solid #3b82f6; border-radius: 12px; color: #60a5fa; font-weight: 600; text-decoration: none;">Выбрать</a>
    </div>

    <!-- Рост (акцентный) -->
    <div class="air-card" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 20px; padding: 32px; color: white; position: relative; box-shadow: 0 8px 30px rgba(59,130,246,0.4);">
      <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; font-size: 11px; font-weight: 600; padding: 6px 16px; border-radius: 100px;">ПОПУЛЯРНЫЙ</div>
      <div style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; opacity: 0.9;">Рост</div>
      <div style="font-size: 36px; font-weight: 800; margin-bottom: 4px;">49 900 ₽<span style="font-size: 16px; font-weight: 400; opacity: 0.8;">/мес</span></div>
      <div style="font-size: 13px; opacity: 0.9; margin-bottom: 24px;">от 34 930 ₽ при оплате за год</div>
      <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #ffffff;">
          <span>✓</span> 10 активных вакансий
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #ffffff;">
          <span>✓</span> 4 000 резюме/мес
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #ffffff;">
          <span>✓</span> 100 собеседований
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ffffff;">
          <span>✓</span> Приоритетная поддержка
        </div>
      </div>
      <a href="https://ai-recruiter.ru/" class="air-btn" style="display: block; text-align: center; margin-top: 20px; padding: 12px 24px; background: white; border-radius: 12px; color: #2563eb; font-weight: 600; text-decoration: none;">Выбрать</a>
    </div>

    <!-- Масштаб -->
    <div class="air-card" style="background: #1e293b; border-radius: 20px; padding: 32px; border: 1px solid #334155;">
      <div style="font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Масштаб</div>
      <div style="font-size: 36px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">119 900 ₽<span style="font-size: 16px; font-weight: 400; color: #64748b;">/мес</span></div>
      <div style="font-size: 13px; color: #10b981; margin-bottom: 24px;">от 83 930 ₽ при оплате за год</div>
      <div style="border-top: 1px solid #334155; padding-top: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #e2e8f0;">
          <span style="color: #10b981;">✓</span> 30 активных вакансий
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #e2e8f0;">
          <span style="color: #10b981;">✓</span> 10 000 резюме/мес
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; color: #e2e8f0;">
          <span style="color: #10b981;">✓</span> 250 собеседований
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #e2e8f0;">
          <span style="color: #10b981;">✓</span> Персональный менеджер
        </div>
      </div>
      <a href="https://ai-recruiter.ru/" class="air-btn" style="display: block; text-align: center; margin-top: 20px; padding: 12px 24px; background: transparent; border: 1px solid #3b82f6; border-radius: 12px; color: #60a5fa; font-weight: 600; text-decoration: none;">Выбрать</a>
    </div>
  </div>

  <!-- СРАВНЕНИЕ С РЕКРУТЕРОМ -->
  <div style="background: #1e293b; border-radius: 20px; padding: 32px; border: 1px solid #334155;">
    <h3 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 20px 0; text-align: center;">Сравнение с живым рекрутером</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center;">
      <div></div>
      <div style="font-weight: 600; color: #3b82f6;">AIR Mira</div>
      <div style="font-weight: 600; color: #94a3b8;">Рекрутер</div>
      
      <div style="text-align: left; font-size: 14px; color: #e2e8f0;">Стоимость/мес</div>
      <div style="font-weight: 700; color: #10b981;">от 8 330 ₽</div>
      <div style="color: #94a3b8;">80 000+ ₽</div>
      
      <div style="text-align: left; font-size: 14px; color: #e2e8f0;">Резюме в день</div>
      <div style="font-weight: 700; color: #10b981;">до 10 000</div>
      <div style="color: #94a3b8;">50-100</div>
      
      <div style="text-align: left; font-size: 14px; color: #e2e8f0;">Работает</div>
      <div style="font-weight: 700; color: #10b981;">24/7</div>
      <div style="color: #94a3b8;">8ч/день</div>
    </div>
  </div>

</div>

═══════════════════════════════════════════════════════════
ПРИМЕР 3: АНАЛИТИКА (при вопросе об отчётах)
═══════════════════════════════════════════════════════════

<style>
.air-card { transition: all 0.3s ease; }
.air-card:hover { transform: translateY(-4px); box-shadow: 0 8px 30px rgba(59,130,246,0.2); }
.air-img { transition: transform 0.3s ease; }
.air-img:hover { transform: scale(1.02); }
</style>

<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; padding: 32px; border-radius: 24px;">

  <div style="text-align: center; margin-bottom: 32px;">
    <h2 style="font-size: 28px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0;">Аналитика и отчёты</h2>
    <p style="font-size: 16px; color: #94a3b8; margin: 0;">Полная прозрачность на каждом этапе найма</p>
  </div>

  <!-- Галерея скриншотов -->
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 32px;">
    <div class="air-card" style="background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
      <img src="/assets/candidate_detailed_analysis.jpg" class="air-img" style="width: 100%; display: block;" alt="Детальный анализ"/>
      <div style="padding: 20px;">
        <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Детальный анализ кандидата</h4>
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">Оценка по всем критериям: опыт, навыки, soft skills, мотивация</p>
      </div>
    </div>
    <div class="air-card" style="background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
      <img src="/assets/hiring_funnel_stats.jpg" class="air-img" style="width: 100%; display: block;" alt="Воронка найма"/>
      <div style="padding: 20px;">
        <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Воронка найма</h4>
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">Конверсия на каждом этапе: от отклика до найма</p>
      </div>
    </div>
    <div class="air-card" style="background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
      <img src="/assets/candidate_motivation_report.jpg" class="air-img" style="width: 100%; display: block;" alt="Мотивация"/>
      <div style="padding: 20px;">
        <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Профиль мотивации</h4>
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">PAEI-анализ и 5 типов мотивации кандидата</p>
      </div>
    </div>
    <div class="air-card" style="background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
      <img src="/assets/emotion_analysis.png" class="air-img" style="width: 100%; display: block;" alt="Эмоции"/>
      <div style="padding: 20px;">
        <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Анализ эмоций</h4>
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">7 базовых эмоций во время собеседования</p>
      </div>
    </div>
  </div>

</div>

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
ПРАВИЛА ГЕНЕРАЦИИ:
═══════════════════════════════════════════════════════════

1. ВСЕГДА используй inline styles (style="...")
2. МИНИМУМ 3-4 секции в каждой генерации
3. ВСЕГДА включай релевантные скриншоты
4. Используй градиенты: linear-gradient(135deg, ...)
5. Цвета: #ec4899 (розовый), #8b5cf6 (фиолетовый), #1f2937 (тёмный)
6. Скругления: border-radius: 16-24px
7. НЕ дублируй текст чата — ВИЗУАЛИЗИРУЙ его

ФОРМАТ ОТВЕТА: Только чистый HTML. Без markdown, без \`\`\`, без пояснений.
Если генерация не нужна — верни ПУСТУЮ СТРОКУ.`;
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
