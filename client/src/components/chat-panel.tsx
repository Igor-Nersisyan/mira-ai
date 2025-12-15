import { useRef, useEffect } from "react";
import { MessageList } from "@/components/message-list";
import { ChatInput } from "@/components/chat-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { RotateCcw, Sparkles } from "lucide-react";
import type { Message } from "@shared/schema";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onReset: () => void;
  isLoading: boolean;
  streamingMessage?: string;
}

export function ChatPanel({
  messages,
  onSendMessage,
  onReset,
  isLoading,
  streamingMessage = "",
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, streamingMessage]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 dark:from-pink-950/30 dark:via-purple-950/20 dark:to-blue-950/30">
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-pink-200/50 dark:border-white/10 backdrop-blur-xl bg-gradient-to-r from-white/60 via-pink-50/40 to-purple-50/40 dark:from-black/40 dark:via-purple-900/20 dark:to-pink-900/20 sticky top-0 z-10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card animate-pulse" />
          </div>
          <div>
            <h2 className="font-semibold text-card-foreground text-sm">Mira</h2>
            <p className="text-xs text-muted-foreground">AI-рекрутер</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground"
              data-testid="button-reset-chat"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Сбросить
            </Button>
          )}
          <ThemeToggle />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        data-testid="chat-messages-container"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-card-foreground mb-2">
              Привет! Я Mira
            </h3>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              Первый AI-рекрутер в России. Расскажите, какие задачи по найму вы хотите решить, и я помогу разобраться.
            </p>
          </div>
        ) : (
          <MessageList 
            messages={messages} 
            isLoading={isLoading} 
            streamingMessage={streamingMessage}
          />
        )}
      </div>

      <div className="border-t border-pink-200/50 dark:border-white/10 backdrop-blur-xl bg-gradient-to-r from-white/60 via-pink-50/40 to-purple-50/40 dark:from-black/40 dark:via-purple-900/20 dark:to-pink-900/20 p-4 shadow-[0_-4px_30px_rgba(0,0,0,0.1)]">
        <ChatInput
          onSend={onSendMessage}
          disabled={isLoading}
          placeholder="Напишите сообщение..."
        />
      </div>
    </div>
  );
}
