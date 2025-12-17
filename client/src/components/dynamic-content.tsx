import { type ReactNode, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import morphdom from "morphdom";

function extractCompleteBlocks(html: string): string {
  if (!html || html.trim().length === 0) return "";
  
  const trimmed = html.trim();
  
  const rootMatch = trimmed.match(/^<(div|section|article|main)(\s[^>]*)?>/i);
  if (!rootMatch) {
    return parseBlocks(trimmed);
  }
  
  const rootTag = rootMatch[1].toLowerCase();
  const rootOpenEnd = trimmed.indexOf('>', rootMatch[0].length - 1) + 1;
  
  const lastCloseIndex = trimmed.lastIndexOf(`</${rootTag}>`);
  const hasClosedRoot = lastCloseIndex !== -1;
  
  let innerContent: string;
  if (hasClosedRoot) {
    innerContent = trimmed.slice(rootOpenEnd, lastCloseIndex);
  } else {
    innerContent = trimmed.slice(rootOpenEnd);
  }
  
  const parsedInner = parseBlocks(innerContent);
  
  if (!parsedInner) return "";
  
  return trimmed.slice(0, rootOpenEnd) + parsedInner + (hasClosedRoot ? `</${rootTag}>` : '');
}

function parseBlocks(html: string): string {
  if (!html || html.trim().length === 0) return "";
  
  const trimmed = html.trim();
  const completeBlocks: string[] = [];
  let pos = 0;
  
  const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
  
  while (pos < trimmed.length) {
    while (pos < trimmed.length && /\s/.test(trimmed[pos])) {
      pos++;
    }
    
    if (pos >= trimmed.length) break;
    
    if (trimmed[pos] !== '<') {
      const nextTagStart = trimmed.indexOf('<', pos);
      if (nextTagStart === -1) {
        completeBlocks.push(trimmed.slice(pos));
        break;
      }
      completeBlocks.push(trimmed.slice(pos, nextTagStart));
      pos = nextTagStart;
      continue;
    }
    
    const tagNameMatch = trimmed.slice(pos).match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
    if (!tagNameMatch) {
      pos++;
      continue;
    }
    
    const tagName = tagNameMatch[1].toLowerCase();
    
    if (selfClosingTags.includes(tagName)) {
      const tagEnd = trimmed.indexOf('>', pos);
      if (tagEnd === -1) break;
      completeBlocks.push(trimmed.slice(pos, tagEnd + 1));
      pos = tagEnd + 1;
      continue;
    }
    
    const closeTag = `</${tagName}>`;
    let depth = 1;
    let searchPos = pos + tagNameMatch[0].length;
    
    while (searchPos < trimmed.length && depth > 0) {
      const openPattern = new RegExp(`<${tagName}(?:\\s[^>]*>|>)`, 'i');
      const remaining = trimmed.slice(searchPos);
      
      const openMatch = remaining.match(openPattern);
      const closeIndex = remaining.toLowerCase().indexOf(closeTag.toLowerCase());
      
      if (closeIndex === -1) break;
      
      const openIndex = openMatch ? remaining.indexOf(openMatch[0]) : -1;
      
      if (openIndex !== -1 && openIndex < closeIndex) {
        depth++;
        searchPos += openIndex + openMatch![0].length;
      } else {
        depth--;
        if (depth === 0) {
          const blockEnd = searchPos + closeIndex + closeTag.length;
          completeBlocks.push(trimmed.slice(pos, blockEnd));
          pos = blockEnd;
        } else {
          searchPos += closeIndex + closeTag.length;
        }
      }
    }
    
    if (depth > 0) break;
  }
  
  return completeBlocks.join("");
}

interface DynamicContentProps {
  html: string | null;
  streamingHtml?: string | null;
  isStreaming?: boolean;
  children: ReactNode;
  contentRef?: React.RefObject<HTMLDivElement | null>;
}

function isLightColor(r: number, g: number, b: number): boolean {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.4;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function parseColorValue(value: string): { r: number; g: number; b: number } | null {
  const hexMatch = value.match(/#([0-9a-fA-F]{3,8})/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    } else if (hex.length === 8) {
      hex = hex.substring(0, 6);
    }
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }
  
  const rgbCommaMatch = value.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbCommaMatch) {
    return {
      r: parseInt(rgbCommaMatch[1]),
      g: parseInt(rgbCommaMatch[2]),
      b: parseInt(rgbCommaMatch[3])
    };
  }
  
  const rgbSpaceMatch = value.match(/rgba?\s*\(\s*(\d+)\s+(\d+)\s+(\d+)/i);
  if (rgbSpaceMatch) {
    return {
      r: parseInt(rgbSpaceMatch[1]),
      g: parseInt(rgbSpaceMatch[2]),
      b: parseInt(rgbSpaceMatch[3])
    };
  }
  
  const hslCommaMatch = value.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/i);
  if (hslCommaMatch) {
    return hslToRgb(parseInt(hslCommaMatch[1]), parseInt(hslCommaMatch[2]), parseInt(hslCommaMatch[3]));
  }
  
  const hslSpaceMatch = value.match(/hsla?\s*\(\s*(\d+)\s+(\d+)%?\s+(\d+)%?/i);
  if (hslSpaceMatch) {
    return hslToRgb(parseInt(hslSpaceMatch[1]), parseInt(hslSpaceMatch[2]), parseInt(hslSpaceMatch[3]));
  }
  
  const namedColors: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
    red: { r: 255, g: 0, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    green: { r: 0, g: 128, b: 0 },
    yellow: { r: 255, g: 255, b: 0 },
    orange: { r: 255, g: 165, b: 0 },
    purple: { r: 128, g: 0, b: 128 },
    pink: { r: 255, g: 192, b: 203 },
    lightgray: { r: 211, g: 211, b: 211 },
    lightgrey: { r: 211, g: 211, b: 211 },
    darkgray: { r: 169, g: 169, b: 169 },
    darkgrey: { r: 169, g: 169, b: 169 },
  };
  
  const lowerValue = value.toLowerCase().trim();
  if (namedColors[lowerValue]) {
    return namedColors[lowerValue];
  }
  
  return null;
}

function parseRgba(bgColor: string): { r: number; g: number; b: number; a: number } | null {
  if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
    return null;
  }
  
  const hexMatch = bgColor.match(/#([0-9a-fA-F]+)/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255
      };
    } else if (hex.length === 8) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: parseInt(hex.substring(6, 8), 16) / 255
      };
    } else if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1
      };
    }
  }
  
  const rgbaCommaMatch = bgColor.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (rgbaCommaMatch) {
    return {
      r: parseInt(rgbaCommaMatch[1]),
      g: parseInt(rgbaCommaMatch[2]),
      b: parseInt(rgbaCommaMatch[3]),
      a: rgbaCommaMatch[4] ? parseFloat(rgbaCommaMatch[4]) : 1
    };
  }
  
  const rgbaSlashMatch = bgColor.match(/rgba?\s*\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+%?))?\s*\)/i);
  if (rgbaSlashMatch) {
    let alpha = 1;
    if (rgbaSlashMatch[4]) {
      alpha = rgbaSlashMatch[4].includes('%') 
        ? parseFloat(rgbaSlashMatch[4]) / 100 
        : parseFloat(rgbaSlashMatch[4]);
    }
    return {
      r: parseInt(rgbaSlashMatch[1]),
      g: parseInt(rgbaSlashMatch[2]),
      b: parseInt(rgbaSlashMatch[3]),
      a: alpha
    };
  }
  
  const hslaCommaMatch = bgColor.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (hslaCommaMatch) {
    const rgb = hslToRgb(parseInt(hslaCommaMatch[1]), parseInt(hslaCommaMatch[2]), parseInt(hslaCommaMatch[3]));
    return { ...rgb, a: hslaCommaMatch[4] ? parseFloat(hslaCommaMatch[4]) : 1 };
  }
  
  const hslaSlashMatch = bgColor.match(/hsla?\s*\(\s*(\d+)\s+(\d+)%?\s+(\d+)%?\s*(?:\/\s*([\d.]+%?))?\s*\)/i);
  if (hslaSlashMatch) {
    const rgb = hslToRgb(parseInt(hslaSlashMatch[1]), parseInt(hslaSlashMatch[2]), parseInt(hslaSlashMatch[3]));
    let alpha = 1;
    if (hslaSlashMatch[4]) {
      alpha = hslaSlashMatch[4].includes('%') 
        ? parseFloat(hslaSlashMatch[4]) / 100 
        : parseFloat(hslaSlashMatch[4]);
    }
    return { ...rgb, a: alpha };
  }
  
  const rgb = parseColorValue(bgColor);
  if (rgb) {
    return { ...rgb, a: 1 };
  }
  
  return null;
}

