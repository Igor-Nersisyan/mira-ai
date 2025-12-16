import { useState, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { DynamicContent } from "@/components/dynamic-content";
import { HeroBlock } from "@/components/hero-block";
import type { Message, StreamEvent } from "@shared/schema";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dynamicHtml, setDynamicHtml] = useState<string | null>(null);
  const [streamingHtml, setStreamingHtml] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHtmlStreaming, setIsHtmlStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const extractCompleteBlocks = (html: string): string => {
    const styleMatch = html.match(/^(\s*<style[^>]*>[\s\S]*?<\/style>\s*)/i);
    const styleBlock = styleMatch ? styleMatch[1] : "";
    const afterStyle = styleMatch ? html.slice(styleMatch[0].length) : html;
    
    let completeHtml = styleBlock;
    let depth = 0;
    let blockStart = 0;
    let i = 0;
    
    while (i < afterStyle.length) {
      if (afterStyle[i] === '<') {
        const isClosing = afterStyle[i + 1] === '/';
        const tagEnd = afterStyle.indexOf('>', i);
        if (tagEnd === -1) break;
        
        const tagContent = afterStyle.slice(i + (isClosing ? 2 : 1), tagEnd);
        const tagName = tagContent.split(/[\s\/]/)[0].toLowerCase();
        const selfClosing = ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName) || 
                           afterStyle[tagEnd - 1] === '/';
        
        if (!selfClosing) {
          if (isClosing) {
            depth--;
            if (depth === 0) {
              completeHtml += afterStyle.slice(blockStart, tagEnd + 1);
              blockStart = tagEnd + 1;
            }
          } else {
            if (depth === 0) blockStart = i;
            depth++;
          }
        }
        i = tagEnd + 1;
      } else {
        i++;
      }
    }
    
    return completeHtml;
  };

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
    setStreamingHtml(null);

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
    setStreamingHtml(null);
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
      
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 dark:from-pink-950/30 dark:via-purple-950/20 dark:to-blue-950/30">
        <DynamicContent 
          html={dynamicHtml} 
          streamingHtml={streamingHtml}
          isStreaming={isHtmlStreaming}
        >
          <HeroBlock />
        </DynamicContent>
      </div>
    </div>
  );
}
