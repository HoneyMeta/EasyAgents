// EasyAgents Type Definitions

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
export type TaskType = 'task' | 'validation' | 'refactor' | 'review';
export type FileOperationType = 'create' | 'modify' | 'delete';
export type AgentStatus = 'active' | 'inactive' | 'terminated';

export interface TaskFile {
  path: string;
  type: FileOperationType;
  methods?: string[];
}

export interface TaskResult {
  completed_at: string;
  summary: string;
  output_ref?: string;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  priority: number;
  assigned_agent: string | null;
  dependencies: string[];
  dependents: string[];
  context_from?: string[];
  files: TaskFile[];
  result?: TaskResult;
  async_execution?: boolean;
  task_type?: TaskType;
  condition?: Record<string, string[]>;
  created_at: string;
  updated_at: string;
}

export interface FileLock {
  locked_by: string;
  locked_at: string;
  expires_at: string;
  methods: string[];
  reason: string;
  task_id?: string;
}

export interface FileModification {
  file: string;
  method?: string;
  modified_by: string;
  modified_at: string;
  lines_changed: string;
  reason: string;
  task_id: string;
}

export interface RefactorSuggestion {
  id: string;
  file: string;
  method?: string;
  reason: string;
  suggested_by: string;
  created_at: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Agent {
  id: string;
  name: string;
  claimed_tasks: string[];
  session_id: string | null;
  status: AgentStatus;
  last_active: string;
  created_at: string;
}

export interface WorkflowConfig {
  lock_timeout: number;
  max_parallel_agents: number;
  auto_refactor_threshold: number;
  inactive_timeout: number;
}

export interface Workflow {
  version: string;
  project: string;
  created_at: string;
  updated_at: string;
  config: WorkflowConfig;
  agents: Record<string, Agent>;
  tasks: Record<string, Task>;
  locks: Record<string, FileLock>;
  modifications: FileModification[];
  refactor_suggestions: RefactorSuggestion[];
}

// Lock operation results
export interface LockAcquireResult {
  success: boolean;
  message: string;
  lock?: FileLock;
  waitInfo?: {
    locked_by: string;
    reason: string;
    expires_in_ms: number;
    methods: string[];
  };
}

export interface LockReleaseResult {
  success: boolean;
  message: string;
}

export interface LockWaitResult {
  released: boolean;
  modifications?: FileModification[];
  timeout?: boolean;
}

// Task operation results
export interface TaskClaimResult {
  success: boolean;
  message: string;
  task?: Task;
  agent_id?: string;
}

export interface TaskCompleteResult {
  success: boolean;
  message: string;
  unblocked_tasks?: string[];
}

// Agent operation results
export interface AgentTakeoverResult {
  success: boolean;
  message: string;
  inherited_tasks?: string[];
}

// Default configuration
export const DEFAULT_CONFIG: WorkflowConfig = {
  lock_timeout: 180000,        // 3 minutes
  max_parallel_agents: 5,
  auto_refactor_threshold: 3,
  inactive_timeout: 600000     // 10 minutes
};

// Default workflow template
export function createDefaultWorkflow(projectName: string): Workflow {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    project: projectName,
    created_at: now,
    updated_at: now,
    config: { ...DEFAULT_CONFIG },
    agents: {},
    tasks: {},
    locks: {},
    modifications: [],
    refactor_suggestions: []
  };
}
