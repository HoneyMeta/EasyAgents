import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { WorkflowStore } from '../../core/workflow-store.js';
import { LockManager } from '../../core/lock-manager.js';
import { AgentManager } from '../../core/agent-manager.js';
import { FileLock } from '../../types/index.js';

export function registerLockCommands(program: Command): void {
  const lock = program.command('lock').description('File lock management');

  // Acquire lock
  lock
    .command('acquire <file>')
    .description('Acquire lock on a file')
    .option('-m, --methods <names>', 'Lock specific methods only (comma-separated)')
    .option('-r, --reason <text>', 'Reason for locking', 'Editing file')
    .option('-t, --timeout <ms>', 'Lock timeout in ms', '180000')
    .option('--task <taskId>', 'Associated task ID')
    .action(async (file, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const lockManager = new LockManager(store);
      const agentManager = new AgentManager(store);

      const agent = agentManager.getOrCreateCurrentAgent();
      const methods = options.methods ? options.methods.split(',').map((s: string) => s.trim()) : undefined;

      const result = lockManager.acquireLock(file, agent.id, {
        methods,
        reason: options.reason,
        timeout: parseInt(options.timeout, 10),
        task_id: options.task
      });

      if (result.success) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.lock) {
          console.log(chalk.gray(`  File: ${file}`));
          console.log(chalk.gray(`  Methods: ${result.lock.methods.join(', ')}`));
          console.log(chalk.gray(`  Expires: ${result.lock.expires_at}`));
        }
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
        if (result.waitInfo) {
          console.log();
          console.log(chalk.yellow('Lock Info:'));
          console.log(chalk.white(`  Locked by: ${result.waitInfo.locked_by}`));
          console.log(chalk.white(`  Reason: ${result.waitInfo.reason}`));
          console.log(chalk.white(`  Methods: ${result.waitInfo.methods.join(', ')}`));
          console.log(chalk.white(`  Expires in: ${Math.ceil(result.waitInfo.expires_in_ms / 1000)}s`));
          console.log();
          console.log(chalk.gray('Use "ea lock wait <file>" to wait for release.'));
        }
        process.exit(1);
      }
    });

  // Release lock
  lock
    .command('release <file>')
    .description('Release lock on a file')
    .option('-c, --changes <text>', 'Description of changes made')
    .option('-l, --lines <range>', 'Lines changed (e.g., "15-22")')
    .option('-m, --method <name>', 'Method that was modified')
    .option('--task <taskId>', 'Associated task ID')
    .action((file, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const lockManager = new LockManager(store);
      const agentManager = new AgentManager(store);

      const agent = agentManager.getCurrentAgent();
      if (!agent) {
        console.log(chalk.red('No agent registered. Cannot release lock.'));
        process.exit(1);
      }

      let modification;
      if (options.changes && options.lines && options.task) {
        modification = {
          method: options.method,
          lines_changed: options.lines,
          reason: options.changes,
          task_id: options.task
        };
      }

      const result = lockManager.releaseLock(file, agent.id, modification);

      if (result.success) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (modification) {
          console.log(chalk.gray(`  Recorded modification: ${options.changes}`));
        }
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
        process.exit(1);
      }
    });

  // Check lock status
  lock
    .command('status [file]')
    .description('Check lock status')
    .action((file) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const lockManager = new LockManager(store);

      if (file) {
        const status = lockManager.getLockStatus(file);
        if (status.locked && status.lock) {
          console.log(chalk.yellow(`🔒 File is locked`));
          console.log(chalk.white(`  Locked by: ${status.lock.locked_by}`));
          console.log(chalk.white(`  Reason: ${status.lock.reason}`));
          console.log(chalk.white(`  Methods: ${status.lock.methods.join(', ')}`));
          console.log(chalk.white(`  Expires: ${status.lock.expires_at}`));
        } else {
          console.log(chalk.green(`🔓 File is not locked`));
          if (status.expired) {
            console.log(chalk.gray('  (Previous lock expired)'));
          }
        }
      } else {
        // Show all locks
        const locks = lockManager.getAllLocks();
        const lockEntries = Object.entries(locks);

        if (lockEntries.length === 0) {
          console.log(chalk.green('No active locks.'));
          return;
        }

        const table = new Table({
          head: ['File', 'Locked By', 'Methods', 'Reason', 'Expires'],
          style: { head: ['cyan'] }
        });

        for (const [path, lock] of lockEntries) {
          const expiresIn = Math.ceil((new Date(lock.expires_at).getTime() - Date.now()) / 1000);
          table.push([
            path.substring(0, 40),
            lock.locked_by.substring(0, 15),
            lock.methods.join(', ').substring(0, 20),
            lock.reason.substring(0, 25),
            `${expiresIn}s`
          ]);
        }

        console.log(table.toString());
      }
    });

  // Wait for lock
  lock
    .command('wait <file>')
    .description('Wait for lock to be released')
    .option('-t, --timeout <ms>', 'Wait timeout in ms', '180000')
    .action(async (file, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const lockManager = new LockManager(store);

      // First check if already unlocked
      const status = lockManager.getLockStatus(file);
      if (!status.locked) {
        console.log(chalk.green('✓ File is not locked.'));
        return;
      }

      console.log(chalk.yellow(`Waiting for lock on ${file}...`));
      console.log(chalk.gray(`  Locked by: ${status.lock?.locked_by}`));
      console.log(chalk.gray(`  Timeout: ${parseInt(options.timeout, 10) / 1000}s`));

      const result = await lockManager.waitForLock(file, parseInt(options.timeout, 10));

      if (result.released) {
        console.log(chalk.green('✓ Lock released!'));
        if (result.modifications && result.modifications.length > 0) {
          console.log();
          console.log(chalk.cyan('Recent modifications:'));
          for (const mod of result.modifications) {
            console.log(chalk.white(`  - ${mod.reason} (lines ${mod.lines_changed}) by ${mod.modified_by}`));
          }
        }
      } else {
        console.log(chalk.red('✗ Timeout waiting for lock.'));
        process.exit(1);
      }
    });

  // View modification history
  lock
    .command('history <file>')
    .description('View modification history for a file')
    .option('-n, --limit <n>', 'Limit number of entries', '10')
    .action((file, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const lockManager = new LockManager(store);
      const history = lockManager.getModificationHistory(file, parseInt(options.limit, 10));

      if (history.length === 0) {
        console.log(chalk.gray('No modification history for this file.'));
        return;
      }

      console.log(chalk.cyan(`Modification history for ${file}:`));
      console.log();

      const table = new Table({
        head: ['Time', 'Agent', 'Method', 'Lines', 'Reason'],
        style: { head: ['cyan'] }
      });

      for (const mod of history) {
        const time = new Date(mod.modified_at).toLocaleString();
        table.push([
          time,
          mod.modified_by.substring(0, 15),
          mod.method || '-',
          mod.lines_changed,
          mod.reason.substring(0, 30)
        ]);
      }

      console.log(table.toString());
    });

  // Force release (admin)
  lock
    .command('force-release <file>')
    .description('Force release a lock (admin operation)')
    .action((file) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const lockManager = new LockManager(store);

      if (lockManager.forceReleaseLock(file)) {
        console.log(chalk.green(`✓ Lock on ${file} force released.`));
      } else {
        console.log(chalk.yellow(`No lock found on ${file}.`));
      }
    });

  // Cleanup expired locks
  lock
    .command('cleanup')
    .description('Clean up expired locks')
    .action(() => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const lockManager = new LockManager(store);
      const cleaned = lockManager.cleanupExpiredLocks();

      console.log(chalk.green(`✓ Cleaned up ${cleaned} expired lock(s).`));
    });
}

function ensureInitialized(store: WorkflowStore): void {
  if (!store.isInitialized()) {
    console.log(chalk.red('EasyAgents not initialized. Run "ea init" first.'));
    process.exit(1);
  }
}
