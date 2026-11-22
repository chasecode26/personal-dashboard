import type { ReactNode } from 'react'
import type { CardBackground } from '../hooks/useCardBackgrounds'

interface CardProps {
  id: string
  className?: string
  bg?: CardBackground
  onEditBg?: (id: string) => void
  children: ReactNode
}

/** 通用卡片：负责自定义背景层 + 遮罩 + 背景设置入口 */
export default function Card({ id, className = '', bg, onEditBg, children }: CardProps) {
  const hasBg = Boolean(bg?.img)
  const lightText = bg?.maskType !== 'light'

  const layerStyle: React.CSSProperties | undefined = hasBg
    ? {
        background: bg!.img!.indexOf('url(') === 0
          ? `${bg!.img} center/cover no-repeat`
          : bg!.img,
        ['--bgmask' as string]: bg!.maskType === 'light'
          ? `rgba(255,255,255,${bg!.mask / 100})`
          : `rgba(8,26,18,${bg!.mask / 100})`,
      }
    : undefined

  return (
    <div
      className={`card ${className} ${hasBg ? 'has-bg' : ''} ${hasBg && lightText ? 'light-text' : ''}`}
      data-bg-key={id}
    >
      {hasBg && <div className="card-bg" style={layerStyle} />}
      {children}
      {onEditBg && (
        <div className="bg-btn" title="设置卡片背景" onClick={() => onEditBg(id)}>
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-6-7 8" /></svg>
        </div>
      )}
    </div>
  )
}
