# ARCC Project Context

## Project Structure
```
/Users/zachhe/workplace/ArccServiceBackend/
├── src/ARCC/docs/                    # Documentation root
│   ├── human/                        # Documentation for developers
│   │   ├── architecture/arcc_hld_v4.md  # High-level design
│   │   └── packages/                 # Package documentation
│   └── agents/                       # Specifications for AI-assisted development
│       └── specifications/2026/01/   # Current month's project specs
├── src/ARCCAppUi/                    # React frontend (Vite + TypeScript)
│   ├── src/App.tsx                   # Main React app
│   ├── src/components/               # React components
│   └── package.json                  # Dependencies
├── src/ARCCAppModel/                 # Smithy API definitions
│   └── model/                        # Smithy model files
├── src/ARCCAppCore/                  # Kotlin Lambda backend
│   ├── src/main/kotlin/              # Lambda handlers
│   └── Config                        # Brazil package config
├── src/ARCCAppCDK/                   # Infrastructure as Code (AWS CDK)
│   ├── lib/                          # CDK constructs and stacks
│   └── Config                        # Brazil package config
├── src/ARCCAppIntegrationTests/      # JUnit5 integration tests (Hydra/local)
│   └── src/test/kotlin/              # Test files
├── src/ARCCAppJavaClient/            # Generated Java client library
├── src/ARCCAppTypescriptClient/      # Generated TypeScript client library
├── src/ARCCAppClientConfig/          # Coral client configuration
└── src/ARCCCliCore/                  # Node.js CLI tool for governance intelligence
    ├── src/                          # TypeScript source
    ├── package.json                  # Dependencies
    └── Config                        # Brazil package config
```

## Agent Specifications

When users mention "specs" or "specifications", they likely refer to implementation specifications in:
```
src/ARCC/docs/agents/specifications/YYYY/MM/project-name/
```

**When working on specifications:**
1. Check if project directory exists in current month
2. Create new project directory if needed: `specifications/2026/01/project-name/`
3. Keep all project files together (specs, validation, notes)
4. Follow the format in `agents/README.md`

**For detailed guidance on creating specifications, see:** `src/ARCC/docs/agents/README.md`

## Development Environment
- **OS**: macOS
- **Tools**: ripgrep, jq, fzf
- **Build**: brazil-build for Brazil projects

## Brazil Projects & Git Integration

**Brazil** is Amazon's internal build system. Each ARCC sub-project is a Brazil package with its own `Config` file defining dependencies.

- **Packages**: Individual buildable units 
- **Version Sets**: Collections of package versions that work together
- **Workspaces**: Local development environments containing multiple packages
- **Git Structure**: Each sub-project is its own git repository, not the workspace root
- Changes propagate through dependency graph via version set updates

## Key Commands
- Build: `brazil-build`
- Search: `rg <pattern>` (ripgrep)
- JSON: `jq` for parsing
- Files: `fzf` for fuzzy finding
- Context management: `tail -50` when building to manage context

## Agent Build Scripts
Use these scripts for structured output without overwhelming context:
- `src/ARCC/tools/check.sh` - ARCCAppCore build validation with structured results
- `src/ARCC/tools/logs.sh` - CloudWatch log analysis with error summaries
- More agent-friendly scripts available in `src/ARCC/tools/` directory

## Agent Build Scripts
Use these scripts for structured output without overwhelming context:
- `tools/check.sh` - ARCCAppCore build validation with structured results
- `tools/logs.sh` - Log analysis utilities
- More agent-friendly scripts available in `tools/` directory

## Agent Build Scripts
Use these scripts for structured output without overwhelming context:
- `tools/check.sh` - ARCCAppCore build validation with structured results
- More agent-friendly scripts available in `tools/` directory
