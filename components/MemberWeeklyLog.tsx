import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { storage } from '../services/storage';
import { Project, WorkLog, AppConfig, UserRole, DEFAULT_CONFIG, TagConfig, DictItem } from '../types';
// Fixed date-fns imports by using specific function modules to ensure type resolution
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { Calendar, Save, Trash2, Plus, Clock, Search, X, UserCircle, Download, ChevronDown, Check, Pencil, AlertTriangle, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Users, TrendingUp, AlertCircle, Mic, Sparkles, Copy, History } from 'lucide-react';
import { ResizableTh } from './TableCommon';
import { exportToCSV } from '../services/exportService';
import { generatePresentationSuggestion, PresentationSuggestion, PresentationStyle, PRESENTATION_STYLES } from '../services/geminiService';
import { EmptyState } from './EmptyState';
import { ColumnManager, ColumnConfig } from './ColumnManager';

const getLabelFromDict = (list: DictItem[], key: string) => {
  if (!key) return '-';
  const item = list.find(i => i.key === key);
  if (item) return item.label;
  const legacyItem = list.find(i => i.label === key);
  if (legacyItem) return legacyItem.label;
  return key;
};

// 辅助函数：将周一日期转换为区间字符串
const getWeekRangeLabel = (mondayStr: string) => {
  try {
    const start = parseISO(mondayStr);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return `${format(start, 'yyyy-MM-dd')} 到 ${format(end, 'yyyy-MM-dd')}`;
  } catch (e) {
    return mondayStr;
  }
};

// 可排序的表头组件
interface SortableResizableThProps {
  width: number;
  onResize: (w: number) => void;
  sortField: string;
  currentSortField: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
  children: React.ReactNode;
}

const SortableResizableTh: React.FC<SortableResizableThProps> = ({
  width,
  onResize,
  sortField,
  currentSortField,
  sortDirection,
  onSort,
  className = '',
  children
}) => {
  const isActive = currentSortField === sortField;
  const thRef = useRef<HTMLTableCellElement>(null);
  
  const handleClick = (e: React.MouseEvent) => {
    // 如果点击的是调整大小的区域（右侧边缘），不触发排序
    const target = e.target as HTMLElement;
    if (thRef.current) {
      const rect = thRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      // 如果点击在右侧 10px 内，认为是调整大小操作
      if (clickX > width - 10) {
        return;
      }
    }
    // 如果点击的是排序图标，也不触发（避免重复）
    if (target.closest('svg')) {
      return;
    }
    onSort(sortField);
  };

  return (
    <th
      ref={thRef}
      className={`relative group bg-slate-50 text-left text-sm font-semibold text-slate-700 border-b border-slate-200 select-none cursor-pointer hover:bg-slate-100 transition-colors ${className}`}
      style={{ width, minWidth: 60 }}
      onClick={handleClick}
    >
      <div className="flex items-center h-full px-4 py-2.5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">
        <span className="flex items-center gap-2">
          <span>{children}</span>
          <div className="flex flex-col">
            {isActive ? (
              sortDirection === 'asc' ? (
                <ArrowUp size={12} className="text-indigo-600" />
              ) : (
                <ArrowDown size={12} className="text-indigo-600" />
              )
            ) : (
              <ArrowUpDown size={12} className="text-slate-300" />
            )}
          </div>
        </span>
      </div>
      
      {/* Resizer Handle - 复用 ResizableTh 的逻辑 */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (thRef.current) {
            const startX = e.pageX;
            const startWidth = thRef.current.offsetWidth;
            const handleMouseMove = (e: MouseEvent) => {
              const diffX = e.pageX - startX;
              const newWidth = Math.max(60, startWidth + diffX);
              onResize(newWidth);
            };
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
              document.body.style.cursor = 'default';
              document.body.style.userSelect = '';
            };
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }
        }}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 z-10 transition-colors"
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Visual Border Divider */}
      <div className="absolute right-0 top-2 bottom-2 w-px bg-slate-200 pointer-events-none" />
    </th>
  );
};

