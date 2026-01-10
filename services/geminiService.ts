import { GoogleGenAI } from "@google/genai";
import { WorkLog, ManagerNote, Project } from "../types";

// 向后兼容：使用新的环境变量名称
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Helper to format date
const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  } catch (e) {
    return dateStr;
  }
};

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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "生成失败，内容为空。";
  } catch (error) {
    console.error("Gemini API Error:", error);
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "调整失败。";
  } catch (error) {
    console.error("Gemini Refine Error:", error);
    return `调整出错: ${(error as Error).message}`;
  }
};

export type PresentationStyle = 'formal' | 'casual' | 'detailed' | 'concise' | 'data-driven' | 'story-driven';

export interface PresentationStyleConfig {
  label: string;
  description: string;
  tone: string;
  length: string;
  focus: string;
}

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
角色: 资深管理汇报顾问，擅长将工作数据转化为有说服力的汇报话术。

任务: 基于本周工作台账数据，生成一份结构化的周例会汇报建议。

【汇报风格要求】
风格类型: ${styleConfig.label}
风格描述: ${styleConfig.description}
语气要求: ${styleConfig.tone}
时长控制: ${styleConfig.length}
重点聚焦: ${styleConfig.focus}

【本周工作数据】
时间周期: ${weekStartDate} 所在周

核心数据:
- 总工时: ${totalHours}小时
- 参与人员: ${uniqueWorkers.size}人 (${Array.from(uniqueWorkers).join('、')})
- 涉及项目: ${projectCount}个

项目详情:
${projectDetails || '本周无项目记录'}

管理动作记录:
${managerNotesText || '本周无管理动作记录'}

【输出要求】
请严格按照以下 JSON 格式输出，不要添加任何额外说明：

{
  "outline": ["要点1标题", "要点2标题", "要点3标题", "要点4标题"],
  "talkingPoints": [
    {
      "title": "要点标题",
      "script": "详细话术（必须符合${styleConfig.label}风格：${styleConfig.tone}，${styleConfig.focus}）",
      "data": "支撑数据（如：完成X个项目，累计Y工时，Z人参与）"
    }
  ],
  "qa": [
    {
      "question": "领导可能问的问题",
      "answer": "建议回答（符合${styleConfig.label}风格，简洁有力，1-2句话）"
    }
  ],
  "duration": "建议汇报时长（根据${styleConfig.length}计算）"
}

【话术要求】
1. 严格遵循${styleConfig.label}风格：${styleConfig.tone}
2. 重点聚焦：${styleConfig.focus}
3. 时长控制：${styleConfig.length}
4. 避免流水账，突出成果和亮点
5. 如果数据较少，要提炼管理动作和团队协作亮点

【风格示例】
${style === 'formal' ? '正式风格："本周团队在战略项目上取得重要进展，累计投入XX工时，项目A已完成关键里程碑..."' : ''}
${style === 'casual' ? '轻松风格："这周大家干得不错，我们完成了几个重要项目，特别是项目A，进展挺顺利的..."' : ''}
${style === 'detailed' ? '详细风格："本周团队共完成3个项目，累计投入XX工时。项目A方面，我们完成了XX功能，涉及X名成员，耗时Y小时..."' : ''}
${style === 'concise' ? '简洁风格："本周完成3个项目，XX工时，项目A进入关键阶段。"' : ''}
${style === 'data-driven' ? '数据风格："本周团队效率提升15%，完成3个项目，累计XX工时，人均Y小时，项目A进度达到80%..."' : ''}
${style === 'story-driven' ? '故事风格："这周有个很有意思的进展，项目A在遇到XX挑战时，我们团队通过XX方式，最终在周三完成了关键突破..."' : ''}

请直接输出 JSON，不要有任何前缀或后缀说明。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const text = response.text || '';
    if (!text) {
      throw new Error("AI 返回内容为空");
    }
    
    // 尝试提取 JSON（可能包含 markdown 代码块）
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // 尝试找到 JSON 对象（可能前后有其他文本）
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonText) as PresentationSuggestion;
      
      // 验证必需字段
      if (!parsed.outline || !parsed.talkingPoints) {
        throw new Error("AI 返回的 JSON 格式不完整");
      }
      
      return parsed;
    } catch (parseError) {
      console.error("JSON 解析失败，原始内容:", text);
      console.error("解析错误:", parseError);
      throw new Error(`JSON 解析失败: ${(parseError as Error).message}。AI 返回内容可能格式不正确。`);
    }
  } catch (error) {
    console.error("Presentation Suggestion Error:", error);
    // 重新抛出错误，让调用方处理
    throw error;
  }
};