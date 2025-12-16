
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { storage } from '../services/storage';
import { Project, WorkLog, AppConfig, UserRole, DEFAULT_CONFIG, TagConfig, DictItem } from '../types';
// Fixed date-fns imports by using specific function modules to ensure type resolution
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { Calendar, Save, Trash2, Plus, Clock, Search, X, UserCircle, Download, ChevronDown, Check, Pencil, AlertTriangle, Loader2 } from 'lucide-react';
import { ResizableTh } from './TableCommon';
import { exportToCSV } from '../services/exportService';

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

interface ProjectSelectorProps {
  projects: Project[];
  config: AppConfig;
  value: string;
  onChange: (projectId: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, config, value, onChange }) => {
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

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.includes(searchTerm));
  }, [projects, searchTerm]);

  return (
    <div className="relative" ref={wrapperRef}>
      <input type="text" className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm focus:bg-white focus:border-indigo-400 outline-none font-bold text-slate-700" placeholder="查找关联项目..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); if (e.target.value === '') onChange(''); }} onFocus={() => setIsOpen(true)} />
      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {filteredProjects.map(p => (
            <div key={p.id} className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 ${p.id === value ? 'bg-indigo-50' : ''}`} onClick={() => { onChange(p.id); setSearchTerm(p.name); setIsOpen(false); }}>
              <div className="font-bold text-slate-800 text-sm truncate">{p.name}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest flex gap-2">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{getLabelFromDict(config.departments, p.department)}</span>
                <span className="text-slate-300">|</span>
                <span>{getLabelFromDict(config.types, p.type)}</span>
              </div>
            </div>
          ))}
          {filteredProjects.length === 0 && ( <div className="px-4 py-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">未找到匹配项目</div> )}
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
  
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    attribute: 100, level: 80, dept: 120, name: 200, type: 150, content: 400, worker: 100, hours: 80, actions: 100
  });

  useEffect(() => { fetchData(); }, []);

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

  const viewLogs = useMemo(() => logs.filter(l => l.weekStartDate === selectedViewWeek), [logs, selectedViewWeek]);

  const handleSubmit = async () => {
    const validRows = formRows.filter(r => r.projectId && r.content);
    if (validRows.length === 0) return alert("请至少填写一行记录");
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
      const updatedLogs = await storage.getLogs();
      setLogs(updatedLogs);
      setIsModalOpen(false);
    } catch (e) { alert("提交失败"); } finally { setIsSaving(false); }
  };

  const handleExport = () => {
    const headers = {
      week: '填报周期',
      attribute: '项目属性',
      level: '级别',
      dept: '归属部门',
      projectName: '项目名称',
      type: '类型',
      content: '工作内容',
      worker: '填写人',
      hours: '工时'
    };

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

      return {
        week: getWeekRangeLabel(log.weekStartDate),
        attribute: getLabelFromDict(config.attributes, currentAttribute),
        level: getLabelFromDict(config.levels, currentLevel),
        dept: getLabelFromDict(config.departments, currentDept),
        projectName: realProject.name || log.projectName,
        type: subLabel ? `${majorLabel} (${subLabel})` : majorLabel,
        content: log.content,
        worker: log.workerName,
        hours: log.hours
      };
    });

    exportToCSV(exportData, headers, `工时台账_${selectedViewWeek}`);
  };

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-400" /></div>;

  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex justify-between items-center mb-10">
        <div> <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight"> <Clock className="text-indigo-600" size={32} /> 团队工作台账 </h2> <p className="text-slate-500 text-sm mt-2 font-medium">成员工时统计与任务交付追踪</p> </div>
        <div className="flex items-center gap-4">
           <select value={selectedViewWeek} onChange={(e) => setSelectedViewWeek(e.target.value)} className="h-11 bg-white border border-slate-200 px-5 rounded-xl text-sm font-bold shadow-sm outline-none">
             {Array.from(new Set([format(startOfWeek(new Date(), {weekStartsOn: 1}), 'yyyy-MM-dd'), ...logs.map(l => l.weekStartDate)])).sort().reverse().map(w => ( <option key={w} value={w}>{getWeekRangeLabel(w)}</option> ))}
           </select>
           <button onClick={handleExport} className="h-11 flex items-center gap-2 border border-slate-200 bg-white text-slate-600 px-6 rounded-xl hover:bg-slate-50 transition-all font-black text-sm uppercase"> <Download size={20} /> 导出台账 </button>
           <button onClick={() => { setIsEditing(false); setFormWeekStart(selectedViewWeek); setTargetWorker(currentUser); setFormRows([{ tempId: '1', projectId: '', content: '', hours: 0 }]); setIsModalOpen(true); }} className="h-11 flex items-center gap-2 bg-indigo-600 text-white px-6 rounded-xl hover:bg-indigo-700 shadow-xl font-black text-sm uppercase"> <Plus size={20} /> 填报工时 </button>
        </div>
      </div>

      <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="min-w-full text-left text-sm table-fixed border-separate border-spacing-0">
            <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
              <tr>
                <ResizableTh width={colWidths.attribute} onResize={(w) => setColWidths({...colWidths, attribute: w})}>属性</ResizableTh>
                <ResizableTh width={colWidths.level} onResize={(w) => setColWidths({...colWidths, level: w})}>级别</ResizableTh>
                <ResizableTh width={colWidths.dept} onResize={(w) => setColWidths({...colWidths, dept: w})}>部门</ResizableTh>
                <ResizableTh width={colWidths.name} onResize={(w) => setColWidths({...colWidths, name: w})}>项目名称</ResizableTh>
                <ResizableTh width={colWidths.type} onResize={(w) => setColWidths({...colWidths, type: w})}>类型</ResizableTh>
                <ResizableTh width={colWidths.content} onResize={(w) => setColWidths({...colWidths, content: w})}>工作内容</ResizableTh>
                <ResizableTh width={colWidths.worker} onResize={(w) => setColWidths({...colWidths, worker: w})}>填写人</ResizableTh>
                <ResizableTh width={colWidths.hours} onResize={(w) => setColWidths({...colWidths, hours: w})} className="text-right">工时</ResizableTh>
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
                
                return (
                  <tr key={log.id} className="hover:bg-indigo-50/30 even:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4"> 
                      <span className="px-3 py-1 rounded-lg text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 truncate inline-flex min-w-[70px] justify-center">
                        {getLabelFromDict(config.attributes, currentAttribute)}
                      </span> 
                    </td>
                    <td className="px-6 py-4"> 
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-lg text-[10px] font-black text-slate-700 border shadow-sm" style={{ backgroundColor: (config.levels as TagConfig[]).find(l => l.key === currentLevel || l.label === currentLevel)?.color || '#f1f5f9' }}>
                        {getLabelFromDict(config.levels, currentLevel)}
                      </span> 
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-bold truncate">
                      {getLabelFromDict(config.departments, currentDept)}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-bold truncate">
                      {realProject.name || log.projectName}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-bold truncate">
                      <div className="flex flex-col">
                        <span className="text-slate-900">{getLabelFromDict(config.types, currentMajorType)}</span>
                        {currentSubType && (
                          <span className="text-[9px] text-slate-400 font-medium">
                            ({getLabelFromDict(config.types.find(t => t.key === currentMajorType || t.label === currentMajorType)?.subTypes || [], currentSubType)})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {log.content}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-bold truncate">
                      {log.workerName}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-indigo-600">
                      {log.hours}
                    </td>
                    <td className="px-6 py-4 text-center sticky right-0 bg-white group-even:bg-slate-50 group-hover:bg-indigo-50 z-20 transition-colors shadow-[-12px_0_15px_-10px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setFormWeekStart(log.weekStartDate); setTargetWorker(log.workerName); setFormRows([{ tempId: '1', id: log.id, projectId: log.projectId, content: log.content, hours: log.hours, originalCreatedBy: log.createdBy }]); setIsEditing(true); setIsModalOpen(true); }} disabled={!canManage} className={`p-2 rounded-xl transition-all ${canManage ? 'text-indigo-600 hover:bg-white shadow-sm' : 'text-slate-200'}`}> <Pencil size={14} /> </button>
                        <button onClick={() => setDeleteLogConfirmId(log.id)} disabled={!canManage} className={`p-2 rounded-xl transition-all ${canManage ? 'text-slate-400 hover:text-rose-600 hover:bg-white shadow-sm' : 'text-slate-200'}`}> <Trash2 size={14} /> </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : ( <tr> <td colSpan={9} className="text-center py-32 text-slate-300 font-black uppercase tracking-widest text-xs"> 本周暂无工时记录 </td> </tr> )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
            <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center shrink-0"> <h3 className="text-2xl font-black text-slate-900"> {isEditing ? '编辑工时' : '填报工时'} </h3> <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900"> <X size={24} /> </button> </div>
            <div className="p-10 overflow-y-auto flex-1 bg-slate-50/30 custom-scrollbar">
              <div className="mb-8 flex flex-wrap gap-8 items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-col gap-2"> 
                   <label className="text-xs font-black text-slate-400 uppercase tracking-widest">统计周期:</label> 
                   <div className="flex items-center gap-3">
                     <input type="date" value={formWeekStart} onChange={(e) => setFormWeekStart(format(startOfWeek(parseISO(e.target.value), { weekStartsOn: 1 }), 'yyyy-MM-dd'))} className="h-10 border border-slate-200 bg-white rounded-xl px-4 text-sm font-bold outline-none" /> 
                     <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">{getWeekRangeLabel(formWeekStart)}</span>
                   </div>
                </div>
                <div className="flex flex-col gap-2"> <label className="text-xs font-black text-slate-400 uppercase tracking-widest">填写人:</label> {userRole === 'manager' ? ( <select value={targetWorker} onChange={(e) => setTargetWorker(e.target.value)} className="h-10 border border-slate-200 bg-white rounded-xl px-4 text-sm font-bold outline-none min-w-[120px]"> {config.users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)} </select> ) : <span className="h-10 px-4 flex items-center bg-slate-100 rounded-xl text-sm font-bold text-slate-500">{currentUser}</span>} </div>
              </div>
              <div className="space-y-4">
                {formRows.map((row: any) => (
                  <div key={row.tempId} className="bg-white p-6 rounded-2xl border border-slate-200 grid grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="col-span-4"> <ProjectSelector projects={projects} config={config} value={row.projectId} onChange={(val) => setFormRows(formRows.map(r => r.tempId === row.tempId ? {...r, projectId: val} : r))} /> </div>
                    <div className="col-span-6"> <textarea className="w-full h-24 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold resize-none outline-none focus:bg-white focus:border-indigo-400 transition-all" placeholder="工作内容..." value={row.content} onChange={(e) => setFormRows(formRows.map(r => r.tempId === row.tempId ? {...r, content: e.target.value} : r))} /> </div>
                    <div className="col-span-2 flex items-start gap-2"> <input type="number" step="0.5" className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm font-black text-indigo-600 text-center outline-none" value={row.hours} onChange={(e) => setFormRows(formRows.map(r => r.tempId === row.tempId ? {...r, hours: e.target.value} : r))} /> {!isEditing && <button onClick={() => setFormRows(formRows.filter(r => r.tempId !== row.tempId))} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"> <Trash2 size={16}/> </button>} </div>
                  </div>
                ))}
                {!isEditing && ( <button onClick={() => setFormRows([...formRows, { tempId: Date.now().toString(), projectId: '', content: '', hours: 0 }])} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"> <Plus size={18} /> 添加记录 </button> )}
              </div>
            </div>
            <div className="px-10 py-6 border-t border-slate-50 bg-white flex justify-end gap-4 rounded-b-[32px] shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-2.5 text-slate-500 font-black uppercase text-xs"> 取消 </button>
              <button onClick={handleSubmit} disabled={isSaving} className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl shadow-xl text-xs font-black uppercase flex items-center gap-2 transition-all active:scale-95"> {isSaving && <Loader2 className="animate-spin" size={16} />} <Save size={16}/> 保存记录 </button>
            </div>
          </div>
        </div>
      )}

      {deleteLogConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[32px] shadow-2xl max-sm w-full p-10 border border-white/20 animate-in fade-in zoom-in">
            <div className="mx-auto bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center text-rose-500 mb-6"> <AlertTriangle size={36} /> </div>
            <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">确认删除记录？</h3>
            <div className="flex flex-col gap-3 mt-10">
              <button onClick={async () => { setIsDeleting(true); try { await storage.deleteLog(deleteLogConfirmId); fetchData(); setDeleteLogConfirmId(null); } finally { setIsDeleting(false); } }} disabled={isDeleting} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-sm uppercase shadow-xl shadow-rose-100 transition-all active:scale-95"> {isDeleting ? '正在删除...' : '确认删除'} </button>
              <button onClick={() => setDeleteLogConfirmId(null)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase transition-all active:scale-95"> 取消 </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
