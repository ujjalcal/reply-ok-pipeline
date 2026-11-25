export const meta = {
  name: 'reply-ok-pipeline-report',
  description: 'Runs reply-ok-pipeline as a nested workflow, then has one agent write a short report on its result',
  phases: [{ title: 'Run pipeline' }, { title: 'Report' }],
}

// Stage 1: run the saved workflow as a sub-step.
// workflow() waits for the child and returns whatever the child returns.
// The child shares this run's agent limit, agent count, token budget and stop signal,
// and its agents appear under "▸ reply-ok-pipeline" in /workflows.
// Nesting is one level only: reply-ok-pipeline must not call workflow() itself.
phase('Run pipeline')
let child
try {
  child = await workflow('reply-ok-pipeline')
} catch (e) {
  // Thrown for an unknown name, an unreadable script or a syntax error in the child.
  log(`reply-ok-pipeline could not run: ${e.message}`)
  return { ran: false, error: String(e && e.message || e), report: null, child: null }
}
log(`child returned: ${child.passed}/${child.total} passed, failed=${child.failed}`)

// Stage 2: use the child's result in the parent.
phase('Report')
const REPORT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['all_passed', 'some_failed', 'crashed'] },
    summary: { type: 'string', description: 'One sentence a person can read at a glance' },
  },
  required: ['status', 'summary'],
}
const report = await agent(
  `Here is the JSON result of a workflow that sends 3 items through reply → confirm → verify, with retries.\n` +
  `Set status to "crashed" if failed is true, "some_failed" if failedItems is non-empty, otherwise "all_passed".\n` +
  `Write a one-sentence summary that mentions any retries or crashes recorded in the per-item history.\n\n` +
  JSON.stringify(child),
  { label: 'report', phase: 'Report', effort: 'low', schema: REPORT })

return { ran: true, report, child }
