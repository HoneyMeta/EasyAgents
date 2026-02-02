# EasyAgents: View Progress

View overall project progress and status.

## Usage

### View Overall Progress

```bash
ea status progress
```

Displays:
- Task list and statuses
- Progress bar
- Number of active agents
- Number of locked files

### View Dependency Graph

```bash
ea status graph --mermaid
```

Outputs a Mermaid-format dependency graph that can be visualized in Mermaid-compatible tools.

### View Agent Status

```bash
ea status agents
```

Shows all agents and their:
- Current status (active/inactive/terminated)
- Claimed tasks
- Last activity time

### Generate Markdown Report

```bash
ea status report --output .easyagents/PROGRESS.md
```

Generates a complete progress report including:
- Task status summary
- Dependency graph
- Agent status
- Recent modification records

### View Refactor Suggestions

```bash
ea status refactor
```

Shows system-generated refactor suggestions (when a file/method has been modified multiple times).

## Other Useful Commands

```bash
# View all tasks
ea task list

# View only in-progress tasks
ea task list --status in_progress

# View only my tasks
ea task list --mine

# View claimable tasks
ea task list --available

# View current agent identity
ea agent whoami

# View all locks
ea lock list
```

## Status Icons Reference

| Icon | Meaning |
|------|---------|
| ✅ | Completed |
| 🔄 | In Progress |
| ⏳ | Pending |
| 🚫 | Blocked |
| ❌ | Failed |
| 🟢 | Agent Active |
| 🟡 | Agent Inactive |
| 🔴 | Agent Terminated |
