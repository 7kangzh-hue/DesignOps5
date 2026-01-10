import React, { useState, useEffect, useMemo, useRef } from 'react';
import { storage } from '../services/storage';
import { Project, AppConfig, DEFAULT_CONFIG, DictItem } from '../types';
import { startOfWeek, endOfWeek, format, parseISO, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar, Trash2, Plus, Clock, Search, Pencil, Loader2, RefreshCw, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { ResizableTh } from './TableCommon';

// 辅助函数：获取星期几
const getWeekday = (dateStr: string) => {
  const date = parseISO(dateStr);
  return format(date, 'EEEE', { locale: zhCN });
};

// 辅助函数：获取日期范围标签
const getWeekRangeLabel = (mondayStr: string) => {
  try {
    const start = parseISO(mondayStr);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return `${format(start, 'yyyy-MM-dd')} 到 ${format(end, 'yyyy-MM-dd')}`;
  } catch (e) {
    return mondayStr;
  }
};

// 项目选择器组件
interface ProjectSelectorProps {
  projects: Project[];
  config: AppConfig;
  value: string;
  onChange: (projectId: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, config, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);
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

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    return projects.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.id.includes(searchTerm)
    );
  }, [projects, searchTerm]);

  const getLabelFromDict = (list: DictItem[], key: string) => {
    if (!key) return '-';
    const item = list.find(i => i.key === key);
    if (item) return item.label;
    const legacyItem = list.find(i => i.label === key);
    if (legacyItem) return legacyItem.label;
    return key;
  };

  const renderProjectItem = (p: Project) => (
    <div 
      key={p.id} 
      className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 ${p.id === value ? 'bg-indigo-50' : ''}`} 
      onClick={() => { onChange(p.id); setSearchTerm(p.name); setIsOpen(false); }}
    >
      <div className="font-bold text-slate-800 text-sm truncate">{p.name}</div>
      <div className="text-[10px] text-slate-400 uppercase tracking-widest flex gap-2">
        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
          {getLabelFromDict(config.departments, p.department)}
        </span>
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
        placeholder="选择项目..." 
        value={searchTerm} 
        onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); if (e.target.value === '') onChange(''); }} 
        onFocus={() => setIsOpen(true)} 
      />
      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {filteredProjects.length > 0 ? (
            filteredProjects.map(renderProjectItem)
          ) : (
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

// 每日流水记录接口
interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  projectId: string;
  projectName: string;
  content: string;
  hours: number;
}

// 周报预览数据接口
interface WeeklyPreviewItem {
  projectId: string;
  projectName: string;
  totalHours: number;
  contents: string[]; // 多条工作内容
}

export const DailyLogManager: React.FC<{ userRole: string, currentUser: string, currentUserId: string }> = ({ 
  userRole, currentUser, currentUserId 
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  
  // 每日流水数据
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedWeek, setSelectedWeek] = useState<string>(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  
  // 模态框状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    projectId: '',
    content: '',
    hours: 0
  });
  
  // 周报预览数据
  const [weeklyPreview, setWeeklyPreview] = useState<WeeklyPreviewItem[]>([]);

  // 初始化加载
  useEffect(() => {
    fetchData();
    loadDailyLogs();
  }, []);

  // 当日期或周变化时重新计算周报预览
  useEffect(() => {
    calculateWeeklyPreview();
  }, [dailyLogs, selectedWeek]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedConfig, projectResult] = await Promise.all([ 
        storage.getConfig(), 
        storage.getProjects(1, 1000)
      ]);
      setConfig(fetchedConfig);
      setProjects(projectResult.items);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsLoading(false); 
    }
  };

  // 从 localStorage 加载每日流水数据
  const loadDailyLogs = () => {
    try {
      const saved = localStorage.getItem('daily_logs');
      if (saved) {
        const logs = JSON.parse(saved);
        setDailyLogs(logs);
      }
    } catch (e) {
      console.error('Failed to load daily logs:', e);
    }
  };

  // 保存每日流水数据到 localStorage
  const saveDailyLogs = (logs: DailyLog[]) => {
    try {
      localStorage.setItem('daily_logs', JSON.stringify(logs));
      setDailyLogs(logs);
    } catch (e) {
      console.error('Failed to save daily logs:', e);
    }
  };

  // 计算周报预览数据（支持排序）
  const calculateWeeklyPreview = () => {
    const weekStart = parseISO(selectedWeek);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    // 过滤出本周的日志
    const weekLogs = dailyLogs.filter(log => {
      const logDate = parseISO(log.date);
      return logDate >= weekStart && logDate <= weekEnd;
    });
    
    // 按项目分组
    const grouped = weekLogs.reduce((acc, log) => {
      if (!acc[log.projectId]) {
        acc[log.projectId] = {
          projectId: log.projectId,
          projectName: log.projectName,
          totalHours: 0,
          contents: []
        };
      }
      acc[log.projectId].totalHours += log.hours;
      if (log.content.trim()) {
        acc[log.projectId].contents.push(log.content);
      }
      return acc;
    }, {} as Record<string, WeeklyPreviewItem>);
    
    let preview = Object.values(grouped);
    
    // 排序逻辑
    if (sortField && activeTab === 'weekly') {
      preview = [...preview].sort((a, b) => {
        let valueA: any;
        let valueB: any;
        
        switch (sortField) {
          case 'projectName':
            valueA = a.projectName;
            valueB = b.projectName;
            break;
          case 'totalHours':
            valueA = a.totalHours;
            valueB = b.totalHours;
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
    
    setWeeklyPreview(preview);
  };

  // 打开新增/编辑模态框
  const openModal = (log?: DailyLog) => {
    if (log) {
      setEditingLog(log);
      setFormData({
        date: log.date,
        projectId: log.projectId,
        content: log.content,
        hours: log.hours
      });
    } else {
      setEditingLog(null);
      setFormData({
        date: selectedDate,
        projectId: '',
        content: '',
        hours: 0
      });
    }
    setIsModalOpen(true);
  };

  // 保存日志
  const saveLog = () => {
    if (!formData.projectId || !formData.content.trim() || formData.hours <= 0) {
      alert('请填写完整信息：项目、工作内容和工时');
      return;
    }

    const project = projects.find(p => p.id === formData.projectId);
    if (!project) {
      alert('请选择有效的项目');
      return;
    }

    const newLog: DailyLog = {
      id: editingLog?.id || `log_${Date.now()}`,
      date: formData.date,
      projectId: formData.projectId,
      projectName: project.name,
      content: formData.content.trim(),
      hours: formData.hours
    };

    let updatedLogs;
    if (editingLog) {
      updatedLogs = dailyLogs.map(log => log.id === editingLog.id ? newLog : log);
    } else {
      updatedLogs = [...dailyLogs, newLog];
    }

    saveDailyLogs(updatedLogs);
    setIsModalOpen(false);
    setEditingLog(null);
  };

  // 删除日志
  const deleteLog = (id: string) => {
    if (window.confirm('确定要删除这条记录吗？')) {
      const updatedLogs = dailyLogs.filter(log => log.id !== id);
      saveDailyLogs(updatedLogs);
    }
  };

  // 同步到工作台账
  const syncToWorkLog = (projectId?: string) => {
    const weekStart = parseISO(selectedWeek);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    let logsToSync: DailyLog[];
    if (projectId) {
      // 同步单个项目
      logsToSync = dailyLogs.filter(log => {
        const logDate = parseISO(log.date);
        return log.projectId === projectId && logDate >= weekStart && logDate <= weekEnd;
      });
    } else {
      // 同步所有项目（使用周报预览数据）
      logsToSync = dailyLogs.filter(log => {
        const logDate = parseISO(log.date);
        return logDate >= weekStart && logDate <= weekEnd;
      });
    }

    if (logsToSync.length === 0) {
      alert('没有可同步的数据');
      return;
    }

    // 将数据保存到 localStorage，供 MemberWeeklyLog 读取
    const syncData = {
      logs: logsToSync,
      weekStartDate: selectedWeek,
      syncedAt: new Date().toISOString()
    };
    
    localStorage.setItem('sync_to_worklog', JSON.stringify(syncData));
    
    // 跳转到工作台账页面
    window.location.href = '#member-log';
    alert('数据已同步，正在跳转到工作台账页面...');
  };

  // Tab 状态
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  
  // 列宽状态
  const [dailyColWidths, setDailyColWidths] = useState<Record<string, number>>({
    date: 120,
    weekday: 100,
    projectName: 200,
    content: 300,
    hours: 100,
    actions: 120
  });
  
  const [weeklyColWidths, setWeeklyColWidths] = useState<Record<string, number>>({
    projectName: 200,
    totalHours: 120,
    content: 400,
    actions: 120
  });
  
  // 排序状态
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 获取选中日期的日志
  const selectedDateLogs = useMemo(() => {
    return dailyLogs.filter(log => log.date === selectedDate);
  }, [dailyLogs, selectedDate]);

  // 获取本周的日志（支持排序）
  const weekLogs = useMemo(() => {
    const weekStart = parseISO(selectedWeek);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    let filtered = dailyLogs.filter(log => {
      const logDate = parseISO(log.date);
      return logDate >= weekStart && logDate <= weekEnd;
    });
    
    // 排序逻辑
    if (sortField && activeTab === 'daily') {
      filtered = [...filtered].sort((a, b) => {
        let valueA: any;
        let valueB: any;
        
        switch (sortField) {
          case 'date':
            valueA = a.date;
            valueB = b.date;
            break;
          case 'projectName':
            valueA = a.projectName;
            valueB = b.projectName;
            break;
          case 'hours':
            valueA = a.hours;
            valueB = b.hours;
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
  }, [dailyLogs, selectedWeek, sortField, sortDirection, activeTab]);

  // 获取本周的日期列表
  const weekDates = useMemo(() => {
    const start = parseISO(selectedWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return format(date, 'yyyy-MM-dd');
    });
  }, [selectedWeek]);

  // 切换上一周/下一周
  const changeWeek = (direction: 'prev' | 'next') => {
    const current = parseISO(selectedWeek);
    const newWeek = direction === 'prev' ? addDays(current, -7) : addDays(current, 7);
    setSelectedWeek(format(startOfWeek(newWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  };
  
  // 处理排序
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight mb-2">
            <Calendar className="text-indigo-600" size={32} />
            每日流水管理
          </h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            记录每日工作明细，自动生成周报预览
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => openModal()}
            className="h-11 flex items-center gap-2 bg-indigo-600 text-white px-6 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-black text-sm uppercase transition-all active:scale-95"
          >
            <Plus size={20} />
            新增记录
          </button>
        </div>
      </div>

      {/* 周选择器 */}
      <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => changeWeek('prev')}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={20} className="text-slate-500" />
            </button>
            <h3 className="text-lg font-black text-slate-900">
              {getWeekRangeLabel(selectedWeek)}
            </h3>
            <button 
              onClick={() => changeWeek('next')}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight size={20} className="text-slate-500" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncToWorkLog()}
              className="h-10 flex items-center gap-2 bg-emerald-600 text-white px-5 rounded-xl hover:bg-emerald-700 font-bold text-sm uppercase transition-all"
            >
              <RefreshCw size={16} />
              一键同步所有到工作台账
            </button>
          </div>
        </div>

        {/* Tab 切换布局 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {/* Tab 导航 */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'daily' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              <div className="flex items-center gap-2">
                <Calendar size={18} className={activeTab === 'daily' ? 'text-indigo-600' : 'text-slate-400'} />
                每日明细
              </div>
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'weekly' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              <div className="flex items-center gap-2">
                <Clock size={18} className={activeTab === 'weekly' ? 'text-emerald-600' : 'text-slate-400'} />
                周报预览
              </div>
            </button>
          </div>

          {/* Tab 内容 */}
          <div className="overflow-x-auto">
            {activeTab === 'daily' ? (
              <table className="w-full text-left text-sm table-fixed border-separate border-spacing-0">
                <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
                  <tr>
                    <ResizableTh
                      width={dailyColWidths.date}
                      onResize={(w) => setDailyColWidths({...dailyColWidths, date: w})}
                      className="cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center gap-2">
                        日期
                        <div className="flex flex-col">
                          {sortField === 'date' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp size={12} className="text-indigo-600" />
                            ) : (
                              <ArrowDown size={12} className="text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-300" />
                          )}
                        </div>
                      </div>
                    </ResizableTh>
                    <ResizableTh
                      width={dailyColWidths.weekday}
                      onResize={(w) => setDailyColWidths({...dailyColWidths, weekday: w})}
                    >
                      星期
                    </ResizableTh>
                    <ResizableTh
                      width={dailyColWidths.projectName}
                      onResize={(w) => setDailyColWidths({...dailyColWidths, projectName: w})}
                      className="cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('projectName')}
                    >
                      <div className="flex items-center gap-2">
                        项目名称
                        <div className="flex flex-col">
                          {sortField === 'projectName' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp size={12} className="text-indigo-600" />
                            ) : (
                              <ArrowDown size={12} className="text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-300" />
                          )}
                        </div>
                      </div>
                    </ResizableTh>
                    <ResizableTh
                      width={dailyColWidths.content}
                      onResize={(w) => setDailyColWidths({...dailyColWidths, content: w})}
                    >
                      工作内容
                    </ResizableTh>
                    <ResizableTh
                      width={dailyColWidths.hours}
                      onResize={(w) => setDailyColWidths({...dailyColWidths, hours: w})}
                      className="cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('hours')}
                    >
                      <div className="flex items-center gap-2">
                        工时
                        <div className="flex flex-col">
                          {sortField === 'hours' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp size={12} className="text-indigo-600" />
                            ) : (
                              <ArrowDown size={12} className="text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-300" />
                          )}
                        </div>
                      </div>
                    </ResizableTh>
                    <ResizableTh
                      width={dailyColWidths.actions}
                      onResize={(w) => setDailyColWidths({...dailyColWidths, actions: w})}
                    >
                      操作
                    </ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weekLogs.length > 0 ? (
                    weekLogs.map(log => (
                      <tr key={log.id} className="hover:bg-indigo-50/30 even:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{log.date}</td>
                        <td className="px-6 py-4 text-slate-600">{getWeekday(log.date)}</td>
                        <td className="px-6 py-4 font-bold text-slate-800 truncate">{log.projectName}</td>
                        <td className="px-6 py-4 text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {log.content}
                        </td>
                        <td className="px-6 py-4 font-bold text-indigo-600">{log.hours} 小时</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openModal(log)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="编辑"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteLog(log.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        本周暂无记录，点击"新增记录"开始记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm table-fixed border-separate border-spacing-0">
                <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
                  <tr>
                    <ResizableTh
                      width={weeklyColWidths.projectName}
                      onResize={(w) => setWeeklyColWidths({...weeklyColWidths, projectName: w})}
                      className="cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('projectName')}
                    >
                      <div className="flex items-center gap-2">
                        项目名称
                        <div className="flex flex-col">
                          {sortField === 'projectName' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp size={12} className="text-emerald-600" />
                            ) : (
                              <ArrowDown size={12} className="text-emerald-600" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-300" />
                          )}
                        </div>
                      </div>
                    </ResizableTh>
                    <ResizableTh
                      width={weeklyColWidths.totalHours}
                      onResize={(w) => setWeeklyColWidths({...weeklyColWidths, totalHours: w})}
                      className="cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('totalHours')}
                    >
                      <div className="flex items-center gap-2">
                        总工时
                        <div className="flex flex-col">
                          {sortField === 'totalHours' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp size={12} className="text-emerald-600" />
                            ) : (
                              <ArrowDown size={12} className="text-emerald-600" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-300" />
                          )}
                        </div>
                      </div>
                    </ResizableTh>
                    <ResizableTh
                      width={weeklyColWidths.content}
                      onResize={(w) => setWeeklyColWidths({...weeklyColWidths, content: w})}
                    >
                      工作内容
                    </ResizableTh>
                    <ResizableTh
                      width={weeklyColWidths.actions}
                      onResize={(w) => setWeeklyColWidths({...weeklyColWidths, actions: w})}
                    >
                      操作
                    </ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weeklyPreview.length > 0 ? (
                    weeklyPreview.map(item => (
                      <tr key={item.projectId} className="hover:bg-emerald-50/30 even:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 truncate">{item.projectName}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600">{item.totalHours} 小时</td>
                        <td className="px-6 py-4 text-slate-700 whitespace-pre-line leading-relaxed">
                          {item.contents.join('\n')}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => syncToWorkLog(item.projectId)}
                            className="h-8 flex items-center gap-1.5 bg-indigo-600 text-white px-3 rounded-lg hover:bg-indigo-700 font-bold text-xs uppercase transition-all"
                          >
                            <RefreshCw size={12} />
                            同步
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        暂无周报数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 新增/编辑模态框 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-black text-slate-900">
                {editingLog ? '编辑记录' : '新增记录'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">日期</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm focus:bg-white focus:border-indigo-400 outline-none font-bold text-slate-700"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">项目</label>
                <ProjectSelector 
                  projects={projects}
                  config={config}
                  value={formData.projectId}
                  onChange={(projectId) => setFormData({...formData, projectId})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">工作内容</label>
                <textarea 
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="w-full h-24 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:bg-white focus:border-indigo-400 outline-none font-bold text-slate-700 resize-none"
                  placeholder="请输入工作内容..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">工时（小时）</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.5"
                  value={formData.hours}
                  onChange={(e) => setFormData({...formData, hours: parseFloat(e.target.value) || 0})}
                  className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm focus:bg-white focus:border-indigo-400 outline-none font-bold text-slate-700"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-11 px-6 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveLog}
                className="h-11 px-6 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
