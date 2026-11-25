export const meta = {
  name: 'reply-ok-pipeline',
  description: 'Three-stage pipeline; stage 1 and stage 2 both catch crashes and retry (max 3 each)',
  phases: [{ title: 'Stage 1' }, { title: 'Stage 2' }, { title: 'Verify' }],
}
const MAX_ATTEMPTS = 3
const VERDICT = {
  type: 'object',
  properties: {
    valid: { type: 'boolean', description: 'true iff the text is exactly "OK confirmed"' },
    reason: { type: 'string' },
  },
  required: ['valid', 'reason'],
}
const stage2Prompt = (prev, feedback) => {
  const base = `The previous stage replied: "${prev}". Reply with exactly that text followed by " confirmed" (e.g. "OK confirmed").`
  return feedback ? `${base}\n\nA previous attempt was rejected by the verifier: ${feedback}` : base
}
const verify = (out, item, attempt) => agent(
  `Verify this output. It must be exactly the string "OK confirmed" (no extra whitespace, punctuation, quotes, or other text). Output under test: ${JSON.stringify(out)}`,
  { label: `verify-${item}${attempt > 1 ? `-try${attempt}` : ''}`, phase: 'Verify', effort: 'low', schema: VERDICT })

const runStage1 = async (item, attempt) => {
  const out = await agent('Reply with exactly the text: OK', {
    label: `s1-${item}${attempt > 1 ? `-try${attempt}` : ''}`, phase: 'Stage 1', effort: 'low' })
  if (out === null) throw new Error('stage 1 agent returned null (skipped or died)')
  return out
}
const runStage2 = async (s1, item, attempt, feedback) => {
  const out = await agent(stage2Prompt(s1, feedback), {
    label: `s2-${item}${attempt > 1 ? `-try${attempt}` : ''}`, phase: 'Stage 2', effort: 'low' })
  if (out === null) throw new Error('stage 2 agent returned null (skipped or died)')
  return out
}

const ITEMS = [1, 2, 3]
const results = await pipeline(
  ITEMS,
  // Stage 1: retry on crash. Never throws — returns {ok, value, history}.
  async (_, item) => {
    const history = []
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const value = await runStage1(item, attempt)
        history.push({ attempt, output: value })
        return { ok: true, value, history }
      } catch (e) {
        history.push({ attempt, crashed: true, error: String(e && e.message || e) })
        log(`item ${item} stage 1 attempt ${attempt} crashed: ${e.message}${attempt < MAX_ATTEMPTS ? ' — retrying' : ' — giving up'}`)
      }
    }
    return { ok: false, value: null, history }
  },
  // Stage 2 + verify: retry on crash or failed verification. Skips if stage 1 gave up.
  async (s1, item) => {
    const stage1 = { attempts: s1.history.length, crashes: s1.history.filter(h => h.crashed).length, history: s1.history }
    if (!s1.ok) {
      return { item, output: null, valid: false, gaveUp: true, failedAt: 'stage 1', stage1, stage2: null }
    }
    const history = []
    let feedback = null
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let out = null
      let v
      try {
        out = await runStage2(s1.value, item, attempt, feedback)
        v = await verify(out, item, attempt)
        if (v === null) throw new Error('verifier returned null (skipped or died)')
      } catch (e) {
        const crashedIn = out === null ? 'stage 2' : 'verify'
        history.push({ attempt, crashed: true, crashedIn, output: out, error: String(e && e.message || e) })
        log(`item ${item} ${crashedIn} attempt ${attempt} crashed: ${e.message}${attempt < MAX_ATTEMPTS ? ' — retrying' : ' — giving up'}`)
        continue
      }
      history.push({ attempt, output: out, valid: v.valid, reason: v.reason })
      if (v.valid) break
      feedback = v.reason
      log(`item ${item} attempt ${attempt} failed verification: ${v.reason}${attempt < MAX_ATTEMPTS ? ' — retrying' : ' — giving up'}`)
    }
    const last = history[history.length - 1]
    return {
      item,
      output: last.output ?? null,
      valid: !!last.valid,
      gaveUp: !last.valid,
      failedAt: last.valid ? null : 'stage 2',
      stage1,
      stage2: { attempts: history.length, crashes: history.filter(h => h.crashed).length, history },
    }
  },
)
const crashed = ITEMS.filter((_, i) => results[i] === null)   // only unexpected script errors land here now
const passed = results.filter(r => r && r.valid).length
const failed = results.filter(r => r && !r.valid).map(r => ({ item: r.item, failedAt: r.failedAt }))
log(`${passed}/${ITEMS.length} verified; unhandled crashes: [${crashed.join(', ')}]; gave up: ${JSON.stringify(failed)}`)
const hasUnhandled = crashed.length > 0
if (hasUnhandled) log(`FAILED: unhandled crash in item(s) ${crashed.join(', ')}`)
return {
  failed: hasUnhandled,
  error: hasUnhandled ? `Unhandled crash in item(s) ${crashed.join(', ')}` : null,
  passed,
  total: ITEMS.length,
  crashedItems: crashed,
  failedItems: failed,
  results,
}
