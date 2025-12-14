import { useEffect, useState, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface DynamicContentProps {
  html: string | null;
  streamingHtml?: string;
  isStreaming?: boolean;
  children: ReactNode;
}

export function DynamicContent({ 
  html, 
  streamingHtml = "", 
  isStreaming = false,
  children 
}: DynamicContentProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentContent, setCurrentContent] = useState<string | null>(null);
  const previousHtmlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasReceivedFirstChunk = streamingHtml.length > 0;

  useEffect(() => {
    if (!isStreaming && html !== currentContent) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setCurrentContent(html);
        previousHtmlRef.current = html;
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [html, currentContent, isStreaming]);

  useEffect(() => {
    if (isStreaming && hasReceivedFirstChunk && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [streamingHtml, isStreaming, hasReceivedFirstChunk]);

  let displayContent: string | null;
  if (isStreaming) {
    if (hasReceivedFirstChunk) {
      displayContent = streamingHtml;
    } else {
      displayContent = previousHtmlRef.current || currentContent;
    }
  } else {
    displayContent = currentContent;
  }

  return (
    <div ref={containerRef} className="min-h-screen p-6 lg:p-8 xl:p-12">
      {isStreaming && hasReceivedFirstChunk && (
        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm" data-testid="html-streaming-indicator">
            Генерация контента...
          </span>
        </div>
      )}
      <div
        className={cn(
          "transition-opacity duration-300 ease-in-out",
          isTransitioning ? "opacity-0" : "opacity-100"
        )}
        data-testid="dynamic-content-container"
      >
        {displayContent ? (
          <div
            className="dynamic-html-content prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: displayContent }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
