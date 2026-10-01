# Efficient agent workflow

Use this guide when setting up a project or when a session feels slow or expensive. It is not imported into agent context automatically.

## Start with a checkable request

Give the agent these four facts when you know them:

```text
Outcome: <behavior or artifact wanted>
Starting point: <likely file, symbol, existing example, or error>
Constraints: <compatibility, scope, or safety requirements that matter>
Acceptance: <test command, expected output, or visual check>
```

If the request is uncertain, ask the agent to inspect the relevant code and state the open decision. Plan first for a change with dependent steps or expensive rework risk. For a small edit, proceed directly. Keep a handoff in `PLAN.md` when the work spans sessions.

## Pick session settings before work

- Choose a model suited to the task. A general coding model is usually enough for routine implementation; use stronger reasoning for hard architecture or debugging. Set reasoning effort to match task difficulty where the client supports it.
- Start a fresh session for unrelated work. Summarize or compact when continuity matters, and keep a concise `PLAN.md` handoff for long tasks. The cost and behavior of these controls vary by client.
- In Claude Code specifically, `/model` and `/effort` control those choices. Many mid-session changes rebuild its prompt cache, so choose near the start of a focused task. Use `/usage` to inspect cache misses, `/clear` for a new task, and `/compact` with a focus when continuity is valuable.

## Control what enters context

1. Locate before reading: search filenames or symbols, then open the smallest relevant files or ranges. For typed, large codebases, consider a code intelligence plugin for definition and reference lookup.
2. Keep full test and build logs available on disk when they are large. Show the failing test names and surrounding error lines first, then inspect more if needed. Never decide a check passed from a truncated success-looking fragment; preserve its exit code.
3. Prefer an installed CLI for a service when it serves the task. Inspect the current client's connected MCP servers and disable idle ones. In Claude Code, `/mcp` and `/context all` show server and tool context use.
4. Delegate a large, self-contained investigation only when its output would crowd the main session. Request a brief answer with file references. The delegate still consumes tokens, so keep small lookups in the main session.
5. Add a scoped rule or on-demand skill after a repeated need. Put shared facts needed every session in `AGENTS.md`; keep client adapters as small as possible.

## Verify without repeated full suites

Run the smallest relevant check while iterating. Run broader verification when the change could affect other areas or before delivery if the project requires it. For a UI change, inspect the running result. Report the exact command, exit code, and any unverified behavior. If a check fails, inspect the failure rather than suppressing the output.

## Measure an optimization

Compare similar completed tasks before and after a setup change. Record:

| Measure | How to get it |
| --- | --- |
| Starting context | Client usage view; Claude Code: `/context` |
| Session tokens and model attribution | Client usage view; Claude Code: `/usage` |
| Cache misses and warm/cold status | Where available; Claude Code: `/usage` |
| Time and rework | task notes or issue history |
| Correctness | acceptance checks and review findings |

If a lower-token workflow causes more corrections or missed acceptance criteria, restore the stronger workflow. Claude Code's [cost guide](https://code.claude.com/docs/en/costs) and [prompt-caching guide](https://code.claude.com/docs/en/prompt-caching) explain its current controls and their limits.
