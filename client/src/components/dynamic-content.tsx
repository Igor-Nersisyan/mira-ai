import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface DynamicContentProps {
  html: string | null;
  isStreaming?: boolean;
  children: ReactNode;
}

export function DynamicContent({ 
  html, 
  isStreaming = false,
  children 
}: DynamicContentProps) {
  return (
    <div className="min-h-screen p-6 lg:p-8 xl:p-12">
      <div data-testid="dynamic-content-container">
        {isStreaming ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-muted-foreground" data-testid="html-streaming-indicator">
              Готовлю информацию для вас...
            </span>
          </div>
        ) : html ? (
          <div
            className="dynamic-html-content prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
