import { useState, useCallback } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { DynamicContent } from "@/components/dynamic-content";
import { HeroBlock } from "@/components/hero-block";
import type { Message, AIResponse } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dynamicHtml, setDynamicHtml] = useState<string | null>(null);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string): Promise<AIResponse> => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      };
      
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      
      const response = await apiRequest("POST", "/api/chat", {
        messages: updatedMessages,
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
    onError: (error) => {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Извините, произошла ошибка. Попробуйте ещё раз.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error("Chat error:", error);
    },
  });

  const handleSendMessage = useCallback(
    (message: string) => {
      if (message.trim() && !chatMutation.isPending) {
        chatMutation.mutate(message);
      }
    },
    [chatMutation]
  );

  const handleResetChat = useCallback(() => {
    setMessages([]);
    setDynamicHtml(null);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background">
      <div className="w-full lg:w-[30%] lg:min-w-[360px] lg:max-w-[480px] border-b lg:border-b-0 lg:border-r border-border">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onReset={handleResetChat}
          isLoading={chatMutation.isPending}
        />
      </div>
      
      <div className="flex-1 overflow-auto">
        <DynamicContent html={dynamicHtml}>
          <HeroBlock />
        </DynamicContent>
      </div>
    </div>
  );
}
