import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { WorkflowStore } from '../../core/workflow-store.js';
import { TaskManager } from '../../core/task-manager.js';
import { AgentManager } from '../../core/agent-manager.js';
import { TaskFile, TaskStatus } from '../../types/index.js';

export function registerTaskCommands(program: Command): void {
  const task = program.command('task').description('Task management commands');

  // Add task
  task
    .command('add <name>')
    .description('Add a new task')
    .option('-d, --description <text>', 'Task description')
    .option('--desc-file <path>', 'Read description from file')
    .option('-p, --priority <n>', 'Priority 1-5 (1=highest)', '3')
    .option('--depends <tasks>', 'Comma-separated dependency task IDs')
    .option('--files <specs>', 'File specs: path:type:methods (comma-separated)')
    .option('--async', 'Mark as async (can run in parallel)')
    .action((name, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      let description = options.description || name;
      if (options.descFile) {
        description = store.parseArgument(`@file:${options.descFile}`);
      } else if (options.description?.startsWith('@file:')) {
        description = store.parseArgument(options.description);
      }

      const files = parseFileSpecs(options.files);
      const dependencies = options.depends ? options.depends.split(',').map((s: string) => s.trim()) : [];

      const taskManager = new TaskManager(store);
      const task = taskManager.addTask({
        name,
        description,
        priority: parseInt(options.priority, 10),
        dependencies,
        files,
        async_execution: options.async || false
      });

      console.log(chalk.green(`✓ Task created: ${task.id}`));
      console.log(chalk.gray(`  Name: ${task.name}`));
      console.log(chalk.gray(`  Priority: ${task.priority}`));
      if (dependencies.length > 0) {
        console.log(chalk.gray(`  Dependencies: ${dependencies.join(', ')}`));
      }
    });

  // List tasks
  task
    .command('list')
    .description('List all tasks')
    .option('-s, --status <status>', 'Filter by status')
    .option('--available', 'Show only claimable tasks')
    .option('--mine', 'Show only my claimed tasks')
    .option('-f, --format <format>', 'Output format: table|json|yaml', 'table')
    .action((options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const taskManager = new TaskManager(store);
      const agentManager = new AgentManager(store);

      let filters: any = {};
      if (options.status) {
        filters.status = options.status as TaskStatus;
      }
      if (options.available) {
        filters.available = true;
      }
      if (options.mine) {
        const agent = agentManager.getCurrentAgent();
        if (agent) {
          filters.assigned_agent = agent.id;
        }
      }

      const tasks = taskManager.listTasks(filters);

      if (options.format === 'json') {
        console.log(JSON.stringify(tasks, null, 2));
        return;
      }

      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found.'));
        return;
      }

      const statusEmoji: Record<TaskStatus, string> = {
        completed: '✅',
        in_progress: '🔄',
        pending: '⏳',
        blocked: '🚫',
        failed: '❌'
      };

      const table = new Table({
        head: ['ID', 'Name', 'Status', 'Priority', 'Agent', 'Dependencies'],
        style: { head: ['cyan'] }
      });

      for (const t of tasks) {
        table.push([
          t.id,
          t.name.substring(0, 30),
          `${statusEmoji[t.status]} ${t.status}`,
          t.priority.toString(),
          t.assigned_agent || '-',
          t.dependencies.join(', ') || '-'
        ]);
      }

      console.log(table.toString());
    });

  // Get task details
  task
    .command('get <taskId>')
    .description('Get task details')
    .option('--with-context', 'Include context from dependency tasks')
    .option('--output <path>', 'Write to file instead of stdout')
    .action((taskId, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const taskManager = new TaskManager(store);

      if (options.withContext) {
        const result = taskManager.getTaskWithContext(taskId);
        if (!result) {
          console.log(chalk.red(`Task ${taskId} not found.`));
          process.exit(1);
        }

        const output = formatTaskWithContext(result.task, result.context);
        if (options.output) {
          require('fs').writeFileSync(options.output, output);
          console.log(chalk.green(`✓ Written to ${options.output}`));
        } else {
          console.log(output);
        }
      } else {
        const task = taskManager.getTask(taskId);
        if (!task) {
          console.log(chalk.red(`Task ${taskId} not found.`));
          process.exit(1);
        }
        console.log(JSON.stringify(task, null, 2));
      }
    });

  // Claim task
  task
    .command('claim <taskId>')
    .description('Claim a task for current agent')
    .option('-n, --name <name>', 'Agent name (for new agents)')
    .action((taskId, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const taskManager = new TaskManager(store);
      const agentManager = new AgentManager(store);

      // Get or create agent
      const agent = agentManager.getOrCreateCurrentAgent(options.name);

      const result = taskManager.claimTask(taskId, agent.id);

      if (result.success) {
        console.log(chalk.green(`✓ ${result.message}`));
        console.log(chalk.gray(`  Agent: ${agent.name} (${agent.id})`));
        if (result.task) {
          console.log();
          console.log(chalk.cyan('Task Details:'));
          console.log(chalk.white(`  Name: ${result.task.name}`));
          console.log(chalk.white(`  Description: ${result.task.description.substring(0, 100)}...`));
          if (result.task.dependencies.length > 0) {
            console.log(chalk.white(`  Dependencies: ${result.task.dependencies.join(', ')}`));
          }
        }
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
        process.exit(1);
      }
    });

  // Complete task
  task
    .command('complete <taskId>')
    .description('Mark task as completed')
    .option('-s, --summary <text>', 'Completion summary')
    .option('--summary-file <path>', 'Read summary from file')
    .option('--output <text>', 'Detailed output content')
    .option('--output-file <path>', 'Read output from file')
    .action((taskId, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const taskManager = new TaskManager(store);

      let summary = options.summary || 'Task completed';
      if (options.summaryFile) {
        summary = store.parseArgument(`@file:${options.summaryFile}`);
      }

      let output: string | undefined;
      if (options.outputFile) {
        output = store.parseArgument(`@file:${options.outputFile}`);
      } else if (options.output) {
        output = options.output;
      }

      const result = taskManager.completeTask(taskId, { summary, output });

      if (result.success) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.unblocked_tasks && result.unblocked_tasks.length > 0) {
          console.log(chalk.cyan(`  Unblocked tasks: ${result.unblocked_tasks.join(', ')}`));
        }
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
        process.exit(1);
      }
    });

  // Delete task
  task
    .command('delete <taskId>')
    .description('Delete a task')
    .option('-f, --force', 'Force delete even if in progress')
    .action((taskId, options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const taskManager = new TaskManager(store);
      const task = taskManager.getTask(taskId);

      if (!task) {
        console.log(chalk.red(`Task ${taskId} not found.`));
        process.exit(1);
      }

      if (task.status === 'in_progress' && !options.force) {
        console.log(chalk.yellow('Task is in progress. Use --force to delete.'));
        process.exit(1);
      }

      if (taskManager.deleteTask(taskId)) {
        console.log(chalk.green(`✓ Task ${taskId} deleted.`));
      } else {
        console.log(chalk.red(`✗ Failed to delete task.`));
        process.exit(1);
      }
    });
}

