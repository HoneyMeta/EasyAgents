# EasyAgents: Generate Task Plan

Analyze user requirements and generate a task breakdown plan.

## Usage

When the user provides a requirement description, follow these steps:

### 1. Analyze Requirements

Carefully read the user requirements and identify:
- Main functional modules
- Technical dependencies
- Tasks that can run in parallel
- Tasks that must run sequentially

### 2. Generate Task List

For each task, determine:
- Task name (concise and clear)
- Detailed description
- Priority (1-5, 1 is highest)
- Dependent predecessor tasks
- Files and methods involved

### 3. Execute Commands

For each task, run:

```bash
ea task add "Task name" \
  --description "Detailed description" \
  --priority <priority> \
  --depends <dependency task IDs, comma-separated> \
  --files "file_path:operation_type:method_name"
```

File operation types:
- `create` - Create new file
- `modify` - Modify existing file
- `delete` - Delete file

### 4. Output Recommendations

After completion, inform the user:
- Total number of tasks created
- Recommended number of parallel agents
- Which tasks can run in parallel

## Example

User requirement: "Implement user login and registration"

After analysis, execute:

```bash
# Task 1: Design database
ea task add "Design user database" \
  --description "Design users table with id, email, password_hash, created_at fields" \
  --priority 1 \
  --files "src/db/schema.sql:create"

# Task 2: Implement user model (depends on Task 1)
ea task add "Implement user model" \
  --description "Implement User model class based on database schema" \
  --priority 2 \
  --depends task_xxx \
  --files "src/models/user.ts:create"

# Task 3: Implement registration API (depends on Task 2)
ea task add "Implement registration API" \
  --description "POST /api/register endpoint" \
  --priority 2 \
  --depends task_yyy \
  --files "src/api/auth.ts:create,src/api/index.ts:modify:registerRoutes"

# Task 4: Implement login API (depends on Task 2, can run parallel with Task 3)
ea task add "Implement login API" \
  --description "POST /api/login endpoint" \
  --priority 2 \
  --depends task_yyy \
  --async \
  --files "src/api/auth.ts:modify:login"
```

## Notes

1. Task granularity should be moderate - not too large or too small
2. Clearly mark dependencies to avoid circular dependencies
3. Add `--async` flag for tasks that can run in parallel
4. For tasks involving the same file, pay attention to method-level locking
