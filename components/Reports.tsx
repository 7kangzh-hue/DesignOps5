
import { startOfWeek } from 'date-fns/startOfWeek';
import { subWeeks } from 'date-fns/subWeeks';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { storage } from '../services/storage';
import { WorkLog, Project, AppConfig, DEFAULT_CONFIG, TypeConfig, TagConfig } from '../types';
import { BarChart3, Calendar, Loader2, RefreshCw, Activity, Download, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { ResizableTh } from './TableCommon';
import { exportToCSV } from '../services/exportService';
import { EmptyState } from './EmptyState';
import { ColumnManager, ColumnConfig } from './ColumnManager';

type ReportTab = 'merged' | 'stats';

interface ProjectStats {
  name: string;
  hours: number;
  people: Set<string>;
}

interface TypeStats {
  projects: Record<string, ProjectStats>;
}

interface DepartmentStats {
  totalHours: number;
  types: Record<string, TypeStats>;
}

const translateLabel = (config: AppConfig, type: keyof AppConfig, key: string): string => {
  if (!key) return '-';
  const dict = config[type] as any[];
  if (!Array.isArray(dict)) return key;
  const found = dict.find(item => item.key === key || item.label === key);
  if (found) return found.label;
  if (type === 'types') {
    for (const majorType of (config.types as TypeConfig[])) {
      const subFound = majorType.subTypes.find(s => s.key === key || s.label === key);
      if (subFound) return subFound.label;
    }
  }
  return key;
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
      style={{ width, minWidth: 30 }}
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
      
      {/* Resizer Handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (thRef.current) {
            const startX = e.pageX;
            const startWidth = thRef.current.offsetWidth;
            const handleMouseMove = (e: MouseEvent) => {
              const diffX = e.pageX - startX;
              const newWidth = Math.max(30, startWidth + diffX);
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

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('merged');
  const [allLogs, setAllLogs] = useState<WorkLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  
  const [startDate, setStartDate] = useState(() => format(startOfWeek(subWeeks(new Date(), 3), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [mergedWidths, setMergedWidths] = useState<Record<string, number>>({
    attr: 100, level: 80, dept: 120, name: 200, type: 150, platform: 100, summary: 300, people: 150, hours: 100
  });

  const [statsWidths, setStatsWidths] = useState<Record<string, number>>({
    dept: 150, type: 150, name: 200, people: 180, hours: 100, total: 100
  });

  // 排序状态 - 项目合并报表
  const [mergedSortField, setMergedSortField] = useState<string | null>(null);
  const [mergedSortDirection, setMergedSortDirection] = useState<'asc' | 'desc'>('asc');

  // 排序状态 - 部门统计报表
  const [statsSortField, setStatsSortField] = useState<string | null>(null);
  const [statsSortDirection, setStatsSortDirection] = useState<'asc' | 'desc'>('asc');

  // 列配置 - 项目合并报表
  const defaultMergedColumns: ColumnConfig[] = [
    { key: 'attr', label: '项目属性', visible: true },
    { key: 'level', label: '项目级别', visible: true },
    { key: 'dept', label: '归属部门', visible: true },
    { key: 'name', label: '项目名称', visible: true },
    { key: 'type', label: '需求类型', visible: true },
    { key: 'platform', label: '开发平台', visible: true },
    { key: 'summary', label: '工作汇总', visible: true },
    { key: 'people', label: '参与人', visible: true },
    { key: 'hours', label: '总工时', visible: true }
  ];
  const [mergedColumnConfig, setMergedColumnConfig] = useState<ColumnConfig[]>(defaultMergedColumns);

  // 列配置 - 部门统计报表
  const defaultStatsColumns: ColumnConfig[] = [
    { key: 'dept', label: '归属部门', visible: true },
    { key: 'type', label: '需求分类', visible: true },
    { key: 'name', label: '项目名称', visible: true },
    { key: 'people', label: '参与人员', visible: true },
    { key: 'hours', label: '项目工时', visible: true }
  ];
  const [statsColumnConfig, setStatsColumnConfig] = useState<ColumnConfig[]>(defaultStatsColumns);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      // For reports, we fetch a large batch of projects to ensure lookups work.
      const [fetchedLogs, projectResult, fetchedConfig] = await Promise.all([ 
        storage.getLogs(), 
        storage.getProjects(1, 1000),
        storage.getConfig() 
      ]);
      setAllLogs(fetchedLogs);
      setProjects(projectResult.items);
      setConfig(fetchedConfig);
      setLastSync(new Date());
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsLoading(false); 
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    let unsubscribeLogs: any;
    let unsubscribeProjects: any;
    const setupSubscriptions = async () => {
      unsubscribeLogs = await storage.subscribe('work_logs', () => fetchData());
      unsubscribeProjects = await storage.subscribe('projects', () => fetchData());
    };
    setupSubscriptions();
    return () => {
      if (unsubscribeLogs) unsubscribeLogs();
      if (unsubscribeProjects) unsubscribeProjects();
    };
  }, [fetchData]);
  
  const projectIndex = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  const filteredLogs = useMemo(() => {
    const s = format(startOfWeek(parseISO(startDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const e = format(startOfWeek(parseISO(endDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return allLogs.filter(log => log.weekStartDate >= s && log.weekStartDate <= e);
  }, [allLogs, startDate, endDate]);

  const mergedProjectReport = useMemo(() => {
    const map = new Map<string, { 
      projectId: string; 
      projectName: string; 
      departmentKey: string; 
      levelKey: string;
      attributeKey: string;
      typeKey: string;
      subTypeKey: string;
      platformKey: string;
      contents: string[]; 
      totalHours: number; 
      participants: Set<string>; 
    }>();

    filteredLogs.forEach(log => {
      const currentProjectDefinition = projectIndex.get(log.projectId);
      const currentDeptKey = currentProjectDefinition?.department || log.expand?.projectId?.department || log.projectDept || 'unknown';
      const currentProjName = currentProjectDefinition?.name || log.expand?.projectId?.name || log.projectName || '未知项目';
      const currentLevelKey = currentProjectDefinition?.level || log.expand?.projectId?.level || 'unknown';
      const currentAttrKey = currentProjectDefinition?.attribute || log.expand?.projectId?.attribute || 'unknown';
      const currentTypeKey = currentProjectDefinition?.type || log.expand?.projectId?.type || log.projectType || 'unknown';
      const currentSubTypeKey = currentProjectDefinition?.subType || log.expand?.projectId?.subType || log.projectSubType || '';
      const currentPlatformKey = currentProjectDefinition?.platform || log.expand?.projectId?.platform || log.projectPlatform || 'unknown';

      const existing = map.get(log.projectId);
      if (existing) {
        existing.contents.push(log.content);
        existing.totalHours += log.hours;
        existing.participants.add(log.workerName);
        existing.projectName = currentProjName;
        existing.departmentKey = currentDeptKey;
        existing.levelKey = currentLevelKey;
        existing.attributeKey = currentAttrKey;
        existing.typeKey = currentTypeKey;
        existing.subTypeKey = currentSubTypeKey;
        existing.platformKey = currentPlatformKey;
      } else {
        map.set(log.projectId, { 
          projectId: log.projectId, 
          projectName: currentProjName, 
          departmentKey: currentDeptKey,
          levelKey: currentLevelKey,
          attributeKey: currentAttrKey,
          typeKey: currentTypeKey,
          subTypeKey: currentSubTypeKey,
          platformKey: currentPlatformKey,
          contents: [log.content], 
          totalHours: log.hours, 
          participants: new Set([log.workerName]) 
        });
      }
    });
    let result = Array.from(map.values());
    
    // 排序逻辑
    if (mergedSortField) {
      result = [...result].sort((a, b) => {
        let valueA: any;
        let valueB: any;
        
        switch (mergedSortField) {
          case 'attribute':
            valueA = translateLabel(config, 'attributes', a.attributeKey);
            valueB = translateLabel(config, 'attributes', b.attributeKey);
            break;
          case 'level':
            valueA = translateLabel(config, 'levels', a.levelKey);
            valueB = translateLabel(config, 'levels', b.levelKey);
            break;
          case 'dept':
            valueA = translateLabel(config, 'departments', a.departmentKey);
            valueB = translateLabel(config, 'departments', b.departmentKey);
            break;
          case 'name':
            valueA = a.projectName;
            valueB = b.projectName;
            break;
          case 'type':
            valueA = translateLabel(config, 'types', a.typeKey);
            valueB = translateLabel(config, 'types', b.typeKey);
            break;
          case 'platform':
            valueA = translateLabel(config, 'platforms', a.platformKey);
            valueB = translateLabel(config, 'platforms', b.platformKey);
            break;
          case 'people':
            valueA = a.participants.size;
            valueB = b.participants.size;
            break;
          case 'hours':
            valueA = a.totalHours;
            valueB = b.totalHours;
            break;
          default:
            return 0;
        }
        
        // 字符串比较
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return mergedSortDirection === 'asc' 
            ? valueA.localeCompare(valueB, 'zh-CN')
            : valueB.localeCompare(valueA, 'zh-CN');
        }
        
        // 数字比较
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return mergedSortDirection === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        return 0;
      });
    }
    
    return result;
  }, [filteredLogs, projectIndex, config, mergedSortField, mergedSortDirection]);

  // 扁平化的部门统计数据（用于排序）
  const flattenedStatsData = useMemo(() => {
    const flatData: Array<{
      deptKey: string;
      typeKey: string;
      projectId: string;
      projectName: string;
      hours: number;
      people: Set<string>;
    }> = [];
    
    filteredLogs.forEach(log => {
      const currentProjectDefinition = projectIndex.get(log.projectId);
      const deptKey = currentProjectDefinition?.department || log.expand?.projectId?.department || log.projectDept || 'unknown';
      const typeKey = currentProjectDefinition?.type || log.expand?.projectId?.type || log.projectType || 'unknown'; 
      const projName = currentProjectDefinition?.name || log.expand?.projectId?.name || log.projectName || '未知项目';
      
      const existing = flatData.find(
        item => item.deptKey === deptKey && item.typeKey === typeKey && item.projectId === log.projectId
      );
      
      if (existing) {
        existing.hours += log.hours;
        existing.people.add(log.workerName);
      } else {
        flatData.push({
          deptKey,
          typeKey,
          projectId: log.projectId,
          projectName: projName,
          hours: log.hours,
          people: new Set([log.workerName])
        });
      }
    });
    
    // 排序逻辑
    if (statsSortField) {
      flatData.sort((a, b) => {
        let valueA: any;
        let valueB: any;
        
        switch (statsSortField) {
          case 'dept':
            valueA = translateLabel(config, 'departments', a.deptKey);
            valueB = translateLabel(config, 'departments', b.deptKey);
            break;
          case 'type':
            valueA = translateLabel(config, 'types', a.typeKey);
            valueB = translateLabel(config, 'types', b.typeKey);
            break;
          case 'name':
            valueA = a.projectName;
            valueB = b.projectName;
            break;
          case 'people':
            valueA = a.people.size;
            valueB = b.people.size;
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
          return statsSortDirection === 'asc' 
            ? valueA.localeCompare(valueB, 'zh-CN')
            : valueB.localeCompare(valueA, 'zh-CN');
        }
        
        // 数字比较
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return statsSortDirection === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        return 0;
      });
    }
    
    return flatData;
  }, [filteredLogs, projectIndex, config, statsSortField, statsSortDirection]);

  const deptStatsReport = useMemo(() => {
    const result: Record<string, DepartmentStats> = {};
    
    // 使用排序后的扁平数据重建嵌套结构
    flattenedStatsData.forEach(item => {
      if (!result[item.deptKey]) result[item.deptKey] = { totalHours: 0, types: {} };
      result[item.deptKey].totalHours += item.hours;
      if (!result[item.deptKey].types[item.typeKey]) {
        result[item.deptKey].types[item.typeKey] = { projects: {} };
      }
      result[item.deptKey].types[item.typeKey].projects[item.projectId] = {
        name: item.projectName,
        hours: item.hours,
        people: item.people
      };
    });
    
    return result;
  }, [flattenedStatsData]);

  // 排序处理函数 - 项目合并报表
  const handleMergedSort = (field: string) => {
    if (mergedSortField === field) {
      setMergedSortDirection(mergedSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setMergedSortField(field);
      setMergedSortDirection('asc');
    }
  };

  // 排序处理函数 - 部门统计报表
  const handleStatsSort = (field: string) => {
    if (statsSortField === field) {
      setStatsSortDirection(statsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setStatsSortField(field);
      setStatsSortDirection('asc');
    }
  };

  const handleExport = () => {
    if (activeTab === 'merged') {
      const headers: Record<string, string> = {};
      mergedColumnConfig.filter(col => col.visible).forEach(col => {
        const exportKey = col.key === 'attr' ? 'attribute' : col.key === 'name' ? 'projectName' : col.key === 'summary' ? 'summary' : col.key;
        headers[exportKey] = col.label;
      });

      const data = mergedProjectReport.map(item => {
        const majorLabel = translateLabel(config, 'types', item.typeKey);
        const subLabel = item.subTypeKey ? translateLabel(config, 'types', item.subTypeKey) : '';
        
        const row: any = {};
        mergedColumnConfig.filter(col => col.visible).forEach(col => {
          const exportKey = col.key === 'attr' ? 'attribute' : col.key === 'name' ? 'projectName' : col.key === 'summary' ? 'summary' : col.key;
          switch (col.key) {
            case 'attr':
              row[exportKey] = translateLabel(config, 'attributes', item.attributeKey);
              break;
            case 'level':
              row[exportKey] = translateLabel(config, 'levels', item.levelKey);
              break;
            case 'dept':
              row[exportKey] = translateLabel(config, 'departments', item.departmentKey);
              break;
            case 'name':
              row[exportKey] = item.projectName;
              break;
            case 'type':
              row[exportKey] = subLabel ? `${majorLabel} - ${subLabel}` : majorLabel;
              break;
            case 'platform':
              row[exportKey] = translateLabel(config, 'platforms', item.platformKey);
              break;
            case 'summary':
              row[exportKey] = item.contents.join('; ');
              break;
            case 'people':
              row[exportKey] = Array.from(item.participants).join(', ');
              break;
            case 'hours':
              row[exportKey] = item.totalHours;
              break;
          }
        });
        return row;
      });
      exportToCSV(data, headers, `项目工时合并报表_${startDate}_${endDate}`);
    } else {
      const headers: Record<string, string> = {};
      statsColumnConfig.filter(col => col.visible).forEach(col => {
        headers[col.key === 'name' ? 'name' : col.key] = col.label;
      });

      const data: any[] = [];
      (Object.entries(deptStatsReport) as [string, DepartmentStats][]).forEach(([deptKey, deptData]) => {
        (Object.entries(deptData.types) as [string, TypeStats][]).forEach(([typeKey, typeData]) => {
          (Object.entries(typeData.projects) as [string, ProjectStats][]).forEach(([_, projData]) => {
            const row: any = {};
            statsColumnConfig.filter(col => col.visible).forEach(col => {
              switch (col.key) {
                case 'dept':
                  row[col.key] = translateLabel(config, 'departments', deptKey);
                  break;
                case 'type':
                  row[col.key] = translateLabel(config, 'types', typeKey);
                  break;
                case 'name':
                  row[col.key] = projData.name;
                  break;
                case 'people':
                  row[col.key] = Array.from(projData.people).join(', ');
                  break;
                case 'hours':
                  row[col.key] = projData.hours;
                  break;
              }
            });
            data.push(row);
          });
        });
      });
      exportToCSV(data, headers, `部门维度工时报表_${startDate}_${endDate}`);
    }
  };

  if (isLoading) return <div className="h-full flex items-center justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="h-full flex flex-col w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <BarChart3 className="text-indigo-600" size={32} /> 数据统计报表
            </h2>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full shadow-sm">
              <Activity size={12} className="text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Metadata Sync</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            最后同步时间: {format(lastSync, 'HH:mm:ss')} (元数据实时联动中)
          </p>
        </div>
        <div className="flex items-center gap-4">
          {activeTab === 'merged' ? (
            <ColumnManager
              columns={mergedColumnConfig}
              onColumnsChange={setMergedColumnConfig}
              storageKey="reports_merged_column_config"
              title="项目合并报表列管理"
            />
          ) : (
            <ColumnManager
              columns={statsColumnConfig}
              onColumnsChange={setStatsColumnConfig}
              storageKey="reports_stats_column_config"
              title="部门统计报表列管理"
            />
          )}
          <button onClick={handleExport} className="flex items-center justify-center h-12 px-6 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 font-black text-xs uppercase gap-2">
            <Download size={20} /> 导出报表
          </button>
          <button 
            onClick={() => fetchData(true)} 
            disabled={isRefreshing}
            className={`flex items-center justify-center h-12 w-12 bg-white border border-slate-200 rounded-2xl text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm active:scale-95 ${isRefreshing ? 'opacity-50' : ''}`}
            title="手动强制同步"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <Calendar size={18} className="text-slate-400 ml-3" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-black text-slate-700 outline-none" />
            <span className="text-slate-300 font-bold">至</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-black text-slate-700 outline-none" />
          </div>
        </div>
      </div>

      <div className="flex gap-4 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 mb-8 w-fit">
        {(['merged', 'stats'] as const).map(tab => ( <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}> {tab === 'merged' ? '项目合并' : '部门统计'} </button> ))}
      </div>

      <div className="bg-white rounded-[24px] shadow-md border border-slate-200 flex-1 flex flex-col overflow-hidden mb-10">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
        {activeTab === 'merged' ? (
             <table className="min-w-full text-left text-sm table-fixed border-separate border-spacing-0">
              <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20"> 
                <tr> 
                  {mergedColumnConfig.filter(col => col.visible).map(col => {
                    const isSortable = ['attr', 'level', 'dept', 'name', 'type', 'platform', 'people', 'hours'].includes(col.key);
                    const sortFieldMap: Record<string, string> = {
                      'attr': 'attribute',
                      'dept': 'dept',
                      'name': 'name',
                      'type': 'type',
                      'platform': 'platform',
                      'people': 'people',
                      'hours': 'hours',
                      'level': 'level'
                    };
                    if (isSortable) {
                      return (
                        <SortableResizableTh
                          key={col.key}
                          width={mergedWidths[col.key] || 100}
                          onResize={(w) => setMergedWidths({...mergedWidths, [col.key]: w})}
                          sortField={sortFieldMap[col.key]}
                          currentSortField={mergedSortField}
                          sortDirection={mergedSortDirection}
                          onSort={handleMergedSort}
                          className={col.key === 'hours' ? 'text-right' : ''}
                        >
                          {col.label}
                        </SortableResizableTh>
                      );
                    }
                    return (
                      <ResizableTh
                        key={col.key}
                        width={mergedWidths[col.key] || 100}
                        onResize={(w) => setMergedWidths({...mergedWidths, [col.key]: w})}
                      >
                        {col.label}
                      </ResizableTh>
                    );
                  })}
                </tr> 
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mergedProjectReport.length > 0 ? mergedProjectReport.map((item) => {
                  const majorLabel = translateLabel(config, 'types', item.typeKey);
                  const subLabel = item.subTypeKey ? translateLabel(config, 'types', item.subTypeKey) : '';
                  const levelConfig = (config.levels as TagConfig[]).find(l => l.key === item.levelKey || l.label === item.levelKey);

                  const renderMergedCell = (colKey: string) => {
                    switch (colKey) {
                      case 'attr':
                        return (
                          <td key={colKey} className="px-6 py-4">
                            <span className="px-3 py-1 rounded-lg text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 truncate inline-flex min-w-[70px] justify-center">
                              {translateLabel(config, 'attributes', item.attributeKey)}
                            </span>
                          </td>
                        );
                      case 'level':
                        return (
                          <td key={colKey} className="px-6 py-4">
                            <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-lg text-[10px] font-black text-slate-700 border shadow-sm" style={{ backgroundColor: levelConfig?.color || '#f1f5f9' }}>
                              {translateLabel(config, 'levels', item.levelKey)}
                            </span>
                          </td>
                        );
                      case 'dept':
                        return (
                          <td key={colKey} className="px-6 py-4 text-slate-600 font-bold truncate">
                            {translateLabel(config, 'departments', item.departmentKey)}
                          </td>
                        );
                      case 'name':
                        return (
                          <td key={colKey} className="px-6 py-4 font-bold text-slate-900">
                            <div 
                              className="whitespace-normal break-words max-h-24 overflow-hidden"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={item.projectName}
                            >
                              {item.projectName}
                            </div>
                          </td>
                        );
                      case 'type':
                        return (
                          <td key={colKey} className="px-6 py-4 text-slate-600 font-bold truncate">
                            <span className="flex flex-col">
                              <span>{majorLabel}</span>
                              {subLabel && <span className="text-[9px] text-slate-400 font-medium">({subLabel})</span>}
                            </span>
                          </td>
                        );
                      case 'platform':
                        return (
                          <td key={colKey} className="px-6 py-4 text-slate-600 font-bold truncate">
                            {translateLabel(config, 'platforms', item.platformKey)}
                          </td>
                        );
                      case 'summary':
                        return (
                          <td key={colKey} className="px-6 py-4 text-slate-500">
                            <ul className="space-y-1"> {item.contents.map((c, i) => <li key={i} className="flex items-start gap-2"> <span className="text-xs leading-relaxed">{c}</span> </li>)} </ul>
                          </td>
                        );
                      case 'people':
                        return (
                          <td key={colKey} className="px-6 py-4 text-slate-600 font-bold truncate">
                            {Array.from(item.participants).join(', ')}
                          </td>
                        );
                      case 'hours':
                        return (
                          <td key={colKey} className="px-6 py-4 text-right font-black text-indigo-600">
                            {item.totalHours}
                          </td>
                        );
                      default:
                        return null;
                    }
                  };

                  return (
                    <tr key={item.projectId} className="hover:bg-indigo-50/30 even:bg-slate-50 transition-colors group">
                      {mergedColumnConfig.filter(col => col.visible).map(col => renderMergedCell(col.key))}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={mergedColumnConfig.filter(col => col.visible).length} className="p-0">
                      <EmptyState
                        icon={BarChart3}
                        title="选定周期内无可用数据"
                        description={`在 ${format(parseISO(startDate), 'yyyy年MM月dd日')} 至 ${format(parseISO(endDate), 'yyyy年MM月dd日')} 期间还没有工时记录`}
                        illustration="data"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
             </table>
        ) : (
             <table className="min-w-full text-left text-sm table-fixed border-separate border-spacing-0">
              <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20"> 
                <tr> 
                  {statsColumnConfig.filter(col => col.visible).map(col => {
                    const isSortable = ['dept', 'type', 'name', 'people', 'hours'].includes(col.key);
                    if (isSortable) {
                      return (
                        <SortableResizableTh
                          key={col.key}
                          width={statsWidths[col.key] || 100}
                          onResize={(w) => setStatsWidths({...statsWidths, [col.key]: w})}
                          sortField={col.key}
                          currentSortField={statsSortField}
                          sortDirection={statsSortDirection}
                          onSort={handleStatsSort}
                          className={col.key === 'hours' ? 'text-right' : ''}
                        >
                          {col.label}
                        </SortableResizableTh>
                      );
                    }
                    return (
                      <ResizableTh
                        key={col.key}
                        width={statsWidths[col.key] || 100}
                        onResize={(w) => setStatsWidths({...statsWidths, [col.key]: w})}
                      >
                        {col.label}
                      </ResizableTh>
                    );
                  })}
                  <ResizableTh width={statsWidths.total} onResize={(w) => setStatsWidths({...statsWidths, total: w})} className="text-right bg-indigo-50/50 text-indigo-700">部门合计</ResizableTh> 
                </tr> 
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {Object.keys(deptStatsReport).length > 0 ? (Object.entries(deptStatsReport) as [string, DepartmentStats][]).map(([deptKey, deptData], deptIndex) => {
                  const typeEntries = Object.entries(deptData.types) as [string, TypeStats][];
                  const deptRowSpan = typeEntries.reduce((acc, [_, typeData]) => acc + Object.keys(typeData.projects).length, 0);
                  const deptLabel = translateLabel(config, 'departments', deptKey);
                  const isEvenDept = deptIndex % 2 === 0;
                  const rowBgClass = isEvenDept ? 'bg-white' : 'bg-slate-50/50';
                  
                  return typeEntries.map(([typeKey, typeData], typeIndex) => {
                    const projectEntries = Object.entries(typeData.projects) as [string, ProjectStats][];
                    const typeLabel = translateLabel(config, 'types', typeKey);
                    
                    const renderStatsCell = (colKey: string, isFirstDeptRow: boolean, isFirstTypeRow: boolean, projData: ProjectStats) => {
                      switch (colKey) {
                        case 'dept':
                          if (isFirstDeptRow) {
                            return (
                              <td key={colKey} rowSpan={deptRowSpan} className={`px-6 py-6 font-black text-slate-900 align-top border-r border-slate-100 ${rowBgClass} sticky left-0 z-10`}>
                                <div className="sticky top-24">{deptLabel}</div>
                              </td>
                            );
                          }
                          return null;
                        case 'type':
                          if (isFirstTypeRow) {
                            return (
                              <td key={colKey} rowSpan={projectEntries.length} className={`px-6 py-6 align-top border-r border-slate-100 ${rowBgClass} font-bold text-slate-500`}>
                                <div className="sticky top-24">{typeLabel}</div>
                              </td>
                            );
                          }
                          return null;
                        case 'name':
                          return (
                            <td key={colKey} className="px-6 py-4 text-slate-700 font-bold align-middle">
                              <div 
                                className="whitespace-normal break-words max-h-24 overflow-hidden"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                                title={projData.name}
                              >
                                {projData.name}
                              </div>
                            </td>
                          );
                        case 'people':
                          return (
                            <td key={colKey} className="px-6 py-4 text-slate-500 text-[10px] font-bold truncate align-middle">
                              {Array.from(projData.people).join(', ')}
                            </td>
                          );
                        case 'hours':
                          return (
                            <td key={colKey} className="px-6 py-4 text-right font-black text-slate-900 align-middle">
                              {projData.hours}
                            </td>
                          );
                        default:
                          return null;
                      }
                    };

                    return projectEntries.map(([projId, projData], projIndex) => {
                      const isFirstDeptRow = typeIndex === 0 && projIndex === 0;
                      const isFirstTypeRow = projIndex === 0;
                      
                      return (
                        <tr key={`${deptKey}-${typeKey}-${projId}`} className={`${rowBgClass} hover:bg-indigo-50/30 transition-colors group`}>
                          {statsColumnConfig.filter(col => col.visible).map(col => renderStatsCell(col.key, isFirstDeptRow, isFirstTypeRow, projData))}
                          {isFirstDeptRow && (
                            <td rowSpan={deptRowSpan} className={`px-6 py-6 font-black align-top text-right ${isEvenDept ? 'bg-indigo-50/20' : 'bg-indigo-50/40'} text-indigo-700 border-l border-indigo-100/50 shadow-[-5px_0_15px_-10px_rgba(0,0,0,0.1)]`}>
                              <div className="sticky top-24 text-xl">{deptData.totalHours}</div>
                            </td>
                          )}
                        </tr>
                      );
                    });
                  });
                }) : (
                  <tr>
                    <td colSpan={statsColumnConfig.filter(col => col.visible).length + 1} className="p-0">
                      <EmptyState
                        icon={BarChart3}
                        title="选定周期内无可用数据"
                        description={`在 ${format(parseISO(startDate), 'yyyy年MM月dd日')} 至 ${format(parseISO(endDate), 'yyyy年MM月dd日')} 期间还没有工时记录`}
                        illustration="data"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
             </table>
        )}
        </div>
      </div>
    </div>
  );
};
