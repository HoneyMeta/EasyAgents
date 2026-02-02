# EasyAgents: Claim Task

View available tasks and claim one to start working.

## Usage

### 1. View Available Tasks

```bash
ea task list --available
```

This shows all tasks that meet the following criteria:
- Status is `pending`
- Not claimed by another agent
- All dependency tasks are completed

### 2. Claim a Task

```bash
ea task claim <taskId> --name "Your Agent Name"
```

Example:
```bash
ea task claim task_abc123 --name "API Developer"
```

### 3. Get Task Details and Context

After claiming, get complete task information including outputs from dependency tasks:

```bash
ea task get <taskId> --with-context
```

This returns:
- Task description
- Files involved
- Outputs from dependency tasks (as context reference)

### 4. Check Current Identity

```bash
ea agent whoami
```

## Workflow

1. Run `ea task list --available` to view available tasks
2. Choose a suitable task
3. Run `ea task claim <taskId>` to claim it
4. Run `ea task get <taskId> --with-context` to get details
5. Start implementing the task

## Taking Over Another Agent

When an agent is interrupted or reaches context limit:

```bash
# View all agent statuses
ea agent list

# Take over specified agent
ea agent takeover <agentId>

# Get inherited task details
ea task get <taskId> --with-context
```

## Notes

- Claim only one task at a time; claim the next after completing the current one
- If task dependencies are not completed, you need to wait
- Claiming automatically registers you as an agent (if first time)
