import {
  Agent,
  AgentStatus,
  AgentTakeoverResult,
  Workflow
} from '../types/index.js';
import { WorkflowStore } from './workflow-store.js';

export class AgentManager {
  private store: WorkflowStore;

  constructor(store: WorkflowStore) {
    this.store = store;
  }

  /**
   * Generate a unique agent ID
   */
  generateAgentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `ea_${timestamp}_${random}`;
  }

  /**
   * Get or create current agent
   */
  getOrCreateCurrentAgent(name?: string): Agent {
    // Check if we have a local agent ID
    let agentId = this.store.getLocalAgentId();
    const workflow = this.store.load();

    if (agentId && workflow.agents[agentId]) {
      const agent = workflow.agents[agentId];
      // Update last active
      agent.last_active = new Date().toISOString();
      agent.status = 'active';
      this.store.save(workflow);
      return agent;
    }

    // Create new agent
    agentId = this.generateAgentId();
    const now = new Date().toISOString();

    const agent: Agent = {
      id: agentId,
      name: name || `Agent ${Object.keys(workflow.agents).length + 1}`,
      claimed_tasks: [],
      session_id: this.generateSessionId(),
      status: 'active',
      last_active: now,
      created_at: now
    };

    workflow.agents[agentId] = agent;
    this.store.save(workflow);
    this.store.saveLocalAgentId(agentId);

    return agent;
  }

  /**
   * Get current agent (returns null if not registered)
   */
  getCurrentAgent(): Agent | null {
    const agentId = this.store.getLocalAgentId();
    if (!agentId) return null;

    const workflow = this.store.load();
    return workflow.agents[agentId] || null;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | null {
    const workflow = this.store.load();
    return workflow.agents[agentId] || null;
  }

  /**
   * List all agents
   */
  listAgents(includeTerminated: boolean = false): Agent[] {
    const workflow = this.store.load();
    let agents = Object.values(workflow.agents);

    // Update status based on last_active
    const now = Date.now();
    const inactiveTimeout = workflow.config.inactive_timeout;

    for (const agent of agents) {
      if (agent.status === 'active') {
        const lastActive = new Date(agent.last_active).getTime();
        if (now - lastActive > inactiveTimeout) {
          agent.status = 'inactive';
        }
      }
    }
    this.store.save(workflow);

    if (!includeTerminated) {
      agents = agents.filter(a => a.status !== 'terminated');
    }

    return agents.sort((a, b) =>
      new Date(b.last_active).getTime() - new Date(a.last_active).getTime()
    );
  }

  /**
   * Rename current agent
   */
  renameAgent(newName: string): boolean {
    const agentId = this.store.getLocalAgentId();
    if (!agentId) return false;

    const workflow = this.store.load();
    const agent = workflow.agents[agentId];
    if (!agent) return false;

    agent.name = newName;
    agent.last_active = new Date().toISOString();
    this.store.save(workflow);

    return true;
  }

  /**
   * Takeover another agent's tasks
   */
  takeoverAgent(targetAgentId: string): AgentTakeoverResult {
    const workflow = this.store.load();
    const targetAgent = workflow.agents[targetAgentId];

    if (!targetAgent) {
      return { success: false, message: `Agent ${targetAgentId} not found` };
    }

    if (targetAgent.status === 'terminated') {
      return { success: false, message: 'Agent is already terminated' };
    }

    // Get or create current agent
    const currentAgent = this.getOrCreateCurrentAgent();

    if (currentAgent.id === targetAgentId) {
      return { success: false, message: 'Cannot takeover yourself' };
    }

    // Transfer tasks
    const inheritedTasks = [...targetAgent.claimed_tasks];

    for (const taskId of inheritedTasks) {
      const task = workflow.tasks[taskId];
      if (task) {
        task.assigned_agent = currentAgent.id;
      }
      if (!currentAgent.claimed_tasks.includes(taskId)) {
        currentAgent.claimed_tasks.push(taskId);
      }
    }

    // Mark target agent as terminated
    targetAgent.status = 'terminated';
    targetAgent.claimed_tasks = [];

    // Transfer any locks
    for (const [path, lock] of Object.entries(workflow.locks)) {
      if (lock.locked_by === targetAgentId) {
        lock.locked_by = currentAgent.id;
      }
    }

    currentAgent.last_active = new Date().toISOString();
    this.store.save(workflow);

    return {
      success: true,
      message: `Took over ${inheritedTasks.length} tasks from ${targetAgent.name}`,
      inherited_tasks: inheritedTasks
    };
  }

  /**
   * Update agent activity timestamp
   */
  touchAgent(): void {
    const agentId = this.store.getLocalAgentId();
    if (!agentId) return;

    const workflow = this.store.load();
    const agent = workflow.agents[agentId];
    if (agent) {
      agent.last_active = new Date().toISOString();
      agent.status = 'active';
      this.store.save(workflow);
    }
  }

  /**
   * Deactivate current agent
   */
  deactivateAgent(): boolean {
    const agentId = this.store.getLocalAgentId();
    if (!agentId) return false;

    const workflow = this.store.load();
    const agent = workflow.agents[agentId];
    if (!agent) return false;

    agent.status = 'inactive';
    this.store.save(workflow);
    this.store.clearLocalAgentId();

    return true;
  }

  /**
   * Get agent statistics
   */
  getAgentStats(): {
    total: number;
    active: number;
    inactive: number;
    terminated: number;
  } {
    const agents = this.listAgents(true);

    return {
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
      inactive: agents.filter(a => a.status === 'inactive').length,
      terminated: agents.filter(a => a.status === 'terminated').length
    };
  }

  /**
   * Format time ago string
   */
  formatTimeAgo(dateString: string): string {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diffMs = now - then;

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  /**
   * Clean up terminated agents older than specified days
   */
  cleanupTerminatedAgents(olderThanDays: number = 7): number {
    const workflow = this.store.load();
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [agentId, agent] of Object.entries(workflow.agents)) {
      if (
        agent.status === 'terminated' &&
        new Date(agent.last_active).getTime() < cutoff
      ) {
        delete workflow.agents[agentId];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.store.save(workflow);
    }

    return cleaned;
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 10);
  }
}
