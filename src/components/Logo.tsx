// The Trekker square logo used as the brand mark next to the "HTC" title
// throughout the app (replaces the generic trophy/cup icon). The source PNG is
// white on transparent, so it sits inside a small brand-green rounded tile to
// stay visible on both light (admin) and dark (public header) backgrounds.

import logoSquare from '../../images/trekker-logo-white-square.png'
import { cx } from './ui'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-700',
        className ?? 'h-8 w-8',
      )}
    >
      <img src={logoSquare} alt="Trekker logo" className="h-full w-full object-contain p-1" />
    </span>
  )
}
