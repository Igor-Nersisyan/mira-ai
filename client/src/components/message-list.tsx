import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import type { Message } from "@shared/schema";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  streamingMessage?: string;
}

export function MessageList({ messages, isLoading, streamingMessage = "" }: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isLoading && streamingMessage && (
        <StreamingMessageBubble content={streamingMessage} />
      )}
      {isLoading && !streamingMessage && <TypingIndicator />}
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
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shadow-sm">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-white rounded-br-sm"
            : "bg-muted/80 text-foreground rounded-bl-sm backdrop-blur-sm"
        )}
      >
        <div className={cn(
          "whitespace-pre-wrap break-words prose prose-sm max-w-none",
          "prose-p:my-0 prose-p:leading-snug",
          "prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-snug",
          "prose-headings:my-1 prose-headings:leading-snug",
          "[&_ul]:pl-4 [&_ol]:pl-4",
          isUser ? "[&_*]:text-white" : "dark:prose-invert"
        )}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        <time className={cn(
          "block text-xs mt-1",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {new Date(message.timestamp).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Moscow",
          })}
        </time>
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Вы</span>
        </div>
      )}
    </div>
  );
}

function StreamingMessageBubble({ content }: { content: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 justify-start" 
      data-testid="streaming-message"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shadow-sm">
        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-muted/80 text-foreground shadow-sm backdrop-blur-sm">
        <div className="whitespace-pre-wrap break-words prose prose-sm max-w-none prose-p:my-0 prose-p:leading-snug prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:leading-snug prose-headings:my-1 prose-headings:leading-snug [&_ul]:pl-4 [&_ol]:pl-4 dark:prose-invert">
          <ReactMarkdown>{content}</ReactMarkdown>
          <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse ml-0.5" />
        </div>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 justify-start" 
      data-testid="typing-indicator"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shadow-sm">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-muted/80 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </motion.div>
  );
}
