import { ArrowLeftRight, Ban, Check, EyeOff, Flag as FlagIcon, MessageCircleQuestion, ScanEye, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Action, Category, Severity } from '../src/types'
import { cx } from './lib'

export type Bucket = 'reply' | 'decline' | 'report' | 'ignore'

export const ACTION: Record<Action, { label: string; icon: LucideIcon; bucket: Bucket; tone: string }> = {
  accept: { label: 'Accept', icon: Check, bucket: 'reply', tone: 'text-label-green' },
  negotiate: { label: 'Negotiate', icon: ArrowLeftRight, bucket: 'reply', tone: 'text-label-blue' },
  ask_for_details: { label: 'Ask for details', icon: MessageCircleQuestion, bucket: 'reply', tone: 'text-label-violet' },
  review_manually: { label: 'Read it yourself', icon: ScanEye, bucket: 'reply', tone: 'text-quiet-ink' },
  decline: { label: 'Decline', icon: Ban, bucket: 'decline', tone: 'text-label-orange' },
  report: { label: 'Report as scam', icon: FlagIcon, bucket: 'report', tone: 'text-label-red' },
  ignore: { label: 'Ignore', icon: EyeOff, bucket: 'ignore', tone: 'text-muted-foreground' },
}

export const CATEGORY: Record<Category, { label: string; dot: string }> = {
  deal_offer: { label: 'Deal offer', dot: 'bg-label-green' },
  needs_more_info: { label: 'Needs more info', dot: 'bg-label-blue' },
  not_a_fit: { label: 'Not a fit', dot: 'bg-label-orange' },
  scam_or_phishing: { label: 'Scam or phishing', dot: 'bg-label-red' },
  spam: { label: 'Spam', dot: 'bg-subtle-foreground' },
}

export const SEVERITY: Record<Severity, { label: string; dot: string }> = {
  high: { label: 'High', dot: 'bg-label-red' },
  medium: { label: 'Medium', dot: 'bg-quiet' },
  low: { label: 'Low', dot: 'bg-subtle-foreground' },
}

const INKS = ['#22262b', '#3d4a57', '#6b4b3e', '#4d5c44', '#4e4670', '#7a5f2c', '#38585e']

/** A monogram tile, tinted from the name, so no real logo is borrowed. */
export function BrandTile({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return (
    <span
      aria-hidden
      style={{ backgroundColor: INKS[h % INKS.length] }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_0_0_1px_rgb(var(--shade)/0.12)]',
        size === 'lg' ? 'size-11 rounded-[12px] text-[17px]' : 'size-8 rounded-[9px] text-[13px]',
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function Chip({ dot, children, className }: { dot?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex h-[22px] items-center gap-1.5 rounded-[7px] bg-muted px-2 text-[12px] whitespace-nowrap text-secondary-foreground shadow-sunk', className)}>
      {dot && <span aria-hidden className={cx('size-1.5 shrink-0 rounded-[2px]', dot)} />}
      {children}
    </span>
  )
}

export const CategoryChip = ({ category }: { category: Category }) => <Chip dot={CATEGORY[category].dot}>{CATEGORY[category].label}</Chip>

export function ActionChip({ action }: { action: Action }) {
  const { label, icon: Icon, tone } = ACTION[action]
  return (
    <span className={cx('inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-[8px] bg-card px-2 text-[12.5px] font-medium whitespace-nowrap shadow-raised', tone)}>
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  )
}

export function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium whitespace-nowrap transition-[background-color,box-shadow,color,transform] duration-100 select-none [&>svg]:size-3.5',
        variant === 'primary' && 'bg-ink text-primary-foreground shadow-ink hover:bg-ink-hover active:translate-y-px',
        variant === 'secondary' && 'bg-card text-foreground shadow-raised hover:shadow-raised-hover active:translate-y-px active:shadow-sunk',
        variant === 'ghost' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <h3 className="text-[12px] font-medium tracking-[0.01em] text-muted-foreground">{children}</h3>
      {aside}
    </div>
  )
}
