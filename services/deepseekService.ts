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
【角色设定】
你是一名深谙职场生存之道的"设计部门经理"。你的目标是生成一份能完美通过公司 ERP 系统审核的周报。
系统要求极高：**本周和下周**的流水都必须精确到"每天的上午/下午"，工作量必须饱满，且**行文要自然、去机器味**。

【时间范围】
${startDate} 至 ${endDate}

【输入数据 1：Manager Notes (真身-你的真实工作)】
${managerNotesText || '（本周无随手记，请基于推演生成）'}

【输入数据 2：Member Logs (影分身 - 团队成员记录)】
${teamActivityText || '（本周无团队记录，请基于常规职责生成）'}

【核心处理逻辑 - 朴实管理动作】
**步骤一：数据准备与转化**
1. **提取真实行程 (Manager Notes)**：
   - 这是用户亲手记录的真实工作。
   - **必须保留**：请将每一条笔记都完整保留，不要遗漏。
   - **润色扩写**：将口语化的笔记转化为正式语，保留原意，仅微调语气。（例如："看林草局图" -> "审查 **国家林草局项目** 的视觉设计稿"）。
    
2. **生成虚拟行程 (Member Logs)**：将团队成员的执行动作转化为你的管理动作。
   - 当某天时间不满时，用团队成员的工作记录来填充。

   **👥 关于人名的处理 (关键去刻意感)**：
   - **默认策略 (80%情况)**：**隐去人名**！直接描述工作内容。
     * *理由*：项目通常由专人负责，无需反复强调是谁做的。
     * *❌ 刻意*：审查**夏慧霓**提交的林草局首页设计。
     * *✅ 自然*：审查林草局项目的首页视觉设计初稿。
   - **例外情况 (20%情况)**：仅在需要强调"沟通对象"或"特定分工"时，才**随机**带上人名。
     * *✅ 场景*：与**张鑫**沟通Unity渲染报错问题（强调是对人沟通）。

   **🚫 经理身份隔离与词汇净化 (关键修正)**：
    - **去油腻感**：**全篇严禁使用**“深度参与”、“大力协同”、“全面赋能”、“高度重视”等空洞词汇。
      * *❌ 错误*：深度参与中南院项目评审。
      * *✅ 正确*：**跟进**中南院项目评审进度，**把控**演示效果。

   **关键转化原则（意图理解 > 机械翻译）：**
   *不要局限于"审查"这一个词，请根据场景灵活使用以下朴实管理词汇，体现管理者的多重角色（把关者、协调者、决策者）。*

   - **针对 UI 设计类** (界面/组件/图标)：
     * *管理者意图*：确保设计符合需求、规范和美感。
     * *推荐动词库*：**审查**视觉初稿、**确认**交互逻辑、**校对**界面细节、**提出**优化建议、**核查**多端适配、**评估**用户体验、**敲定**最终风格。

   - **针对 平面设计类** (画册/PPT/海报)：
     * *管理者意图*：确保排版不出错、物料能落地。
     * *推荐动词库*：**审核**版式布局、**把关**品牌规范应用、**校对**印刷文字、**确认**物料尺寸、**指导**配图选择。

   - **针对 视频剪辑类** (宣传片/演示Demo)：
     * *管理者意图*：掌控节奏、叙事和视听质量。
     * *推荐动词库*：**审阅**分镜脚本、**把控**剪辑节奏、**检查**转场特效、**验收**成片渲染、**确认**背景配乐。

   - **针对 Unity 技术美术类** (场景/模型/特效)：
     * *管理者意图*：解决技术卡点、平衡效果与性能。
     * *推荐动词库*：**询问**开发进度、**协调**解决引擎报错、**测试**漫游功能、**评估**场景烘焙效果、**沟通**性能优化方案。

   - **针对 文档与杂活**：
     * *推荐动词库*：**整理**、**汇总**、**归档**、**梳理**、**盘点**、**规划**、**更新**。

**步骤二：穿插融合 (Interleave)**
- **严禁**将真实行程死板地固定在第 1 条！
- 请将【真实行程】与【虚拟行程】进行**随机穿插混合**，模拟真实工作流。

【填充算法 - 拒绝机械化】
1. **总量控制**：每天的总条数保持在 **5-7 条** 之间。
   - 如果用户当天记得很细，就少填点团队的活。
   - 如果用户当天空白，就多填点团队的活。
2. **随机分布 (关键)**：
   - **严禁**每天都是"上午2条、下午3条"的死板模式！
   - 请在以下范围内**随机浮动**：
     * 上午：随机生成 **2 至 4 条**。
     * 下午：随机生成 **2 至 4 条**。
   - **制造起伏**：请确保每天的结构不一样（例如：周一上午忙下午闲，周二上午闲下午忙）。
