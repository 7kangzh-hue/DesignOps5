# AI 服务环境变量配置指南

本项目支持双 AI 提供商：**DeepSeek** 和 **Google Gemini**。用户可以在设置界面实时切换使用哪个 AI 服务。本文档说明如何在本地开发和部署环境中配置这两个 AI 服务。

## 📋 目录

- [项目架构概述](#项目架构概述)
- [本地开发配置](#本地开发配置)
- [GitHub Actions 配置](#github-actions-配置)
- [Vercel 部署配置](#vercel-部署配置)
- [环境变量说明](#环境变量说明)
- [AI 提供商切换说明](#ai-提供商切换说明)
- [故障排除](#故障排除)

---

## 🏗️ 项目架构概述

### 双 AI 服务架构
```
┌─────────────────────────────────────────┐
│           UI 组件层                      │
│  (SmartReport.tsx, MemberWeeklyLog.tsx) │
└──────────────────┬──────────────────────┘
                   │ 导入 aiService.ts
                   ▼
┌─────────────────────────────────────────┐
│          AI 服务统一层                   │
│          (services/aiService.ts)        │
│  • 读取 localStorage 中的提供商设置      │
│  • 根据设置路由到对应的 AI 服务          │
│  • 提供统一的函数接口                    │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌─────────────┐
│DeepSeek │  │ Gemini  │  │ 用户设置    │
│Service  │  │Service  │  │ (Settings)  │
└─────────┘  └─────────┘  └─────────────┘
```

### 核心特性
1. **实时切换**：用户可在设置界面随时切换 AI 提供商
2. **统一接口**：所有组件通过 `aiService.ts` 调用 AI 功能
3. **自动路由**：根据 `localStorage` 设置自动选择服务
4. **调试日志**：每个 AI 调用都有详细的控制台日志

---

## 🖥️ 本地开发配置

### 步骤 1: 创建本地环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# 在项目根目录执行
cp .env.example .env.local
```

### 步骤 2: 配置 AI 服务密钥

编辑 `.env.local` 文件，配置两个 AI 服务的密钥：

```env
# Gemini API 配置 (用于 Google Gemini 服务)
VITE_GEMINI_API_KEY="your_gemini_api_key_here"

# DeepSeek API 配置 (用于 DeepSeek 服务)
VITE_DEEPSEEK_API_KEY="your_deepseek_api_key_here"

# 向后兼容：旧版本的 Gemini 配置
VITE_API_KEY="your_gemini_api_key_here"
```

### 步骤 3: 获取 API 密钥

#### Google Gemini API 密钥
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新项目或选择现有项目
3. 生成 API 密钥
4. 复制密钥到 `VITE_GEMINI_API_KEY`

#### DeepSeek API 密钥
1. 访问 [DeepSeek 官网](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入 API 密钥管理页面
4. 生成新密钥
5. 复制密钥到 `VITE_DEEPSEEK_API_KEY`

### 步骤 4: 验证配置

重启开发服务器：

```bash
npm run dev
```

访问应用，进入设置页面验证 AI 服务切换功能。

> ⚠️ **重要**: `.env.local` 文件已被 `.gitignore` 忽略，不会提交到 Git，可以安全地存储你的本地 API Key。

---

## 🚀 GitHub Actions 配置

### 步骤 1: 添加 GitHub Secrets

1. 进入你的 GitHub 仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加以下两个 Secret：

   **Secret 1: Gemini API Key**
   - **Name**: `VITE_GEMINI_API_KEY`
   - **Value**: 你的 Gemini API Key

   **Secret 2: DeepSeek API Key**
   - **Name**: `VITE_DEEPSEEK_API_KEY`
   - **Value**: 你的 DeepSeek API Key

### 步骤 2: 验证工作流

工作流文件已配置在 `.github/workflows/deploy.yml`，会自动从 GitHub Secrets 读取环境变量。

当你推送代码到 `main` 或 `master` 分支时，GitHub Actions 会：
1. 从 Secrets 读取所有环境变量
2. 在构建时注入为环境变量
3. Vite 会自动将其暴露给客户端代码

---

## ☁️ Vercel 部署配置

如果你使用 Vercel 部署：

### 步骤 1: 添加环境变量

1. 进入 Vercel 项目设置
2. 点击 **Settings** → **Environment Variables**
3. 添加以下变量：

   **Gemini API Key**
   - **Name**: `VITE_GEMINI_API_KEY`
   - **Value**: 你的 Gemini API Key
   - **Environment**: 选择 `Production`, `Preview`, `Development`

   **DeepSeek API Key**
   - **Name**: `VITE_DEEPSEEK_API_KEY`
   - **Value**: 你的 DeepSeek API Key
   - **Environment**: 选择 `Production`, `Preview`, `Development`

### 步骤 2: 重新部署

添加环境变量后，Vercel 会自动触发重新部署。

---

## 📝 环境变量说明

### `VITE_GEMINI_API_KEY`
- **类型**: String
- **必需**: 是（如果使用 Gemini 服务）
- **说明**: Google Gemini API 的密钥
- **获取方式**: [Google AI Studio](https://makersuite.google.com/app/apikey)
- **使用场景**: 当用户选择 Gemini 作为 AI 提供商时使用

### `VITE_DEEPSEEK_API_KEY`
- **类型**: String
- **必需**: 是（如果使用 DeepSeek 服务）
- **说明**: DeepSeek API 的密钥
- **获取方式**: [DeepSeek Platform](https://platform.deepseek.com/)
- **使用场景**: 当用户选择 DeepSeek 作为 AI 提供商时使用

### `VITE_API_KEY` (向后兼容)
- **类型**: String
- **必需**: 否
- **说明**: 旧版本的 Gemini API 密钥配置
- **兼容性**: `geminiService.ts` 会优先使用 `VITE_GEMINI_API_KEY`，如果不存在则使用 `VITE_API_KEY`

### 为什么使用 `VITE_` 前缀？

Vite 只会将以 `VITE_` 开头的环境变量暴露给客户端代码，这是 Vite 的安全机制。

### 环境变量优先级

1. **本地开发**: `.env.local` > `.env`
2. **构建时**: 系统环境变量 > `.env.production` > `.env`

---

## 🔄 AI 提供商切换说明

### 切换机制
1. **用户选择**: 在设置页面的 "AI 模型" 标签页中选择提供商
2. **本地存储**: 选择保存在 `localStorage` 的 `app_ai_provider` 键中
3. **实时生效**: 切换后立即生效，无需刷新页面

### 默认设置
- **初始默认**: DeepSeek（无需 VPN，免费使用）
- **切换提示**: 切换时会显示确认提示

### 调试日志
每个 AI 调用都会在浏览器控制台输出调试信息：
```
[aiService] Current provider from localStorage: gemini
[aiService] generateWeeklyReport - Provider: gemini, Calling Gemini...
```

### 网络要求
- **DeepSeek**: 无需 VPN，国内可直接访问
- **Gemini**: 需要 VPN（部分地区需要）

---

## 🔒 安全提示

1. ✅ **永远不要**将 `.env.local` 提交到 Git
2. ✅ **永远不要**在代码中硬编码 API Key
3. ✅ 使用 GitHub Secrets 或 Vercel Environment Variables 存储生产环境的密钥
4. ✅ 定期轮换 API Key（建议每 3-6 个月）
5. ✅ 限制 API Key 的使用权限（如果平台支持）
6. ✅ 监控 API 使用量，设置预算告警

---

## ❓ 常见问题

### Q: 本地开发时 AI 功能不工作？
A: 检查：
1. `.env.local` 文件是否存在且格式正确
2. API 密钥是否有效且未过期
3. 是否重启了开发服务器（环境变量更改需要重启）
4. 浏览器控制台是否有错误信息

### Q: 切换到 Gemini 后仍然调用 DeepSeek？
A: 检查：
1. 浏览器控制台是否显示正确的提供商日志
2. `localStorage` 中 `app_ai_provider` 的值是否正确
3. 网络请求是否发送到对应的 API 端点

### Q: GitHub Actions 构建失败？
A: 检查：
1. GitHub Secrets 中是否添加了所有必需的密钥
2. Secret 名称是否完全匹配（区分大小写）
3. 工作流文件中的环境变量名称是否正确

### Q: 部署后 AI 功能不工作？
A: 检查：
1. 部署平台的环境变量是否配置完整
2. 环境变量名称是否为 `VITE_` 前缀
3. 是否重新部署了应用（环境变量更改需要重新部署）
4. 浏览器控制台是否有跨域或网络错误

### Q: 如何验证当前使用的 AI 提供商？
A: 方法：
1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签页
3. 执行 AI 操作（如生成周报）
4. 查看控制台输出的调试日志

---

## 📚 相关文档

- [Vite 环境变量文档](https://vitejs.dev/guide/env-and-mode.html)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel 环境变量](https://vercel.com/docs/concepts/projects/environment-variables)
- [Google Gemini API 文档](https://ai.google.dev/gemini-api/docs)
- [DeepSeek API 文档](https://platform.deepseek.com/api-docs/)

---

## 🆘 技术支持

如果遇到问题，请按以下步骤排查：

1. **检查环境变量**：确认所有必需的 API 密钥都已正确配置
2. **查看控制台**：浏览器开发者工具中的 Console 和 Network 标签页
3. **验证网络**：确保可以访问对应的 API 端点
4. **测试 API 密钥**：使用 curl 或 Postman 直接测试 API 密钥是否有效
5. **查看日志**：检查应用日志和部署平台日志

如果问题仍未解决，请提供：
- 浏览器控制台错误信息
- 环境变量配置（隐藏敏感信息）
- 复现步骤
- 期望与实际行为对比
