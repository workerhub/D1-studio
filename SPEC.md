# D1Studio — Product Specification

## 1. 产品概述

**产品名称**: D1Studio  
**定位**: 专为 Cloudflare D1 数据库设计的在线 SQL 查询与学习平台  
**解决的问题**: Cloudflare Dashboard 的 D1 控制台仅提供单行命令输入，无法编写复杂 SQL，切换数据库操作繁琐，不适合作为专业查询工具。  
**部署方式**: Cloudflare Workers（公网，含域名）

---

## 2. 用户角色

| 角色 | 权限 |
|------|------|
| **Admin** | 用户管理、数据库槽位配置、权限分配、查看所有用户历史、系统配置 |
| **User** | 查询被分配的数据库（增删改查）、查看自身历史记录 |

- Admin 在管理后台添加新用户；普通 User 无法添加用户
- 用户规模：数十人

---

## 3. 功能模块

### 3.1 认证

- 用户名 + 密码登录
- 可选 2FA（在个人设置中配置）：
  - 邮箱验证码（Email OTP）
  - TOTP（如 Google Authenticator）
  - Passkey（WebAuthn）
- 登录会话通过 JWT 管理

### 3.2 SQL 编辑器

- 多行输入，支持编写大段 SQL
- 语法高亮（CodeMirror 6 + SQL 语言包）
- 支持 SELECT / INSERT / UPDATE / DELETE
- 写操作（非 SELECT）执行前弹出确认对话框（用户可在个人设置中关闭此功能）
- 查询结果表格展示，默认最多返回 5000 行

### 3.3 表结构浏览器（Schema Browser）

- 位于编辑器侧边栏
- 以展开/折叠按钮按需显示每张表的结构（字段名、类型）

### 3.4 查询历史

- 每个用户保存自己的查询历史
- Admin 可查看所有用户的历史记录
- 历史保存期限可在系统配置中自定义（选项：3 / 7 / 15 / 30 天，或自定义天数）
- 历史记录包含：SQL 内容、执行时间、执行用户、目标数据库、执行结果状态

### 3.5 数据库管理（Admin）

- 支持 1 ~ 10 个 D1 业务数据库
- 使用预绑定槽位方式（`DB_SLOT_1` ~ `DB_SLOT_10`），Admin 在后台激活槽位并配置显示名称
- Admin 可动态启用/禁用/重命名数据库槽位，无需修改代码或重新部署

### 3.6 用户权限管理（Admin）

- 按用户分配可访问的数据库组合（如 Alice 只能访问 DB1，Bob 能访问 DB1 和 DB2）
- Admin 后台可随时修改权限

### 3.7 管理后台

- 用户管理：新增、删除、禁用/启用、重置密码
- 数据库管理：激活/禁用槽位、配置显示名称
- 权限分配：用户 ↔ 数据库
- 全局查询历史查看（可筛选用户、数据库、时间范围）
- 系统配置：历史保存期限等

---

## 4. 技术架构

### 4.1 整体架构

```
Cloudflare Workers (单 Worker)
├── 前端: React 19 + Vite + Tailwind CSS + shadcn/ui
└── 后端: Hono (TypeScript)
         └── D1 Bindings (APP_DB + DB_SLOT_1~10)
```

前后端合并在同一个 Cloudflare Worker 中部署，代码目录明确分离。

### 4.2 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | React 19 + Vite |
| UI 组件 | Tailwind CSS + shadcn/ui |
| SQL 编辑器 | CodeMirror 6 + @codemirror/lang-sql |
| 后端框架 | Hono |
| 认证 | jose (JWT) + otplib (TOTP) + WebAuthn API |
| 邮件服务 | Resend 或 自定义 SMTP（二选一，通过环境变量切换） |
| 运行环境 | Cloudflare Workers |
| 数据存储 | Cloudflare D1 |
| CI/CD | GitHub Actions + Wrangler |
| 依赖更新 | Renovate（配置文件位于 `.github/renovate.json`） |

### 4.3 D1 数据库绑定策略

在 `wrangler.toml` 中预定义 10 个槽位（含占位符），由 GitHub Actions 在部署前用 `sed` 替换为真实 ID：

```toml
[[d1_databases]]
binding = "APP_DB"
database_name = "${APP_DB_NAME}"
database_id = "${APP_DB_ID}"

[[d1_databases]]
binding = "DB_SLOT_1"
database_name = "${DB_SLOT_1_NAME}"
database_id = "${DB_SLOT_1_ID}"

# DB_SLOT_2 ~ DB_SLOT_10 同理
```

Admin 在界面上激活某个槽位并配置其显示名称，未激活的槽位对用户不可见。

---

## 5. 目录结构

