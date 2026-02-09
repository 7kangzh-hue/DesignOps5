/**
 * ERP 数据接口定义
 */
export interface ErpData {
  [key: string]: string;
}

/**
 * 将 Markdown 周报内容解析为 ERP 系统所需的 JSON 字符串
 */
export function parseMarkdownToErpJsonString(markdown: string): string {
  const result: ErpData = {};
  const lines = markdown.split('\n');

  // 状态机变量
  let currentDayPrefix: string | null = null;
  let currentPeriodSuffix: string | null = null;
  let currentScope: 'thisWeek' | 'nextWeek' | null = null;
  let buffer: string[] = [];

  // ERP ID 映射表
  const dayMap: Record<string, string> = {
    '周一': 'Mon',
    '周二': 'Tues',
    '周三': 'Wed',
    '周四': 'Thur',
    '周五': 'Fri',
    '周六': 'Sat',
    '周日': 'Sun'
  };

  // 核心：写入缓冲区内容
  const flushBuffer = () => {
    if (buffer.length > 0 && currentDayPrefix && currentPeriodSuffix && currentScope) {
      const key = `${currentScope}${currentDayPrefix}${currentPeriodSuffix}`;
      // 如果 key 已存在（比如有多个段落），则换行追加
      result[key] = result[key] ? `${result[key]}\n${buffer.join('\n')}` : buffer.join('\n');
      buffer = [];
    }
  };

  // 1. 提取重点工作 (保持原有的块提取逻辑)
  const extractSection = (startMarker: string, endMarkerPattern: RegExp) => {
    const start = markdown.indexOf(startMarker);
    if (start === -1) return '';
    const sub = markdown.substring(start + startMarker.length);
    const end = sub.search(endMarkerPattern);
    const content = end === -1 ? sub : sub.substring(0, end);
    
    return content.split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map((l, i) => {
        // 移除 Markdown 符号并保留纯文本
        const cleanText = l.replace(/^- /, '').replace(/\*\*/g, '').replace(/__/g, '').trim();
        return `${i + 1}. ${cleanText}`;
      })
      .join('\n');
  };

  result['thisWeekPoint'] = extractSection('## 1. 本周重点工作总结', /## 2\./);
  result['nextWeekPoint'] = extractSection('### 🚀 下周重点目标', /### 📅/);

  // 2. 提取每日流水
  for (const line of lines) {
    const trimLine = line.trim();
    if (!trimLine) continue;

    // --- A. 识别周次范围 (修复点：切换前必须 flushBuffer) ---
    
    // 识别本周
    if (trimLine.includes('## 2. 本周工作流水')) { 
      flushBuffer(); // 切换前先保存上一块内容
      currentScope = 'thisWeek'; 
      currentDayPrefix = null; 
      continue; 
    }
    
    // 识别下周 (这里之前漏了 flushBuffer，导致周五下午丢失)
    if (trimLine.includes('### 📅 下周日程预排') || trimLine.includes('下周日程')) { 
      flushBuffer(); // <--- 关键修复：切换到下周前，先把本周(周五下午)的内容存进去！
      currentScope = 'nextWeek'; 
      currentDayPrefix = null; 
      continue; 
    }

    // --- B. 识别星期 ---
    const dayMatch = trimLine.match(/(?:^|\s|[*#])(周[一二三四五六日])/);
    if (dayMatch) {
      flushBuffer(); // 换天了，存上一时段
      currentDayPrefix = dayMap[dayMatch[1]];
      currentPeriodSuffix = null; 
      continue; 
    }

    // --- C. 识别时段 ---
    const periodMatch = trimLine.match(/(?:^|[-*])\s*(?:\*\*)?\s*(上午|下午|晚上)(?:\*\*)?[:：]?/);
    if (periodMatch) {
      flushBuffer(); // 换时段了，存上一时段
      const p = periodMatch[1];
      currentPeriodSuffix = p === '上午' ? '_M' : p === '下午' ? '_A' : '_N';
      continue;
    }

    // --- D. 识别内容行 ---
    const contentMatch = trimLine.match(/^(\d+)[.、]\s*(.*)/);
    if (contentMatch && currentScope && currentDayPrefix && currentPeriodSuffix) {
      const cleanContent = contentMatch[2].replace(/\*\*/g, '').replace(/__/g, '').trim();
      buffer.push(`${buffer.length + 1}. ${cleanContent}`);
    }
  }
  
  // 循环结束，存入最后一段缓冲区
  flushBuffer();

  return JSON.stringify(result, null, 2);
}

/**
 * 辅助函数：移除 Markdown 格式（供其他组件调用）
 */
export function removeMarkdownFormatting(text: string): string {
  if (!text) return '';
  return text.replace(/\*\*(.*?)\*\*/g, '$1')
             .replace(/__(.*?)__/g, '$1')
             .replace(/`(.*?)`/g, '$1')
             .trim();
}