#!/usr/bin/env node

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerTaskCommands } from './commands/task.js';
import { registerLockCommands } from './commands/lock.js';
import { registerAgentCommands } from './commands/agent.js';
import { registerStatusCommands } from './commands/status.js';
import { registerIOCommands } from './commands/io.js';

const program = new Command();

program
  .name('ea')
  .description('EasyAgents - Lightweight Multi-Agent Workflow System for AI IDEs')
  .version('1.0.0');

// Register all command groups
registerInitCommand(program);
registerTaskCommands(program);
registerLockCommands(program);
registerAgentCommands(program);
registerStatusCommands(program);
registerIOCommands(program);

program.parse();
