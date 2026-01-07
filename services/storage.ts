
import { startOfWeek } from 'date-fns/startOfWeek';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { subDays } from 'date-fns/subDays';
import PocketBase from 'pocketbase';
import { Project, WorkLog, ManagerNote, WeeklyReport, AppConfig, DEFAULT_CONFIG, User, TagConfig, TypeConfig, DictItem } from '../types';

const DEFAULT_SERVER_URL = 'http://106.55.198.216:8090';
const STORAGE_KEY_PB_URL = 'pocketbase_url';

const getServerUrl = () => {
  return localStorage.getItem(STORAGE_KEY_PB_URL) || DEFAULT_SERVER_URL;
};

export const pb = new PocketBase(getServerUrl());
pb.autoCancellation(false);

// 用于 Mock 模式下的跨组件通信
const mockEvents = new EventTarget();
const notifyMockChange = (collection: string) => {
  mockEvents.dispatchEvent(new CustomEvent('change', { detail: { collection } }));
};

export const updatePocketBaseUrl = (url: string) => {
  if (!url) {
    localStorage.removeItem(STORAGE_KEY_PB_URL);
  } else {
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = `http://${url}`;
    }
    localStorage.setItem(STORAGE_KEY_PB_URL, finalUrl);
  }
  window.location.reload();
};

export const getCurrentServerUrl = () => getServerUrl();

let _isMockMode = false;

export const enableMockMode = () => {
  _isMockMode = true;
  console.log("--- MOCK MODE ENABLED ---");
  seedMockData();
};

export const checkIsMockMode = () => _isMockMode;

const MOCK_KEYS = {
  PROJECTS: 'mock_projects',
  LOGS: 'mock_logs',
  NOTES: 'mock_notes',
  REPORTS: 'mock_reports',
  CONFIG: 'mock_config',
  USERS: 'mock_users'
};

const safeGetItem = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch (e) { return null; }
};
const safeSetItem = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch (e) {}
};