function compositeColors(
  fg: { r: number; g: number; b: number; a: number },
  bg: { r: number; g: number; b: number }
): { r: number; g: number; b: number } {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a))
  };
}

function getEffectiveBackground(element: HTMLElement): { r: number; g: number; b: number } | null {
  const isDarkMode = document.documentElement.classList.contains('dark');
  const themeBase = isDarkMode 
    ? { r: 10, g: 10, b: 10 }
    : { r: 250, g: 250, b: 250 };
  
  const layers: { r: number; g: number; b: number; a: number }[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;
  const maxDepth = 10;
  
  while (current && depth < maxDepth) {
    const computedStyle = window.getComputedStyle(current);
    const bgColor = computedStyle.backgroundColor;
    const parsed = parseRgba(bgColor);
    
    if (parsed) {
      layers.unshift(parsed);
      if (parsed.a >= 1) break;
    }
    
    current = current.parentElement;
    depth++;
  }
  
  if (layers.length === 0) {
    return null;
  }
  
  let result = themeBase;
  for (const layer of layers) {
    result = compositeColors(layer, result);
  }
  
  return result;
}

const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

function wrapEmojisInElement(element: HTMLElement) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent && emojiRegex.test(node.textContent)) {
      textNodes.push(node as Text);
    }
  }
  
  textNodes.forEach((textNode) => {
    const text = textNode.textContent || '';
    const parts = text.split(emojiRegex);
    
    if (parts.length > 1) {
      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (emojiRegex.test(part)) {
          const span = document.createElement('span');
          span.className = 'emoji';
          span.style.cssText = 'color: initial; font-style: normal;';
          span.textContent = part;
          fragment.appendChild(span);
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
        emojiRegex.lastIndex = 0;
      });
      textNode.parentNode?.replaceChild(fragment, textNode);
    }
    emojiRegex.lastIndex = 0;
  });
}

