import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as fs from 'node:fs';
import { WorkflowStore } from '../../core/workflow-store.js';
import { TaskManager } from '../../core/task-manager.js';
import { AgentManager } from '../../core/agent-manager.js';
import { LockManager } from '../../core/lock-manager.js';

export function registerStatusCommands(program: Command): void {
  const status = program.command('status').description('Workflow status commands');

  // Progress overview
  status
    .command('progress')
    .description('Show overall workflow progress')
    .option('-f, --format <format>', 'Output format: text|json', 'text')
    .action((options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const taskManager = new TaskManager(store);
      const agentManager = new AgentManager(store);
      const lockManager = new LockManager(store);

      const progress = taskManager.getProgress();
      const agents = agentManager.listAgents();
      const locks = Object.keys(lockManager.getAllLocks()).length;

      if (options.format === 'json') {
        console.log(JSON.stringify({ progress, agents: agents.length, locks }, null, 2));
        return;
      }

      // Task table
      const tasks = taskManager.listTasks();
      if (tasks.length > 0) {
        const statusEmoji: Record<string, string> = {
          completed: '✅',
          in_progress: '🔄',
          pending: '⏳',
          blocked: '🚫',
          failed: '❌'
        };

        const table = new Table({
          head: ['ID', 'Name', 'Status', 'Agent', 'Dependencies'],
          style: { head: ['cyan'] }
        });

        for (const t of tasks) {
          table.push([
            t.id,
            t.name.substring(0, 25),
            `${statusEmoji[t.status]} ${t.status}`,
            t.assigned_agent?.substring(0, 12) || '-',
            t.dependencies.join(', ').substring(0, 20) || '-'
          ]);
        }

        console.log(table.toString());
        console.log();
      }

      // Progress bar
      const barWidth = 30;
      const filled = Math.round((progress.percentage / 100) * barWidth);
      const empty = barWidth - filled;
      const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

      console.log(`Progress: ${bar} ${progress.percentage}% (${progress.completed}/${progress.total} completed)`);
      console.log();
      console.log(chalk.gray(`Active Agents: ${agents.filter(a => a.status === 'active').length} | Active Locks: ${locks} | Blocked Tasks: ${progress.blocked}`));
    });

  // Dependency graph
  status
    .command('graph')
    .description('Show task dependency graph')
    .option('--mermaid', 'Output as Mermaid diagram')
    .action((options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const taskManager = new TaskManager(store);
      const mermaid = taskManager.generateMermaidGraph();

      if (options.mermaid) {
        console.log(mermaid);
      } else {
        console.log(chalk.cyan('Task Dependency Graph (Mermaid format):'));
        console.log();
        console.log('```mermaid');
        console.log(mermaid);
        console.log('```');
        console.log();
        console.log(chalk.gray('Copy the above to a Mermaid-compatible viewer.'));
      }
    });

  // Agent status
  status
    .command('agents')
    .description('Show active agents and their tasks')
    .action(() => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const agentManager = new AgentManager(store);
      const agents = agentManager.listAgents();

      if (agents.length === 0) {
        console.log(chalk.gray('No agents registered.'));
        return;
      }

      console.log(chalk.cyan('Active Agents:'));
      console.log();

      const table = new Table({
        head: ['Agent', 'Status', 'Current Tasks', 'Last Active'],
        style: { head: ['cyan'] }
      });

      for (const a of agents) {
        const statusIcon = a.status === 'active' ? '🟢' : a.status === 'inactive' ? '🟡' : '🔴';
        table.push([
          `${a.name} (${a.id.substring(0, 10)}...)`,
          `${statusIcon} ${a.status}`,
          a.claimed_tasks.length > 0 ? a.claimed_tasks.join(', ') : '-',
          agentManager.formatTimeAgo(a.last_active)
        ]);
      }

      console.log(table.toString());
    });

  // Generate markdown report
  status
    .command('report')
    .description('Generate markdown progress report')
    .option('-o, --output <path>', 'Output file path', '.easyagents/PROGRESS.md')
    .action((options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const taskManager = new TaskManager(store);
      const agentManager = new AgentManager(store);
      const lockManager = new LockManager(store);

      const progress = taskManager.getProgress();
      const tasks = taskManager.listTasks();
      const agents = agentManager.listAgents();
      const modifications = lockManager.getModificationHistory('', 10);
      const mermaid = taskManager.generateMermaidGraph();

      const report = generateMarkdownReport({
        progress,
        tasks,
        agents,
        modifications,
        mermaid,
        agentManager
      });

      fs.writeFileSync(options.output, report, 'utf-8');
      console.log(chalk.green(`✓ Report generated: ${options.output}`));
    });

  // Refactor suggestions
  status
    .command('refactor')
    .description('Show refactor suggestions')
    .action(() => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const lockManager = new LockManager(store);
      const suggestions = lockManager.getRefactorSuggestions();

      if (suggestions.length === 0) {
        console.log(chalk.green('No refactor suggestions.'));
        return;
      }

      console.log(chalk.cyan('Refactor Suggestions:'));
      console.log();

      const table = new Table({
        head: ['ID', 'File', 'Method', 'Priority', 'Reason'],
        style: { head: ['cyan'] }
      });

      for (const s of suggestions) {
        const priorityColor = s.priority === 'high' ? chalk.red : s.priority === 'medium' ? chalk.yellow : chalk.gray;
        table.push([
          s.id,
          s.file.substring(0, 30),
          s.method || '-',
          priorityColor(s.priority),
          s.reason.substring(0, 40)
        ]);
      }

      console.log(table.toString());
    });
}

