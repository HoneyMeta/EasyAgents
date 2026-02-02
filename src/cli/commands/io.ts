import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { WorkflowStore } from '../../core/workflow-store.js';

export function registerIOCommands(program: Command): void {
  const io = program.command('io').description('Large content I/O utilities');

  // Write stdin to temp file
  io
    .command('write')
    .description('Write stdin to temp file, return path')
    .option('-n, --name <name>', 'File name hint')
    .action(async (options) => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      // Read from stdin
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });

      let content = '';
      for await (const line of rl) {
        content += line + '\n';
      }

      if (!content.trim()) {
        console.log(chalk.red('No content provided via stdin.'));
        process.exit(1);
      }

      const tempPath = store.writeTemp(content.trim(), options.name);
      console.log(tempPath);
    });

  // Read file content
  io
    .command('read <path>')
    .description('Read file content to stdout')
    .option('-l, --lines <range>', 'Read specific lines (e.g., "1-100")')
    .action((filePath, options) => {
      const store = new WorkflowStore();

      let fullPath = filePath;
      if (!fs.existsSync(fullPath)) {
        // Try relative to project root
        fullPath = `${store.getProjectRoot()}/${filePath}`;
      }

      if (!fs.existsSync(fullPath)) {
        console.error(chalk.red(`File not found: ${filePath}`));
        process.exit(1);
      }

      let content = fs.readFileSync(fullPath, 'utf-8');

      if (options.lines) {
        const [start, end] = options.lines.split('-').map(Number);
        const lines = content.split('\n');
        content = lines.slice(start - 1, end).join('\n');
      }

      console.log(content);
    });

  // Cleanup temp files
  io
    .command('cleanup')
    .description('Clean up old temp files')
    .action(() => {
      const store = new WorkflowStore();
      ensureInitialized(store);

      const cleaned = store.cleanupTemp();
      console.log(chalk.green(`✓ Cleaned up ${cleaned} temp file(s).`));
    });

  // Parse @file: argument
  io
    .command('parse <value>')
    .description('Parse argument value (supports @file: prefix)')
    .action((value) => {
      const store = new WorkflowStore();

      try {
        const content = store.parseArgument(value);
        console.log(content);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
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
