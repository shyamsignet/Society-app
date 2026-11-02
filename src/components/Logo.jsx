// SociYo emblem: three buildings, the residents in front and a coral arc.
// Same artwork as public/favicon.svg and docs/brand/sociyo-icon.svg.
export default function Logo({ size = 40, className = '', tile = true }) {
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} className={className} aria-hidden="true">
      {tile && <rect width="1024" height="1024" rx="224" fill="#3B1F3A" />}
      <g transform="translate(512 520) scale(1.2) translate(-512 -435)">
        <g transform="translate(0 0)">
        <path d="M258 566 V392 Q258 378 271 373 L366 336 Q384 330 384 349 V566 Z" fill="#F7F1E8" />
        <path d="M766 566 V392 Q766 378 753 373 L658 336 Q640 330 640 349 V566 Z" fill="#F7F1E8" />
        <path d="M400 566 V318 Q400 304 412 297 L498 248 Q512 240 526 248 L612 297 Q624 304 624 318 V566 Z" fill="#F7F1E8" />
        <rect x="290" y="410" width="40" height="40" rx="7.199999999999999" fill="#3B1F3A" /><rect x="290" y="474" width="40" height="40" rx="7.199999999999999" fill="#3B1F3A" /><rect x="694" y="410" width="40" height="40" rx="7.199999999999999" fill="#3B1F3A" /><rect x="694" y="474" width="40" height="40" rx="7.199999999999999" fill="#3B1F3A" />
        <rect x="446" y="318" width="50" height="50" rx="9" fill="#3B1F3A" /><rect x="528" y="318" width="50" height="50" rx="9" fill="#3B1F3A" /><rect x="446" y="392" width="50" height="50" rx="9" fill="#3B1F3A" /><rect x="528" y="392" width="50" height="50" rx="9" fill="#3B1F3A" />
        <path d="M206 612 Q512 500 818 612" fill="none" stroke="#3B1F3A" strokeWidth="40" strokeLinecap="round" />
        <path d="M206 612 Q512 500 818 612" fill="none" stroke="#E8674A" strokeWidth="20" strokeLinecap="round" />
        <g fill="#D6C8F0" stroke="#3B1F3A" strokeWidth="16" paintOrder="stroke">
        <circle cx="418" cy="520" r="40" /><path d="M340 624 Q340 566 418 566 Q496 566 496 624 Z" />
        <circle cx="606" cy="520" r="40" /><path d="M528 624 Q528 566 606 566 Q684 566 684 624 Z" />
        <circle cx="512" cy="500" r="50" /><path d="M412 630 Q412 556 512 556 Q612 556 612 630 Z" />
        </g></g>
      </g>
    </svg>
  )
}

export const APP_NAME = 'SociYo'
export const TAGLINE = 'Your society, sorted.'

// Brand lockup used on the login/onboarding hero: mark + wordmark (kept in Latin) + tagline.
export function BrandLine({ tagline = true, mark = true }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      {mark && <Logo size={22} />}
      <span translate="no" className="text-white font-extrabold tracking-tight">SociYo</span>
      {tagline && <span className="text-brand-200">· <span>Your society, sorted.</span></span>}
    </p>
  )
}
