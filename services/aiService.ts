// services/aiService.ts
import * as deepseek from './deepseekService';
import * as gemini from './geminiService';
import { WorkLog, ManagerNote, Project } from "../types";

// 定义支持的提供商类型
export type AIProvider = 'deepseek' | 'gemini';

// 获取当前设置的提供商 (默认为 deepseek)
const getProvider = (): AIProvider => {
  const provider = (localStorage.getItem('app_ai_provider') as AIProvider) || 'deepseek';
  console.log(`[aiService] Current provider from localStorage: ${provider}`);
  return provider;
};

// =================================================================
// 1. 导出类型和常量 (由于两个文件定义相同，直接复用其中一个的定义即可)
// =================================================================
export type { PresentationSuggestion, PresentationStyle, PresentationStyleConfig } from './deepseekService';
export { PRESENTATION_STYLES } from './deepseekService';

// =================================================================
// 2. 统一接口实现
// =================================================================

export const generateWeeklyReport = async (
  notes: ManagerNote[],
  logs: WorkLog[],
  startDate: string,
  endDate: string,
  templateContent: string
): Promise<string> => {
  const provider = getProvider();
  console.log(`[aiService] generateWeeklyReport - Provider: ${provider}, Calling ${provider === 'gemini' ? 'Gemini' : 'DeepSeek'}...`);
  if (provider === 'gemini') {
    return gemini.generateWeeklyReport(notes, logs, startDate, endDate, templateContent);
  }
  return deepseek.generateWeeklyReport(notes, logs, startDate, endDate, templateContent);
};

export const refineWeeklyReport = async (
  currentReport: string,
  userInstruction: string
): Promise<string> => {
  const provider = getProvider();
  console.log(`[aiService] refineWeeklyReport - Provider: ${provider}, Calling ${provider === 'gemini' ? 'Gemini' : 'DeepSeek'}...`);
  if (provider === 'gemini') {
    return gemini.refineWeeklyReport(currentReport, userInstruction);
  }
  return deepseek.refineWeeklyReport(currentReport, userInstruction);
};

export const generatePresentationSuggestion = async (
  logs: WorkLog[],
  projects: Project[],
  notes: ManagerNote[],
  weekStartDate: string,
  style: any // 使用 any 避免类型导入的微小差异，或者明确引用 deepseekService.PresentationStyle
) => {
  const provider = getProvider();
  console.log(`[aiService] generatePresentationSuggestion - Provider: ${provider}, Calling ${provider === 'gemini' ? 'Gemini' : 'DeepSeek'}...`);
  if (provider === 'gemini') {
    return gemini.generatePresentationSuggestion(logs, projects, notes, weekStartDate, style);
  }
  return deepseek.generatePresentationSuggestion(logs, projects, notes, weekStartDate, style);
};
