# Analysis: did running the workflow need ultracode?

After the workflow was pushed to this repo, a second Claude Code session was started from the repo and asked to run `reply-ok-pipeline` by name. It ran fine, but the session itself was set up differently from the one that built the workflow. This note records what differed, why the other session didn't need ultracode, and what the differences mean.

The explanation was checked by three independent agents (authorization, execution, cost). Their corrections are included below.

## The test run

The new session was started from `ujjalcal/reply-ok-pipeline` with one instruction: run `Workflow({name: "reply-ok-pipeline"})`, don't fall back to the file path, and report back.

- Name found on the first try
- `failed: false`, 3 of 3 passed on first attempts, no crashes or retries
- 9 agents, 593,097 tokens, 6.6 s
- The script that ran was byte-identical (same SHA-256) to `.claude/workflows/reply-ok-pipeline.js`

That session had none of the original session's stored copies, so the script could only have come from the repo. Running by name from the repo works.

## How the two sessions differed

| Setting | Session that built the workflow | Session started from the repo |
|---|---|---|
| Started by | The user, from claude.ai | The first session, through the session tools |
| Ultracode | On | Off (not set) |
| Effort | Medium | Not set (default) |
| User's claude.ai plugins | Loaded: brand-voice, sales, data, legal, finance, marketing, productivity, design, common-room and more, with their skills, agent types and ~57 MCP servers | Not loaded: 4 built-in plugins, 6 MCP servers, 7 standard agent types |
| Permission mode, model, environment | Auto, same model, same environment | Same |

A session started through the session tools inherits the environment and model, but not ultracode, effort or the user's claude.ai plugins. The tool has no option for ultracode or plugins.

## Why ultracode wasn't needed

A workflow may run when any one of these holds: the user typed "ultracode", ultracode is on for the session, the user asked for a workflow in their own words, a skill or command the user invoked says to run one, or the user asked to run a specific named workflow. Ultracode is enough on its own, but never required.

| Session | Condition met | Ultracode needed? |
|---|---|---|
| Built the workflow | The first message, "**Use a workflow** with one agent that replies OK", is an explicit request in the user's own words. Ultracode was also on, so two conditions were met. | No, redundant |
| Started from the repo | Asked to "run the saved workflow named reply-ok-pipeline", a request to run a specific named workflow | No |

Ultracode doesn't unlock workflows. It makes a workflow the default for every substantive task, and the session kept getting reminders to use one. For every workflow requested by name in this session it made no difference. Its only visible effect was on questions that weren't workflow requests, such as this analysis itself, which ran as a three-agent workflow (~209k tokens) instead of a direct answer.

## What the differences mean

Session settings change how the main session behaves, not what the workflow script does.

- **Ultracode and session effort** affect whether and how the main session decides to start a workflow. They don't affect the agents inside it, because every `agent()` call in the script sets `effort: 'low'` and both sessions use the same model. That's why the results were identical.
- **Plugins** don't change results, but probably explain the token gap. Each agent cost about 68.3k tokens in the original session and about 65.9k in the new one: about 2.4k more per agent (+3.7%), or 22k per 9-agent run. The original session's four fresh runs varied by only ~480 tokens in total, so the gap is a real, fixed difference. The likely cause is the plugins' skills, agent types and MCP servers being listed in each agent's starting context. That's a strong guess, not proven.
- **How the session was started** had no visible effect on the run.

The difference the user noticed was in the session, not the workflow. In the original session the user directed each step and could steer between runs. The new session got one written instruction, ran it once, and finished in about 15 seconds, before anyone opened it.

## Corrections from the checking agents

1. **The new session's request didn't come from the user.** It was written by the first session, while the rule asks for the user's explicit request in their own words. The new session treated it as the user's and ran the workflow; the rules don't clearly say whether that should count. A session the user starts and prompts directly is the clean test.
2. **"Plugins only add context" overstated it.** The sessions also differed in MCP servers, agent types and how they were started. Attributing the token gap to plugins alone would need testing one difference at a time.
3. **Ultracode did more than set a default.** It also added repeated reminders to use the Workflow tool, which pushed the session toward workflows even for questions like this one.

## Did workflows need anything beyond Claude Code?

No. There was no tmux or other terminal multiplexer, no separate processes, no job queue and no external storage. Workflows run inside Claude Code itself.

- **Running in the background is built in.** The Workflow tool starts the run and returns straight away, and Claude Code sends a notification when it finishes. Nothing had to keep a terminal open or poll for results. When a run was stopped, Claude Code reported it as a `local_workflow` task, meaning one run by the Claude Code process itself.
- **Running agents at the same time is built in.** Agents ran side by side through `parallel()` and `pipeline()` in the script, with Claude Code running several agents at once up to its own limit. No extra terminals were opened and no processes were started or managed by hand.
- **Watching progress is built in.** `/workflows` shows live progress, and each run keeps its own records under `~/.claude/projects/…`, including a copy of the script and every agent's result.
- **Resuming is built in.** Reusing saved results with `resumeFromRunId` is part of the Workflow tool; nothing external stores them.

The one requirement is that the Claude Code session stays alive while a workflow runs, because the run lives inside that session. If the session ends partway through, the run stops. Resuming only works within the same session, so a new session has to start the workflow again. Here every run finished in seconds, so this never came up.

The second session wasn't needed for workflows either. It was just a clean place to test running the workflow by name.

## Open questions

- Do workflow agents inherit the session's plugin skills, MCP tool definitions and agent-type listings, and how much of the ~2.4k per agent comes from each?
- Does a message one session sends to a session it created count as the user's request under the workflow rules?
- Would a new session started by the user from claude.ai, with ultracode on and medium effort, use ~615k tokens per run like the original?
