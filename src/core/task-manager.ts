import {
  Task,
  TaskStatus,
  TaskFile,
  TaskResult,
  TaskClaimResult,
  TaskCompleteResult,
  Workflow
} from '../types/index.js';
import { WorkflowStore } from './workflow-store.js';

export class TaskManager {
  private store: WorkflowStore;

  constructor(store: WorkflowStore) {
    this.store = store;
  }

  /**
   * Generate a unique task ID
   */
  generateTaskId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `task_${timestamp}_${random}`;
  }

  /**
   * Add a new task
   */
  addTask(options: {
    name: string;
    description: string;
    priority?: number;
    dependencies?: string[];
    files?: TaskFile[];
    async_execution?: boolean;
    task_type?: Task['task_type'];
  }): Task {
    const workflow = this.store.load();
    const now = new Date().toISOString();
    const taskId = this.generateTaskId();

    const task: Task = {
      id: taskId,
      name: options.name,
      description: options.description,
      status: 'pending',
      priority: options.priority || 3,
      assigned_agent: null,
      dependencies: options.dependencies || [],
      dependents: [],
      files: options.files || [],
      async_execution: options.async_execution || false,
      task_type: options.task_type || 'task',
      created_at: now,
      updated_at: now
    };

    // Update dependents of dependency tasks
    for (const depId of task.dependencies) {
      const depTask = workflow.tasks[depId];
      if (depTask && !depTask.dependents.includes(taskId)) {
        depTask.dependents.push(taskId);
      }
    }

    workflow.tasks[taskId] = task;
    this.store.save(workflow);

    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | null {
    const workflow = this.store.load();
    return workflow.tasks[taskId] || null;
  }

  /**
   * Get task with context from dependencies
   */
  getTaskWithContext(taskId: string): { task: Task; context: Record<string, string> } | null {
    const workflow = this.store.load();
    const task = workflow.tasks[taskId];
    if (!task) return null;

    const context: Record<string, string> = {};
    const contextFrom = task.context_from || task.dependencies;

    for (const depId of contextFrom) {
      const output = this.store.readOutput(depId);
      if (output) {
        context[depId] = output;
      } else {
        const depTask = workflow.tasks[depId];
        if (depTask?.result?.summary) {
          context[depId] = depTask.result.summary;
        }
      }
    }

    return { task, context };
  }

  /**
   * List all tasks with optional filters
   */
  listTasks(filters?: {
    status?: TaskStatus;
    assigned_agent?: string;
    available?: boolean;
  }): Task[] {
    const workflow = this.store.load();
    let tasks = Object.values(workflow.tasks);

    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }

    if (filters?.assigned_agent) {
      tasks = tasks.filter(t => t.assigned_agent === filters.assigned_agent);
    }

    if (filters?.available) {
      tasks = tasks.filter(t => this.isTaskAvailable(t, workflow));
    }

    // Sort by priority (lower number = higher priority)
    return tasks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if a task is available for claiming
   */
  isTaskAvailable(task: Task, workflow?: Workflow): boolean {
    if (task.status !== 'pending') return false;
    if (task.assigned_agent) return false;

    const wf = workflow || this.store.load();

    // Check if all dependencies are completed
    for (const depId of task.dependencies) {
      const depTask = wf.tasks[depId];
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Claim a task for an agent
   */
  claimTask(taskId: string, agentId: string): TaskClaimResult {
    const workflow = this.store.load();
    const task = workflow.tasks[taskId];

    if (!task) {
      return { success: false, message: `Task ${taskId} not found` };
    }

    if (!this.isTaskAvailable(task, workflow)) {
      if (task.status !== 'pending') {
        return { success: false, message: `Task is already ${task.status}` };
      }
      if (task.assigned_agent) {
        return { success: false, message: `Task is already assigned to ${task.assigned_agent}` };
      }
      return { success: false, message: 'Task dependencies not completed' };
    }

    // Update task
    task.status = 'in_progress';
    task.assigned_agent = agentId;
    task.updated_at = new Date().toISOString();

    // Update agent's claimed tasks
    const agent = workflow.agents[agentId];
    if (agent) {
      if (!agent.claimed_tasks.includes(taskId)) {
        agent.claimed_tasks.push(taskId);
      }
      agent.last_active = new Date().toISOString();
    }

    this.store.save(workflow);

    return {
      success: true,
      message: `Task ${taskId} claimed successfully`,
      task,
      agent_id: agentId
    };
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string, options: {
    summary: string;
    output?: string;
  }): TaskCompleteResult {
    const workflow = this.store.load();
    const task = workflow.tasks[taskId];

    if (!task) {
      return { success: false, message: `Task ${taskId} not found` };
    }

    if (task.status === 'completed') {
      return { success: false, message: 'Task is already completed' };
    }

    const now = new Date().toISOString();

    // Save output if provided
    let outputRef: string | undefined;
    if (options.output) {
      outputRef = this.store.writeOutput(taskId, options.output);
    }

    // Update task
    task.status = 'completed';
    task.result = {
      completed_at: now,
      summary: options.summary,
      output_ref: outputRef
    };
    task.updated_at = now;

    // Remove from agent's claimed tasks
    if (task.assigned_agent) {
      const agent = workflow.agents[task.assigned_agent];
      if (agent) {
        agent.claimed_tasks = agent.claimed_tasks.filter(id => id !== taskId);
        agent.last_active = now;
      }
    }

    // Find tasks that are now unblocked
    const unblockedTasks: string[] = [];
    for (const dependentId of task.dependents) {
      const dependent = workflow.tasks[dependentId];
      if (dependent && this.isTaskAvailable(dependent, workflow)) {
        unblockedTasks.push(dependentId);
      }
    }

    this.store.save(workflow);

    return {
      success: true,
      message: `Task ${taskId} completed`,
      unblocked_tasks: unblockedTasks
    };
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskStatus): boolean {
    const workflow = this.store.load();
    const task = workflow.tasks[taskId];

    if (!task) return false;

    task.status = status;
    task.updated_at = new Date().toISOString();
    this.store.save(workflow);

    return true;
  }

  /**
   * Get workflow progress statistics
   */
  getProgress(): {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    blocked: number;
    failed: number;
    percentage: number;
  } {
    const workflow = this.store.load();
    const tasks = Object.values(workflow.tasks);

    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      percentage: 0
    };

    stats.percentage = stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;

    return stats;
  }

  /**
   * Generate Mermaid diagram of task dependencies
   */
  generateMermaidGraph(): string {
    const workflow = this.store.load();
    const tasks = Object.values(workflow.tasks);

    const statusEmoji: Record<TaskStatus, string> = {
      completed: '✅',
      in_progress: '🔄',
      pending: '⏳',
      blocked: '🚫',
      failed: '❌'
    };

    let mermaid = 'graph TD\n';

    for (const task of tasks) {
      const emoji = statusEmoji[task.status];
      const label = `${task.name} ${emoji}`;
      mermaid += `    ${task.id}["${label}"]\n`;

      for (const depId of task.dependencies) {
        mermaid += `    ${depId} --> ${task.id}\n`;
      }
    }

    return mermaid;
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    const workflow = this.store.load();
    const task = workflow.tasks[taskId];

    if (!task) return false;

    // Remove from dependents of dependencies
    for (const depId of task.dependencies) {
      const depTask = workflow.tasks[depId];
      if (depTask) {
        depTask.dependents = depTask.dependents.filter(id => id !== taskId);
      }
    }

    // Remove from dependencies of dependents
    for (const dependentId of task.dependents) {
      const dependent = workflow.tasks[dependentId];
      if (dependent) {
        dependent.dependencies = dependent.dependencies.filter(id => id !== taskId);
      }
    }

    // Remove from agent's claimed tasks
    if (task.assigned_agent) {
      const agent = workflow.agents[task.assigned_agent];
      if (agent) {
        agent.claimed_tasks = agent.claimed_tasks.filter(id => id !== taskId);
      }
    }

    delete workflow.tasks[taskId];
    this.store.save(workflow);

    return true;
  }
}
