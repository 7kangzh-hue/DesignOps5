
import { startOfWeek } from 'date-fns/startOfWeek';
import { subWeeks } from 'date-fns/subWeeks';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { WorkLog, Project, AppConfig, DEFAULT_CONFIG, TypeConfig, TagConfig } from '../types';
import { BarChart3, Calendar, Loader2, RefreshCw, Activity, Download } from 'lucide-react';
import { ResizableTh } from './TableCommon';
import { exportToCSV } from '../services/exportService';

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

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [fetchedLogs, fetchedProjects, fetchedConfig] = await Promise.all([ 
        storage.getLogs(), 
        storage.getProjects(),
        storage.getConfig() 
      ]);
      setAllLogs(fetchedLogs);
      setProjects(fetchedProjects);
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
    return Array.from(map.values());
  }, [filteredLogs, projectIndex]);

  const deptStatsReport = useMemo(() => {
    const result: Record<string, DepartmentStats> = {};
    filteredLogs.forEach(log => {
      const currentProjectDefinition = projectIndex.get(log.projectId);
      const deptKey = currentProjectDefinition?.department || log.expand?.projectId?.department || log.projectDept || 'unknown';
      const typeKey = currentProjectDefinition?.type || log.expand?.projectId?.type || log.projectType || 'unknown'; 
      const projName = currentProjectDefinition?.name || log.expand?.projectId?.name || log.projectName || '未知项目';
      if (!result[deptKey]) result[deptKey] = { totalHours: 0, types: {} };
      result[deptKey].totalHours += log.hours;
      if (!result[deptKey].types[typeKey]) result[deptKey].types[typeKey] = { projects: {} };
      if (!result[deptKey].types[typeKey].projects[log.projectId]) {
        result[deptKey].types[typeKey].projects[log.projectId] = { name: projName, hours: 0, people: new Set() };
      }
      const proj = result[deptKey].types[typeKey].projects[log.projectId];
      proj.hours += log.hours;
      proj.people.add(log.workerName);
      proj.name = projName;
    });
    return result;
  }, [filteredLogs, projectIndex]);

  const handleExport = () => {
    if (activeTab === 'merged') {
      const headers = {
        attribute: '项目属性',
        level: '项目级别',
        dept: '归属部门',
        projectName: '项目名称',
        type: '需求类型',
        platform: '开发平台',
        summary: '工作内容汇总',
        people: '参与人员',
        hours: '总工时'
      };
      const data = mergedProjectReport.map(item => {
        const majorLabel = translateLabel(config, 'types', item.typeKey);
        const subLabel = item.subTypeKey ? translateLabel(config, 'types', item.subTypeKey) : '';
        return {
          attribute: translateLabel(config, 'attributes', item.attributeKey),
          level: translateLabel(config, 'levels', item.levelKey),
          dept: translateLabel(config, 'departments', item.departmentKey),
          projectName: item.projectName,
          type: subLabel ? `${majorLabel} - ${subLabel}` : majorLabel,
          platform: translateLabel(config, 'platforms', item.platformKey),
          summary: item.contents.join('; '),
          people: Array.from(item.participants).join(', '),
          hours: item.totalHours
        };
      });
      exportToCSV(data, headers, `项目工时合并报表_${startDate}_${endDate}`);
    } else {
      const headers = {
        dept: '归属部门',
        type: '需求分类',
        name: '项目名称',
        people: '参与人员',
        hours: '项目工时'
      };
      const data: any[] = [];
      (Object.entries(deptStatsReport) as [string, DepartmentStats][]).forEach(([deptKey, deptData]) => {
        (Object.entries(deptData.types) as [string, TypeStats][]).forEach(([typeKey, typeData]) => {
          (Object.entries(typeData.projects) as [string, ProjectStats][]).forEach(([_, projData]) => {
            data.push({
              dept: translateLabel(config, 'departments', deptKey),
              type: translateLabel(config, 'types', typeKey),
              name: projData.name,
              people: Array.from(projData.people).join(', '),
              hours: projData.hours
            });
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
          <div className="flex items-center gap-3">
             <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"> 
               <BarChart3 className="text-indigo-600" size={32} /> 数据统计报表 
             </h2>
             <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full mt-1">
                <Activity size={12} className="text-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Metadata Sync</span>
             </div>
          </div>
          <p className="text-slate-500 text-sm mt-2 font-medium">最后同步时间: {format(lastSync, 'HH:mm:ss')} (元数据实时联动中)</p> 
        </div>
        <div className="flex items-center gap-4">
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

      <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden mb-10">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
        {activeTab === 'merged' ? (
             <table className="min-w-full text-left text-sm table-fixed border-separate border-spacing-0">
              <thead className="bg-slate-50 sticky top-0 z-20"> 
                <tr> 
                  <ResizableTh width={mergedWidths.attr} onResize={(w) => setMergedWidths({...mergedWidths, attr: w})}>项目属性</ResizableTh> 
                  <ResizableTh width={mergedWidths.level} onResize={(w) => setMergedWidths({...mergedWidths, level: w})}>项目级别</ResizableTh> 
                  <ResizableTh width={mergedWidths.dept} onResize={(w) => setMergedWidths({...mergedWidths, dept: w})}>归属部门</ResizableTh> 
                  <ResizableTh width={mergedWidths.name} onResize={(w) => setMergedWidths({...mergedWidths, name: w})}>项目名称</ResizableTh> 
                  <ResizableTh width={mergedWidths.type} onResize={(w) => setMergedWidths({...mergedWidths, type: w})}>需求类型</ResizableTh> 
                  <ResizableTh width={mergedWidths.platform} onResize={(w) => setMergedWidths({...mergedWidths, platform: w})}>开发平台</ResizableTh> 
                  <ResizableTh width={mergedWidths.summary} onResize={(w) => setMergedWidths({...mergedWidths, summary: w})}>工作汇总</ResizableTh> 
                  <ResizableTh width={mergedWidths.people} onResize={(w) => setMergedWidths({...mergedWidths, people: w})}>参与人</ResizableTh> 
                  <ResizableTh width={mergedWidths.hours} onResize={(w) => setMergedWidths({...mergedWidths, hours: w})} className="text-right">总工时</ResizableTh> 
                </tr> 
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mergedProjectReport.length > 0 ? mergedProjectReport.map((item) => {
                  const majorLabel = translateLabel(config, 'types', item.typeKey);
                  const subLabel = item.subTypeKey ? translateLabel(config, 'types', item.subTypeKey) : '';
                  const levelConfig = (config.levels as TagConfig[]).find(l => l.key === item.levelKey || l.label === item.levelKey);

                  return (
                    <tr key={item.projectId} className="hover:bg-indigo-50/30 even:bg-slate-50 transition-colors animate-in fade-in slide-in-from-left-2 duration-300">
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-lg text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 truncate inline-flex min-w-[70px] justify-center uppercase">
                          {translateLabel(config, 'attributes', item.attributeKey)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-lg text-[10px] font-black text-slate-700 shadow-sm border border-black/5" style={{ backgroundColor: levelConfig?.color || '#f1f5f9' }}>
                          {translateLabel(config, 'levels', item.levelKey)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-bold truncate">{translateLabel(config, 'departments', item.departmentKey)}</td>
                      <td className="px-6 py-4 font-bold text-slate-900 truncate" title={item.projectName}>{item.projectName}</td>
                      <td className="px-6 py-4 text-slate-600 font-bold truncate">
                        <span className="flex flex-col">
                          <span>{majorLabel}</span>
                          {subLabel && <span className="text-[9px] text-slate-400 font-medium">({subLabel})</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-bold truncate">{translateLabel(config, 'platforms', item.platformKey)}</td>
                      <td className="px-6 py-4 text-slate-500"> 
                        <ul className="space-y-1"> {item.contents.map((c, i) => <li key={i} className="flex items-start gap-2"> <span className="text-xs leading-relaxed">{c}</span> </li>)} </ul> 
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-bold truncate"> {Array.from(item.participants).join(', ')} </td>
                      <td className="px-6 py-4 text-right font-black text-indigo-600 text-lg">{item.totalHours}</td>
                    </tr>
                  );
                }) : (
                  <tr> <td colSpan={9} className="text-center py-40 text-slate-300 font-black uppercase tracking-widest text-xs"> 选定周期内无可用数据 </td> </tr>
                )}
              </tbody>
             </table>
        ) : (
             <table className="min-w-full text-left text-sm table-fixed border-separate border-spacing-0">
              <thead className="bg-slate-50 sticky top-0 z-20"> 
                <tr> 
                  <ResizableTh width={statsWidths.dept} onResize={(w) => setStatsWidths({...statsWidths, dept: w})}>归属部门</ResizableTh> 
                  <ResizableTh width={statsWidths.type} onResize={(w) => setStatsWidths({...statsWidths, type: w})}>需求分类</ResizableTh> 
                  <ResizableTh width={statsWidths.name} onResize={(w) => setStatsWidths({...statsWidths, name: w})}>项目名称</ResizableTh> 
                  <ResizableTh width={statsWidths.people} onResize={(w) => setStatsWidths({...statsWidths, people: w})}>参与人员</ResizableTh> 
                  <ResizableTh width={statsWidths.hours} onResize={(w) => setStatsWidths({...statsWidths, hours: w})} className="text-right">项目工时</ResizableTh> 
                  <ResizableTh width={statsWidths.total} onResize={(w) => setStatsWidths({...statsWidths, total: w})} className="text-right bg-indigo-50/50 text-indigo-700">部门合计</ResizableTh> 
                </tr> 
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.keys(deptStatsReport).length > 0 ? (Object.entries(deptStatsReport) as [string, DepartmentStats][]).map(([deptKey, deptData]) => {
                  const typeEntries = Object.entries(deptData.types) as [string, TypeStats][];
                  const deptRowSpan = typeEntries.reduce((acc, [_, typeData]) => acc + Object.keys(typeData.projects).length, 0);
                  const deptLabel = translateLabel(config, 'departments', deptKey);
                  return typeEntries.map(([typeKey, typeData], typeIndex) => {
                    const projectEntries = Object.entries(typeData.projects) as [string, ProjectStats][];
                    const typeLabel = translateLabel(config, 'types', typeKey);
                    return projectEntries.map(([projId, projData], projIndex) => (
                      <tr key={`${deptKey}-${typeKey}-${projId}`} className="hover:bg-indigo-50/30 even:bg-slate-50 transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300">
                        {typeIndex === 0 && projIndex === 0 && ( <td rowSpan={deptRowSpan} className="px-6 py-4 font-black text-slate-900 align-top border-r border-slate-100 bg-white leading-[3rem]"> {deptLabel} </td> )}
                        {projIndex === 0 && ( <td rowSpan={projectEntries.length} className="px-6 py-4 align-top border-r border-slate-100 bg-white font-bold text-slate-500 leading-[3rem]"> {typeLabel} </td> )}
                        <td className="px-6 py-4 text-slate-700 font-bold truncate h-14 leading-relaxed">{projData.name}</td>
                        <td className="px-6 py-4 text-slate-500 text-[10px] font-bold truncate h-14 leading-relaxed"> {Array.from(projData.people).join(', ')} </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 h-14 leading-relaxed">{projData.hours}</td>
                        {typeIndex === 0 && projIndex === 0 && ( <td rowSpan={deptRowSpan} className="px-6 py-4 font-black align-top text-right bg-indigo-50/30 text-indigo-700 border-l border-indigo-100/50 shadow-[-5px_0_15px_-10px_rgba(0,0,0,0.1)] leading-[3rem]"> <div className="mt-2 text-xl">{deptData.totalHours}</div> </td> )}
                      </tr>
                    ));
                  });
                }) : (
                  <tr> <td colSpan={6} className="text-center py-40 text-slate-300 font-black uppercase tracking-widest text-xs"> 选定周期内无可用数据 </td> </tr>
                )}
              </tbody>
             </table>
        )}
        </div>
      </div>
    </div>
  );
};
