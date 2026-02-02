# EasyAgents

**Multi-agent collaboration in YOUR favorite IDE.**

No new apps to learn. No context switching. Just install, and your existing AI IDE gains multi-agent superpowers.

[中文文档](#中文文档)

## Why EasyAgents?

Traditional multi-agent systems require you to leave your IDE and use a separate application. EasyAgents takes a different approach:

| Traditional Multi-Agent | EasyAgents |
|------------------------|------------|
| Install new application | `npm install -g easyagents` |
| Learn new interface | Use your existing IDE |
| Single tool only | Mix any AI IDEs together |
| Proprietary workflow | Open, file-based coordination |

**Works with any AI IDE that supports custom commands/skills:**
- Claude Code
- Cursor
- Windsurf
- Cline
- Aider
- ...and more

**Mix and match!** Use Claude Code for backend, Cursor for frontend, and Windsurf for tests - all coordinating through EasyAgents.

## Features

- **IDE Agnostic** - Works with any AI IDE, mix different IDEs in one workflow
- **Task Management** - Create, assign, and track tasks with dependencies
- **File Locking** - Prevent conflicts when multiple agents edit the same file
- **Agent Coordination** - Manage multiple AI agents working in parallel
- **Progress Visualization** - View progress with tables, charts, and Mermaid diagrams
- **Context Passing** - Share outputs between dependent tasks

## Installation

```bash
npm install -g easyagents
```

## Quick Start

### 1. Initialize your project

```bash
ea init
```

### 2. Plan tasks with AI (in Claude Code)

Tell the AI what you want to build:
```
/ea-plan Build a user authentication system with login, registration, and password reset
```

The AI will:
- Analyze your requirements
- Break them down into tasks with dependencies
- Tell you how many parallel agents are recommended

### 3. Work with multiple agents

Open multiple AI IDE windows - **any combination works**:
- 3 Claude Code windows
- 2 Cursor + 1 Windsurf
- Claude Code + Cursor + Cline + Aider

In each window, claim a task:
```
/ea-claim
```

The AI will claim an available task and start working. Just describe what you need in natural language - the AI handles file locking, task coordination, and context passing automatically.

### 4. Monitor progress

```
/ea-status
```

## How It Works

**You speak naturally, AI handles the complexity.**

| You say | AI does |
|---------|---------|
| `/ea-plan Build a REST API` | Analyzes requirements, creates tasks with dependencies |
| `/ea-claim` | Claims available task, shows what to do |
| `/ea-status` | Shows progress, active agents, blocked tasks |
| `/ea-complete Done with login` | Records completion, unblocks dependent tasks |

The AI automatically:
- Acquires file locks before editing
- Waits if another agent is editing the same file
- Records modification history for coordination
- Passes context between dependent tasks

## Claude Code Skills

| Skill | What you say | What happens |
|-------|--------------|--------------|
| `/ea-plan` | "Build a shopping cart feature" | AI creates task breakdown |
| `/ea-claim` | (no args needed) | AI claims next available task |
| `/ea-edit` | "I need to modify auth.ts" | AI acquires lock, edits safely |
| `/ea-complete` | "Finished implementing login" | AI records completion, unblocks dependents |
| `/ea-status` | (no args needed) | AI shows progress overview |

## Multi-Agent Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  You: /ea-plan "Build user management system"                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  AI: Created 5 tasks. Recommend 3 parallel agents.              │
│      Task 1: Design database (no dependencies)                  │
│      Task 2: User model (depends on 1)                          │
│      Task 3: Auth API (depends on 2)                            │
│      Task 4: User API (depends on 2)  ← can parallel with 3     │
│      Task 5: Integration tests (depends on 3, 4)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ Window 1│          │ Window 2│          │ Window 3│
   │/ea-claim│          │/ea-claim│          │/ea-claim│
   │ Task 1  │          │ (waits) │          │ (waits) │
   └─────────┘          └─────────┘          └─────────┘
        ↓
   ┌─────────┐
   │Complete │ → Unblocks Task 2
   └─────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ Task 2  │          │ (waits) │          │ (waits) │
   └─────────┘          └─────────┘          └─────────┘
        ↓
   ┌─────────┐
   │Complete │ → Unblocks Task 3 & 4
   └─────────┘
                              ↓
        ┌─────────────────────┴─────────────────────┐
        ↓                                           ↓
   ┌─────────┐                                ┌─────────┐
   │ Task 3  │  ← parallel execution →        │ Task 4  │
   └─────────┘                                └─────────┘
```

## File Locking (Automatic)

When multiple agents need to edit the same file, EasyAgents handles it automatically:

```
Agent 1: Editing src/api/index.ts...
Agent 2: /ea-edit src/api/index.ts
         → AI: "File locked by Agent 1, waiting..."
         → AI: "Lock released. Agent 1 added user routes (lines 15-22)."
         → AI: "Proceeding with your edit..."
```

## CLI Reference

The AI uses these commands internally. You can also use them directly if needed:

```bash
# Task management
ea task add <name>              # Add a new task
ea task list [--available]      # List tasks
ea task claim <id>              # Claim a task
ea task complete <id>           # Complete a task

# File locking
ea lock acquire <file>          # Acquire lock
ea lock release <file>          # Release lock
ea lock status <file>           # Check lock status

# Status
ea status progress              # Show progress
ea status agents                # Show agents
ea status report                # Generate report
```

## Configuration

The workflow configuration is stored in `.easyagents/workflow.yaml`:

```yaml
config:
  lock_timeout: 180000        # Lock timeout in ms (default: 3 min)
  max_parallel_agents: 5      # Maximum parallel agents
  auto_refactor_threshold: 3  # Suggest refactor after N modifications
```

## License

MIT

---

# 中文文档

**在你熟悉的 IDE 中实现多 Agent 协作。**

无需学习新工具，无需切换环境。安装后，你现有的 AI IDE 即刻获得多 Agent 超能力。

## 为什么选择 EasyAgents？

传统多 Agent 系统需要你离开 IDE，使用单独的应用程序。EasyAgents 采用不同的方式：

| 传统多 Agent 系统 | EasyAgents |
|------------------|------------|
| 安装新应用程序 | `npm install -g easyagents` |
| 学习新界面 | 使用你现有的 IDE |
| 只能用单一工具 | 任意混搭 AI IDE |
| 封闭的工作流 | 开放的、基于文件的协调 |

**支持任何带自定义命令/技能的 AI IDE：**
- Claude Code
- Cursor
- Windsurf
- Cline
- Aider
- ...更多

**随意混搭！** 用 Claude Code 写后端，Cursor 写前端，Windsurf 写测试 - 全部通过 EasyAgents 协调。

## 功能特性

- **IDE 无关** - 支持任何 AI IDE，可在同一工作流中混用不同 IDE
- **任务管理** - 创建、分配和跟踪带依赖关系的任务
- **文件锁定** - 防止多个 Agent 同时编辑同一文件时产生冲突
- **Agent 协调** - 管理多个并行工作的 AI Agent
- **进度可视化** - 通过表格、图表和 Mermaid 图展示进度
- **上下文传递** - 在依赖任务之间共享输出

## 安装

```bash
npm install -g easyagents
```

## 快速开始

### 1. 初始化项目

```bash
ea init
```

### 2. 用 AI 规划任务（在任意 AI IDE 中）

告诉 AI 你想构建什么：
```
/ea-plan 构建一个用户认证系统，包含登录、注册和密码重置功能
```

AI 会：
- 分析你的需求
- 分解成带依赖关系的任务
- 告诉你建议开启多少个并行 Agent

### 3. 多 Agent 协作

打开多个 AI IDE 窗口 - **任意组合都可以**：
- 3 个 Claude Code 窗口
- 2 个 Cursor + 1 个 Windsurf
- Claude Code + Cursor + Cline + Aider

在每个窗口中认领任务：
```
/ea-claim
```

AI 会认领可用任务并开始工作。你只需用自然语言描述需求 - AI 会自动处理文件锁定、任务协调和上下文传递。

### 4. 监控进度

```
/ea-status
```

## 工作原理

**你用自然语言交流，AI 处理复杂性。**

| 你说 | AI 做 |
|------|-------|
| `/ea-plan 构建一个 REST API` | 分析需求，创建带依赖的任务 |
| `/ea-claim` | 认领可用任务，展示要做什么 |
| `/ea-status` | 显示进度、活跃 Agent、阻塞的任务 |
| `/ea-complete 登录功能完成了` | 记录完成，解锁依赖此任务的后续任务 |

AI 自动：
- 编辑前获取文件锁
- 如果其他 Agent 正在编辑同一文件则等待
- 记录修改历史以便协调
- 在依赖任务之间传递上下文

## Claude Code Skills

| Skill | 你说什么 | 发生什么 |
|-------|----------|----------|
| `/ea-plan` | "构建购物车功能" | AI 创建任务分解 |
| `/ea-claim` | （无需参数） | AI 认领下一个可用任务 |
| `/ea-edit` | "我需要修改 auth.ts" | AI 获取锁，安全编辑 |
| `/ea-complete` | "登录功能实现完成" | AI 记录完成，解锁后续任务 |
| `/ea-status` | （无需参数） | AI 显示进度概览 |

## 多 Agent 工作流

```
┌─────────────────────────────────────────────────────────────────┐
│  你: /ea-plan "构建用户管理系统"                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  AI: 创建了 5 个任务，建议 3 个并行 Agent。                      │
│      任务 1: 设计数据库（无依赖）                                │
│      任务 2: 用户模型（依赖 1）                                  │
│      任务 3: 认证 API（依赖 2）                                  │
│      任务 4: 用户 API（依赖 2）← 可与 3 并行                     │
│      任务 5: 集成测试（依赖 3, 4）                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ 窗口 1  │          │ 窗口 2  │          │ 窗口 3  │
   │/ea-claim│          │/ea-claim│          │/ea-claim│
   │ 任务 1  │          │ (等待)  │          │ (等待)  │
   └─────────┘          └─────────┘          └─────────┘
        ↓
   ┌─────────┐
   │ 完成    │ → 解锁任务 2
   └─────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ 任务 2  │          │ (等待)  │          │ (等待)  │
   └─────────┘          └─────────┘          └─────────┘
        ↓
   ┌─────────┐
   │ 完成    │ → 解锁任务 3 和 4
   └─────────┘
                              ↓
        ┌─────────────────────┴─────────────────────┐
        ↓                                           ↓
   ┌─────────┐                                ┌─────────┐
   │ 任务 3  │  ← 并行执行 →                  │ 任务 4  │
   └─────────┘                                └─────────┘
```

## 文件锁定（自动）

当多个 Agent 需要编辑同一文件时，EasyAgents 自动处理：

```
Agent 1: 正在编辑 src/api/index.ts...
Agent 2: /ea-edit src/api/index.ts
         → AI: "文件被 Agent 1 锁定，等待中..."
         → AI: "锁已释放。Agent 1 添加了用户路由（第 15-22 行）。"
         → AI: "继续你的编辑..."
```

## CLI 参考

AI 内部使用这些命令。如有需要你也可以直接使用：

```bash
# 任务管理
ea task add <名称>              # 添加任务
ea task list [--available]      # 列出任务
ea task claim <id>              # 认领任务
ea task complete <id>           # 完成任务

# 文件锁定
ea lock acquire <文件>          # 获取锁
ea lock release <文件>          # 释放锁
ea lock status <文件>           # 检查锁状态

# 状态
ea status progress              # 显示进度
ea status agents                # 显示 Agent
ea status report                # 生成报告
```

## 配置

工作流配置存储在 `.easyagents/workflow.yaml`：

```yaml
config:
  lock_timeout: 180000        # 锁定超时时间（毫秒，默认3分钟）
  max_parallel_agents: 5      # 最大并行 Agent 数
  auto_refactor_threshold: 3  # 修改N次后建议重构
```

## 许可证

MIT
