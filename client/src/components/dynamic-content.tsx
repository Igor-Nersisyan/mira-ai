import { type ReactNode, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface DynamicContentProps {
  html: string | null;
  streamingHtml?: string | null;
  isStreaming?: boolean;
  children: ReactNode;
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3])
    };
  }
  return null;
}

function getEffectiveBackground(element: HTMLElement): { r: number; g: number; b: number } | null {
  let current: HTMLElement | null = element;
  
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const bg = parseColor(style.backgroundColor);
    if (bg) {
      return bg;
    }
    current = current.parentElement;
  }
  
  return null;
}

function applyContrastColors(container: HTMLElement) {
  const textElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, li, a, div, td, th, label, strong, em, b, i');
  
  textElements.forEach((el) => {
    const element = el as HTMLElement;
    const bg = getEffectiveBackground(element);
    
    if (bg) {
      const luminance = getLuminance(bg.r, bg.g, bg.b);
      const isLightBg = luminance > 0.5;
      
      element.style.setProperty('color', isLightBg ? '#1a1a1a' : '#ffffff', 'important');
    }
  });
}

export function DynamicContent({ 
  html, 
  streamingHtml = null,
  isStreaming = false,
  children 
}: DynamicContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hasStreamingContent = streamingHtml && streamingHtml.trim().length > 0;
  const hasFinalHtml = html && html.trim().length > 0;
  
  const displayHtml = hasStreamingContent ? streamingHtml : (hasFinalHtml ? html : null);
  const showDefault = !displayHtml && !isStreaming;
  
  useEffect(() => {
    if (contentRef.current && displayHtml) {
      const timeoutId = setTimeout(() => {
        if (contentRef.current) {
          applyContrastColors(contentRef.current);
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [displayHtml]);
  
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
            ref={contentRef}
            className="dynamic-html-content prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        ) : showDefault ? (
          children
        ) : null}
      </div>
    </div>
  );
}
