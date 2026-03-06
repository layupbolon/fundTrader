# 🔒 Security Fixes Applied（历史记录 + 当前状态）

> 历史文档说明：
> 本文档最初记录的是早期安全修复阶段。当前项目已进入后续阶段，部分“待实现项”已落地。
> 实时项目状态请以 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 为准。
>
> 最后更新：2026-03-06

## ✅ Critical Issues Fixed（历史修复项）

### 1. Encryption Security

- ✅ 移除硬编码加密 Key 回退
- ✅ 移除硬编码 Salt，要求 `ENCRYPTION_SALT`
- ✅ 更新 `.env.example` 加密相关变量

**Files Modified:**

- `packages/backend/src/utils/crypto.util.ts`
- `packages/backend/src/services/broker/tiantian.service.ts`
- `.env.example`

### 2. HTTPS for External APIs

- ✅ 将基金数据外部调用从 HTTP 调整为 HTTPS

**Files Modified:**

- `packages/backend/src/services/data/fund-data.service.ts`

### 3. Database Auto-Sync

- ✅ 生产环境禁用 `synchronize`
- ✅ 开发环境启用 SQL logging

**Files Modified:**

- `packages/backend/src/app.module.ts`

### 4. Puppeteer Security

- ✅ 调整浏览器启动参数，移除不安全默认项

**Files Modified:**

- `packages/backend/src/services/broker/tiantian.service.ts`

### 5. Input Validation

- ✅ DTO + class-validator 参数校验
- ✅ 全局 ValidationPipe

**Files Created/Modified:**

- `packages/backend/src/api/dto.ts`
- `packages/backend/src/api/controllers.ts`
- `packages/backend/src/main.ts`

### 6. Security Headers

- ✅ Helmet 安全头

**Files Modified:**

- `packages/backend/src/main.ts`

### 7. Rate Limiting

- ✅ Throttler 速率限制

**Files Modified:**

- `packages/backend/src/app.module.ts`

### 8. CORS Configuration

- ✅ 白名单来源控制（`ALLOWED_ORIGINS`）

**Files Modified:**

- `packages/backend/src/main.ts`
- `.env.example`

## ✅ 已补齐（相对历史文档）

### Authentication & Authorization（已实现）

历史版本标注为“未实现”的鉴权能力已落地：

- ✅ JWT 登录/注册流程
- ✅ 全局 `JwtAuthGuard`
- ✅ `@Public()` 白名单端点机制
- ✅ API Bearer 鉴权接入（Swagger）

**Implemented In:**

- `packages/backend/src/auth/auth.module.ts`
- `packages/backend/src/auth/auth.controller.ts`
- `packages/backend/src/auth/auth.service.ts`
- `packages/backend/src/auth/jwt.strategy.ts`
- `packages/backend/src/auth/jwt-auth.guard.ts`
- `packages/backend/src/auth/public.decorator.ts`
- `packages/backend/src/app.module.ts`

## 📋 Security Checklist（当前视角）

- [x] Remove hardcoded secrets
- [x] Fix encryption implementation
- [x] HTTPS for external APIs
- [x] Disable DB auto-sync in production
- [x] Secure Puppeteer configuration
- [x] Input validation
- [x] Security headers (Helmet)
- [x] Rate limiting
- [x] CORS configuration
- [x] Authentication & Authorization (JWT)
- [x] Audit logging（operation logs）
- [ ] CSRF protection（如切换到 cookie/session 模式再启用）
- [ ] Error message sanitization（可继续细化）
- [ ] Dependency vulnerability scanning（CI 持续执行）

## 🚀 Current Recommended Steps

1. **Build & run (pnpm)**

```bash
pnpm build
pnpm dev
```

2. **Update environment variables**

```bash
cp .env.example .env
# Set strong MASTER_KEY (min 32 chars)
# Set random ENCRYPTION_SALT (min 16 chars)
# Configure ALLOWED_ORIGINS
# Configure JWT_SECRET
```

3. **Run security audit**

```bash
pnpm audit
pnpm audit --fix
```

## 📝 Configuration Required

Add to your `.env` file:

```env
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# CRITICAL: Change these in production
MASTER_KEY=your_secure_master_key_min_32_characters_long
ENCRYPTION_SALT=your_random_salt_min_16_chars
JWT_SECRET=your_jwt_secret_here_change_in_production_min_32_chars
```

## ✅ Build Status Check

```bash
pnpm build
```