function ensureInitialized(store: WorkflowStore): void {
  if (!store.isInitialized()) {
    console.log(chalk.red('EasyAgents not initialized. Run "ea init" first.'));
    process.exit(1);
  }
}

function parseFileSpecs(specs?: string): TaskFile[] {
  if (!specs) return [];

  return specs.split(',').map(spec => {
    const parts = spec.trim().split(':');
    const file: TaskFile = {
      path: parts[0],
      type: (parts[1] as TaskFile['type']) || 'modify'
    };
    if (parts[2]) {
      file.methods = parts[2].split(';');
    }
    return file;
  });
}

function formatTaskWithContext(task: any, context: Record<string, string>): string {
  let output = `# Task: ${task.name}\n\n`;
  output += `**ID:** ${task.id}\n`;
  output += `**Status:** ${task.status}\n`;
  output += `**Priority:** ${task.priority}\n\n`;
  output += `## Description\n\n${task.description}\n\n`;

  if (Object.keys(context).length > 0) {
    output += `## Context from Dependencies\n\n`;
    for (const [depId, content] of Object.entries(context)) {
      output += `### ${depId}\n\n${content}\n\n`;
    }
  }

  if (task.files && task.files.length > 0) {
    output += `## Files\n\n`;
    for (const file of task.files) {
      output += `- ${file.path} (${file.type})`;
      if (file.methods) {
        output += ` - methods: ${file.methods.join(', ')}`;
      }
      output += '\n';
    }
  }

  return output;
}
