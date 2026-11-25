export const meta = {
  name: 'reply-ok-x3',
  description: 'Three agents in parallel, each replies OK',
  phases: [{ title: 'Reply' }],
}
phase('Reply')
const rs = await parallel([0, 1, 2].map(i => () =>
  agent('Reply with exactly the text: OK', { label: `ok-${i + 1}`, effort: 'low' })))
return rs
