import { useState, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { DynamicContent } from "@/components/dynamic-content";
import { HeroBlock } from "@/components/hero-block";
import type { Message, StreamEvent } from "@shared/schema";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dynamicHtml, setDynamicHtml] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHtmlStreaming, setIsHtmlStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamChat = useCallback(async (allMessages: Message[]): Promise<string> => {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: allMessages }),
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      throw new Error("Chat request failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event: StreamEvent = JSON.parse(line.slice(6));
            
            if (event.type === "chat_chunk") {
              fullMessage += event.content;
              setStreamingMessage(fullMessage);
            } else if (event.type === "chat_end") {
              fullMessage = event.fullMessage;
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }

    return fullMessage;
  }, []);

  const streamHtml = useCallback(async (
    conversationContext: string, 
    lastUserMessage: string, 
    currentHtml: string | null
  ): Promise<string | null> => {
    setIsHtmlStreaming(true);

    try {
      const response = await fetch("/api/html/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          conversationContext, 
          lastUserMessage, 
          currentHtml 
        }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error("HTML request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullHtml = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));
              
              if (event.type === "html_chunk") {
                fullHtml += event.content;
              } else if (event.type === "html_end") {
                return event.fullHtml;
              } else if (event.type === "error") {
                throw new Error(event.message);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      return fullHtml.trim() || null;
    } finally {
      setIsHtmlStreaming(false);
    }
  }, []);

  const handleSendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      abortControllerRef.current = new AbortController();

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageText.trim(),
        timestamp: Date.now(),
      };

      const allMessages = [...messages, userMessage];
      setMessages(allMessages);
      setIsLoading(true);
      setStreamingMessage("");

      try {
        const context = allMessages
          .slice(-6)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");

        const chatPromise = streamChat(allMessages);
        const htmlPromise = streamHtml(context, messageText.trim(), dynamicHtml);

        const [assistantResponse, html] = await Promise.all([chatPromise, htmlPromise]);

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantResponse,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingMessage("");
        setIsLoading(false);

        if (html) {
          setDynamicHtml(html);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Извините, произошла ошибка. Попробуйте ещё раз.",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } finally {
        setIsLoading(false);
        setStreamingMessage("");
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, streamChat, streamHtml]
  );

  const handleResetChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setDynamicHtml(null);
    setStreamingMessage("");
    setIsLoading(false);
    setIsHtmlStreaming(false);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-background">
      <div className="w-full lg:w-[30%] lg:min-w-[360px] lg:max-w-[480px] h-[50vh] lg:h-full border-b lg:border-b-0 lg:border-r border-border flex-shrink-0">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onReset={handleResetChat}
          isLoading={isLoading}
          streamingMessage={streamingMessage}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <DynamicContent 
          html={dynamicHtml} 
          isStreaming={isHtmlStreaming}
        >
          <HeroBlock />
        </DynamicContent>
      </div>
    </div>
  );
}
