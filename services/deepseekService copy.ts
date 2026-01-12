import OpenAI from "openai";
import { WorkLog, ManagerNote, Project } from "../types";

// 初始化 DeepSeek 客户端 (兼容 OpenAI SDK)
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com', 
  apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
  dangerouslyAllowBrowser: true // 允许前端调用
});

// 辅助函数：格式化日期
const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  } catch (e) {
    return dateStr;
  }
};

// ==========================================
// 1. 核心常量配置 (解决报错的关键部分)
// ==========================================

export type PresentationStyle = 'formal' | 'casual' | 'detailed' | 'concise' | 'data-driven' | 'story-driven';

export interface PresentationStyleConfig {
  label: string;
  description: string;
  tone: string;
  length: string;
  focus: string;
}

// 这里直接从 geminiService 复制过来的，保证前端组件能读到配置
export const PRESENTATION_STYLES: Record<PresentationStyle, PresentationStyleConfig> = {
  formal: {
    label: '正式严谨',
    description: '适合高层汇报，语气正式，结构严谨',
    tone: '正式、专业、严谨，使用规范的汇报用语',
    length: '每个要点控制在30-40秒',
    focus: '突出战略价值和业务影响'
  },
  casual: {
    label: '轻松自然',
    description: '适合团队内部，语气轻松，自然流畅',
    tone: '轻松、自然、口语化，像日常交流一样',
    length: '每个要点控制在20-30秒',
    focus: '强调团队协作和日常进展'
  },
  detailed: {
    label: '详细全面',
    description: '包含更多细节和数据，适合需要深入了解的场景',
    tone: '专业、详细，包含具体数据和细节',
    length: '每个要点控制在40-50秒，可包含更多信息',
    focus: '提供详细的项目进展和具体成果'
  },
  concise: {
    label: '简洁高效',
    description: '只讲重点，快速传达核心信息',
    tone: '简洁、直接、高效，一句话说清要点',
    length: '每个要点控制在15-20秒',
    focus: '只讲最重要的成果和亮点'
  },
  'data-driven': {
    label: '数据导向',
    description: '以数据为核心，用数字说话',
    tone: '专业、客观，大量使用数据和指标',
    length: '每个要点控制在30-40秒',
    focus: '突出量化成果和效率提升'
  },
  'story-driven': {
    label: '故事化',
    description: '用故事的方式呈现，更有感染力',
    tone: '生动、有画面感，用场景和故事呈现',
    length: '每个要点控制在30-40秒',
    focus: '通过具体场景和故事展现成果'
  }
};

export interface PresentationSuggestion {
  outline: string[];
  talkingPoints: Array<{
    title: string;
    script: string;
    data: string;
  }>;
  qa: Array<{
    question: string;
    answer: string;
  }>;
  duration: string;
}

// ==========================================
// 2. 业务功能函数 (DeepSeek 版实现)
// ==========================================

export const generateWeeklyReport = async (
  notes: ManagerNote[],
  logs: WorkLog[],
  startDate: string,
  endDate: string,
  templateContent: string
): Promise<string> => {
  try {
    const managerNotesText = notes
      .map(n => `- [${formatDate(n.date)}] ${n.content} ${n.relatedProjectName ? `(关联项目: ${n.relatedProjectName})` : ''}`)
      .join('\n');

    const projectSummaries: Record<string, string[]> = {};
    logs.forEach(log => {
      if (!projectSummaries[log.projectName]) {
        projectSummaries[log.projectName] = [];
      }
      projectSummaries[log.projectName].push(`${log.workerName}: ${log.content} (${log.hours}h)`);
    });

    const teamActivityText = Object.entries(projectSummaries)
      .map(([project, activities]) => `项目【${project}】:\n  ${activities.join('\n  ')}`)
      .join('\n\n');

    const processedTemplate = templateContent
      .replace(/{startDate}/g, startDate)
      .replace(/{endDate}/g, endDate);

    const prompt = `
      角色: 设计部门经理。
      任务: 根据以下输入数据，使用指定的模板生成周报。
      
      时间范围: ${startDate} 至 ${endDate}

      【输入数据 1：我的每日随手记（管理动作）】
      ${managerNotesText || '(本周无随手记，请根据团队工作自动补充常规管理动作)'}

      【输入数据 2：团队成员工作记录（项目进度监控）】
      ${teamActivityText || '(本周无团队记录)'}

      【输出模板要求】
      ${processedTemplate}

      [语言]: 简体中文。
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-chat",
      temperature: 0.7,
    });

    return completion.choices[0].message.content || "生成失败，内容为空。";
  } catch (error) {
    console.error("DeepSeek API Error:", error);
    return `生成出错: ${(error as Error).message}。请确保 API 配置正确。`;
  }
};

export const refineWeeklyReport = async (
  currentReport: string,
  userInstruction: string
): Promise<string> => {
  try {
    const prompt = `
      角色: 专业的设计经理助理。
      任务: 根据用户的指令优化周报。

      【当前周报内容】
      ${currentReport}

      【用户修改指令】
      "${userInstruction}"

      【要求】
      1. 保持原有的 Markdown 结构。
      2. 仅输出更新后的完整 Markdown 内容。
      3. 语气专业、干练。
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-chat",
    });

    return completion.choices[0].message.content || "调整失败。";
  } catch (error) {
    console.error("DeepSeek Refine Error:", error);
    return `调整出错: ${(error as Error).message}`;
  }
};

