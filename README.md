# reply-ok-pipeline

A Claude Code workflow that sends three items through three stages, with crash handling and retries at every agent call. The task itself is trivial (each item ends up as "OK confirmed"); the point is the structure around it.

| Stage | Agent's job |
|---|---|
| 1 | Reply `OK` |
| 2 | Take stage 1's reply and add ` confirmed` |
| Verify | Check the output is exactly `OK confirmed`, returning `{valid, reason}` |

## Behaviour

- **Pipeline, not barriers.** Each item moves to its next stage as soon as its own previous stage finishes.
- **Retries.** Stage 1 retries on a crash. Stage 2 and the checker retry together on a crash or a failed check, passing the checker's reason into the next attempt. Each stage gets at most 3 attempts.
- **Crashes are caught everywhere.** An agent that throws or comes back empty (`null`) counts as a crash. Each crash record says where it happened (`stage 2` or `verify`) and keeps the stage 2 reply if there was one.
- **Results are always returned.** `failed: true` and `error` flag any item that crashed outside the crash handling (a bug in the script). The run still reports "completed", so anything that reads the output must check `failed`.

## Output

```json
{
  "failed": false,
  "error": null,
  "passed": 3,
  "total": 3,
  "crashedItems": [],
  "failedItems": [],
  "results": [
    {
      "item": 1,
      "output": "OK confirmed",
      "valid": true,
      "gaveUp": false,
      "failedAt": null,
      "stage1": { "attempts": 1, "crashes": 0, "history": [] },
      "stage2": { "attempts": 1, "crashes": 0, "history": [] }
    }
  ]
}
```

`failedItems` lists items that used up their retries, with `failedAt` set to `stage 1` or `stage 2`. `crashedItems` lists items that came back empty because of an uncaught error.

## Running it

The script is at `.claude/workflows/reply-ok-pipeline.js`, so a Claude Code session started in this repository can run it by name:

```
Workflow({ name: "reply-ok-pipeline" })
```

Or from the file:

```
Workflow({ scriptPath: ".claude/workflows/reply-ok-pipeline.js" })
```

A fresh run uses 9 agents and about 615k tokens. Almost all of that is each agent's fixed startup context (about 68k), not the work.

## Files

| Path | What it is |
|---|---|
| `.claude/workflows/reply-ok-pipeline.js` | The final workflow |
| `examples/01-single-agent.js` | First step: one agent replies OK |
| `examples/02-three-parallel.js` | Second step: three agents in parallel |
| `SESSION.md` | How the workflow was built, run by run, and what each run showed |
| `ANALYSIS.md` | Running it by name from a fresh session, and why that didn't need ultracode |
