import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { WorkflowStore } from '../../core/workflow-store.js';
import { AgentManager } from '../../core/agent-manager.js';

export function registerAgentCommands(program: Command): void {
  const agent = program.command('agent').description('Agent management commands');

  // Who am I
  agent
    .command('whoami')
    .description('Show current agent identity')
    .action(() => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const agentManager = new AgentManager(store);
      const currentAgent = agentManager.getCurrentAgent();

      if (!currentAgent) {
        console.log(chalk.yellow('No agent registered for this session.'));
        console.log(chalk.gray('Claim a task to register: ea task claim <taskId>'));
        return;
      }

      console.log(chalk.cyan('Current Agent:'));
      console.log(chalk.white(`  ID: ${currentAgent.id}`));
      console.log(chalk.white(`  Name: ${currentAgent.name}`));
      console.log(chalk.white(`  Status: ${formatStatus(currentAgent.status)}`));
      console.log(chalk.white(`  Tasks: ${currentAgent.claimed_tasks.length > 0 ? currentAgent.claimed_tasks.join(', ') : 'none'}`));
      console.log(chalk.white(`  Last Active: ${agentManager.formatTimeAgo(currentAgent.last_active)}`));
    });

  // List agents
  agent
    .command('list')
    .description('List all agents')
    .option('-a, --all', 'Include terminated agents')
    .action((options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const agentManager = new AgentManager(store);
      const agents = agentManager.listAgents(options.all);

      if (agents.length === 0) {
        console.log(chalk.gray('No agents registered.'));
        return;
      }

      const table = new Table({
        head: ['ID', 'Name', 'Status', 'Tasks', 'Last Active'],
        style: { head: ['cyan'] }
      });

      for (const a of agents) {
        table.push([
          a.id,
          a.name,
          formatStatus(a.status),
          a.claimed_tasks.length > 0 ? a.claimed_tasks.join(', ') : '-',
          agentManager.formatTimeAgo(a.last_active)
        ]);
      }

      console.log(table.toString());

      // Show stats
      const stats = agentManager.getAgentStats();
      console.log();
      console.log(chalk.gray(`Active: ${stats.active} | Inactive: ${stats.inactive} | Terminated: ${stats.terminated}`));
    });

  // Rename agent
  agent
    .command('rename <name>')
    .description('Rename current agent')
    .action((name) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const agentManager = new AgentManager(store);

      if (agentManager.renameAgent(name)) {
        console.log(chalk.green(`✓ Agent renamed to "${name}"`));
      } else {
        console.log(chalk.red('✗ No agent registered. Claim a task first.'));
        process.exit(1);
      }
    });

  // Takeover agent
  agent
    .command('takeover <agentId>')
    .description('Take over another agent\'s tasks')
    .action((agentId) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const agentManager = new AgentManager(store);
      const result = agentManager.takeoverAgent(agentId);

      if (result.success) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.inherited_tasks && result.inherited_tasks.length > 0) {
          console.log(chalk.cyan('Inherited tasks:'));
          for (const taskId of result.inherited_tasks) {
            console.log(chalk.white(`  - ${taskId}`));
          }
        }
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
        process.exit(1);
      }
    });

  // Register new agent
  agent
    .command('register')
    .description('Register as a new agent')
    .option('-n, --name <name>', 'Agent name')
    .action((options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const agentManager = new AgentManager(store);
      const newAgent = agentManager.getOrCreateCurrentAgent(options.name);

      console.log(chalk.green('✓ Agent registered'));
      console.log(chalk.white(`  ID: ${newAgent.id}`));
      console.log(chalk.white(`  Name: ${newAgent.name}`));
    });

  // Deactivate agent
  agent
    .command('deactivate')
    .description('Deactivate current agent')
    .action(() => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const agentManager = new AgentManager(store);

      if (agentManager.deactivateAgent()) {
        console.log(chalk.green('✓ Agent deactivated'));
      } else {
        console.log(chalk.yellow('No agent to deactivate.'));
      }
    });

  // Cleanup old agents
  agent
    .command('cleanup')
    .description('Clean up old terminated agents')
    .option('-d, --days <n>', 'Older than N days', '7')
    .action((options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const agentManager = new AgentManager(store);
      const cleaned = agentManager.cleanupTerminatedAgents(parseInt(options.days, 10));

      console.log(chalk.green(`✓ Cleaned up ${cleaned} terminated agent(s).`));
    });
}

function ensureInitialized(store: WorkflowStore): void {
  if (!store.isInitialized()) {
    console.log(chalk.red('EasyAgents not initialized. Run "ea init" first.'));
    process.exit(1);
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'active':
      return chalk.green('🟢 active');
    case 'inactive':
      return chalk.yellow('🟡 inactive');
    case 'terminated':
      return chalk.red('🔴 terminated');
    default:
      return status;
  }
}