function sanitizeStyles(container: HTMLElement) {
  const allElements = container.querySelectorAll('*');
  
  allElements.forEach((el) => {
    const element = el as HTMLElement;
    const style = element.getAttribute('style');
    
    if (style) {
      let newStyle = style;
      
      if (style.includes('backdrop-filter') || style.includes('filter: blur')) {
        newStyle = newStyle.replace(/backdrop-filter[^;]*;?/gi, '');
        newStyle = newStyle.replace(/filter:\s*blur[^;]*;?/gi, '');
      }
      
      if (newStyle !== style) {
        element.setAttribute('style', newStyle);
      }
    }
    
    element.classList.remove('light-bg-forced', 'dark-bg-forced');
    
    const effectiveBg = getEffectiveBackground(element);
    if (effectiveBg) {
      const isLight = isLightColor(effectiveBg.r, effectiveBg.g, effectiveBg.b);
      if (isLight) {
        element.classList.add('light-bg-forced');
      } else {
        element.classList.add('dark-bg-forced');
      }
    }
  });
  
  wrapEmojisInElement(container);
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="image-lightbox"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        data-testid="button-close-lightbox"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function DynamicContent({ 
  html, 
  streamingHtml = null,
  isStreaming = false,
  children,
  contentRef: externalRef
}: DynamicContentProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const contentRef = externalRef || internalRef;
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const lastHtmlRef = useRef<string>("");
  
  const hasFinalHtml = html && html.trim().length > 0;
  const showDefault = !hasFinalHtml && !isStreaming && !streamingHtml;
  
  const displayHtml = useMemo(() => {
    if (html) return html;
    if (streamingHtml) return extractCompleteBlocks(streamingHtml);
    return "";
  }, [html, streamingHtml]);
  
  useEffect(() => {
    if (!contentRef.current) return;
    
    if (displayHtml && displayHtml !== lastHtmlRef.current) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = displayHtml;
      
      morphdom(contentRef.current, wrapper, {
        childrenOnly: true,
        onBeforeElUpdated: (fromEl, toEl) => {
          if (fromEl.isEqualNode(toEl)) {
            return false;
          }
          return true;
        }
      });
      
      lastHtmlRef.current = displayHtml;
      
      sanitizeStyles(contentRef.current);
      
      const images = contentRef.current.querySelectorAll('img');
      images.forEach((img) => {
        if (!img.dataset.lightboxBound) {
          img.style.cursor = 'zoom-in';
          img.dataset.lightboxBound = 'true';
          img.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setLightboxImage(img.src);
          };
        }
      });
    }
  }, [displayHtml, contentRef]);
  
  return (
    <>
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
          {showDefault ? (
            children
          ) : (
            <div
              ref={contentRef}
              className="dynamic-html-content max-w-none"
            />
          )}
        </div>
      </div>
      
      {lightboxImage && createPortal(
        <ImageLightbox 
          src={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />,
        document.body
      )}
    </>
  );
}