const seedMockData = () => {
  const today = new Date();
  const currentMonday = startOfWeek(today, { weekStartsOn: 1 });
  const mondayStr = format(currentMonday, 'yyyy-MM-dd');

  const demoUsers: User[] = [
    { id: 'mock_u1', username: 'admin', name: '张经理', role: 'manager' },
    { id: 'mock_u2', username: 'wang', name: '王大神', role: 'member' },
    { id: 'mock_u3', username: 'li', name: '李小美', role: 'member' }
  ];
  safeSetItem(MOCK_KEYS.USERS, JSON.stringify(demoUsers));

  if (!safeGetItem(MOCK_KEYS.CONFIG)) {
    safeSetItem(MOCK_KEYS.CONFIG, JSON.stringify({ ...DEFAULT_CONFIG, users: demoUsers }));
  }

  const demoProjects: Project[] = [
    { id: 'p_001', name: 'DesignOps 2.0 效能平台', level: 'S', details: '重构系统架构，提升 50% 运行效率', type: 'internal_build', stage: 'ongoing', platform: 'web', startTime: '2024-01-15', attribute: 'strategic', department: 'rd_center', owner: ['mock_u1'], contact: '陈总', createdBy: 'mock_u1' },
    { id: 'p_002', name: '双11大促UI迭代', level: 'A', details: '视觉延展与主会场组件化', type: 'ui_design', subType: 'iterative', stage: 'ongoing', platform: 'web', startTime: '2024-03-01', attribute: 'routine', department: 'brand', owner: ['mock_u2'], contact: '李总', createdBy: 'mock_u1' },
    { id: 'p_003', name: '品牌 IP 形象 3D 建模', level: 'B', details: '制作 5 个不同姿势的高精度模型', type: '3d_modeling', stage: 'testing', platform: 'pc', startTime: '2024-02-10', attribute: 'strategic', department: 'marketing', owner: ['mock_u3'], contact: '王主管', createdBy: 'mock_u1' },
    { id: 'p_004', name: '2024 营销官网重构', level: 'S', details: '全站响应式适配及交互升级', type: 'interaction_design', stage: 'ongoing', platform: 'web', startTime: '2024-03-15', attribute: 'strategic', department: 'marketing', owner: ['mock_u2', 'mock_u3'], contact: '赵总', createdBy: 'mock_u1' },
    { id: 'p_005', name: '内部管理系统图标库', level: 'C', details: '规范化 200+ 业务图标', type: 'ui_design', subType: 'expansion', stage: 'published', platform: 'web', startTime: '2024-01-05', attribute: 'routine', department: 'rd_center', owner: ['mock_u2'], contact: '刘工', createdBy: 'mock_u1' }
  ];
  safeSetItem(MOCK_KEYS.PROJECTS, JSON.stringify(demoProjects));

  const demoLogs: WorkLog[] = [
    { id: 'l_001', projectId: 'p_001', projectName: 'DesignOps 2.0 效能平台', projectDept: 'rd_center', projectType: 'internal_build', workerName: '张经理', content: '核心路由逻辑重构与状态管理优化', hours: 4, weekStartDate: mondayStr, created: new Date().toISOString(), createdBy: 'mock_u1' },
    { id: 'l_002', projectId: 'p_001', projectName: 'DesignOps 2.0 效能平台', projectDept: 'rd_center', projectType: 'internal_build', workerName: '张经理', content: '与前端团队沟通 API 对接规范', hours: 2, weekStartDate: mondayStr, created: new Date().toISOString(), createdBy: 'mock_u1' },
    { id: 'l_003', projectId: 'p_002', projectName: '双11大促UI迭代', projectDept: 'brand', projectType: 'ui_design', projectSubType: 'iterative', workerName: '王大神', content: '主会场背景合成与排版初稿完成', hours: 6, weekStartDate: mondayStr, created: new Date().toISOString(), createdBy: 'mock_u2' },
    { id: 'l_004', projectId: 'p_002', projectName: '双11大促UI迭代', projectDept: 'brand', projectType: 'ui_design', projectSubType: 'iterative', workerName: '王大神', content: '处理第二波预售活动 banner 延展', hours: 2, weekStartDate: mondayStr, created: new Date().toISOString(), createdBy: 'mock_u2' },
    { id: 'l_005', projectId: 'p_003', projectName: '品牌 IP 形象 3D 建模', projectDept: 'marketing', projectType: '3d_modeling', workerName: '李小美', content: 'IP 头部模型细化与拓扑优化', hours: 5, weekStartDate: mondayStr, created: new Date().toISOString(), createdBy: 'mock_u3' },
    { id: 'l_006', projectId: 'p_004', projectName: '2024 营销官网重构', projectDept: 'marketing', projectType: 'interaction_design', workerName: '李小美', content: '官网首页动效原型方案评审', hours: 3, weekStartDate: mondayStr, created: new Date().toISOString(), createdBy: 'mock_u3' },
    { id: 'l_007', projectId: 'p_004', projectName: '2024 营销官网重构', projectDept: 'marketing', projectType: 'interaction_design', workerName: '王大神', content: '协助李小美进行复杂交互逻辑的代码化实现', hours: 4, weekStartDate: mondayStr, created: new Date().toISOString(), createdBy: 'mock_u2' },
    { id: 'l_008', projectId: 'p_001', projectName: 'DesignOps 2.0 效能平台', projectDept: 'rd_center', projectType: 'internal_build', workerName: '王大神', content: '开发统计报表模块的实时同步功能', hours: 4, weekStartDate: mondayStr, created: new Date().toISOString(), createdBy: 'mock_u2' }
  ];
  safeSetItem(MOCK_KEYS.LOGS, JSON.stringify(demoLogs));
  
  const demoNotes: ManagerNote[] = [
    { id: 'n_001', content: '组织双11大促项目启动周会，确定视觉基调为“未来科技感”', date: `${mondayStr}T09:30:00`, relatedProjectId: 'p_002', expand: { relatedProjectId: demoProjects[1] } },
    { id: 'n_002', content: '评审官网重构动效方案，建议增加微交互反馈以提升用户体验', date: `${mondayStr}T14:00:00`, relatedProjectId: 'p_004', expand: { relatedProjectId: demoProjects[3] } },
    { id: 'n_003', content: 'DesignOps 平台架构基本跑通，下周进入业务模块全面开发', date: `${mondayStr}T17:00:00`, relatedProjectId: 'p_001', expand: { relatedProjectId: demoProjects[0] } }
  ];
  safeSetItem(MOCK_KEYS.NOTES, JSON.stringify(demoNotes));
};

