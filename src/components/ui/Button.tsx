import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

type Variant = 'primary' | 'secondary' | 'quiet' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ink text-primary-foreground shadow-ink hover:bg-ink-hover active:translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-none disabled:bg-accent disabled:text-subtle-foreground disabled:shadow-sunk',
  secondary:
    'bg-card text-foreground shadow-raised hover:shadow-raised-hover active:translate-y-px active:shadow-sunk disabled:opacity-50',
  quiet: 'bg-accent text-secondary-foreground shadow-sunk hover:bg-accent-hover hover:text-foreground',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
  danger: 'bg-[#c4503f] text-white shadow-ink hover:bg-[#ab4334]',
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }
>(function Button({ variant = 'secondary', size = 'md', className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[9px] font-medium whitespace-nowrap transition-[background-color,box-shadow,color,transform] duration-100 select-none',
        size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3.5 text-[13px]',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
})

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string; size?: 'sm' | 'md' }
>(function IconButton({ className, size = 'md', ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35 [&>svg]:size-4',
        size === 'sm' ? 'size-6' : 'size-7',
        className,
      )}
      {...props}
    />
  )
})
