import { z } from "zod";

export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.number(),
});

export type Message = z.infer<typeof messageSchema>;

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const htmlRequestSchema = z.object({
  conversationContext: z.string(),
  lastUserMessage: z.string(),
  lastAssistantMessage: z.string(),
});

export type HtmlRequest = z.infer<typeof htmlRequestSchema>;

export const aiResponseSchema = z.object({
  message: z.string(),
  html: z.string().nullable(),
});

export type AIResponse = z.infer<typeof aiResponseSchema>;

export const chatResponseSchema = z.object({
  success: z.boolean(),
  data: aiResponseSchema.optional(),
  error: z.string().optional(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

export type StreamEvent = 
  | { type: "chat_start" }
  | { type: "chat_chunk"; content: string }
  | { type: "chat_end"; fullMessage: string }
  | { type: "html_start" }
  | { type: "html_chunk"; content: string }
  | { type: "html_end"; fullHtml: string }
  | { type: "error"; message: string };
