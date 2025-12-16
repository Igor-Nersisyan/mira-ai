import { useState, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { DynamicContent } from "@/components/dynamic-content";
import { HeroBlock } from "@/components/hero-block";
import { ChatBackground } from "@/components/chat-background";
import type { Message, StreamEvent } from "@shared/schema";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dynamicHtml, setDynamicHtml] = useState<string | null>(null);
  const [streamingHtml, setStreamingHtml] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [isHtmlStreaming, setIsHtmlStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const extractCompleteBlocks = (html: string): string => {
    const styleMatch = html.match(/^(\s*<style[^>]*>[\s\S]*?<\/style>\s*)/i);
    if (!styleMatch) return "";
    
    const styleBlock = styleMatch[1];
    const afterStyle = html.slice(styleMatch[0].length);
    
    const lastClosingDiv = afterStyle.lastIndexOf('</div>');
    if (lastClosingDiv === -1) return styleBlock;
    
    let depth = 0;
    let validEnd = -1;
    
    for (let i = 0; i <= lastClosingDiv; i++) {
      if (afterStyle.slice(i, i + 4) === '<div') {
        depth++;
      } else if (afterStyle.slice(i, i + 6) === '</div>') {
        depth--;
        if (depth === 0) {
          validEnd = i + 6;
        }
      }
    }
    
    if (validEnd === -1) return styleBlock;
    return styleBlock + afterStyle.slice(0, validEnd);
  };

  const streamChat = useCallback(async (allMessages: Message[]): Promise<string> => {
    setIsChatTyping(true);
    
    try {
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
    } finally {
      setIsChatTyping(false);
    }
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
      let lastShownHtml = "";

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
                const completeBlocks = extractCompleteBlocks(fullHtml);
                if (completeBlocks.length > lastShownHtml.length) {
                  lastShownHtml = completeBlocks;
                  setStreamingHtml(completeBlocks);
                }
              } else if (event.type === "html_end") {
                setStreamingHtml(null);
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

      setStreamingHtml(null);
      return fullHtml.trim() || null;
    } finally {
      setIsHtmlStreaming(false);
      setStreamingHtml(null);
    }
  }, []);

  const isLoading = isChatTyping || isHtmlStreaming;

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
      setStreamingMessage("");

      try {
        const context = allMessages
          .slice(-6)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");

        const htmlPromise = streamHtml(context, messageText.trim(), dynamicHtml).catch(() => null);
        
        const assistantResponse = await streamChat(allMessages);
        
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantResponse,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingMessage("");

        const html = await htmlPromise;
        if (html) {
          setDynamicHtml(html);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Chat error:", error);
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Извините, произошла ошибка. Попробуйте ещё раз.",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } finally {
        setStreamingMessage("");
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, streamChat, streamHtml, dynamicHtml]
  );

  const handleResetChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setDynamicHtml(null);
    setStreamingHtml(null);
    setStreamingMessage("");
    setIsChatTyping(false);
    setIsHtmlStreaming(false);
  }, []);

  return (
    <div className="relative flex flex-col lg:flex-row h-screen overflow-hidden bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 dark:from-pink-950/30 dark:via-purple-950/20 dark:to-blue-950/30">
      <ChatBackground />
      
      <div className="relative w-full lg:w-[30%] lg:min-w-[360px] lg:max-w-[480px] h-[50vh] lg:h-full border-b lg:border-b-0 lg:border-r border-border/50 flex-shrink-0">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onReset={handleResetChat}
          isLoading={isLoading}
          isChatTyping={isChatTyping}
          streamingMessage={streamingMessage}
        />
      </div>
      
      <div className="relative flex-1 overflow-y-auto">
        <div className="relative z-10">
          <div className="absolute inset-0 backdrop-blur-[2px] bg-white/15 dark:bg-black/10 pointer-events-none" style={{ minHeight: '100%', height: 'auto' }} />
          <div className="relative z-20">
            <DynamicContent 
              html={dynamicHtml} 
              streamingHtml={streamingHtml}
              isStreaming={isHtmlStreaming}
            >
              <HeroBlock />
            </DynamicContent>
          </div>
        </div>
      </div>
    </div>
  );
}
