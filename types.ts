
export interface Project {
  id: string;
  name: string;
  level: string; // Key (e.g., "S")
  details: string;
  type: string; // Key (e.g., "ui_design")
  subType?: string; // Key (e.g., "iterative_design")
  stage: string; // Key (e.g., "ongoing")
  platform: string; // Key (e.g., "web")
  startTime: string;
  attribute: string; // Key (e.g., "strategic")
  department: string; // Key (e.g., "brand_dept")
  owner: string[]; // 负责人数组 (存储 User ID)
  contact: string;
  createdBy?: string; // 创建者 ID
}

export interface WorkLog {
  id: string;
  projectId: string;
  projectName: string;
  projectDept: string; 
  projectType: string;
  projectSubType?: string;
  projectPlatform?: string;
  workerName: string;
  content: string;
  hours: number;
  weekStartDate: string;
  created: string;
  createdBy?: string;
  // Relation Expand support
  expand?: {
    projectId?: Project;
  };
}

export interface ManagerNote {
  id: string;
  content: string;
  date: string;
  relatedProjectId?: string;
  relatedProjectName?: string; // 留作旧数据兼容
  expand?: {
    relatedProjectId?: Project;
  };
}

export interface WeeklyReport {
  id: string;
  startDate: string;
  endDate: string;
  content: string;
  created: string;
}

export interface PresentationSuggestionRecord {
  id: string;
  weekStartDate: string;
  style: string;
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
  created: string;
  updated: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  content: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: 'manager' | 'member';
}

export interface DictItem {
  key: string;
  label: string;
}

export interface TagConfig extends DictItem {
  color: string;
}

export interface TypeConfig extends DictItem {
  subTypes: DictItem[];
}

export interface AppConfig {
  types: TypeConfig[];
  departments: DictItem[];
  platforms: DictItem[];
  levels: TagConfig[]; 
  attributes: DictItem[];
  stages: TagConfig[]; 
  projectColumnOrder: string[];
  reportTemplates: ReportTemplate[];
  users: User[]; 
}

export const DEFAULT_CONFIG: AppConfig = {
  types: [
    { key: 'ui_design', label: 'UI设计', subTypes: [
      { key: 'initial', label: '初始设计' },
      { key: 'iterative', label: '迭代设计' },
      { key: 'expansion', label: '扩展设计' },
      { key: 'adaptation', label: '适配设计' }
    ]},
    { key: 'graphic_design', label: '平面设计', subTypes: [] },
    { key: 'unity_dev', label: 'Unity开发', subTypes: [] },
    { key: 'video_edit', label: '视频剪辑', subTypes: [] },
    { key: '3d_modeling', label: '3D建模', subTypes: [] },
    { key: 'interaction_design', label: '交互设计', subTypes: [] },
    { key: 'internal_build', label: '内部建设', subTypes: [] }
  ],
  departments: [
    { key: 'brand', label: '品牌部' },
    { key: 'operation', label: '运营部' },
    { key: 'rd_center', label: '研发中心' },
    { key: 'marketing', label: '市场部' },
    { key: 'ceo_office', label: '总裁办' }
  ],
  platforms: [
    { key: 'web', label: 'Web' },
    { key: 'ios', label: 'iOS' },
    { key: 'android', label: 'Android' },
    { key: 'pc', label: 'PC' },
    { key: 'print', label: 'Print' },
    { key: 'social', label: 'Social Media' }
  ],
  levels: [
    { key: 'S', label: 'S', color: '#fee2e2' },
    { key: 'A', label: 'A', color: '#ffedd5' },
    { key: 'B', label: 'B', color: '#dbeafe' },
    { key: 'C', label: 'C', color: '#f3f4f6' }
  ],
  attributes: [
    { key: 'strategic', label: '战略项目' },
    { key: 'routine', label: '常规需求' },
    { key: 'incident', label: '突发支持' },
    { key: 'research', label: '技术预研' }
  ],
  stages: [
    { key: 'not_started', label: '未开始', color: '#f3f4f6' },
    { key: 'ongoing', label: '进行中', color: '#dcfce7' },
    { key: 'testing', label: '测试中', color: '#e0e7ff' },
    { key: 'accepted', label: '已验收', color: '#d1fae5' },
    { key: 'published', label: '已发布', color: '#ccfbf1' },
    { key: 'paused', label: '暂停', color: '#fee2e2' }
  ],
  projectColumnOrder: [
    'level', 'name', 'details', 'type', 'stage', 
    'platform', 'startTime', 'attribute', 'department', 
    'owner', 'contact'
  ],
  reportTemplates: [
    {
      id: 'default_standard',
      name: '标准管理版 (默认)',
      content: `【严格格式要求】
请严格按照以下Markdown格式输出，不要更改标题结构。

# 部门周报 ({startDate} 至 {endDate})

## 1. 本周重点工作总结
(基于输入数据，提炼3-5条核心成果，包括重点项目进展、团队管理成效、流程优化等)
- ...
- ...

## 2. 本周工作流水 (本周)
(将我的管理工作和对项目的监控，按天分配到上午和下午。若无具体时间，请根据逻辑合理编排)
### 周一
- **上午**: ...
- **下午**: ...
... (依次列出周二至周五) ...

## 3. 下周工作计划 (下周)
(根据本周进度推导下周计划，同样按每日上午、下午编排)
### 周一
- **上午**: ...
- **下午**: ...
... (依次列出下周二至周五) ...

## 4. 风险与需协调事项
- ...

[语气要求]: 专业、干练、管理视角。`
    }
  ],
  users: [] 
};

export const PROJECT_FIELD_LABELS: Record<string, string> = {
  level: '项目级别',
  name: '项目名称',
  details: '需求详情',
  type: '需求类型',
  stage: '阶段',
  platform: '开发平台',
  startTime: '开始时间',
  attribute: '项目属性',
  department: '归属部门',
  owner: '负责人',
  contact: '对接人'
};

export type ViewState = 'project-library' | 'member-log' | 'manager-notes' | 'smart-report' | 'reports' | 'settings';
export type UserRole = 'manager' | 'member';
