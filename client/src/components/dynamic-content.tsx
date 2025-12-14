import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DynamicContentProps {
  html: string | null;
  children: ReactNode;
}

export function DynamicContent({ html, children }: DynamicContentProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentContent, setCurrentContent] = useState<string | null>(null);

  useEffect(() => {
    if (html !== currentContent) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setCurrentContent(html);
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [html, currentContent]);

  return (
    <div className="min-h-screen p-6 lg:p-8 xl:p-12">
      <div
        className={cn(
          "transition-opacity duration-300 ease-in-out",
          isTransitioning ? "opacity-0" : "opacity-100"
        )}
        data-testid="dynamic-content-container"
      >
        {currentContent ? (
          <div
            className="dynamic-html-content prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: currentContent }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
