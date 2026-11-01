// Sociyo mark: two facing building outlines forming a rounded "S", with a heart in the gap.
// Same artwork as public/favicon.svg.
export default function Logo({ size = 40, className = '', tile = true }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden="true">
      {tile && <rect width="512" height="512" rx="112" fill="#13254A" />}
      <g fill="none" stroke="#FFFFFF" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round">
        <path d="M360 108 H202 A54 54 0 0 0 148 162 V202 A54 54 0 0 0 202 256 H216" />
        <path d="M296 256 H310 A54 54 0 0 1 364 310 V350 A54 54 0 0 1 310 404 H152" />
      </g>
      <g fill="#8FA3C7">
        <rect x="200" y="148" width="24" height="26" rx="5" /><rect x="240" y="148" width="24" height="26" rx="5" /><rect x="280" y="148" width="24" height="26" rx="5" />
        <rect x="200" y="190" width="24" height="26" rx="5" />
        <rect x="288" y="296" width="24" height="26" rx="5" />
        <rect x="208" y="338" width="24" height="26" rx="5" /><rect x="248" y="338" width="24" height="26" rx="5" /><rect x="288" y="338" width="24" height="26" rx="5" />
      </g>
      <path fill="#22C55E" d="M256 288 C224 266 224 234 241 228 C250 225 256 231 256 238 C256 231 262 225 271 228 C288 234 288 266 256 288 Z" />
    </svg>
  )
}

export const APP_NAME = 'Sociyo'
export const TAGLINE = 'Your society, sorted.'

// Brand lockup used on the login/onboarding hero: mark + wordmark (kept in Latin) + tagline.
export function BrandLine({ tagline = true, mark = true }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      {mark && <Logo size={22} />}
      <span translate="no" className="text-white font-extrabold tracking-tight">Sociyo</span>
      {tagline && <span className="text-brand-200">· <span>Your society, sorted.</span></span>}
    </p>
  )
}
