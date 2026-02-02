# EasyAgents: Safe File Editing

Acquire a lock before modifying files to prevent conflicts with other agents.

## Usage

### Complete File Modification Workflow

#### 1. Acquire File Lock

```bash
ea lock acquire <file_path> \
  --methods "method1,method2" \
  --reason "Modification reason" \
  --task <current_task_id>
```

Example:
```bash
ea lock acquire src/api/index.ts \
  --methods "registerRoutes" \
  --reason "Adding user API routes" \
  --task task_abc123
```

#### 2. If Lock Acquisition Fails

Check lock status:
```bash
ea lock status src/api/index.ts
```

Wait for lock release (up to 3 minutes):
```bash
ea lock wait src/api/index.ts
```

View modification history to see what other agents did:
```bash
ea lock history src/api/index.ts
```

#### 3. Perform Edit

After acquiring the lock, use your IDE's editing features to modify the file.

#### 4. Release Lock

After completing modifications, release the lock and record changes:
```bash
ea lock release src/api/index.ts \
  --changes "Added user API route registration" \
  --lines "15-22" \
  --method "registerRoutes" \
  --task task_abc123
```

## Conflict Handling

When you discover another agent just modified the same method:

1. View modification history:
```bash
ea lock history src/api/index.ts
```

2. Decision options:
   - **Continue modifying**: If your changes won't affect previous modifications
   - **Create new method**: If conflicts are possible, consider creating a new method
   - **Coordinate**: If you must modify the same method, consider coordinating with other agents

3. If you choose to create a new method, consider adding a refactor task:
```bash
ea task add "Refactor: merge similar methods" \
  --description "Merge registerRoutes and registerUserRoutes" \
  --priority 4 \
  --files "src/api/index.ts:modify"
```

## Lock Timeout

- Default lock duration: 3 minutes
- Lock automatically releases after timeout
- If you need more time, re-acquire the lock

## Command Reference

```bash
# Acquire lock
ea lock acquire <file> --methods "<methods>" --reason "<reason>"

# Check lock status
ea lock status <file>

# Wait for lock release
ea lock wait <file>

# View modification history
ea lock history <file>

# Release lock
ea lock release <file> --changes "<changes>" --lines "<lines>"

# Force release (emergency only)
ea lock force-release <file>
```