function ensureInitialized(store: WorkflowStore): void {
  if (!store.isInitialized()) {
    console.log(chalk.red('EasyAgents not initialized. Run "ea init" first.'));
    process.exit(1);
  }
}

function generateMarkdownReport(data: {
  progress: any;
  tasks: any[];
  agents: any[];
  modifications: any[];
  mermaid: string;
  agentManager: AgentManager;
}): string {
  const { progress, tasks, agents, modifications, mermaid, agentManager } = data;
  const now = new Date().toLocaleString();

  let report = `# Project Progress Report

**Updated:** ${now}
**Overall Progress:** ${progress.percentage}% (${progress.completed}/${progress.total} tasks completed)

## Task Status Summary

| Status | Count |
|--------|-------|
| ✅ Completed | ${progress.completed} |
| 🔄 In Progress | ${progress.in_progress} |
| ⏳ Pending | ${progress.pending} |
| 🚫 Blocked | ${progress.blocked} |
| ❌ Failed | ${progress.failed} |

## Dependency Graph

\`\`\`mermaid
${mermaid}\`\`\`

## Tasks

| ID | Name | Status | Agent | Dependencies |
|----|------|--------|-------|--------------|
`;

  const statusEmoji: Record<string, string> = {
    completed: '✅',
    in_progress: '🔄',
    pending: '⏳',
    blocked: '🚫',
    failed: '❌'
  };

  for (const t of tasks) {
    report += `| ${t.id} | ${t.name} | ${statusEmoji[t.status]} ${t.status} | ${t.assigned_agent || '-'} | ${t.dependencies.join(', ') || '-'} |\n`;
  }

  report += `
## Active Agents

| Agent | Status | Current Tasks | Last Active |
|-------|--------|---------------|-------------|
`;

  for (const a of agents) {
    const statusIcon = a.status === 'active' ? '🟢' : a.status === 'inactive' ? '🟡' : '🔴';
    report += `| ${a.name} (${a.id.substring(0, 8)}...) | ${statusIcon} ${a.status} | ${a.claimed_tasks.join(', ') || '-'} | ${agentManager.formatTimeAgo(a.last_active)} |\n`;
  }

  if (modifications.length > 0) {
    report += `
## Recent Modifications

| File | Method | Agent | Time | Reason |
|------|--------|-------|------|--------|
`;

    for (const m of modifications) {
      const time = new Date(m.modified_at).toLocaleString();
      report += `| ${m.file} | ${m.method || '-'} | ${m.modified_by.substring(0, 10)}... | ${time} | ${m.reason} |\n`;
    }
  }

  report += `
---
*Generated by EasyAgents*
`;

  return report;
}
