# Session log: building reply-ok-pipeline

This records the Claude Code session in which the workflow was built, one request at a time. Each step changed the script, ran it, and checked the result. Token counts are tokens used by the workflow's agents in that run; "saved results" means a resumed run reused agent results from an earlier run instead of running those agents again.

## Timeline

| # | Request | Change | Agents (fresh) | Tokens | Result |
|---|---|---|---|---|---|
| 1 | One agent that replies OK | Single `agent()` call | 1 (1) | ~68k | `"OK"` |
| 2 | Three agents in parallel | `parallel()` over 3 calls | 3 (3) | ~205k | `["OK","OK","OK"]` |
| 3 | Two-stage pipeline | `pipeline()`: reply OK, then add " confirmed" | 6 (6) | ~411k | 3 × `"OK confirmed"` |
| 4 | Add a verifying stage | Checker agent returning `{valid, reason}`; resumed run | 9 (3) | ~204k | 3/3 passed |
| 5 | Make a stage 2 agent fail | Item 2's stage 2 replies `NOT OK` | 9 (5) | ~341k | 2/3 passed; checker caught item 2 |
| 6 | Retry the failed item until it passes | Retry stage 2 + check up to 3 times, passing the checker's reason; item 2 sabotaged on attempt 1 only | 11 (2) | ~137k | 3/3; item 2 passed on attempt 2 |
| 7 | Make it fail all three attempts | Item 2 sabotaged on every attempt | 13 (4) | ~273k | 2/3; item 2 gave up after 3 |
| 8 | Make a stage 2 agent crash instead | Item 2's stage 2 throws | 7 (0) | 0 | 2/3; item 2 came back `null`, retries skipped |
| 9 | Retry the crashed item too | `try/catch` around stage 2; crash counts as an attempt | 9 (0) | 0 | 3/3; item 2 crashed once, then passed |
| 10 | Wrap stage 1 the same way | Stage 1 retries on crash, never throws; item 3's stage 1 crashes once | 9 (0) | 0 | 3/3; both crashes recovered |
| 11 | Throw if any item crashes unhandled | Final check throws; test switch makes item 1 crash outside the handling | 7 (0) | 0 | Run failed: "Unhandled crash in item(s) 1"; items 2–3's results lost |
| 12 | Return results with a failed flag instead | Return `failed` / `error` instead of throwing | 7 (0) | 0 | `failed: true`; items 2–3's full results kept |
| 13 | Run without the simulated crash | Test switch off | 9 (0) | 0 | `failed: false`, 3/3 |
| 14 | Remove the other simulated crashes | Deleted the built-in crashes for items 2 and 3 | 9 (0) | 0 | 3/3, no crashes |
| 15 | Remove the test hook too | Deleted the test switch | 9 (0) | 0 | 3/3 |
| 16 | Save as a named workflow | Copied to `.claude/workflows/reply-ok-pipeline.js` | – | – | Saved |
| 17 | Run it by name | Name not found; ran the saved file instead | 9 (9) | ~615k | 3/3 |
| 18 | Show the final script / fix both | Code reading found two problems (below); fixed both | 9 (0) | 0 | 3/3 |
| 19 | Test the checker crash path | Temporary copy where item 2's first check crashes | 10 (2) | ~137k | 3/3; item 2 crashed in `verify`, passed on attempt 2 |
| 20 | Run it by name | Name now found | 9 (9) | ~615k | 3/3 |
| 21 | Delete test copy, then the `/root` copy, run by name again | Ran from the `/home/user` copy (script identical) | 9 (9) | ~615k | 3/3 |
| 22 | Delete the named workflow, run by name to confirm it fails | It didn't fail; stopped after 2 agents | 2 (2) | ~135k | Still runnable by name |
| 23 | Push to GitHub and document the session | Restored the final script from the session's run records; wrote README and this log; committed locally | – | – | Committed; push blocked (below) |
| 24 | Push to the new repo | Connected `ujjalcal/reply-ok-pipeline`, pushed `main` | – | – | Pushed |
| 25 | Run it by name from the repo | Named run; script that ran was identical to the repo's copy | 9 (9) | ~615k | 3/3 |

Roughly 4.3M agent tokens in total. The seven runs that started fresh (1, 2, 3, 17, 20, 21, 25) account for about 3.2M of it.

## Getting it onto GitHub

- **A session can't create repositories.** Creating `ujjalcal/reply-ok-pipeline` through the GitHub API was refused, because a cloud session may only use repositories that already exist and are connected to it. The repo had to be created by hand on github.com.
- **The new repo wasn't visible at first.** Right after it was created, connecting it failed and it didn't appear in the session's repository list. On the next try it connected. The cause isn't certain: either the Claude GitHub App's repository access was updated, or GitHub needed a moment to catch up.
- **The push** went to an empty remote, so there was nothing to merge. Git printed `push negotiation failed`, which is harmless here; `main` on GitHub matched the local commit.
- **Running by name after the push** used a script identical to the repo's copy. That doesn't prove the repo's copy was used, because the session still held its own identical copy from step 20. Only a new session started from the repo would show that.

## Problems found by reading the code

After step 15 the tests all passed, but reading the script found two issues that no test had exercised:

1. **A checker crash wasn't retried.** The `verify` call sat outside the `try/catch`, so if the checking agent died, `v.valid` threw and the whole item ended up in `crashedItems`. Fixed by moving `verify` inside the `try` and treating a `null` verdict as a crash. Step 19 then tested that path on purpose.
2. **A typo**, `stage1 ={`, with no effect on behaviour.

## What we learned

### How workflows behave

- **Tokens grow with the number of agents, not the work.** Each agent costs about 68k tokens of fixed setup even to reply "OK".
- **`pipeline()` doesn't wait between stages.** Each item moves on independently, so a slow item doesn't hold up the others.
- **A failed check and a crash are different.** A failed check returns a result the retry logic can act on. A crash makes the stage callback throw; the item becomes `null`, skips every later stage, and goes around the retry logic unless caught.
- **Crash handling has to cover every agent call.** Stage 2 was covered first, then stage 1, and the checker was only found by reading the code, because no test had made it crash.
- **Throwing loses partial results.** Failing the whole run discarded the items that had passed. Returning everything with `failed: true` keeps them, but the run still reports "completed", so the reader of the output has to check the flag.
- **A checker agent is only worth it when judging takes reasoning.** Here a string comparison in the script would have done the same job at no cost.

### Reusing saved results when resuming

- Results are reused in order up to the first call that changed; everything after it runs fresh, including calls that didn't change. Because pipeline calls finish in whatever order they finish, one change near the front can rerun more than expected (step 5 reran 5 agents when only 2 prompts changed).
- New calls added at the end, such as retries, leave earlier results reusable. Most edit-and-rerun steps cost nothing for this reason.
- Simulated crashes that throw before calling an agent cost nothing to test.

### Named workflows

- A workflow saved mid-session wasn't found by name at first, but was a few minutes later. (I had said they're only read at session start; that was wrong.)
- Once found, the session keeps its own copy. Deleting the file didn't stop it running by name. (I had said it would fail; that was wrong too, and testing it cost about 135k tokens before the run was stopped.)
- Nothing in a cloud session's container outlasts the session. A workflow worth keeping belongs in a repository, which is why this one is here.
- A script deleted from disk can still be recovered from the session's own run records, which keep a copy of every script that ran. That's how the final version got into this repo.
