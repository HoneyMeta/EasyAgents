import {
  FileLock,
  FileModification,
  RefactorSuggestion,
  LockAcquireResult,
  LockReleaseResult,
  LockWaitResult,
  Workflow
} from '../types/index.js';
import { WorkflowStore } from './workflow-store.js';

export class LockManager {
  private store: WorkflowStore;

  constructor(store: WorkflowStore) {
    this.store = store;
  }

  /**
   * Normalize file path for consistent key usage
   */
  private normalizePath(filePath: string): string {
    return this.store.normalizePath(filePath);
  }

  /**
   * Check if a lock is expired
   */
  private isLockExpired(lock: FileLock): boolean {
    return new Date(lock.expires_at) <= new Date();
  }

  /**
   * Check if methods conflict
   */
  private methodsConflict(requestedMethods: string[], lockedMethods: string[]): boolean {
    // If either locks all methods, there's a conflict
    if (lockedMethods.includes('*') || requestedMethods.includes('*')) {
      return true;
    }

    // Check for specific method overlap
    return requestedMethods.some(m => lockedMethods.includes(m));
  }

  /**
   * Acquire a lock on a file
   */
  acquireLock(
    filePath: string,
    agentId: string,
    options: {
      methods?: string[];
      reason: string;
      timeout?: number;
      task_id?: string;
    }
  ): LockAcquireResult {
    const workflow = this.store.load();
    const normalizedPath = this.normalizePath(filePath);
    const existingLock = workflow.locks[normalizedPath];
    const requestedMethods = options.methods || ['*'];
    const timeout = options.timeout || workflow.config.lock_timeout;

    // Check if already locked
    if (existingLock) {
      // Check if lock is expired
      if (this.isLockExpired(existingLock)) {
        // Clean up expired lock
        delete workflow.locks[normalizedPath];
      } else {
        // Check if it's the same agent
        if (existingLock.locked_by === agentId) {
          // Extend the lock
          existingLock.expires_at = new Date(Date.now() + timeout).toISOString();
          existingLock.methods = [...new Set([...existingLock.methods, ...requestedMethods])];
          this.store.save(workflow);
          return {
            success: true,
            message: 'Lock extended',
            lock: existingLock
          };
        }

        // Check for method-level conflict
        if (!this.methodsConflict(requestedMethods, existingLock.methods)) {
          // No conflict, can acquire lock for different methods
          return this.createLock(workflow, normalizedPath, agentId, requestedMethods, options.reason, timeout, options.task_id);
        }

        // Lock conflict
        const remainingTime = new Date(existingLock.expires_at).getTime() - Date.now();
        return {
          success: false,
          message: `File locked by ${existingLock.locked_by}`,
          waitInfo: {
            locked_by: existingLock.locked_by,
            reason: existingLock.reason,
            expires_in_ms: remainingTime,
            methods: existingLock.methods
          }
        };
      }
    }

    // Create new lock
    return this.createLock(workflow, normalizedPath, agentId, requestedMethods, options.reason, timeout, options.task_id);
  }

  /**
   * Create a new lock
   */
  private createLock(
    workflow: Workflow,
    filePath: string,
    agentId: string,
    methods: string[],
    reason: string,
    timeout: number,
    taskId?: string
  ): LockAcquireResult {
    const now = new Date();
    const lock: FileLock = {
      locked_by: agentId,
      locked_at: now.toISOString(),
      expires_at: new Date(now.getTime() + timeout).toISOString(),
      methods,
      reason,
      task_id: taskId
    };

    workflow.locks[filePath] = lock;
    this.store.save(workflow);

    return {
      success: true,
      message: 'Lock acquired successfully',
      lock
    };
  }

  /**
   * Release a lock on a file
   */
  releaseLock(
    filePath: string,
    agentId: string,
    modification?: {
      method?: string;
      lines_changed: string;
      reason: string;
      task_id: string;
    }
  ): LockReleaseResult {
    const workflow = this.store.load();
    const normalizedPath = this.normalizePath(filePath);
    const lock = workflow.locks[normalizedPath];

    if (!lock) {
      return { success: false, message: 'No lock found for this file' };
    }

    if (lock.locked_by !== agentId) {
      return { success: false, message: `Lock owned by ${lock.locked_by}, not ${agentId}` };
    }

    // Record modification if provided
    if (modification) {
      const mod: FileModification = {
        file: normalizedPath,
        method: modification.method,
        modified_by: agentId,
        modified_at: new Date().toISOString(),
        lines_changed: modification.lines_changed,
        reason: modification.reason,
        task_id: modification.task_id
      };
      workflow.modifications.push(mod);

      // Check if refactor suggestion should be added
      this.checkRefactorSuggestion(workflow, normalizedPath, modification.method);
    }

    // Remove lock
    delete workflow.locks[normalizedPath];
    this.store.save(workflow);

    return { success: true, message: 'Lock released successfully' };
  }

