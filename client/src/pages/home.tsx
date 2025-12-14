import { useState, useCallback } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { DynamicContent } from "@/components/dynamic-content";
import { HeroBlock } from "@/components/hero-block";
import type { Message, AIResponse } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface MutationContext {
  userMessage: Message;
  allMessages: Message[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dynamicHtml, setDynamicHtml] = useState<string | null>(null);

  const chatMutation = useMutation({
    mutationFn: async (context: MutationContext): Promise<AIResponse> => {
      const response = await apiRequest("POST", "/api/chat", {
        messages: context.allMessages,
      });
      
      return response.json();
    },
    onSuccess: (data: AIResponse) => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      if (data.html !== null) {
        setDynamicHtml(data.html);
      }
    },
    onError: () => {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Извините, произошла ошибка. Попробуйте ещё раз.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const handleSendMessage = useCallback(
    (messageText: string) => {
      if (messageText.trim() && !chatMutation.isPending) {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: messageText.trim(),
          timestamp: Date.now(),
        };
        
        setMessages((prev) => {
          const allMessages = [...prev, userMessage];
          chatMutation.mutate({ userMessage, allMessages });
          return allMessages;
        });
      }
    },
    [chatMutation]
  );

  const handleResetChat = useCallback(() => {
    setMessages([]);
    setDynamicHtml(null);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-background">
      <div className="w-full lg:w-[30%] lg:min-w-[360px] lg:max-w-[480px] h-[50vh] lg:h-full border-b lg:border-b-0 lg:border-r border-border flex-shrink-0">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onReset={handleResetChat}
          isLoading={chatMutation.isPending}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <DynamicContent html={dynamicHtml}>
          <HeroBlock />
        </DynamicContent>
      </div>
    </div>
  );
}
