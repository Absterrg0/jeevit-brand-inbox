import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'winnow-theme'

function current(): Theme {
  if (typeof document === 'undefined') return 'light'
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggle = useCallback((origin?: HTMLElement) => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
    const apply = () => setTheme(next)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) return apply()

    // Sweep the new palette out from the switch, as the reference does.
    const rect = origin?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 48
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight - 32
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    document.documentElement.style.setProperty('--theme-x', `${x}px`)
    document.documentElement.style.setProperty('--theme-y', `${y}px`)
    document.documentElement.style.setProperty('--theme-radius', `${radius}px`)
    document.documentElement.classList.add('theme-reveal')
    document.startViewTransition(apply).finished.finally(() => {
      document.documentElement.classList.remove('theme-reveal')
    })
  }, [])

  return { theme, toggle }
}