  /**
   * Check lock status for a file
   */
  getLockStatus(filePath: string): {
    locked: boolean;
    lock?: FileLock;
    expired?: boolean;
  } {
    const workflow = this.store.load();
    const normalizedPath = this.normalizePath(filePath);
    const lock = workflow.locks[normalizedPath];

    if (!lock) {
      return { locked: false };
    }

    const expired = this.isLockExpired(lock);
    if (expired) {
      // Clean up expired lock
      delete workflow.locks[normalizedPath];
      this.store.save(workflow);
      return { locked: false, expired: true };
    }

    return { locked: true, lock };
  }

  /**
   * Wait for a lock to be released
   */
  async waitForLock(
    filePath: string,
    timeout: number = 180000,
    checkInterval: number = 5000
  ): Promise<LockWaitResult> {
    const startTime = Date.now();
    const normalizedPath = this.normalizePath(filePath);

    while (Date.now() - startTime < timeout) {
      const status = this.getLockStatus(filePath);

      if (!status.locked) {
        // Lock released, get recent modifications
        const workflow = this.store.load();
        const recentMods = workflow.modifications.filter(
          m => m.file === normalizedPath &&
            new Date(m.modified_at).getTime() > startTime - 60000
        );
        return { released: true, modifications: recentMods };
      }

      // Wait before checking again
      await this.sleep(checkInterval);
    }

    return { released: false, timeout: true };
  }

  /**
   * Get modification history for a file (or all files if empty string)
   */
  getModificationHistory(filePath: string, limit?: number): FileModification[] {
    const workflow = this.store.load();

    let mods: FileModification[];
    if (filePath === '') {
      // Return all modifications
      mods = [...workflow.modifications];
    } else {
      const normalizedPath = this.normalizePath(filePath);
      mods = workflow.modifications.filter(m => m.file === normalizedPath);
    }

    mods.sort((a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime());

    if (limit) {
      mods = mods.slice(0, limit);
    }

    return mods;
  }

  /**
   * Get all active locks
   */
  getAllLocks(): Record<string, FileLock> {
    const workflow = this.store.load();
    const activeLocks: Record<string, FileLock> = {};

    for (const [path, lock] of Object.entries(workflow.locks)) {
      if (!this.isLockExpired(lock)) {
        activeLocks[path] = lock;
      }
    }

    return activeLocks;
  }

  /**
   * Force release a lock (admin operation)
   */
  forceReleaseLock(filePath: string): boolean {
    const workflow = this.store.load();
    const normalizedPath = this.normalizePath(filePath);

    if (workflow.locks[normalizedPath]) {
      delete workflow.locks[normalizedPath];
      this.store.save(workflow);
      return true;
    }

    return false;
  }

  /**
   * Clean up all expired locks
   */
  cleanupExpiredLocks(): number {
    const workflow = this.store.load();
    let cleaned = 0;

    for (const [path, lock] of Object.entries(workflow.locks)) {
      if (this.isLockExpired(lock)) {
        delete workflow.locks[path];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.store.save(workflow);
    }

    return cleaned;
  }

  /**
   * Check if a refactor suggestion should be added
   */
  private checkRefactorSuggestion(
    workflow: Workflow,
    filePath: string,
    method?: string
  ): void {
    const threshold = workflow.config.auto_refactor_threshold;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Count recent modifications to this file/method
    const recentMods = workflow.modifications.filter(
      m => m.file === filePath &&
        (!method || m.method === method) &&
        new Date(m.modified_at).getTime() > oneDayAgo
    );

    if (recentMods.length >= threshold) {
      // Check if suggestion already exists
      const existingSuggestion = workflow.refactor_suggestions.find(
        s => s.file === filePath && (!method || s.method === method)
      );

      if (!existingSuggestion) {
        const suggestion: RefactorSuggestion = {
          id: `refactor_${Date.now().toString(36)}`,
          file: filePath,
          method,
          reason: method
            ? `Method "${method}" has been modified ${recentMods.length} times in the last 24 hours`
            : `File has been modified ${recentMods.length} times in the last 24 hours`,
          suggested_by: 'system',
          created_at: new Date().toISOString(),
          priority: recentMods.length >= threshold * 2 ? 'high' : 'medium'
        };
        workflow.refactor_suggestions.push(suggestion);
      }
    }
  }

  /**
   * Get refactor suggestions
   */
  getRefactorSuggestions(filePath?: string): RefactorSuggestion[] {
    const workflow = this.store.load();

    if (filePath) {
      const normalizedPath = this.normalizePath(filePath);
      return workflow.refactor_suggestions.filter(s => s.file === normalizedPath);
    }

    return workflow.refactor_suggestions;
  }

  /**
   * Dismiss a refactor suggestion
   */
  dismissRefactorSuggestion(suggestionId: string): boolean {
    const workflow = this.store.load();
    const index = workflow.refactor_suggestions.findIndex(s => s.id === suggestionId);

    if (index >= 0) {
      workflow.refactor_suggestions.splice(index, 1);
      this.store.save(workflow);
      return true;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
