# Sub-Agent Strategy

## When to Use Sub-Agents

**Good use cases:**
- Parallel independent tasks (no dependencies between them)
- Code generation across multiple files
- Review/analysis tasks that benefit from focused context
- Tasks that can be clearly scoped with minimal context

**Avoid sub-agents when:**
- Tasks require cross-file consistency (one agent seeing all files is better)
- Context is too large (will hit context window limits)
- Tasks have sequential dependencies (wait for previous results)

## Agent Selection

1. Always run `ListAgents` first to see available agents
2. Use `zachhe_default` for file read/write operations

## Context Management

**Context window limits:**
- Provide minimal but sufficient context in `relevant_context`

**What to include in queries:**
- Explicit file paths
- Clear success criteria
- Specific patterns/formats to follow
- Minimal examples (not exhaustive)

## Parallelism Strategy

**High parallelism (4 agents):**
- Independent code generation tasks
- Each agent works on separate files
- No cross-file consistency needed

**Low parallelism (1-2 agents):**
- Review tasks needing broader context
- Cross-file pattern enforcement
- Tasks where seeing related files together matters

## Wave Execution Pattern

For large multi-file tasks:
1. Group related files by domain/dependency
2. Execute waves sequentially (wait for completion)
3. Agents within a wave run in parallel
4. Later waves can depend on earlier wave results

## Error Handling

- Context overflow: Split into smaller batches
- Agent not found: Re-run `ListAgents`, use exact name from list
- Task too broad: Break into focused sub-tasks

## Anti-Patterns

- Using sub-agents for simple single-file edits (overhead not worth it)
- Expecting sub-agents to communicate with each other (they can't)
- Assuming sub-agents have main conversation context (they don't)