```
d1studio/
├── src/
│   ├── client/                     # 前端代码
│   │   ├── components/
│   │   │   ├── editor/             # SQL 编辑器
│   │   │   ├── results/            # 结果表格
│   │   │   ├── schema/             # 表结构浏览器
│   │   │   ├── history/            # 查询历史
│   │   │   └── admin/              # 管理后台组件
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── main.tsx
│   └── server/                     # 后端代码
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── query.ts
│       │   ├── admin.ts
│       │   └── history.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   └── rateLimit.ts
│       ├── db/                     # D1 数据访问层
│       └── index.ts                # Hono 入口
├── .github/
│   ├── workflows/
│   │   └── deploy.yml              # GitHub Actions 部署
│   └── renovate.json               # Renovate 依赖自动更新配置
├── wrangler.toml                   # 含占位符，不含真实 ID
├── package.json
├── SPEC.md
└── CLAUDE.md
```

---

## 6. 配置与部署

### 6.1 变量分布原则

**原则**: `wrangler.toml` 中不包含任何真实 ID 或敏感信息。

| 类型 | 存储位置 | 说明 |
|------|----------|------|
| 构建时变量 | GitHub Repository Variables | D1 数据库 ID、KV ID 等，用于 sed 替换 wrangler.toml |
| 构建时密钥 | GitHub Repository Secrets | Cloudflare API Token、Account ID |
| 运行时变量 | Cloudflare Console → Variables | TABLE_PREFIX、邮件服务选择等 |
| 运行时密钥 | Cloudflare Console → Secrets | JWT_SECRET、邮件服务凭证等 |

### 6.2 GitHub Actions 部署流程

```yaml
- name: Replace placeholders in wrangler.toml
  run: |
    sed -i "s|\${APP_DB_ID}|${{ vars.APP_DB_ID }}|g" wrangler.toml
    sed -i "s|\${APP_DB_NAME}|${{ vars.APP_DB_NAME }}|g" wrangler.toml
    sed -i "s|\${DB_SLOT_1_ID}|${{ vars.DB_SLOT_1_ID }}|g" wrangler.toml
    sed -i "s|\${DB_SLOT_1_NAME}|${{ vars.DB_SLOT_1_NAME }}|g" wrangler.toml
    # ... DB_SLOT_2 ~ DB_SLOT_10

- name: Deploy to Cloudflare Workers
  run: npx wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 6.3 Cloudflare Console 运行时配置

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `TABLE_PREFIX` | Variable | 应用数据库表前缀（如 `d1s`） |
| `JWT_SECRET` | Secret | JWT 签名密钥 |
| `EMAIL_PROVIDER` | Variable | 邮件服务选择：`resend` 或 `smtp` |
| `RESEND_API_KEY` | Secret | Resend API 密钥（EMAIL_PROVIDER=resend 时使用） |
| `SMTP_HOST` | Secret | SMTP 服务器地址（EMAIL_PROVIDER=smtp 时使用） |
| `SMTP_PORT` | Variable | SMTP 端口（EMAIL_PROVIDER=smtp 时使用） |
| `SMTP_USER` | Secret | SMTP 账号 |
| `SMTP_PASS` | Secret | SMTP 密码 |
| `SMTP_FROM` | Variable | 发件人地址 |

### 6.4 邮件服务配置说明

通过 `EMAIL_PROVIDER` 环境变量切换邮件服务：
- `resend`：使用 Resend API，仅需配置 `RESEND_API_KEY`
- `smtp`：使用自定义 SMTP，需配置 `SMTP_*` 系列变量

两种方式均在 Cloudflare Console 中配置，代码层面统一接口，无需修改代码切换。

### 6.5 Renovate 配置

配置文件路径：`.github/renovate.json`

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["before 6am on monday"],
  "prConcurrentLimit": 3,
  "labels": ["dependencies"]
}
```

---

## 7. 应用数据库表结构

所有表名使用 `{TABLE_PREFIX}_` 前缀，例如前缀为 `d1s` 时表名为 `d1s_users`。

```sql
{PREFIX}_users            -- 用户（id, username, password_hash, role, is_active, created_at）
{PREFIX}_sessions         -- 登录会话（id, user_id, token_hash, expires_at）
{PREFIX}_totp_secrets     -- TOTP 密钥（user_id, secret, is_verified）
{PREFIX}_passkeys         -- Passkey 凭证（id, user_id, credential_id, public_key, ...）
{PREFIX}_db_slots         -- 槽位配置（slot_index, display_name, is_active）
{PREFIX}_db_permissions   -- 用户-数据库权限（user_id, slot_index）
{PREFIX}_query_history    -- 查询历史（id, user_id, slot_index, sql, status, rows_affected, executed_at）
{PREFIX}_settings         -- 系统配置键值对（key, value）
```

---

## 8. UI 设计原则

- 风格：清爽简洁（Light 主题为主）
- 组件库：shadcn/ui（基于 Radix UI，无障碍友好）
- 主布局：左侧 Schema 浏览器 + 中间编辑器 + 下方结果面板（类 DataGrip 布局）
- 数据库切换：顶部下拉选择当前操作的数据库