const normalizeProject = (p: any): Project => {
  let owner: string[] = [];
  if (Array.isArray(p.owner)) {
    owner = p.owner;
  } else if (typeof p.owner === 'string' && p.owner.trim() !== '') {
    try {
      const parsed = JSON.parse(p.owner);
      owner = Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch (e) {
      owner = p.owner.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return { ...p, owner };
};

export const storage = {
  isMockMode: () => _isMockMode,
  updatePocketBaseUrl,
  getCurrentServerUrl,
  enableMockMode,

  // 实时订阅封装
  async subscribe(collection: string, callback: () => void) {
    if (_isMockMode) {
      const handler = (e: any) => {
        if (e.detail.collection === collection) callback();
      };
      mockEvents.addEventListener('change', handler);
      return () => mockEvents.removeEventListener('change', handler);
    } else {
      try {
        const unsubscribe = await pb.collection(collection).subscribe('*', () => {
          callback();
        });
        return unsubscribe;
      } catch (e) {
        console.error("Subscription failed:", e);
        return () => {};
      }
    }
  },
  
  async getProjects(page: number = 1, perPage: number = 50): Promise<{ items: Project[], totalItems: number }> {
    if (_isMockMode) {
      const all = (JSON.parse(safeGetItem(MOCK_KEYS.PROJECTS) || '[]')).map(normalizeProject);
      const start = (page - 1) * perPage;
      const slicedItems = all.slice(start, start + perPage);
      return {
        items: slicedItems,
        totalItems: all.length
      };
    }
    const result = await pb.collection('projects').getList(page, perPage, { 
      sort: '-created', 
      requestKey: null 
    });
    return {
      items: result.items.map(r => normalizeProject({ ...r, id: r.id })),
      totalItems: result.totalItems
    };
  },

  async saveProject(project: Partial<Project>) {
    const { id, ...dataToSave } = project;
    if (dataToSave.owner && Array.isArray(dataToSave.owner)) {
      dataToSave.owner = JSON.stringify(dataToSave.owner) as any;
    }
    if (_isMockMode) {
      const projects = JSON.parse(safeGetItem(MOCK_KEYS.PROJECTS) || '[]');
      if (id) {
        const idx = projects.findIndex((p: any) => p.id === id);
        if (idx !== -1) projects[idx] = { ...projects[idx], ...project };
      } else {
        projects.push({ ...project, id: 'p_' + Date.now() });
      }
      safeSetItem(MOCK_KEYS.PROJECTS, JSON.stringify(projects));
      notifyMockChange('projects');
      return;
    }
    if (id) await pb.collection('projects').update(id, dataToSave);
    else await pb.collection('projects').create(dataToSave);
  },

  async deleteProject(id: string) {
    if (_isMockMode) {
      const projects = JSON.parse(safeGetItem(MOCK_KEYS.PROJECTS) || '[]');
      safeSetItem(MOCK_KEYS.PROJECTS, JSON.stringify(projects.filter((p: any) => p.id !== id)));
      notifyMockChange('projects');
      return;
    }
    await pb.collection('projects').delete(id);
  },

  async getLogs(): Promise<WorkLog[]> {
    if (_isMockMode) {
      const logs = JSON.parse(safeGetItem(MOCK_KEYS.LOGS) || '[]');
      const projects = JSON.parse(safeGetItem(MOCK_KEYS.PROJECTS) || '[]');
      return logs.map((l: any) => {
        const proj = projects.find((p: any) => p.id === l.projectId);
        return { ...l, expand: proj ? { projectId: normalizeProject(proj) } : undefined };
      });
    }
    const records = await pb.collection('work_logs').getFullList({ 
      sort: '-created', expand: 'projectId', requestKey: null 
    });
    return records.map(r => ({ ...r, id: r.id } as any));
  },

  async saveLog(log: Partial<WorkLog>) {
    const { id, ...dataToSave } = log;
    if (_isMockMode) {
      const logs = JSON.parse(safeGetItem(MOCK_KEYS.LOGS) || '[]');
      if (id) {
        const idx = logs.findIndex((l: any) => l.id === id);
        if (idx !== -1) logs[idx] = { ...logs[idx], ...log };
      } else {
        logs.push({ ...log, id: 'l_' + Date.now(), created: new Date().toISOString() });
      }
      safeSetItem(MOCK_KEYS.LOGS, JSON.stringify(logs));
      notifyMockChange('work_logs');
      return;
    }
    if (id) await pb.collection('work_logs').update(id, dataToSave);
    else await pb.collection('work_logs').create(dataToSave);
  },

  async deleteLog(id: string) {
    if (_isMockMode) {
      const logs = JSON.parse(safeGetItem(MOCK_KEYS.LOGS) || '[]');
      safeSetItem(MOCK_KEYS.LOGS, JSON.stringify(logs.filter((l: any) => l.id !== id)));
      notifyMockChange('work_logs');
      return;
    }
    await pb.collection('work_logs').delete(id);
  },

  async getManagerNotes(): Promise<ManagerNote[]> {
    if (_isMockMode) return JSON.parse(safeGetItem(MOCK_KEYS.NOTES) || '[]');
    const records = await pb.collection('manager_notes').getFullList({ sort: '-date', expand: 'relatedProjectId', requestKey: null });
    return records.map(r => ({ ...r, id: r.id } as any));
  },

  async saveManagerNote(note: Partial<ManagerNote>) {
    const { id, ...dataToSave } = note;
    if (_isMockMode) {
      const notes = JSON.parse(safeGetItem(MOCK_KEYS.NOTES) || '[]');
      if (id) {
        const idx = notes.findIndex((n: any) => n.id === id);
        if (idx !== -1) notes[idx] = { ...notes[idx], ...note };
      } else {
        notes.push({ ...note, id: 'n_' + Date.now() });
      }
      safeSetItem(MOCK_KEYS.NOTES, JSON.stringify(notes));
      notifyMockChange('manager_notes');
      return;
    }
    if (id) await pb.collection('manager_notes').update(id, dataToSave);
    else await pb.collection('manager_notes').create(dataToSave);
  },

  async deleteManagerNote(id: string) {
    if (_isMockMode) {
      const notes = JSON.parse(safeGetItem(MOCK_KEYS.NOTES) || '[]');
      safeSetItem(MOCK_KEYS.NOTES, JSON.stringify(notes.filter((n: any) => n.id !== id)));
      notifyMockChange('manager_notes');
      return;
    }
    await pb.collection('manager_notes').delete(id);
  },

  async getWeeklyReports(): Promise<WeeklyReport[]> {
    if (_isMockMode) return JSON.parse(safeGetItem(MOCK_KEYS.REPORTS) || '[]');
    const records = await pb.collection('weekly_reports').getFullList({ sort: '-created', requestKey: null });
    return records.map(r => ({ ...r, id: r.id } as any));
  },

  async saveWeeklyReport(report: Partial<WeeklyReport>) {
    const { id, ...dataToSave } = report;
    if (_isMockMode) {
      const reports = JSON.parse(safeGetItem(MOCK_KEYS.REPORTS) || '[]');
      if (id) {
        const idx = reports.findIndex((r: any) => r.id === id);
        if (idx !== -1) reports[idx] = { ...reports[idx], ...report };
      } else {
        reports.push({ ...report, id: 'r_' + Date.now(), created: new Date().toISOString() });
      }
      safeSetItem(MOCK_KEYS.REPORTS, JSON.stringify(reports));
      notifyMockChange('weekly_reports');
      return;
    }
    if (id) await pb.collection('weekly_reports').update(id, dataToSave);
    else await pb.collection('weekly_reports').create(dataToSave);
  },

  async deleteWeeklyReport(id: string) {
    if (_isMockMode) {
      const reports = JSON.parse(safeGetItem(MOCK_KEYS.REPORTS) || '[]');
      safeSetItem(MOCK_KEYS.REPORTS, JSON.stringify(reports.filter((r: any) => r.id !== id)));
      notifyMockChange('weekly_reports');
      return;
    }
    await pb.collection('weekly_reports').delete(id);
  },

  async getConfig(): Promise<AppConfig> {
    const users = await this.getUsers();
    if (_isMockMode) {
      const config = JSON.parse(safeGetItem(MOCK_KEYS.CONFIG) || 'null');
      return { ...(config || DEFAULT_CONFIG), users };
    }
    const records = await pb.collection('app_config').getFullList({ requestKey: null });
    const dbConfig = records.length > 0 ? records[0].data : {};
    return { ...DEFAULT_CONFIG, ...dbConfig, users };
  },

  async saveConfig(config: AppConfig) {
    const { users, ...configData } = config;
    if (_isMockMode) {
      safeSetItem(MOCK_KEYS.CONFIG, JSON.stringify(config));
      notifyMockChange('app_config');
      return;
    }
    const records = await pb.collection('app_config').getFullList({ requestKey: null });
    if (records.length > 0) {
      await pb.collection('app_config').update(records[0].id, { data: configData });
    } else {
      await pb.collection('app_config').create({ data: configData });
    }
  },

  async getUsers(): Promise<User[]> {
    if (_isMockMode) return JSON.parse(safeGetItem(MOCK_KEYS.USERS) || '[]');
    try {
      const records = await pb.collection('users').getFullList({ sort: '-created', requestKey: null });
      return records.map(r => ({ 
        id: r.id, username: r.username, name: r.name || r.username, role: (r.role as any) || 'member' 
      }));
    } catch (e) { return []; }
  },

  async saveUser(user: Partial<User>) {
    const { id, ...dataToSave } = user;
    if (_isMockMode) {
      const users = JSON.parse(safeGetItem(MOCK_KEYS.USERS) || '[]');
      if (id) {
        const idx = users.findIndex((u: any) => u.id === id);
        if (idx !== -1) users[idx] = { ...users[idx], ...user };
      } else {
        users.push({ ...user, id: 'u_' + Date.now() });
      }
      safeSetItem(MOCK_KEYS.USERS, JSON.stringify(users));
      notifyMockChange('users');
      return;
    }
    if (id) {
      if (!dataToSave.password) delete dataToSave.password;
      await pb.collection('users').update(id, dataToSave);
    } else {
      await pb.collection('users').create({
        ...dataToSave,
        passwordConfirm: dataToSave.password,
        emailVisibility: true
      });
    }
  },

  async deleteUser(id: string) {
    if (_isMockMode) {
      const users = JSON.parse(safeGetItem(MOCK_KEYS.USERS) || '[]');
      safeSetItem(MOCK_KEYS.USERS, JSON.stringify(users.filter((u: any) => u.id !== id)));
      notifyMockChange('users');
      return;
    }
    await pb.collection('users').delete(id);
  }
};