interface ProjectSelectorProps {
  projects: Project[];
  config: AppConfig;
  value: string;
  onChange: (projectId: string) => void;
  recentProjectIds?: string[]; // 最近使用的项目ID列表
  currentWorker?: string; // 当前填写人，用于筛选最近项目
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, config, value, onChange, recentProjectIds = [], currentWorker }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedProject = useMemo(() => projects.find(p => p.id === value), [projects, value]);

  useEffect(() => {
    if (selectedProject) setSearchTerm(selectedProject.name);
    else if (!value) setSearchTerm('');
  }, [selectedProject, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedProject) setSearchTerm(selectedProject.name);
        else setSearchTerm(''); 
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProject]);

  // 最近使用的项目（优先显示，最多取前3个用于小标签）
  const recentProjects = useMemo(() => {
    return recentProjectIds
      .map(id => projects.find(p => p.id === id))
      .filter((p): p is Project => p !== undefined);
  }, [recentProjectIds, projects]);

  // 用于显示在输入框下方的小标签（最多3个）
  const recentProjectsForTags = useMemo(() => {
    return recentProjects.slice(0, 3);
  }, [recentProjects]);

  // 其他项目
  const otherProjects = useMemo(() => {
    const recentSet = new Set(recentProjectIds);
    return projects.filter(p => !recentSet.has(p.id));
  }, [projects, recentProjectIds]);

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return { recent: recentProjects, others: otherProjects };
    const filterFunc = (p: Project) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.includes(searchTerm);
    return {
      recent: recentProjects.filter(filterFunc),
      others: otherProjects.filter(filterFunc)
    };
  }, [recentProjects, otherProjects, searchTerm]);

  const renderProjectItem = (p: Project) => (
    <div 
      key={p.id} 
      className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 ${p.id === value ? 'bg-indigo-50' : ''}`} 
      onClick={() => { onChange(p.id); setSearchTerm(p.name); setIsOpen(false); }}
    >
      <div className="font-bold text-slate-800 text-sm truncate">{p.name}</div>
      <div className="text-[10px] text-slate-400 uppercase tracking-widest flex gap-2">
        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{getLabelFromDict(config.departments, p.department)}</span>
        <span className="text-slate-300">|</span>
        <span>{getLabelFromDict(config.types, p.type)}</span>
      </div>
    </div>
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <input 
        type="text" 
        className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm focus:bg-white focus:border-indigo-400 outline-none font-bold text-slate-700" 
        placeholder="查找关联项目..." 
        value={searchTerm} 
        onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); if (e.target.value === '') onChange(''); }} 
        onFocus={() => setIsOpen(true)} 
      />
      {/* 最近项目小标签（最多3个） */}
      {!isOpen && !value && recentProjectsForTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {recentProjectsForTags.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id);
                setSearchTerm(p.name);
              }}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 rounded-lg text-xs font-bold text-indigo-700 transition-all flex items-center gap-1.5"
            >
              <Clock size={12} className="text-indigo-500" />
              <span className="truncate max-w-[120px]">{p.name}</span>
            </button>
          ))}
        </div>
      )}
      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {/* 最近使用的项目 */}
          {!searchTerm && recentProjects.length > 0 && (
            <>
              <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 sticky top-0">
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-indigo-600" />
                  <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">最近使用</span>
                </div>
              </div>
              {recentProjects.map(renderProjectItem)}
            </>
          )}
          
          {/* 搜索结果或全部项目 */}
          {filteredProjects.recent.length > 0 && filteredProjects.recent.map(renderProjectItem)}
          {filteredProjects.others.length > 0 && (
            <>
              {!searchTerm && recentProjects.length > 0 && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 sticky top-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">全部项目</span>
                </div>
              )}
              {filteredProjects.others.map(renderProjectItem)}
            </>
          )}
          
          {filteredProjects.recent.length === 0 && filteredProjects.others.length === 0 && (
            <div className="px-4 py-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                <Search size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500">未找到匹配项目</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const MemberWeeklyLog: React.FC<{ userRole: UserRole, currentUser: string, currentUserId: string }> = ({ userRole, currentUser, currentUserId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedViewWeek, setSelectedViewWeek] = useState<string>(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [deleteLogConfirmId, setDeleteLogConfirmId] = useState<string | null>(null);
  const [formWeekStart, setFormWeekStart] = useState<string>(selectedViewWeek);
  const [targetWorker, setTargetWorker] = useState<string>(currentUser);
  const [formRows, setFormRows] = useState<any[]>([{ tempId: '1', projectId: '', content: '', hours: 0 }]);
  const [isEditing, setIsEditing] = useState(false);
  
  // 汇报建议相关状态
  const [presentationSuggestion, setPresentationSuggestion] = useState<PresentationSuggestion | null>(null);
  const [isPresentationModalOpen, setIsPresentationModalOpen] = useState(false);
  const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);
  const [presentationStyle, setPresentationStyle] = useState<PresentationStyle>('formal');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [savedSuggestions, setSavedSuggestions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSuggestionId, setCurrentSuggestionId] = useState<string | null>(null);
  const styleSelectorRef = useRef<HTMLDivElement>(null);
  
  // 成功动画相关状态
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  
  // 按人员工时统计折叠状态
  const [isHoursByWorkerExpanded, setIsHoursByWorkerExpanded] = useState(true);

  // 点击外部关闭风格选择器
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (styleSelectorRef.current && !styleSelectorRef.current.contains(event.target as Node)) {
        setShowStyleSelector(false);
      }
    }
    if (showStyleSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStyleSelector]);
  
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    attribute: 100, level: 80, dept: 120, name: 200, type: 150, content: 400, worker: 100, hours: 80, actions: 100
  });

  // 列配置
  const defaultColumns: ColumnConfig[] = [
    { key: 'attribute', label: '属性', visible: true },
    { key: 'level', label: '级别', visible: true },
    { key: 'dept', label: '部门', visible: true },
    { key: 'name', label: '项目名称', visible: true },
    { key: 'type', label: '类型', visible: true },
    { key: 'content', label: '工作内容', visible: true },
    { key: 'worker', label: '填写人', visible: true },
    { key: 'hours', label: '工时', visible: true }
  ];
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(defaultColumns);

  // 排序状态
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { 
    fetchData();
    if (userRole === 'manager') {
      fetchSavedSuggestions();
    }
  }, [userRole, selectedViewWeek]);
  
  const fetchSavedSuggestions = async () => {
    try {
      const suggestions = await storage.getPresentationSuggestions(selectedViewWeek);
      setSavedSuggestions(suggestions);
      // 如果有当前周期的建议，自动加载最新的
      if (suggestions.length > 0) {
        const latest = suggestions[0];
        if (latest.style === presentationStyle) {
          setPresentationSuggestion({
            outline: latest.outline,
            talkingPoints: latest.talkingPoints,
            qa: latest.qa,
            duration: latest.duration
          });
          setCurrentSuggestionId(latest.id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch saved suggestions:', e);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedConfig, projectResult, fetchedLogs] = await Promise.all([ 
        storage.getConfig(), 
        storage.getProjects(1, 1000), 
        storage.getLogs() 
      ]);
      setConfig(fetchedConfig);
      setProjects(projectResult.items);
      setLogs(fetchedLogs);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const viewLogs = useMemo(() => {
    let filtered = logs.filter(l => l.weekStartDate === selectedViewWeek);
    
    // 排序逻辑
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const projectA = projects.find(p => p.id === a.projectId) || a.expand?.projectId;
        const projectB = projects.find(p => p.id === b.projectId) || b.expand?.projectId;
        
        let valueA: any;
        let valueB: any;
        
        switch (sortField) {
          case 'attribute':
            valueA = projectA?.attribute || '';
            valueB = projectB?.attribute || '';
            // 转换为标签进行排序
            valueA = getLabelFromDict(config.attributes, valueA);
            valueB = getLabelFromDict(config.attributes, valueB);
            break;
          case 'level':
            valueA = projectA?.level || '';
            valueB = projectB?.level || '';
            // 转换为标签进行排序
            valueA = getLabelFromDict(config.levels, valueA);
            valueB = getLabelFromDict(config.levels, valueB);
            break;
          case 'type':
            const typeA = projectA?.type || a.projectType || '';
            const typeB = projectB?.type || b.projectType || '';
            valueA = getLabelFromDict(config.types, typeA);
            valueB = getLabelFromDict(config.types, typeB);
            break;
          case 'worker':
            valueA = a.workerName || '';
            valueB = b.workerName || '';
            break;
          case 'hours':
            valueA = a.hours || 0;
            valueB = b.hours || 0;
            break;
          default:
            return 0;
        }
        
        // 字符串比较
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return sortDirection === 'asc' 
            ? valueA.localeCompare(valueB, 'zh-CN')
            : valueB.localeCompare(valueA, 'zh-CN');
        }
        
        // 数字比较
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        return 0;
      });
    }
    
    return filtered;
  }, [logs, selectedViewWeek, sortField, sortDirection, projects, config]);

  // 计算未填写成员（仅 manager 可见）
  const unfilledMembers = useMemo(() => {
    if (userRole !== 'manager') return [];
    const filledMembers = new Set(viewLogs.map(log => log.workerName));
    return config.users
      .filter(u => u.role === 'member')
      .filter(u => !filledMembers.has(u.name));
  }, [viewLogs, config.users, userRole]);

  // 工时统计
  const hoursStats = useMemo(() => {
    const totalHours = viewLogs.reduce((sum, log) => sum + (log.hours || 0), 0);
    const uniqueWorkers = new Set(viewLogs.map(log => log.workerName));
    const avgHours = uniqueWorkers.size > 0 ? totalHours / uniqueWorkers.size : 0;
    
    // 按人员统计工时
    const hoursByWorker: Record<string, number> = {};
    viewLogs.forEach(log => {
      const name = log.workerName;
      hoursByWorker[name] = (hoursByWorker[name] || 0) + (log.hours || 0);
    });
    
    return {
      totalHours,
      avgHours,
      workerCount: uniqueWorkers.size,
      hoursByWorker
    };
  }, [viewLogs]);

  // 计算最近使用的项目（基于当前用户的历史记录）
  const recentProjectIds = useMemo(() => {
    const workerLogs = logs
      .filter(log => log.workerName === targetWorker)
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    
    const projectIdSet = new Set<string>();
    const recentIds: string[] = [];
    
    for (const log of workerLogs) {
      if (log.projectId && !projectIdSet.has(log.projectId)) {
        projectIdSet.add(log.projectId);
        recentIds.push(log.projectId);
        if (recentIds.length >= 5) break; // 最多5个
      }
    }
    
    return recentIds;
  }, [logs, targetWorker]);

  // 草稿保存键（使用 useCallback 避免重复创建函数）
  const getDraftKey = useCallback(() => {
    return `worklog_draft_${currentUserId}_${formWeekStart}_${targetWorker}`;
  }, [currentUserId, formWeekStart, targetWorker]);

  // 清除草稿
  const clearDraft = useCallback(() => {
    const key = `worklog_draft_${currentUserId}_${formWeekStart}_${targetWorker}`;
    localStorage.removeItem(key);
    setHasDraft(false);
  }, [currentUserId, formWeekStart, targetWorker]);

  // 加载草稿
  const loadDraft = useCallback(() => {
    try {
      const key = `worklog_draft_${currentUserId}_${formWeekStart}_${targetWorker}`;
      const draftData = localStorage.getItem(key);
      if (draftData) {
        const draft = JSON.parse(draftData);
        if (draft.formWeekStart) setFormWeekStart(draft.formWeekStart);
        if (draft.targetWorker) setTargetWorker(draft.targetWorker);
        if (draft.formRows) setFormRows(draft.formRows);
        setHasDraft(true);
        return true;
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
    }
    return false;
  }, [currentUserId, formWeekStart, targetWorker]);

  // 自动保存草稿（使用防抖，每次表单变化后延迟保存）
  useEffect(() => {
    if (!isModalOpen || isEditing) return;
    
    // 清除之前的定时器
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    
    // 检查是否有实际内容
    const hasContent = formRows.some(r => r.projectId || r.content || r.hours);
    if (!hasContent) {
      // 如果没有内容，清除草稿
      clearDraft();
      return;
    }
    
    // 延迟保存（3秒防抖，避免频繁保存）
    autoSaveTimerRef.current = window.setTimeout(() => {
      const key = `worklog_draft_${currentUserId}_${formWeekStart}_${targetWorker}`;
      const draftData = {
        formWeekStart,
        targetWorker,
        formRows,
        savedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(key, JSON.stringify(draftData));
        setHasDraft(true);
      } catch (e) {
        console.error('Failed to save draft:', e);
      }
    }, 3000); // 3秒防抖保存
    
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formRows, formWeekStart, targetWorker, isModalOpen, isEditing, currentUserId, clearDraft]);

  // 打开弹窗时检查草稿（只在首次打开时检查，避免重复询问）
  const hasCheckedDraft = useRef(false);
  useEffect(() => {
    if (isModalOpen && !isEditing && !hasCheckedDraft.current) {
      hasCheckedDraft.current = true;
      const key = `worklog_draft_${currentUserId}_${formWeekStart}_${targetWorker}`;
      const draftData = localStorage.getItem(key);
      setHasDraft(!!draftData);
      
      // 如果有草稿，询问用户是否恢复
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          const savedAt = new Date(draft.savedAt);
          const timeAgo = Math.floor((Date.now() - savedAt.getTime()) / 1000 / 60); // 分钟
          const timeStr = timeAgo < 1 ? '刚刚' : timeAgo < 60 ? `${timeAgo}分钟前` : `${Math.floor(timeAgo / 60)}小时前`;
          const shouldRestore = window.confirm(
            `检测到未保存的草稿（${timeStr}保存），是否恢复？`
          );
          if (shouldRestore) {
            loadDraft();
          } else {
            clearDraft();
          }
        } catch (e) {
          console.error('Failed to parse draft:', e);
          clearDraft();
        }
      }
    }
    // 弹窗关闭时重置标记
    if (!isModalOpen) {
      hasCheckedDraft.current = false;
    }
  }, [isModalOpen, isEditing, loadDraft, clearDraft, currentUserId, formWeekStart, targetWorker]);

  // 计算表单统计
  const formStats = useMemo(() => {
    const validRows = formRows.filter(r => r.projectId && r.content);
    const totalHours = validRows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
    const projectCount = new Set(validRows.map(r => r.projectId)).size;
    
    // 按项目统计工时
    const hoursByProject: Record<string, number> = {};
    validRows.forEach(row => {
      const project = projects.find(p => p.id === row.projectId);
      const projectName = project?.name || row.projectId;
      hoursByProject[projectName] = (hoursByProject[projectName] || 0) + (Number(row.hours) || 0);
    });
    
    return {
      validRows,
      totalHours,
      projectCount,
      hoursByProject,
      rowCount: validRows.length
    };
  }, [formRows, projects]);

  // 实际提交逻辑
  const doSubmit = async () => {
    const { validRows } = formStats;
    if (validRows.length === 0) {
      alert("请至少填写一行有效记录");
      return;
    }
    
    setIsSaving(true);
    try {
      for (const row of validRows) {
        const project = projects.find(p => p.id === row.projectId);
        if (!project) continue;
        const logData: Partial<WorkLog> = {
          ...(row.id ? { id: row.id } : {}), 
          projectId: row.projectId,
          projectName: project.name,
          projectDept: project.department,
          projectType: project.type,
          projectSubType: project.subType,
          projectPlatform: project.platform,
          workerName: targetWorker,
          content: row.content,
          hours: Number(row.hours),
          weekStartDate: formWeekStart,
          createdBy: row.id ? row.originalCreatedBy : currentUserId
        };
        await storage.saveLog(logData);
      }
      
      // 清除草稿
      clearDraft();
      
      // 更新数据
      const updatedLogs = await storage.getLogs();
      setLogs(updatedLogs);
      
      // 关闭主弹窗
      setIsModalOpen(false);
      
      // 显示成功动画
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2500);
      
    } catch (e) { 
      alert("提交失败：" + (e instanceof Error ? e.message : String(e))); 
    } finally { 
      setIsSaving(false); 
    }
  };

  // 直接提交（取消预览）
  const handleSubmit = () => {
    doSubmit();
  };

  const handleExport = () => {
    const headers: Record<string, string> = {
      week: '填报周期'
    };
    columnConfig.filter(col => col.visible).forEach(col => {
      headers[col.key === 'name' ? 'projectName' : col.key] = col.label;
    });

    const exportData = viewLogs.map(log => {
      const projectFromLibrary = projects.find(p => p.id === log.projectId);
      const realProject = log.expand?.projectId || projectFromLibrary || {} as Partial<Project>;
      
      const currentAttribute = realProject.attribute || '';
      const currentLevel = realProject.level || '';
      const currentDept = realProject.department || log.projectDept || '';
      const currentMajorType = realProject.type || log.projectType || '';
      const currentSubType = realProject.subType || log.projectSubType || '';

      const majorLabel = getLabelFromDict(config.types, currentMajorType);
      const subLabel = currentMajorType && currentSubType ? getLabelFromDict(config.types.find(t => t.key === currentMajorType || t.label === currentMajorType)?.subTypes || [], currentSubType) : '';

      const row: any = {
        week: getWeekRangeLabel(log.weekStartDate)
      };
      
      columnConfig.filter(col => col.visible).forEach(col => {
        const exportKey = col.key === 'name' ? 'projectName' : col.key;
        switch (col.key) {
          case 'attribute':
            row[exportKey] = getLabelFromDict(config.attributes, currentAttribute);
            break;
          case 'level':
            row[exportKey] = getLabelFromDict(config.levels, currentLevel);
            break;
          case 'dept':
            row[exportKey] = getLabelFromDict(config.departments, currentDept);
            break;
          case 'name':
            row[exportKey] = realProject.name || log.projectName;
            break;
          case 'type':
            row[exportKey] = subLabel ? `${majorLabel} (${subLabel})` : majorLabel;
            break;
          case 'content':
            row[exportKey] = log.content;
            break;
          case 'worker':
            row[exportKey] = log.workerName;
            break;
          case 'hours':
            row[exportKey] = log.hours;
            break;
        }
      });

      return row;
    });

    exportToCSV(exportData, headers, `工时台账_${selectedViewWeek}`);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      // 如果点击的是当前排序列，切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 如果点击的是新列，设置为升序
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleGeneratePresentation = async (isRegenerate = false) => {
    if (viewLogs.length === 0) {
      alert("本周暂无工时记录，无法生成汇报建议");
      return;
    }
    
    setIsGeneratingPresentation(true);
    setShowStyleSelector(false);
    try {
      const notes = await storage.getManagerNotes();
      const suggestion = await generatePresentationSuggestion(
        viewLogs,
        projects,
        notes,
        selectedViewWeek,
        presentationStyle
      );
      
      // 保存到数据库（会覆盖同周期同风格的记录）
      const saved = await storage.savePresentationSuggestion({
        weekStartDate: selectedViewWeek,
        style: presentationStyle,
        outline: suggestion.outline,
        talkingPoints: suggestion.talkingPoints,
        qa: suggestion.qa,
        duration: suggestion.duration,
        ...(currentSuggestionId && isRegenerate ? { id: currentSuggestionId } : {})
      });
      
      setPresentationSuggestion(suggestion);
      setCurrentSuggestionId(saved.id);
      setIsPresentationModalOpen(true);
      
      // 刷新历史记录
      await fetchSavedSuggestions();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("生成汇报建议失败:", e);
      alert(`生成汇报建议失败：${errorMessage}\n\n请检查：\n1. API Key 是否正确配置\n2. 网络连接是否正常\n3. 控制台是否有详细错误信息`);
    } finally {
      setIsGeneratingPresentation(false);
    }
  };
  
  const handleLoadSuggestion = (suggestion: any) => {
    setPresentationSuggestion({
      outline: suggestion.outline,
      talkingPoints: suggestion.talkingPoints,
      qa: suggestion.qa,
      duration: suggestion.duration
    });
    setPresentationStyle(suggestion.style as PresentationStyle);
    setCurrentSuggestionId(suggestion.id);
    setIsPresentationModalOpen(true);
    setShowHistory(false);
  };

  const confirmDelete = async () => {
    if (deleteLogConfirmId) {
      setIsDeleting(true);
      try {
        await storage.deleteLog(deleteLogConfirmId);
        const updatedLogs = await storage.getLogs();
        setLogs(updatedLogs);
        setDeleteLogConfirmId(null);
      } catch (e) {
        alert("删除失败");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-400" /></div>;

  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight mb-2">
            <Clock className="text-indigo-600" size={32} />
            团队工作台账
          </h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            成员工时统计与任务交付追踪
          </p>
        </div>
        <div className="flex items-center gap-4">
           <select value={selectedViewWeek} onChange={(e) => setSelectedViewWeek(e.target.value)} className="h-11 bg-white border border-slate-200 px-5 rounded-xl text-sm font-bold shadow-sm outline-none">
             {Array.from(new Set([format(startOfWeek(new Date(), {weekStartsOn: 1}), 'yyyy-MM-dd'), ...logs.map(l => l.weekStartDate)])).sort().reverse().map(w => ( <option key={w} value={w}>{getWeekRangeLabel(w)}</option> ))}
           </select>
           <ColumnManager
             columns={columnConfig}
             onColumnsChange={setColumnConfig}
             storageKey="member_log_column_config"
             title="工作台账列管理"
           />
           <button onClick={handleExport} className="h-11 flex items-center gap-2 border border-slate-200 bg-white text-slate-600 px-6 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-black text-sm uppercase shadow-sm hover:shadow-md"> <Download size={20} /> 导出台账 </button>
           {userRole === 'manager' && (
             <div className="relative" ref={styleSelectorRef}>
               <div className="flex items-center gap-2">
                 <button
                   onClick={() => setShowStyleSelector(!showStyleSelector)}
                   disabled={isGeneratingPresentation || viewLogs.length === 0}
                   className="h-11 flex items-center gap-2 border border-violet-200 bg-violet-50 text-violet-700 px-4 rounded-xl hover:bg-violet-100 transition-all font-bold text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                   title="选择汇报风格"
                 >
                   <Sparkles size={16} />
                   {PRESENTATION_STYLES[presentationStyle].label}
                   <ChevronDown size={14} className={showStyleSelector ? 'rotate-180' : ''} />
                 </button>
                 <button 
                   onClick={() => handleGeneratePresentation(false)} 
                   disabled={isGeneratingPresentation || viewLogs.length === 0}
                   className="h-11 flex items-center gap-2 border border-violet-200 bg-violet-50 text-violet-700 px-6 rounded-xl hover:bg-violet-100 transition-all font-black text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isGeneratingPresentation ? <Loader2 className="animate-spin" size={20} /> : <Mic size={20} />}
                   {isGeneratingPresentation ? '生成中...' : currentSuggestionId ? '重新生成' : '生成汇报建议'}
                 </button>
                 {savedSuggestions.length > 0 && (
                   <div className="relative">
                     <button
                       onClick={() => setShowHistory(!showHistory)}
                       className="h-11 flex items-center gap-2 border border-slate-200 bg-white text-slate-600 px-4 rounded-xl hover:bg-slate-50 transition-all font-bold text-xs uppercase"
                       title="查看历史记录"
                     >
                       <History size={16} />
                       历史 ({savedSuggestions.length})
                     </button>
                     
                     {showHistory && (
                       <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 max-h-96 overflow-y-auto">
                         <div className="flex items-center justify-between mb-4">
                           <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">历史记录</h4>
                           <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-900">
                             <X size={16} />
                           </button>
                         </div>
                         <div className="space-y-2">
                           {savedSuggestions.map((suggestion) => (
                             <div
                               key={suggestion.id}
                               onClick={() => handleLoadSuggestion(suggestion)}
                               className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                 currentSuggestionId === suggestion.id
                                   ? 'bg-violet-50 border-violet-500'
                                   : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                               }`}
                             >
                               <div className="flex items-center justify-between mb-2">
                                 <span className="text-xs font-black text-slate-900">
                                   {PRESENTATION_STYLES[suggestion.style as PresentationStyle]?.label || suggestion.style}
                                 </span>
                                 <span className="text-[10px] text-slate-400 font-bold">
                                   {new Date(suggestion.updated || suggestion.created).toLocaleString('zh-CN', {
                                     month: 'short',
                                     day: 'numeric',
                                     hour: '2-digit',
                                     minute: '2-digit'
                                   })}
                                 </span>
                               </div>
                               <div className="text-xs text-slate-600 font-medium">
                                 {suggestion.outline.slice(0, 2).join('、')}...
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )}
               </div>
               
               {showStyleSelector && (
                 <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4">
                   <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">选择汇报风格</div>
                   <div className="grid grid-cols-1 gap-2">
                     {(Object.keys(PRESENTATION_STYLES) as PresentationStyle[]).map(style => (
                       <button
                         key={style}
                         onClick={() => {
                           setPresentationStyle(style);
                           setShowStyleSelector(false);
                         }}
                         className={`p-3 rounded-xl text-left transition-all ${
                           presentationStyle === style
                             ? 'bg-violet-50 border-2 border-violet-500'
                             : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                         }`}
                       >
                         <div className="flex items-center justify-between mb-1">
                           <span className="text-sm font-black text-slate-900">{PRESENTATION_STYLES[style].label}</span>
                           {presentationStyle === style && <Check size={16} className="text-violet-600" />}
                         </div>
                         <p className="text-xs text-slate-500 font-medium">{PRESENTATION_STYLES[style].description}</p>
                       </button>
                     ))}
                   </div>
                 </div>
               )}
             </div>
           )}
           <button 
             onClick={() => { 
               setIsEditing(false); 
               setFormWeekStart(selectedViewWeek); 
               setTargetWorker(currentUser); 
               setFormRows([{ tempId: '1', projectId: '', content: '', hours: 0 }]); 
               // 清除旧草稿（如果周期或填写人变化）
               clearDraft();
               setIsModalOpen(true); 
             }} 
             className="h-11 flex items-center gap-2 bg-indigo-600 text-white px-6 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-black text-sm uppercase transition-all active:scale-95"
           > 
             <Plus size={20} /> 
             填报工时 
           </button>
        </div>
      </div>

      {/* Manager 专用：未填写成员提示 */}
      {userRole === 'manager' && unfilledMembers.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-sm shadow-amber-100/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl shadow-sm">
              <AlertCircle className="text-amber-600" size={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-amber-900 mb-2 uppercase tracking-widest flex items-center gap-2">
                未填写成员提醒
                <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                  {unfilledMembers.length} 人
                </span>
              </h3>
              <p className="text-xs text-amber-700 mb-4 font-medium leading-relaxed">
                以下成员尚未填报本周工时，建议及时提醒：
              </p>
              <div className="flex flex-wrap gap-2">
                {unfilledMembers.map(member => (
                  <span 
                    key={member.id} 
                    className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold text-amber-800 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {member.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 工时统计 */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl shadow-sm">
              <TrendingUp className="text-indigo-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">总工时</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{hoursStats.totalHours.toFixed(1)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl shadow-sm">
              <Users className="text-emerald-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">已填写人数</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{hoursStats.workerCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-violet-50 rounded-xl shadow-sm">
              <Clock className="text-violet-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">人均工时</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{hoursStats.avgHours.toFixed(1)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-rose-50 rounded-xl shadow-sm">
              <AlertCircle className="text-rose-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">未填写人数</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{userRole === 'manager' ? unfilledMembers.length : '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Manager 专用：按人员工时统计 */}
      {userRole === 'manager' && Object.keys(hoursStats.hoursByWorker).length > 0 && (
        <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <button
            onClick={() => setIsHoursByWorkerExpanded(!isHoursByWorkerExpanded)}
            className="w-full text-left"
          >
            <h3 className="text-sm font-black text-slate-900 mb-5 uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
              <Users size={18} className="text-indigo-600" />
              按人员工时统计
              <ChevronDown 
                size={18} 
                className={`text-slate-400 ml-auto transition-transform duration-200 ${
                  isHoursByWorkerExpanded ? 'rotate-180' : ''
                }`}
              />
            </h3>
          </button>
          {isHoursByWorkerExpanded && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(hoursStats.hoursByWorker)
                .sort(([, a], [, b]) => b - a)
                .map(([name, hours]) => (
                  <div key={name} className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all hover:border-indigo-200">
                    <p className="text-xs font-bold text-slate-500 mb-2 truncate uppercase tracking-wider">{name}</p>
                    <p className="text-xl font-black text-indigo-600 leading-none">{hours.toFixed(1)} <span className="text-sm text-slate-400 font-medium">小时</span></p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-[24px] shadow-md border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="min-w-full text-left text-sm table-fixed border-separate border-spacing-0">
            <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
              <tr>
                {columnConfig.filter(col => col.visible).map(col => {
                  const isSortable = ['attribute', 'level', 'type', 'worker', 'hours'].includes(col.key);
                  if (isSortable) {
                    return (
                      <SortableResizableTh
                        key={col.key}
                        width={colWidths[col.key] || 100}
                        onResize={(w) => setColWidths({...colWidths, [col.key]: w})}
                        sortField={col.key}
                        currentSortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className={col.key === 'hours' ? 'text-right' : ''}
                      >
                        {col.label}
                      </SortableResizableTh>
                    );
                  }
                  return (
                    <ResizableTh
                      key={col.key}
                      width={colWidths[col.key] || 100}
                      onResize={(w) => setColWidths({...colWidths, [col.key]: w})}
                    >
                      {col.label}
                    </ResizableTh>
                  );
                })}
                <th className="px-6 py-2.5 w-24 text-center sticky right-0 bg-slate-50 font-black text-[10px] uppercase text-slate-400 border-b border-slate-200">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {viewLogs.length > 0 ? viewLogs.map((log) => {
                const projectFromLibrary = projects.find(p => p.id === log.projectId);
                const realProject = log.expand?.projectId || projectFromLibrary || {} as Partial<Project>;
                const canManage = userRole === 'manager' || log.createdBy === currentUserId || log.workerName === currentUser;
                
                const isRealProjectValid = !!realProject.id;
                
                const currentAttribute = realProject.attribute || '';
                const currentLevel = realProject.level || '';
                const currentDept = realProject.department || (isRealProjectValid ? '' : log.projectDept) || '';
                const currentMajorType = realProject.type || (isRealProjectValid ? '' : log.projectType) || '';
                const currentSubType = realProject.subType || (isRealProjectValid ? '' : log.projectSubType) || '';
                
                const renderCell = (colKey: string) => {
                  switch (colKey) {
                    case 'attribute':
                      return (
                        <td key={colKey} className="px-6 py-4">
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 truncate inline-flex min-w-[70px] justify-center">
                            {getLabelFromDict(config.attributes, currentAttribute)}
                          </span>
                        </td>
                      );
                    case 'level':
                      return (
                        <td key={colKey} className="px-6 py-4">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-lg text-[10px] font-black text-slate-700 border shadow-sm" style={{ backgroundColor: (config.levels as TagConfig[]).find(l => l.key === currentLevel || l.label === currentLevel)?.color || '#f1f5f9' }}>
                            {getLabelFromDict(config.levels, currentLevel)}
                          </span>
                        </td>
                      );
                    case 'dept':
                      return (
                        <td key={colKey} className="px-6 py-4 text-slate-600 font-bold truncate">
                          {getLabelFromDict(config.departments, currentDept)}
                        </td>
                      );
                    case 'name':
                      return (
                        <td key={colKey} className="px-6 py-4 text-slate-900 font-bold">
                          <div
                            className="whitespace-normal break-words"
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {realProject.name || log.projectName}
                          </div>
                        </td>
                      );
                    case 'type':
                      return (
                        <td key={colKey} className="px-6 py-4 text-slate-600 font-bold truncate">
                          <div className="flex flex-col">
                            <span className="text-slate-900">{getLabelFromDict(config.types, currentMajorType)}</span>
                            {currentSubType && (
                              <span className="text-[9px] text-slate-400 font-medium">
                                ({getLabelFromDict(config.types.find(t => t.key === currentMajorType || t.label === currentMajorType)?.subTypes || [], currentSubType)})
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    case 'content':
                      return (
                        <td key={colKey} className="px-6 py-4 text-slate-600 whitespace-pre-wrap leading-relaxed">
                          {log.content}
                        </td>
                      );
                    case 'worker':
                      return (
                        <td key={colKey} className="px-6 py-4 text-slate-600 font-bold truncate">
                          {log.workerName}
                        </td>
                      );
                    case 'hours':
                      return (
                        <td key={colKey} className="px-6 py-4 text-right font-black text-indigo-600">
                          {log.hours}
                        </td>
                      );
                    default:
                      return null;
                  }
                };
                
                return (
                  <tr key={log.id} className="hover:bg-indigo-50/30 even:bg-slate-50 transition-colors group">
                    {columnConfig.filter(col => col.visible).map(col => renderCell(col.key))}
                    <td className="px-6 py-4 text-center sticky right-0 bg-white group-even:bg-slate-50 group-hover:bg-indigo-50 z-20 transition-colors shadow-[-12px_0_15px_-10px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setFormWeekStart(log.weekStartDate); setTargetWorker(log.workerName); setFormRows([{ tempId: '1', id: log.id, projectId: log.projectId, content: log.content, hours: log.hours, originalCreatedBy: log.createdBy }]); setIsEditing(true); setIsModalOpen(true); }} disabled={!canManage} className={`p-2 rounded-xl transition-all ${canManage ? 'text-indigo-600 hover:bg-white shadow-sm' : 'text-slate-200'}`}> <Pencil size={14} /> </button>
                        <button onClick={() => setDeleteLogConfirmId(log.id)} disabled={!canManage} className={`p-2 rounded-xl transition-all ${canManage ? 'text-slate-400 hover:text-rose-600 hover:bg-white shadow-sm' : 'text-slate-200'}`}> <Trash2 size={14} /> </button>
                      </div>
                    </td>
                  </tr>
                );
              }              ) : (
                <tr>
                  <td colSpan={columnConfig.filter(col => col.visible).length + 1} className="p-0">
                    <EmptyState
                      icon={Clock}
                      title="本周暂无工时记录"
                      description={userRole === 'manager' 
                        ? '团队成员尚未填报本周工时，您可以提醒他们及时填写' 
                        : '开始记录您本周的工作内容，让团队了解您的贡献'}
                      action={userRole === 'manager' ? undefined : {
                        label: '立即填报',
                        onClick: () => {
                          setIsEditing(false);
                          setFormWeekStart(selectedViewWeek);
                          setTargetWorker(currentUser);
                          setFormRows([{ tempId: '1', projectId: '', content: '', hours: 0 }]);
                          setIsModalOpen(true);
                        },
                        icon: Plus
                      }}
                      illustration="data"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
            <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-black text-slate-900">{isEditing ? '编辑工时' : '填报工时'}</h3>
                {hasDraft && (
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 flex items-center gap-2">
                    <Clock size={12} />
                    已保存草稿
                  </span>
                )}
              </div>
              <button 
                onClick={() => {
                  // 关闭时保存草稿提示
                  const hasContent = formRows.some(r => r.projectId || r.content || r.hours);
                  if (hasContent && !isEditing) {
                    const key = `worklog_draft_${currentUserId}_${formWeekStart}_${targetWorker}`;
                    const draftData = {
                      formWeekStart,
                      targetWorker,
                      formRows,
                      savedAt: new Date().toISOString()
                    };
                    try {
                      localStorage.setItem(key, JSON.stringify(draftData));
                    } catch (e) {
                      console.error('Failed to save draft on close:', e);
                    }
                  }
                  setIsModalOpen(false);
                }} 
                className="text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-10 overflow-y-auto flex-1 bg-slate-50/30 custom-scrollbar">
              {/* 顶部信息栏 - 优化布局 */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">统计周期</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={formWeekStart} 
                      onChange={(e) => setFormWeekStart(format(startOfWeek(parseISO(e.target.value), { weekStartsOn: 1 }), 'yyyy-MM-dd'))} 
                      className="h-10 flex-1 border border-slate-200 bg-white rounded-lg px-3 text-sm font-bold outline-none focus:border-indigo-400" 
                    />
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 inline-block w-fit">
                    {getWeekRangeLabel(formWeekStart)}
                  </span>
                </div>
                <div className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">填写人</label>
                  {userRole === 'manager' ? (
                    <select 
                      value={targetWorker} 
                      onChange={(e) => setTargetWorker(e.target.value)} 
                      className="h-10 border border-slate-200 bg-white rounded-lg px-3 text-sm font-bold outline-none focus:border-indigo-400"
                    >
                      {config.users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  ) : (
                    <span className="h-10 px-3 flex items-center bg-slate-100 rounded-lg text-sm font-bold text-slate-500">
                      {currentUser}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">填写统计</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">有效记录</p>
                      <p className="text-xl font-black text-indigo-600">{formStats.rowCount} 条</p>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">总工时</p>
                      <p className="text-xl font-black text-indigo-600">{formStats.totalHours.toFixed(1)} 小时</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 表单行 - 优化布局 */}
              <div className="space-y-4">
                {formRows.map((row: any) => {
                  const project = projects.find(p => p.id === row.projectId);
                  return (
                    <div key={row.tempId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-5">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">关联项目</label>
                          <ProjectSelector 
                            projects={projects} 
                            config={config} 
                            value={row.projectId} 
                            onChange={(val) => setFormRows(formRows.map(r => r.tempId === row.tempId ? {...r, projectId: val} : r))}
                            recentProjectIds={recentProjectIds}
                            currentWorker={targetWorker}
                          />
                        </div>
                        <div className="col-span-12 md:col-span-5">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">工作内容</label>
                          <textarea 
                            className="w-full h-24 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold resize-none outline-none focus:bg-white focus:border-indigo-400 transition-all" 
                            placeholder="请输入工作内容..." 
                            value={row.content} 
                            onChange={(e) => setFormRows(formRows.map(r => r.tempId === row.tempId ? {...r, content: e.target.value} : r))} 
                          />
                        </div>
                        <div className="col-span-12 md:col-span-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">工时</label>
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <input 
                                type="number" 
                                step="1" 
                                min="0"
                                className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-3 text-sm font-black text-indigo-600 text-center outline-none focus:bg-white focus:border-indigo-400" 
                                value={row.hours} 
                                onChange={(e) => setFormRows(formRows.map(r => r.tempId === row.tempId ? {...r, hours: e.target.value} : r))} 
                              />
                              {/* 工时快捷按钮 */}
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {[4, 8, 16, 24, 40].map(h => (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => setFormRows(formRows.map(r => r.tempId === row.tempId ? {...r, hours: h} : r))}
                                    className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 rounded font-bold transition-colors"
                                  >
                                    {h}h
                                  </button>
                                ))}
                              </div>
                            </div>
                            {!isEditing && (
                              <button 
                                onClick={() => setFormRows(formRows.filter(r => r.tempId !== row.tempId))} 
                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors mt-0"
                              >
                                <Trash2 size={16}/>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!isEditing && (
                  <button 
                    onClick={() => setFormRows([...formRows, { tempId: Date.now().toString(), projectId: '', content: '', hours: 0 }])} 
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16}/>
                    添加一行
                  </button>
                )}
              </div>
            </div>
            <div className="px-10 py-6 bg-slate-50 border-t border-slate-50 flex justify-between items-center rounded-b-[32px] shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {hasDraft ? (
                  <>
                    <Clock size={14} className="text-amber-500" />
                    <span className="text-amber-600 font-bold">草稿已保存</span>
                  </>
                ) : (
                  <>
                    <Clock size={14} />
                    <span>草稿将自动保存</span>
                  </>
                )}
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    clearDraft();
                    setIsModalOpen(false);
                  }} 
                  className="px-8 py-2.5 text-slate-500 font-black uppercase tracking-widest hover:bg-white rounded-xl transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={isSaving || formStats.rowCount === 0}
                  className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl shadow-xl text-sm font-black uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-all"
                >
                  {isSaving && <Loader2 className="animate-spin" size={18} />}
                  {isEditing ? '更新记录' : '提交保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 提交成功动画 */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center">
          <div className="bg-white rounded-[32px] shadow-2xl p-12 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
            <div className="relative">
              {/* 成功图标 - 带动画 */}
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center shadow-xl animate-in zoom-in duration-500">
                <Check className="text-white" size={48} strokeWidth={4} />
              </div>
              {/* 外圈脉冲动画 */}
              <div className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping"></div>
              {/* 装饰点 */}
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full shadow-lg animate-bounce delay-300"></div>
            </div>
            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
              <h3 className="text-3xl font-black text-slate-900 mb-3 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                提交成功！
              </h3>
              <p className="text-base text-slate-600 font-bold mb-2">
                已成功提交 <span className="text-indigo-600">{formStats.rowCount}</span> 条记录
              </p>
              <p className="text-sm text-slate-500 font-medium">
                总工时 <span className="text-indigo-600 font-black">{formStats.totalHours.toFixed(1)}</span> 小时
              </p>
            </div>
            {/* 成功提示条 */}
            <div className="mt-2 px-6 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                <Check size={14} />
                数据已保存，可继续添加记录
              </p>
            </div>
          </div>
        </div>
      )}

      {deleteLogConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-10 animate-in fade-in zoom-in border border-white/20">
            <div className="mx-auto bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center text-rose-500 mb-6"> <AlertTriangle size={36} /> </div>
            <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">确认删除记录？</h3>
            <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed">删除后该工时将不再计入报表统计，操作不可撤销。</p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} disabled={isDeleting} className="w-full py-4 bg-rose-600 text-white rounded-2xl shadow-xl font-black text-sm uppercase"> {isDeleting ? '正在删除...' : '确认删除'} </button>
              <button onClick={() => setDeleteLogConfirmId(null)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase"> 取消 </button>
            </div>
          </div>
        </div>
      )}

      {/* 汇报建议模态框 */}
      {isPresentationModalOpen && presentationSuggestion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
            <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-50 rounded-xl">
                  <Mic className="text-violet-600" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">周例会汇报建议</h3>
                    <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-[10px] font-black uppercase tracking-widest">
                      {PRESENTATION_STYLES[presentationStyle].label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">建议汇报时长：{presentationSuggestion.duration}</p>
                </div>
              </div>
              <button onClick={() => setIsPresentationModalOpen(false)} className="text-slate-400 hover:text-slate-900 h-10 w-10 flex items-center justify-center"> <X size={24} /> </button>
            </div>

            <div className="px-10 py-8 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30">
              {/* 汇报大纲 */}
              <div className="mb-8 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h4 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  汇报大纲
                </h4>
                <ol className="space-y-2">
                  {presentationSuggestion.outline.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-black">
                        {index + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-700 pt-0.5">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* 详细话术 */}
              <div className="mb-8 space-y-4">
                <h4 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <Mic size={16} className="text-violet-600" />
                  详细话术
                </h4>
                {presentationSuggestion.talkingPoints.map((point, index) => (
                  <div key={index} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-black">
                        {index + 1}
                      </span>
                      <h5 className="text-base font-black text-slate-900 pt-0.5">{point.title}</h5>
                    </div>
                    <div className="ml-9 space-y-3">
                      <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-xl">
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">{point.script}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <TrendingUp size={14} />
                        <span className="font-bold">数据支撑：{point.data}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Q&A */}
              {presentationSuggestion.qa.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h4 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    可能的问题与回答
                  </h4>
                  <div className="space-y-4">
                    {presentationSuggestion.qa.map((item, index) => (
                      <div key={index} className="border-l-4 border-amber-400 pl-4">
                        <p className="text-sm font-black text-amber-900 mb-2">Q{index + 1}: {item.question}</p>
                        <p className="text-sm font-medium text-slate-600 leading-relaxed">A: {item.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-10 py-6 bg-slate-50 border-t border-slate-50 flex justify-between items-center rounded-b-[32px] shrink-0">
              <button
                onClick={() => {
                  setIsPresentationModalOpen(false);
                  handleGeneratePresentation(true);
                }}
                disabled={isGeneratingPresentation}
                className="px-6 py-2.5 text-violet-600 font-black uppercase tracking-widest hover:bg-violet-50 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingPresentation ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                重新生成
              </button>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    const fullText = [
                      `汇报大纲：\n${presentationSuggestion.outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\n`,
                      `详细话术：\n${presentationSuggestion.talkingPoints.map((p, i) => `${i + 1}. ${p.title}\n   ${p.script}\n   数据：${p.data}`).join('\n\n')}\n\n`,
                      presentationSuggestion.qa.length > 0 ? `Q&A：\n${presentationSuggestion.qa.map((q, i) => `Q${i + 1}: ${q.question}\nA: ${q.answer}`).join('\n\n')}` : ''
                    ].join('');
                    navigator.clipboard.writeText(fullText);
                    alert('已复制到剪贴板');
                  }}
                  className="px-8 py-2.5 text-slate-600 font-black uppercase tracking-widest hover:bg-white rounded-xl transition-all flex items-center gap-2"
                >
                  <Copy size={16} />
                  复制全部
                </button>
                <button onClick={() => setIsPresentationModalOpen(false)} className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl shadow-xl text-sm font-black uppercase">
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};