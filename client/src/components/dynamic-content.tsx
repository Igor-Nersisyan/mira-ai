import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface DynamicContentProps {
  html: string | null;
  streamingHtml?: string | null;
  isStreaming?: boolean;
  children: ReactNode;
}

export function DynamicContent({ 
  html, 
  streamingHtml = null,
  isStreaming = false,
  children 
}: DynamicContentProps) {
  const displayHtml = streamingHtml || html;
  
  return (
    <div className="min-h-screen p-6 lg:p-8 xl:p-12">
      {isStreaming && (
        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm" data-testid="html-streaming-indicator">
            Генерация контента...
          </span>
        </div>
      )}
      <div data-testid="dynamic-content-container">
        {displayHtml ? (
          <div
            className="dynamic-html-content prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
