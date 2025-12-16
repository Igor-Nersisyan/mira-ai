import { useEffect, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface DynamicContentProps {
  html: string | null;
  isStreaming?: boolean;
  streamingChunk?: string;
  children: ReactNode;
}

export function DynamicContent({ 
  html, 
  isStreaming = false,
  streamingChunk = "",
  children 
}: DynamicContentProps) {
  const streamingContainerRef = useRef<HTMLDivElement>(null);
  const lastAppendedLengthRef = useRef<number>(0);

  useEffect(() => {
    if (isStreaming && streamingChunk && streamingContainerRef.current) {
      const newContent = streamingChunk.slice(lastAppendedLengthRef.current);
      if (newContent) {
        const range = document.createRange();
        range.selectNodeContents(streamingContainerRef.current);
        range.collapse(false);
        const fragment = range.createContextualFragment(newContent);
        streamingContainerRef.current.appendChild(fragment);
        lastAppendedLengthRef.current = streamingChunk.length;
      }
    }
  }, [streamingChunk, isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      lastAppendedLengthRef.current = 0;
      if (streamingContainerRef.current) {
        streamingContainerRef.current.innerHTML = "";
      }
    }
  }, [isStreaming]);

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
        {isStreaming ? (
          <div
            ref={streamingContainerRef}
            className="dynamic-html-content prose prose-slate dark:prose-invert max-w-none"
            data-streaming="true"
          />
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
