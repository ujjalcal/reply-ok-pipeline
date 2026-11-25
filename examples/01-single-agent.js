export const meta = {
  name: 'reply-ok',
  description: 'Single agent that replies OK',
  phases: [{ title: 'Reply' }],
}
phase('Reply')
const r = await agent('Reply with exactly the text: OK', { label: 'ok', effort: 'low' })
return r
