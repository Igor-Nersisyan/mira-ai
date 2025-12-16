import { useMemo, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface DynamicContentProps {
  html: string | null;
  isStreaming?: boolean;
  streamingHtml?: string;
  children: ReactNode;
}

function extractCompleteElements(html: string): string {
  if (!html) return "";
  
  const completeSections: string[] = [];
  let remaining = html;
  
  const topLevelTags = ['section', 'div', 'article', 'header', 'footer', 'main', 'nav', 'aside'];
  
  for (const tag of topLevelTags) {
    const openTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    const closeTag = `</${tag}>`;
    
    let match;
    let searchStart = 0;
    
    while ((match = openTagRegex.exec(remaining)) !== null) {
      if (match.index < searchStart) continue;
      
      const openTagStart = match.index;
      const openTagEnd = openTagStart + match[0].length;
      
      let depth = 1;
      let pos = openTagEnd;
      
      while (depth > 0 && pos < remaining.length) {
        const nextOpen = remaining.toLowerCase().indexOf(`<${tag}`, pos);
        const nextClose = remaining.toLowerCase().indexOf(closeTag.toLowerCase(), pos);
        
        if (nextClose === -1) break;
        
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          pos = nextOpen + tag.length + 1;
        } else {
          depth--;
          if (depth === 0) {
            const completeElement = remaining.slice(openTagStart, nextClose + closeTag.length);
            completeSections.push(completeElement);
            searchStart = nextClose + closeTag.length;
          }
          pos = nextClose + closeTag.length;
        }
      }
    }
  }
  
  return completeSections.join('\n');
}

export function DynamicContent({ 
  html, 
  isStreaming = false,
  streamingHtml = "",
  children 
}: DynamicContentProps) {
  const displayHtml = useMemo(() => {
    if (isStreaming && streamingHtml) {
      return extractCompleteElements(streamingHtml);
    }
    return html;
  }, [isStreaming, streamingHtml, html]);

  const showLoading = isStreaming && !displayHtml;

  return (
    <div className="min-h-screen p-6 lg:p-8 xl:p-12">
      <div data-testid="dynamic-content-container">
        {showLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-muted-foreground" data-testid="html-streaming-indicator">
              Готовлю информацию для вас...
            </span>
          </div>
        ) : displayHtml ? (
          <div
            className="dynamic-html-content prose prose-slate dark:prose-invert max-w-none"
            data-streaming={isStreaming ? "true" : undefined}
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
