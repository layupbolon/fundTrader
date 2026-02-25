# Monorepo 使用指南

本项目已改造为 Monorepo 架构，使用 pnpm workspaces 管理多个包。

## 项目结构

```
fundTrader/
├── packages/
│   ├── backend/          # 后端服务（NestJS）
│   ├── shared/           # 前后端共享代码（类型定义、枚举）
│   └── frontend/         # 前端应用（待开发）
├── pnpm-workspace.yaml   # workspace 配置
└── package.json          # 根配置（workspace 脚本）
```

## 包说明

### @fundtrader/backend
后端服务，包含所有业务逻辑、API、数据库模型、策略引擎等。

**依赖**: `@fundtrader/shared`

### @fundtrader/shared
前后端共享的类型定义和枚举，确保类型一致性。

**导出内容**:
- 枚举类型（FundType, TransactionType, StrategyType 等）
- 接口定义（IFund, IPosition, ITransaction 等）

### @fundtrader/frontend（待开发）
前端应用，用于可视化管理基金交易策略。

## 常用命令

### 安装依赖

```bash
# 在根目录安装所有包的依赖
pnpm install
```

### 开发

```bash
# 启动后端开发服务器（热重载）
pnpm dev

# 或者直接在 backend 目录运行
cd packages/backend
pnpm start:dev
```

### 构建

```bash
# 构建所有包
pnpm build

# 构建单个包
pnpm build:backend
pnpm build:shared
```

### 测试

```bash
# 运行所有测试
pnpm test

# 运行后端测试
pnpm test:backend

# 运行测试并生成覆盖率报告
pnpm test:cov
```

### 数据库

```bash
# 启动 PostgreSQL 和 Redis
pnpm dcup

# 停止数据库服务
pnpm dcdown
```

### 代码质量

```bash
# 运行 ESLint
pnpm lint

# 格式化代码
pnpm format
```

## 添加新包

1. 在 `packages/` 目录创建新包目录
2. 创建 `package.json`，包名使用 `@fundtrader/` 前缀
3. pnpm 会自动识别新包

## 包之间的依赖

在 `package.json` 中使用 `workspace:*` 引用其他包：

```json
{
  "dependencies": {
    "@fundtrader/shared": "workspace:*"
  }
}
```

## 环境配置

每个包可以有自己的环境变量文件：

- `packages/backend/.env` - 后端环境变量
- `packages/frontend/.env` - 前端环境变量（待开发）

## 开发工作流

1. **修改 shared 包**
   ```bash
   cd packages/shared
   # 修改代码
   pnpm build
   ```

2. **修改 backend 包**
   ```bash
   cd packages/backend
   # 修改代码
   pnpm test
   ```

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: your feature"
   git push
   ```

## 优势

1. **代码共享**: shared 包确保前后端类型定义一致
2. **独立开发**: 每个包可以独立开发、测试、部署
3. **依赖管理**: pnpm workspaces 自动处理包之间的依赖
4. **构建优化**: 只构建修改过的包
5. **扩展性**: 方便添加新的包（如 mobile、admin 等）

## 下一步

- [ ] 开发前端应用（React/Vue）
- [ ] 添加 E2E 测试包
- [ ] 添加文档站点包
- [ ] 配置 CI/CD 流水线
