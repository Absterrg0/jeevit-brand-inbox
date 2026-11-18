/**
 * Brand identity and deal grouping.
 *
 * In a real inbox the mail provider's contact graph would do this. Here it is a
 * small registry (15 senders) plus two fallbacks: the domain becomes a name,
 * and an agency that writes "on behalf of X" is filed under X, not itself.
 * Keeping this explicit is what lets three Dew Lab emails become one deal.
 */
import type { InboxEmail } from './types'

interface BrandEntry {
  key: string
  name: string
  domains: string[]
  /** A gmail sender whose local part is the brand, e.g. chai.and.co@gmail.com. */
  localPart?: string
  agency?: boolean
}

const REGISTRY: BrandEntry[] = [
  { key: 'dewlab', name: 'Dew Lab', domains: ['dewlab.in'] },
  { key: 'brightside', name: 'Brightside Agency', domains: ['brightside-agency.com'], agency: true },
  { key: 'glowstar', name: 'Glowstar', domains: ['glowstar-official.co'] },
  { key: 'pixelon', name: 'Pixelon', domains: ['pixelon.com'] },
  { key: 'luckyplay11', name: 'LuckyPlay11', domains: ['luckyplay11.app'] },
  { key: 'chaiandco', name: 'Chai & Co', domains: ['gmail.com'], localPart: 'chai.and.co' },
  { key: 'urbanthread', name: 'Urban Thread', domains: ['urbanthread.in'] },
  { key: 'brewbox', name: 'BrewBox', domains: ['brewbox.co'] },
  { key: 'auralbuds', name: 'AuralBuds', domains: ['auralbuds.com'] },
  { key: 'snapmeal', name: 'SnapMeal', domains: ['snapmeal.in'] },
  { key: 'creatorweekly', name: 'Creator Weekly', domains: ['creatorweekly.io'] },
  { key: 'youtube-centre', name: 'YouTube Copyright Centre', domains: ['youtube-copyright-centre.net'] },
  { key: 'fitnest', name: 'FitNest', domains: ['fitnest.in'] },
  { key: 'quickcash', name: 'QuickCash Media', domains: ['quickcash-media.biz'] },
]

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')

export interface ResolvedBrand {
  key: string
  name: string
  domain: string
  agency: boolean
  /** The brand the agency is writing for, if different. */
  onBehalfOf?: BrandEntry
}

function prettyDomainName(domain: string) {
  const base = domain.split('.').slice(-2, -1)[0] ?? domain
  return base
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function resolveBrand(email: InboxEmail): ResolvedBrand {
  const domain = (email.from.split('@')[1] ?? '').toLowerCase()
  const local = (email.from.split('@')[0] ?? '').toLowerCase()
  const direct = REGISTRY.find((b) => b.domains.includes(domain) && (!b.localPart || b.localPart === local))
  const text = `${email.subject} ${email.body}`

  // An agency writing for a brand: group with the brand, not the agency.
  if (direct?.agency) {
    const match = text.match(/on behalf of\s+([A-Z][A-Za-z0-9&' ]{1,28}?)(?:\s*[-–—,.]|\s+for\b|\s+following\b|$)/i)
    if (match) {
      const target = REGISTRY.find((b) => slug(b.name) === slug(match[1]) || slug(b.key) === slug(match[1]))
      if (target) {
        return { key: target.key, name: target.name, domain, agency: true, onBehalfOf: target }
      }
    }
    return { key: direct.key, name: direct.name, domain, agency: true }
  }

  if (direct) return { key: direct.key, name: direct.name, domain, agency: false }
  return { key: slug(prettyDomainName(domain)), name: prettyDomainName(domain), domain, agency: /agency|talent|partnerships?/i.test(local) }
}

export function knownBrand(name: string): BrandEntry | undefined {
  return REGISTRY.find((b) => slug(b.name) === slug(name) || b.key === slug(name))
}
