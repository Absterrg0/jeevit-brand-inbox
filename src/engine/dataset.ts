import creatorProfile from '../../data/creator_profile.json'
import inbox from '../../data/inbox.json'
import { analyzeInbox } from './analyze'
import type { CreatorProfile, InboxEmail } from './types'

/** One place where the shipped dataset is wired in, for the CLI and the UI. */
export const PROFILE = creatorProfile as CreatorProfile
export const INBOX = inbox as InboxEmail[]
export const ANALYSIS = analyzeInbox(INBOX, PROFILE)
