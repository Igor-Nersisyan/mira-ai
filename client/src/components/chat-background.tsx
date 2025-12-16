export function ChatBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25 dark:opacity-15">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hr-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#FF8B36" strokeWidth="1.5">
              <circle cx="20" cy="20" r="8" />
              <circle cx="20" cy="16" r="4" />
              
              <rect x="60" y="15" width="16" height="20" rx="2" />
              <line x1="64" y1="22" x2="72" y2="22" />
              <line x1="64" y1="26" x2="70" y2="26" />
              <line x1="64" y1="30" x2="72" y2="30" />
              
              <circle cx="110" cy="22" r="10" />
              <polyline points="105,22 109,26 117,18" />
              
              <rect x="150" y="12" width="20" height="20" rx="3" />
              <line x1="150" y1="20" x2="170" y2="20" />
              <line x1="150" y1="26" x2="170" y2="26" />
              <line x1="158" y1="12" x2="158" y2="32" />
              
              <circle cx="30" cy="70" r="6" />
              <circle cx="30" cy="66" r="3" />
              <circle cx="40" cy="72" r="5" />
              <circle cx="40" cy="69" r="2.5" />
              <circle cx="22" cy="74" r="4" />
              <circle cx="22" cy="71.5" r="2" />
              
              <path d="M70,60 L70,80 M60,70 L80,70" />
              <circle cx="70" cy="70" r="12" />
              
              <path d="M110,65 C110,60 120,60 120,65 L120,75 C120,80 110,80 110,75 Z" />
              <circle cx="115" cy="63" r="4" />
              
              <rect x="150" y="60" width="24" height="18" rx="3" />
              <circle cx="162" cy="69" r="4" />
              <rect x="152" y="74" width="20" height="2" rx="1" />
              
              <path d="M15,120 L25,110 L35,120 L25,130 Z" />
              
              <rect x="105" y="110" width="22" height="16" rx="2" />
              <path d="M105,114 L116,122 L127,114" />
              
              <circle cx="165" cy="118" r="10" />
              <path d="M160,118 Q165,124 170,118" />
              <circle cx="162" cy="115" r="1.5" />
              <circle cx="168" cy="115" r="1.5" />
              
              <path d="M20,165 L35,165 L35,180 L20,180 Z" />
              <path d="M23,170 L32,170 M23,175 L28,175" />
              
              <circle cx="70" cy="170" r="6" />
              <circle cx="70" cy="167" r="3" />
              <path d="M60,180 L70,175 L80,180" />
              
              <path d="M105,165 L125,165 M105,172 L120,172 M105,179 L125,179" />
              <circle cx="130" cy="165" r="3" />
              <circle cx="130" cy="172" r="3" />
              <circle cx="130" cy="179" r="3" />
              
              <rect x="155" y="162" width="18" height="22" rx="9" />
              <circle cx="164" cy="178" r="2" />
            </g>
            
            <g fill="none" stroke="#2D8CFF" strokeWidth="1.5">
              <circle cx="70" cy="120" r="8" />
              <path d="M67,120 L70,123 L77,116" />
              <path d="M78,112 L82,108" />
              <path d="M78,128 L82,132" />
              
              <circle cx="180" cy="45" r="4" />
              <circle cx="45" cy="95" r="3" />
              <circle cx="140" cy="140" r="3" />
              <circle cx="90" cy="185" r="3" />
              <circle cx="175" cy="135" r="2" />
              <circle cx="5" cy="145" r="3" />
              
              <path d="M185,85 L195,95 M195,85 L185,95" />
              <path d="M5,55 L10,60 M10,55 L5,60" />
              <path d="M145,185 L150,190 M150,185 L145,190" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hr-pattern)" />
      </svg>
    </div>
  );
}
