# Decisions, trade-offs and known weaknesses

Short notes on the choices that shaped this, including the ones that went wrong first.

## 1. Threw away the first version

The first version was a regex rules engine with an optional "AI second opinion". It scored 15/15 on labels that were written while tuning the rules against the same 15 emails. That number measured memorisation of the inbox, not skill. Rules like "contains `fantasy`" also say nothing about the next email that calls betting "opinion trading".

It was replaced, not patched. The old code is in git history (`03d3a00`) and nothing from the engine survives. The design tokens in `web/index.css` were kept.

## 2. Where the line between model and code sits

The test for each piece of work was: *if this is wrong, can the creator see that it is wrong?*

- A slightly awkward summary sentence is visible and harmless. **Model.**
- "₹1,00,000 is 9% below your rate card" looks authoritative and is invisible when wrong. **Code.**

So the model reads (what kind of email, which brand, what is asked, copy the fee and deadline as written, does this fall under rule N) and words the reply. Code does money parsing, currency conversion, rate-card totals, date resolution and comparison, exclusivity date logic, grouping, merging terms, the category, the action, the counter-offer and the summary.

Consequences worth defending:

- **The model does not pick the category.** It reports facts; `categorise()` in `src/core/deals.ts` derives the category from them in a fixed order. The model's own guess is recorded (`modelCategory`) and scored separately so the value of the code layer is measurable, but it is never an input.
- **The model copies money as text** (`"Rs 3 lakh"`), and code parses it. Asking a 7B model for `300000` invites a wrong number of zeros that nobody would notice.
- **The model returns day and month; code picks the year.** "Go live by 1 November" in an email sent on 10 November must stay in the past so it can be flagged. A model asked for an ISO date tends to helpfully roll it to next year.
- **Every claim that can change the outcome needs a quote**, and code checks the quote is in the email. Unsupported claims are dropped and listed in `droppedClaims`.

## 3. One model call became three

Planned: one extraction call that also listed rule and exclusivity conflicts.

What happened on the first real run with `qwen2.5:7b`: it extracted `product: "Pixelon 9 smartphone (smartphones)"` and, in the same JSON, reported no conflict with the smartphone exclusivity. The pipeline recommended accepting a deal that breaches a contract. It also labelled "Fast payment, no long contracts" as a request for upfront payment, which turned a legitimate (if unwanted) offer into a scam.

Two prompt rewrites of the single call did not fix it. Splitting did: a second, narrow call (`src/llm/check.ts`) asks one explicit yes/no question per rule, per exclusivity, and "does this ask the creator to pay?", each needing evidence. Small models are much better at five short questions than at filling twenty keys at once.

Cost: about 50% more model time per brand email. Newsletters and notices skip the second call.

This was tuned on the supplied inbox only. The held-out set was written before it and not looked at until the prompts were frozen.

## 4. Prompt injection: containment, not detection

Detection is a bonus. The design assumes the model *will* sometimes be fooled and makes that not matter:

1. The model has no tools. It can only return JSON.
2. Its JSON is validated against a schema with no field that means "accept" or "trusted".
3. Category and action are computed by code. A scam signal maps to `report` in every combination of other flags (tested exhaustively in `tests/core.test.ts`).
4. An email with a scam signal is never merged into another deal, so it cannot overwrite a real brand's terms ("latest terms win" would otherwise be an attack surface).
5. The drafting call never sees the email body, only points written by code. A draft may not contain a number, link, address or phone number that the points did not contain.
6. The creator's profile is read from a file the email cannot reach. Phone number and address are not in it at all.

On top of that sits a small regex backstop for text addressed to an AI and for platform lookalike domains. It is deliberately the only pattern matching on raw email text in the system. On the real E-07 the model resisted the injection but did not label it; the backstop did. `tests/pipeline.test.ts` has the reverse case: a fully hijacked model, and the outcome is still `report` with no draft.

Known gap: the backstop is English-only and easy to phrase around. Then safety rests on points 1 to 6, and the email is treated as an ordinary offer and judged on its (code-checked) terms.

## 5. Recorded responses instead of a live key

No hosted API key was available while building this, and reviewers should not need one. Model responses are recorded in `recordings/` keyed by a hash of the prompt version plus the exact messages. The default run replays them; the deterministic code still runs for real on every replay.

- Change an email or a prompt and the key changes, so stale output is never replayed. The email is reported as "not analysed" rather than guessed.
- `--live` is cache-first, which is also the production behaviour: re-running an inbox only pays for new emails.

Trade-off: the recorded run is from a local 7B model, which is weaker than the free hosted models (Groq, Gemini). The numbers in the README are therefore a floor for this design, and the hosted path, though it is the same code with a different base URL, **was not exercised**.

## 6. Failing closed

If the model's output fails validation twice, or the rule check fails, the email becomes `review_manually` and is listed first in the summary. It is never silently classified by a fallback heuristic. The old regex engine was not kept as an offline fallback because a wrong confident answer is worse than "read this one yourself".

## 7. Things that are weak, and I know it

- **Thread context.** Each email is extracted alone and merged afterwards, newest value per field. A follow-up phrased as a delta ("add a second reel") cannot be resolved without the earlier email. Fix: pass the merged terms so far into the extraction call.
- **Grouping is by brand name and subject**, because the dataset has no `Message-ID`/`In-Reply-To`. Two campaigns from one brand would merge into one deal. Real mail headers fix most of this.
- **Profile free text is parsed with regex** for the exchange rate and included usage months (`src/core/profile.ts`), with a warning and a default when it fails. Those should be structured fields confirmed at onboarding.
- **The rate card has four items.** Anything else ("YouTube shoutout") is either mapped to the nearest item by the model or left unpriced and mentioned.
- **Quote checking is word overlap**, not exact substring, because small models trim quotes. It can be fooled by a quote assembled from words scattered across the email.
- **A false scam signal costs a real deal.** The quote check does not verify that the label fits the quote. Scams are shown under "Leave alone" with the quoted reason rather than hidden, so a wrong one is recoverable.
- **Draft quality depends on the model.** The guard stops invented facts, not clumsy phrasing, and the Hinglish from a 7B model is rough. Rejected drafts fall back to an English template.
- **Labels are one person's judgement.** Debatable ones are marked in the label files (E-06, E-12, H-06, H-10).
- **30 emails is a small sample.** One email is 6.7 points of accuracy.

## 8. Things deliberately left out

Sending email, OAuth/Gmail integration, a database, auth, editing the profile in the UI, a queue, streaming. None of them is needed to judge whether the core decision-making is sound, and each would have taken time from the evaluation.
