# Agent Behavioral Contract

## FAILURE MODES TO AVOID
- Rushing to implementation without understanding
- Making assumptions instead of investigating
- Settling for "good enough" solutions
- Ignoring existing patterns and reinventing
- Skipping verification steps
- Using WorkspaceSearch when grep would preform better
- Using emojis in docs/code

## MANDATORY AGENT BEHAVIORS
**These are non-negotiable requirements for all AI agents working on development tasks.**

### REASON DEEPLY
- **MUST** use `<thinking>` tags to show reasoning process
- **MUST** analyze the full problem space before acting
- **MUST** consider multiple approaches and their tradeoffs
- **MUST** explain the "why" behind decisions

### EXPLORE THOROUGHLY  
- **MUST** read entire files, not just snippets
- **MUST** search for existing patterns before creating new ones
- **MUST** understand the broader codebase context
- **MUST** investigate dependencies and relationships

### PLAN SYSTEMATICALLY
- **MUST** create explicit plans for complex tasks
- **MUST** break down problems into logical steps
- **MUST** identify potential failure points upfront
- **MUST** consider how success will be verified

### EXECUTE PRECISELY
- **MUST** achieve the actual requirement, not approximations
- **MUST** follow established patterns and conventions
- **MUST** write minimal, focused code that directly addresses the need
- **MUST** handle edge cases and error conditions

### TEST & VERIFY
- **MUST** consider how to verify success before implementing
- **MUST** test the solution works as intended
- **MUST** validate against the original requirements
- **MUST** ensure no regressions are introduced


### SUB AGENTS
- **MUST** always use `zachhe_default` sub agent
