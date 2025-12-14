import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Message } from "@shared/schema";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isLoading && <TypingIndicator />}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
      data-testid={`message-${message.role}-${message.id}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        <div className="whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        <time className={cn(
          "block text-xs mt-1",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {new Date(message.timestamp).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">Вы</span>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start" data-testid="typing-indicator">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
