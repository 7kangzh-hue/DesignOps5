# 环境变量配置指南

本项目使用 Gemini API，需要配置 API Key。本文档说明如何在本地开发和部署环境中配置。

## 📋 目录

- [本地开发配置](#本地开发配置)
- [GitHub Actions 配置](#github-actions-配置)
- [Vercel 部署配置](#vercel-部署配置)
- [环境变量说明](#环境变量说明)

---

## 🖥️ 本地开发配置

### 步骤 1: 创建本地环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# 在项目根目录执行
cp .env.example .env.local
```

### 步骤 2: 填入你的 API Key

编辑 `.env.local` 文件，将 `your_gemini_api_key_here` 替换为你的实际 API Key：

```env
VITE_API_KEY=你的_Gemini_API_Key
```

### 步骤 3: 验证配置

重启开发服务器：

```bash
npm run dev
```

现在你可以在本地测试 AI 功能了！

> ⚠️ **重要**: `.env.local` 文件已被 `.gitignore` 忽略，不会提交到 Git，可以安全地存储你的本地 API Key。

---

## 🚀 GitHub Actions 配置

### 步骤 1: 添加 GitHub Secret

1. 进入你的 GitHub 仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 填写：
   - **Name**: `VITE_API_KEY`
   - **Value**: 你的 Gemini API Key
5. 点击 **Add secret**

### 步骤 2: 验证工作流

工作流文件已配置在 `.github/workflows/deploy.yml`，会自动从 GitHub Secrets 读取 `VITE_API_KEY`。

当你推送代码到 `main` 或 `master` 分支时，GitHub Actions 会：
1. 从 Secrets 读取 `VITE_API_KEY`
2. 在构建时注入为环境变量
3. Vite 会自动将其暴露给客户端代码

---

## ☁️ Vercel 部署配置

如果你使用 Vercel 部署：

### 步骤 1: 添加环境变量

1. 进入 Vercel 项目设置
2. 点击 **Settings** → **Environment Variables**
3. 添加变量：
   - **Name**: `VITE_API_KEY`
   - **Value**: 你的 Gemini API Key
   - **Environment**: 选择 `Production`, `Preview`, `Development`（根据需要）

### 步骤 2: 重新部署

添加环境变量后，Vercel 会自动触发重新部署。

---

## 📝 环境变量说明

### `VITE_API_KEY`

- **类型**: String
- **必需**: 是
- **说明**: Gemini API 的密钥
- **获取方式**: [Google AI Studio](https://makersuite.google.com/app/apikey)

### 为什么使用 `VITE_` 前缀？

Vite 只会将以 `VITE_` 开头的环境变量暴露给客户端代码，这是 Vite 的安全机制。

### 环境变量优先级

1. **本地开发**: `.env.local` > `.env`
2. **构建时**: 系统环境变量 > `.env.production` > `.env`

---

## 🔒 安全提示

1. ✅ **永远不要**将 `.env.local` 提交到 Git
2. ✅ **永远不要**在代码中硬编码 API Key
3. ✅ 使用 GitHub Secrets 或 Vercel Environment Variables 存储生产环境的密钥
4. ✅ 定期轮换 API Key
5. ✅ 限制 API Key 的使用权限（如果可能）

---

## ❓ 常见问题

### Q: 本地开发时提示 API Key 未配置？

A: 检查：
1. `.env.local` 文件是否存在
2. 文件中的 `VITE_API_KEY` 是否正确
3. 是否重启了开发服务器（环境变量更改需要重启）

### Q: GitHub Actions 构建失败，提示 API Key 未找到？

A: 检查：
1. GitHub Secrets 中是否添加了 `VITE_API_KEY`
2. Secret 名称是否完全匹配（区分大小写）
3. 工作流文件中的环境变量名称是否正确

### Q: 部署后 AI 功能不工作？

A: 检查：
1. 部署平台（Vercel/GitHub Pages）的环境变量是否配置
2. 环境变量名称是否为 `VITE_API_KEY`（带 `VITE_` 前缀）
3. 是否重新部署了应用（环境变量更改需要重新部署）

---

## 📚 相关文档

- [Vite 环境变量文档](https://vitejs.dev/guide/env-and-mode.html)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel 环境变量](https://vercel.com/docs/concepts/projects/environment-variables)
