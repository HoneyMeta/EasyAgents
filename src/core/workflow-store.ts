import * as fs from 'node:fs';
import * as path from 'node:path';
import * as YAML from 'yaml';
import { Workflow, createDefaultWorkflow } from '../types/index.js';

const EASYAGENTS_DIR = '.easyagents';
const WORKFLOW_FILE = 'workflow.yaml';
const AGENT_ID_FILE = '.agent_id';
const OUTPUTS_DIR = 'outputs';
const TEMP_DIR = 'temp';

export class WorkflowStore {
  private projectRoot: string;
  private easyagentsDir: string;
  private workflowPath: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.easyagentsDir = path.join(this.projectRoot, EASYAGENTS_DIR);
    this.workflowPath = path.join(this.easyagentsDir, WORKFLOW_FILE);
  }

  /**
   * Check if EasyAgents is initialized in the project
   */
  isInitialized(): boolean {
    return fs.existsSync(this.workflowPath);
  }

  /**
   * Initialize EasyAgents in the project
   */
  initialize(projectName?: string): Workflow {
    const name = projectName || path.basename(this.projectRoot);

    // Create directories
    this.ensureDir(this.easyagentsDir);
    this.ensureDir(path.join(this.easyagentsDir, OUTPUTS_DIR));
    this.ensureDir(path.join(this.easyagentsDir, TEMP_DIR));

    // Create workflow file
    const workflow = createDefaultWorkflow(name);
    this.save(workflow);

    // Create .gitignore for temp files
    const gitignorePath = path.join(this.easyagentsDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'temp/\n.agent_id\n', 'utf-8');

    return workflow;
  }

  /**
   * Load workflow from YAML file
   */
  load(): Workflow {
    if (!this.isInitialized()) {
      throw new Error('EasyAgents not initialized. Run "ea init" first.');
    }

    const content = fs.readFileSync(this.workflowPath, 'utf-8');
    return YAML.parse(content) as Workflow;
  }

  /**
   * Save workflow to YAML file
   */
  save(workflow: Workflow): void {
    workflow.updated_at = new Date().toISOString();
    const content = YAML.stringify(workflow, {
      indent: 2,
      lineWidth: 0  // Disable line wrapping
    });
    fs.writeFileSync(this.workflowPath, content, 'utf-8');
  }

  /**
   * Get current agent ID from local file
   */
  getLocalAgentId(): string | null {
    const agentIdPath = path.join(this.easyagentsDir, AGENT_ID_FILE);
    if (fs.existsSync(agentIdPath)) {
      return fs.readFileSync(agentIdPath, 'utf-8').trim();
    }
    return null;
  }

  /**
   * Save agent ID to local file
   */
  saveLocalAgentId(agentId: string): void {
    const agentIdPath = path.join(this.easyagentsDir, AGENT_ID_FILE);
    fs.writeFileSync(agentIdPath, agentId, 'utf-8');
  }

  /**
   * Clear local agent ID
   */
  clearLocalAgentId(): void {
    const agentIdPath = path.join(this.easyagentsDir, AGENT_ID_FILE);
    if (fs.existsSync(agentIdPath)) {
      fs.unlinkSync(agentIdPath);
    }
  }

  /**
   * Write task output to file
   */
  writeOutput(taskId: string, content: string): string {
    const outputPath = path.join(this.easyagentsDir, OUTPUTS_DIR, `${taskId}.md`);
    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  /**
   * Read task output from file
   */
  readOutput(taskId: string): string | null {
    const outputPath = path.join(this.easyagentsDir, OUTPUTS_DIR, `${taskId}.md`);
    if (fs.existsSync(outputPath)) {
      return fs.readFileSync(outputPath, 'utf-8');
    }
    return null;
  }

  /**
   * Write content to temp file
   */
  writeTemp(content: string, hint?: string): string {
    const hash = this.simpleHash(content);
    const filename = hint ? `${hint}_${hash}.md` : `content_${hash}.md`;
    const tempPath = path.join(this.easyagentsDir, TEMP_DIR, filename);
    fs.writeFileSync(tempPath, content, 'utf-8');
    return tempPath;
  }

  /**
   * Read content from temp file
   */
  readTemp(filename: string): string | null {
    const tempPath = path.join(this.easyagentsDir, TEMP_DIR, filename);
    if (fs.existsSync(tempPath)) {
      return fs.readFileSync(tempPath, 'utf-8');
    }
    return null;
  }

  /**
   * Clean up old temp files (older than 1 hour)
   */
  cleanupTemp(): number {
    const tempDir = path.join(this.easyagentsDir, TEMP_DIR);
    if (!fs.existsSync(tempDir)) return 0;

    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    let cleaned = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Parse argument value, supporting @file: prefix
   */
  parseArgument(value: string): string {
    if (value.startsWith('@file:')) {
      const filePath = value.substring(6);
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.projectRoot, filePath);
      return fs.readFileSync(fullPath, 'utf-8');
    }
    return value;
  }

  /**
   * Get project root path
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get easyagents directory path
   */
  getEasyagentsDir(): string {
    return this.easyagentsDir;
  }

  /**
   * Normalize file path (convert backslashes to forward slashes)
   */
  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }
}

// Singleton instance for convenience
let defaultStore: WorkflowStore | null = null;

export function getStore(projectRoot?: string): WorkflowStore {
  if (!defaultStore || projectRoot) {
    defaultStore = new WorkflowStore(projectRoot);
  }
  return defaultStore;
}
