# CLAUDE.md — D1Studio 开发指南

本文件为 Claude Code 及开发者提供项目开发规范。详细产品需求见 [SPEC.md](./SPEC.md)。

---

## 项目概述

D1Studio 是一个部署在 Cloudflare Workers 上的在线 SQL 查询工具，专为 Cloudflare D1 数据库设计。前后端合并在单个 Worker 中，但代码目录严格分离。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + Vite |
| UI | Tailwind CSS + shadcn/ui |
| SQL 编辑器 | CodeMirror 6 + @codemirror/lang-sql |
| 后端框架 | Hono |
| 认证 | jose (JWT) + otplib (TOTP) + WebAuthn API |
| 邮件 | Resend 或 自定义 SMTP（通过 `EMAIL_PROVIDER` 环境变量切换） |
| 运行环境 | Cloudflare Workers |
| 数据库 | Cloudflare D1 |
| CI/CD | GitHub Actions + Wrangler |
| 依赖更新 | Renovate（`.github/renovate.json`） |

---

## 目录结构

```
d1studio/
├── src/
│   ├── client/          # 前端代码（React）
│   └── server/          # 后端代码（Hono）
├── .github/
│   ├── workflows/
│   │   └── deploy.yml
│   └── renovate.json
├── wrangler.toml        # 含占位符，绝不含真实 ID
├── SPEC.md
└── CLAUDE.md
```

**重要**: `src/client/` 和 `src/server/` 之间不允许跨目录引用，只能通过 API 接口通信。

---

## 配置与密钥管理规范

### 核心原则

- `wrangler.toml` 中**不得包含**任何真实的数据库 ID、KV ID 或敏感信息
- 所有需要填入 `wrangler.toml` 的 ID，使用 `${VARIABLE_NAME}` 占位符
- GitHub Actions 在部署前用 `sed` 将占位符替换为 GitHub Repository Variables 中的值

### 变量存放位置

| 变量类型 | 存放位置 |
|----------|----------|
| D1 数据库 ID、KV ID 等构建时变量 | GitHub Repository Variables |
| Cloudflare API Token、Account ID | GitHub Repository Secrets |
| TABLE_PREFIX、EMAIL_PROVIDER 等运行时变量 | Cloudflare Console → Variables |
| JWT_SECRET、邮件凭证等运行时密钥 | Cloudflare Console → Secrets |

### wrangler.toml 占位符格式

```toml
[[d1_databases]]
binding = "APP_DB"
database_name = "${APP_DB_NAME}"
database_id = "${APP_DB_ID}"

[[d1_databases]]
binding = "DB_SLOT_1"
database_name = "${DB_SLOT_1_NAME}"
database_id = "${DB_SLOT_1_ID}"
```

---

## 数据库规范

### 表前缀

所有应用表必须使用 `TABLE_PREFIX` 环境变量作为前缀，通过代码动态拼接，不得硬编码表名。

```typescript
// 正确
const tableName = `${env.TABLE_PREFIX}_users`;

// 错误
const tableName = 'd1s_users';
```

### 应用数据库（APP_DB）表

```
{PREFIX}_users
{PREFIX}_sessions
{PREFIX}_totp_secrets
{PREFIX}_passkeys
{PREFIX}_db_slots
{PREFIX}_db_permissions
{PREFIX}_query_history
{PREFIX}_settings
```

### D1 业务数据库槽位

- 共 10 个槽位：`DB_SLOT_1` ~ `DB_SLOT_10`
- 槽位是否激活及显示名称存储在 `{PREFIX}_db_slots` 表中
- 后端在执行查询时根据 slot_index 选择对应 binding

---

## GitHub Actions 部署

### 部署前 sed 替换

```yaml
- name: Replace placeholders in wrangler.toml
  run: |
    sed -i "s|\${APP_DB_ID}|${{ vars.APP_DB_ID }}|g" wrangler.toml
    sed -i "s|\${APP_DB_NAME}|${{ vars.APP_DB_NAME }}|g" wrangler.toml
    sed -i "s|\${DB_SLOT_1_ID}|${{ vars.DB_SLOT_1_ID }}|g" wrangler.toml
    sed -i "s|\${DB_SLOT_1_NAME}|${{ vars.DB_SLOT_1_NAME }}|g" wrangler.toml
    # DB_SLOT_2 ~ DB_SLOT_10 同理

- name: Deploy
  run: npx wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### Renovate 配置

文件路径：`.github/renovate.json`（不在根目录）

---

## 邮件服务

通过 `EMAIL_PROVIDER` 环境变量（Cloudflare Console 配置）选择邮件服务：

- `resend`：使用 Resend API，需配置 `RESEND_API_KEY`
- `smtp`：使用自定义 SMTP，需配置 `SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM`

后端邮件模块必须实现统一接口，通过 `EMAIL_PROVIDER` 在运行时路由，不得在业务代码中直接判断服务商。

---

## 编码规范

### 通用

- 语言：TypeScript（前后端均使用，开启严格模式）
- 不得使用 `any` 类型，除非有充分注释说明原因
- 环境变量通过 `env` 参数传入，不得使用全局 `process.env`（Cloudflare Workers 不支持）

### 后端（Hono）

- 路由文件按功能模块划分：`auth.ts / query.ts / admin.ts / history.ts`
- 所有路由必须通过 auth middleware 验证 JWT
- Admin 路由需额外校验 role === 'admin'
- D1 查询结果行数在后端强制限制为 5000 行（`LIMIT 5000`）
- 写操作（非 SELECT）必须在 API 层面有明确标识，供前端弹窗确认使用

### 前端（React）

- 组件按功能目录组织，不得在 `client/` 中引用 `server/` 的任何模块
- 使用 shadcn/ui 组件，保持 UI 一致性
- SQL 编辑器使用 CodeMirror 6，仅开启语法高亮，不需要自动补全

---

## 安全规范

- 密码存储使用 bcrypt（不得使用 MD5/SHA1）
- JWT 有效期合理设置（建议 access token 15min，refresh token 7d）
- SQL 查询通过 D1 binding 执行，不得拼接字符串构造 SQL（防注入）
- Passkey / WebAuthn 实现遵循 FIDO2 标准
- 2FA 验证码有效期不超过 10 分钟，验证后立即失效（防重放）

---

## 不要做的事

- 不在 `wrangler.toml` 中写入任何真实 ID 或密钥
- 不硬编码表名（必须使用 TABLE_PREFIX）
- 不在 `src/client/` 中引用 `src/server/` 的代码
- 不在前端存储 JWT 以外的敏感信息
- 不跳过写操作的权限校验（即使是 Admin 也需要记录历史）
- 不将 Renovate 配置放在根目录（必须放在 `.github/renovate.json`）