export const generatePresentationSuggestion = async (
  logs: WorkLog[],
  projects: Project[],
  notes: ManagerNote[],
  weekStartDate: string,
  style: PresentationStyle = 'formal'
): Promise<PresentationSuggestion> => {
  try {
    // 统计数据
    const totalHours = logs.reduce((sum, log) => sum + (log.hours || 0), 0);
    const uniqueWorkers = new Set(logs.map(log => log.workerName));
    const projectCount = new Set(logs.map(log => log.projectId)).size;
    
    // 按项目汇总
    const projectSummaries: Record<string, { hours: number; workers: Set<string>; contents: string[] }> = {};
    logs.forEach(log => {
      if (!projectSummaries[log.projectId]) {
        projectSummaries[log.projectId] = { hours: 0, workers: new Set(), contents: [] };
      }
      projectSummaries[log.projectId].hours += log.hours || 0;
      projectSummaries[log.projectId].workers.add(log.workerName);
      projectSummaries[log.projectId].contents.push(`${log.workerName}: ${log.content}`);
    });

    const projectDetails = Object.entries(projectSummaries)
      .map(([projectId, data]) => {
        const project = projects.find(p => p.id === projectId);
        return `项目【${project?.name || '未知项目'}】:
  - 累计工时: ${data.hours}小时
  - 参与人员: ${Array.from(data.workers).join('、')}
  - 主要工作: ${data.contents.slice(0, 3).join('；')}`;
      })
      .join('\n\n');

    const managerNotesText = notes
      .filter(n => n.date.startsWith(weekStartDate) || (n.date >= weekStartDate && n.date <= weekStartDate))
      .map(n => `- ${n.content}${n.relatedProjectName ? ` (关联: ${n.relatedProjectName})` : ''}`)
      .join('\n');

    const styleConfig = PRESENTATION_STYLES[style];
    
    const prompt = `
角色: 资深管理汇报顾问。
任务: 基于本周数据生成结构化的周例会汇报建议。

【汇报风格】${styleConfig.label} (${styleConfig.description})
【数据概览】总工时 ${totalHours}h，${uniqueWorkers.size}人参与，${projectCount}个项目。

项目详情:
${projectDetails || '本周无项目记录'}

管理动作:
${managerNotesText || '本周无管理动作记录'}

【输出要求】
必须严格输出纯 JSON 格式，不要包含 Markdown 代码块标记（如 \`\`\`json），内容字段如下：
{
  "outline": ["要点1", "要点2"],
  "talkingPoints": [
    {
      "title": "标题",
      "script": "详细话术（符合${styleConfig.label}语气）",
      "data": "支撑数据"
    }
  ],
  "qa": [{"question": "问题", "answer": "回答"}],
  "duration": "建议时长"
}
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-chat",
      response_format: { type: "json_object" }, // DeepSeek 支持 JSON 模式，这里强制开启
    });

    const text = completion.choices[0].message.content || '{}';
    
    // 简单的 JSON 清洗（防止 AI 还是加了 Markdown）
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleanText) as PresentationSuggestion;

  } catch (error) {
    console.error("DeepSeek Suggestion Error:", error);
    throw error;
  }
};