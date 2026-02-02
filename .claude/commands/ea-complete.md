# EasyAgents: Complete Task

Mark a task as completed and record the completion summary.

## Usage

### Basic Completion

```bash
ea task complete <taskId> --summary "Completion summary"
```

Example:
```bash
ea task complete task_abc123 --summary "Implemented user registration API with email validation"
```

### With Detailed Output

If you have detailed implementation notes or output, save them to a file:

```bash
ea task complete <taskId> \
  --summary "Brief summary" \
  --output-file .easyagents/outputs/task_abc123.md
```

Or provide output content directly:
```bash
ea task complete <taskId> \
  --summary "Brief summary" \
  --output "Detailed implementation notes..."
```

### Read Summary from File

For longer summaries:
```bash
ea task complete <taskId> --summary-file ./completion-notes.md
```

## After Completion

The command will display:
- Confirmation that the task is completed
- List of subsequent tasks that are now unblocked (dependents)

Example:
```
✓ Task task_abc123 completed
  Unblocked tasks: task_def456, task_ghi789
```

## Workflow

1. Ensure all modifications are complete and tested
2. Release all held file locks
3. Run `ea task complete` to mark as completed
4. Review unblocked tasks and consider claiming the next one

## Completion Summary Guidelines

A good completion summary should include:
- What functionality was implemented
- Which key files were created/modified
- Any notes for subsequent tasks to be aware of

Example:
```
Implemented user registration API (POST /api/register)
- Created src/api/auth.ts
- Modified src/api/index.ts to add routes
- Includes email format validation and password strength check
- Note: SMTP configuration required to send verification emails
```

## Notes

- Ensure all file locks are released before completing
- Summary will be passed as context to tasks that depend on this one
- Detailed output is saved in `.easyagents/outputs/` directory
