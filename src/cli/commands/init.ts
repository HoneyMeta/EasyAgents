import { Command } from 'commander';
import chalk from 'chalk';
import { WorkflowStore } from '../../core/workflow-store.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize EasyAgents in current project')
    .option('-n, --name <name>', 'Project name')
    .option('-f, --force', 'Overwrite existing configuration')
    .action((options) => {
      const store = new WorkflowStore();

      if (store.isInitialized() && !options.force) {
        console.log(chalk.yellow('EasyAgents is already initialized in this project.'));
        console.log(chalk.gray('Use --force to reinitialize.'));
        return;
      }

      const workflow = store.initialize(options.name);

      console.log(chalk.green('✓ EasyAgents initialized successfully!'));
      console.log();
      console.log(chalk.gray('Created:'));
      console.log(chalk.gray('  .easyagents/workflow.yaml'));
      console.log(chalk.gray('  .easyagents/outputs/'));
      console.log(chalk.gray('  .easyagents/temp/'));
      console.log();
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.white('  1. Generate tasks: ea task add "Task name" --description "..."'));
      console.log(chalk.white('  2. Claim a task:   ea task claim <task_id>'));
      console.log(chalk.white('  3. View progress:  ea status progress'));
      console.log();
      console.log(chalk.gray(`Project: ${workflow.project}`));
    });
}
