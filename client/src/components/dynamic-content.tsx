import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import morphdom from "morphdom";

interface DynamicContentProps {
  html: string | null;
  streamingHtml?: string | null;
  isStreaming?: boolean;
  children: ReactNode;
  contentRef?: React.RefObject<HTMLDivElement | null>;
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

function sanitizeStyles(container: HTMLElement) {
  const allElements = container.querySelectorAll('*');
  
  allElements.forEach((el) => {
    const element = el as HTMLElement;
    const style = element.getAttribute('style');
    
    if (style) {
      let newStyle = style;
      
      if (style.includes('linear-gradient') || style.includes('radial-gradient')) {
        newStyle = newStyle.replace(/background[^;]*gradient[^;]*;?/gi, 'background: #ffffff;');
      }
      
      const rgbaMatch = style.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/gi);
      if (rgbaMatch) {
        rgbaMatch.forEach(rgba => {
          const parts = rgba.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
          if (parts) {
            const alpha = parseFloat(parts[4]);
            if (alpha < 0.9 && style.includes('background')) {
              const r = parseInt(parts[1]);
              const g = parseInt(parts[2]);
              const b = parseInt(parts[3]);
              const solidColor = `rgb(${r}, ${g}, ${b})`;
              newStyle = newStyle.replace(rgba, solidColor);
            }
          }
        });
      }
      
      if (style.includes('backdrop-filter') || style.includes('filter: blur')) {
        newStyle = newStyle.replace(/backdrop-filter[^;]*;?/gi, '');
        newStyle = newStyle.replace(/filter:\s*blur[^;]*;?/gi, '');
      }
      
      if (newStyle !== style) {
        element.setAttribute('style', newStyle);
      }
    }
  });
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
  
  useEffect(() => {
    if (!contentRef.current) return;
    
    const currentHtml = streamingHtml || html || "";
    
    if (currentHtml && currentHtml !== lastHtmlRef.current) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = currentHtml;
      
      morphdom(contentRef.current, wrapper, {
        childrenOnly: true,
        onBeforeElUpdated: (fromEl, toEl) => {
          if (fromEl.isEqualNode(toEl)) {
            return false;
          }
          return true;
        }
      });
      
      lastHtmlRef.current = currentHtml;
      
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
  }, [streamingHtml, html, contentRef]);
  
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
              className="dynamic-html-content prose prose-slate dark:prose-invert max-w-none"
              style={{ 
                contain: 'layout style',
                willChange: 'contents'
              }}
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
