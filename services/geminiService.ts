
import { GoogleGenAI } from "@google/genai";
import { WorkLog, ManagerNote } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
// We assume process.env.API_KEY is provided via the shim in index.html or build environment
// 👇 改成这样：使用 import.meta.env 读取 VITE_API_KEY
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || "" });

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
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "生成失败，内容为空。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `生成出错: ${(error as Error).message}。请确保已正确配置 API_KEY 环境并能连接 Google API。`;
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
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "调整失败。";
  } catch (error) {
    console.error("Gemini Refine Error:", error);
    return `调整出错: ${(error as Error).message}`;
  }
};