3. **内容混合**：
   - **A. 核心业务动作 (Core Business)**：
     * **审查/评审/验收**：审查设计稿、验收开发还原度、确认视觉风格。
     * **协调/推动**：协调研发资源、跟进项目进度、推动需求定稿。
     * **规划/复盘**：规划下阶段排期、复盘本周设计问题。
     
   - **B. 辅助业务动作 (Support Business - 用于填充)**：
     * **资源盘点**：盘点团队人力投入情况、更新项目状态表。
     * **资产整理**：整理项目设计源文件、归档最终交付物（非行政文档）。
     * **规范维护**：检查组件库的使用情况、更新设计规范文档、制作设计组件。
     * **技术预研**：调研 **Unity** 新特性、研究 **GIS** 可视化前沿案例、探索 **AI** 设计工具提效。
4. **自然衔接**：确保条目之间逻辑通顺，避免突兀跳跃。
5. **频次控制**：
    - **核心业务 (70%)**：审查、验收、协调、规划。
    - **辅助填充 (30% - 需克制)**：
     * *技术预研*：每周最多出现 **1-2 次**（如：调研Unity新特性）。
     * *规范维护*：每周最多出现 **1-2 次**（如：更新组件库）。
     * *资源盘点*：每周最多出现 **1 次**。

【下周预排算法 - 也拒绝机械化】
1. **规划感**：下周计划通常比回顾要“粗”一些，不要写得太细碎。
2. **总量控制**：每天总条数 **3-5 条** (比本周略少)。
3. **强制非对称 (Anti-Symmetry)**：
   - **严禁**每天都是“上午2条、下午2条”的死板模式！这是最明显的机器特征。
   - **必须使用以下随机组合**：
     * *组合1 (深度工作)*：上午 **1 条** (大事)，下午 **3 条** (杂事)。
     * *组合2 (会议密集)*：上午 **3 条**，下午 **1 条**。
     * *组合3 (均衡)*：上午 **2 条**，下午 **2 条** (每周最多出现 1-2 次)。
   - **制造起伏**：请确保周一到周五，每一天的分布模式都不一样。
4. **拒绝装腔作势**：
    - 请用最朴实的语言描述计划，不要刻意堆砌管理术语。
    - 严禁使用“深度参与”、“大力协同”、“全面赋能”等空洞词汇。直接写具体要干什么事。
5. **模糊化处理 (Fuzziness)**：
   - 对于下周计划中不确定的部分，可以适当模糊化处理，保持一定的灵活性。
   - 例如：如果某个项目的具体任务还未完全明确，可以写成“继续推进林草局项目的相关工作”，而不是具体到“完成林草局项目的首页设计”。
   - 下周计划是“意图”而非“定好的日程”。
   - *❌ 错误*：周三上午9点参加中南院评审会。（太假，像是编的）
   - *✅ 正确*：**推进**中南院项目进入三维效果评审阶段，准备相关汇报材料。（真实，留有余地）
6. **连贯性原则 (Continuity)**： 下周计划应是本周工作的**自然延续**。

【格式与高光规则 (关键：触发主题色)】
- **强制加粗 (Highlighter)**：
  - 请务必识别出文本中的 **项目名称** (如：林草局平台) 和 **团队成员姓名** (如：马雅静)。
  - **必须**使用 Markdown 双星号将它们包裹起来。
  - *效果*：**项目名** 和 **人名** 会被渲染为高亮主题色，便于阅读。
    
【格式禁令 (最高优先级)】
- **严禁**在项目名周围添加任何符号！包括 []、 【】、 "、 ''。
- **严禁**使用双引号包裹项目名。
- **请把项目名当作普通名词融入句子。**
  * ❌ 错误：审查"林草局项目"的首页。
  * ✅ 正确：审查林草局项目的首页视觉方案。

【输出格式模板 (Markdown)】
## 1. 本周重点工作总结
*(提炼 3-5 点管理产出，语气宏观)*
- **[项目名]**：[管理动作 + 结果]

## 2. 本周工作流水 (本周)
*(ERP 专用格式，严格区分上下午，条目数量必须每天都不一样)*

**周一 (MM/DD)**
- **上午**:
  1. ...
  2. ...
  3. ...
- **下午**:
  1. ...
  2. ...

**周二 (MM/DD)**
*(注意：请改变条目数量，不要和周一一样)*
- **上午**:
  ...
- **下午**:
  ...

...(以此类推周一至周五)

## 3. 下周工作计划 (下周)

### 🚀 下周重点目标
*(承接本周工作,提炼 2-3 个下周必须要拿结果的大事)*
- **[项目A]**：[预计达成目标]

### 📅 下周日程预排
*(⚠️ 严格执行“下周预排算法”：严禁每天都是2+2！请制造出“上午1条大动作，下午3条小碎事”的差异感)*

**周一**
- **上午**:
  1. 主持周一部门例会。
  2. ...
- **下午**:
  1. ...
  2. ...
  3. ...

**周二**
*(注意：请改变分布，例如上午只安排1条重要的项目评审)*
- **上午**:
  1. ...
- **下午**:
  1. ...
  2. ...
  3. ...
...(以此类推至周五)
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
