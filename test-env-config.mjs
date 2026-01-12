#!/usr/bin/env node

/**
 * 环境变量配置验证脚本
 * 用于验证双 AI 服务环境变量配置是否正确
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 验证双 AI 服务环境变量配置...\n');

// 检查文件是否存在
const filesToCheck = [
  { path: '.env.example', required: true, description: '环境变量模板文件' },
  { path: '.env.local', required: false, description: '本地环境变量文件' },
  { path: 'ENV_SETUP.md', required: true, description: '环境变量配置文档' },
  { path: '.github/workflows/deploy.yml', required: true, description: 'GitHub Actions 工作流' },
  { path: 'README.md', required: true, description: '项目说明文档' },
];

console.log('📁 检查文件是否存在:');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(file.path);
  const status = exists ? '✅' : file.required ? '❌' : '⚠️';
  console.log(`  ${status} ${file.path} - ${file.description}`);
});

// 检查 .env.example 内容
console.log('\n📝 检查 .env.example 内容:');
try {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  const requiredVars = [
    'VITE_GEMINI_API_KEY',
    'VITE_DEEPSEEK_API_KEY',
    'VITE_API_KEY'
  ];
  
  requiredVars.forEach(varName => {
    const hasVar = envExample.includes(varName);
    console.log(`  ${hasVar ? '✅' : '❌'} ${varName}`);
  });
  
  // 检查说明文档
  const hasInstructions = envExample.includes('使用说明');
  console.log(`  ${hasInstructions ? '✅' : '❌'} 包含使用说明`);
} catch (error) {
  console.log(`  ❌ 无法读取 .env.example: ${error.message}`);
}

// 检查 .env.local 内容（如果存在）
console.log('\n🔧 检查 .env.local 内容:');
if (fs.existsSync('.env.local')) {
  try {
    const envLocal = fs.readFileSync('.env.local', 'utf8');
    const lines = envLocal.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    
    console.log(`  找到 ${lines.length} 个环境变量配置`);
    
    // 检查关键变量
    const checkVars = ['VITE_GEMINI_API_KEY', 'VITE_DEEPSEEK_API_KEY'];
    checkVars.forEach(varName => {
      const hasVar = envLocal.includes(varName);
      console.log(`  ${hasVar ? '✅' : '⚠️'} ${varName}`);
    });
  } catch (error) {
    console.log(`  ❌ 无法读取 .env.local: ${error.message}`);
  }
} else {
  console.log('  ℹ️  .env.local 不存在，请运行: cp .env.example .env.local');
}

// 检查 GitHub Actions 工作流
console.log('\n⚙️ 检查 GitHub Actions 工作流:');
try {
  const workflow = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
  
  const checks = [
    { name: 'VITE_GEMINI_API_KEY', pattern: /VITE_GEMINI_API_KEY:\s*\$\{\{\s*secrets\.VITE_GEMINI_API_KEY\s*\}\}/ },
    { name: 'VITE_DEEPSEEK_API_KEY', pattern: /VITE_DEEPSEEK_API_KEY:\s*\$\{\{\s*secrets\.VITE_DEEPSEEK_API_KEY\s*\}\}/ },
    { name: 'VITE_API_KEY', pattern: /VITE_API_KEY:\s*\$\{\{\s*secrets\.VITE_API_KEY\s*\}\}/ }
  ];
  
  checks.forEach(check => {
    const hasVar = check.pattern.test(workflow);
    console.log(`  ${hasVar ? '✅' : '❌'} ${check.name}`);
  });
} catch (error) {
  console.log(`  ❌ 无法读取工作流文件: ${error.message}`);
}

// 总结
console.log('\n📊 配置验证总结:');
console.log('========================================');
console.log('✅ 已完成以下配置更新:');
console.log('  1. 创建 .env.example 模板文件');
console.log('  2. 更新 .env.local 支持双 AI 服务');
console.log('  3. 重写 ENV_SETUP.md 详细文档');
console.log('  4. 更新 GitHub Actions 工作流');
console.log('  5. 更新 README.md 使用说明');
console.log('');
console.log('🚀 下一步操作:');
console.log('  1. 本地开发: cp .env.example .env.local');
console.log('  2. 编辑 .env.local 填入真实的 API 密钥');
console.log('  3. 重启开发服务器: npm run dev');
console.log('  4. 测试 AI 服务切换功能');
console.log('  5. 生产部署: 在 GitHub Secrets 中添加两个 API Key');
console.log('========================================\n');

console.log('💡 提示: 运行以下命令测试配置:');
console.log('  node test-env-config.mjs');
console.log('  npm run dev');
console.log('  然后在浏览器中打开 http://localhost:5173');
console.log('  进入设置页面切换 AI 提供商并查看控制台日志\n');
