
import { format } from 'date-fns/format';
import { isSameDay } from 'date-fns/isSameDay';
import { isSameWeek } from 'date-fns/isSameWeek';
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { subDays } from 'date-fns/subDays';
import { isAfter } from 'date-fns/isAfter';
import { startOfDay } from 'date-fns/startOfDay';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { storage } from '../services/storage';
import { ManagerNote, Project, AppConfig, DEFAULT_CONFIG } from '../types';
import { PenLine, Calendar, ChevronLeft, ChevronRight, Trash2, Pencil, Save, X, Hash, AlertTriangle, Loader2, Plus, Sparkles, FolderKanban } from 'lucide-react';
import { EmptyState } from './EmptyState';

type ViewMode = 'day' | 'week';

export const ManagerNotes: React.FC = () => {
  const [notes, setNotes] = useState<ManagerNote[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  
  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [inputValue, setInputValue] = useState('');
  const [noteDate, setNoteDate] = useState(todayStr);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [showProjectPopup, setShowProjectPopup] = useState(false);
  const [popupSearch, setPopupSearch] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedNotes, projectResult, fetchedConfig] = await Promise.all([
        storage.getManagerNotes(),
        storage.getProjects(1, 1000),
        storage.getConfig()
      ]);
      setNotes(fetchedNotes);
      setProjects(projectResult.items);
      setConfig(fetchedConfig);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotes = useMemo(() => {
    const list = notes.filter(note => {
      const noteDateParsed = parseISO(note.date);
      if (viewMode === 'day') return isSameDay(noteDateParsed, currentDate);
      return isSameWeek(noteDateParsed, currentDate, { weekStartsOn: 1 });
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [notes, currentDate, viewMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.endsWith('@')) { setShowProjectPopup(true); setPopupSearch(''); }
    else if (showProjectPopup) {
      const lastAt = val.lastIndexOf('@');
      if (lastAt !== -1) setPopupSearch(val.substring(lastAt + 1));
      else setShowProjectPopup(false);
    }
  };

  const selectProject = (project: Project) => {
    setLinkedProjectId(project.id);
    const lastAt = inputValue.lastIndexOf('@');
    if (lastAt !== -1) {
      const newValue = inputValue.substring(0, lastAt) + `@${project.name} `;
      setInputValue(newValue);
    }
    setShowProjectPopup(false);
    inputRef.current?.focus();
  };

  const handleSave = async () => {
    if (!inputValue.trim()) return;
    if (isAfter(parseISO(noteDate), today)) { alert("无法记录未来的随手记"); return; }
    const now = new Date();
    const timePart = `T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const fullISODate = `${noteDate}${timePart}`;
    
    const newNote: Partial<ManagerNote> = {
      ...(editingNoteId ? { id: editingNoteId } : {}),
      content: inputValue,
      date: fullISODate,
      relatedProjectId: linkedProjectId || undefined,
      relatedProjectName: '' 
    };
    
    try {
      await storage.saveManagerNote(newNote);
      await fetchData();
      setInputValue('');
      setNoteDate(todayStr);
      setLinkedProjectId(null);
      setEditingNoteId(null);
    } catch (e) {
      alert("保存失败");
    }
  };

  const handleEdit = (note: ManagerNote) => {
    setEditingNoteId(note.id);
    setInputValue(note.content);
    setNoteDate(note.date.split('T')[0]);
    setLinkedProjectId(note.relatedProjectId || null);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => { e.stopPropagation(); setDeleteConfirmId(id); };
  
  const confirmDelete = async () => {
    if (deleteConfirmId) {
      await storage.deleteManagerNote(deleteConfirmId);
      const updatedNotes = await storage.getManagerNotes();
      setNotes(updatedNotes);
      if (editingNoteId === deleteConfirmId) { setEditingNoteId(null); setInputValue(''); setNoteDate(todayStr); setLinkedProjectId(null); }
      setDeleteConfirmId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setInputValue('');
    setNoteDate(todayStr);
    setLinkedProjectId(null);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (viewMode === 'day') setCurrentDate(prev => subDays(prev, 1));
      else setCurrentDate(prev => subDays(prev, 7));
    } else {
      if (viewMode === 'day') {
        const nextDay = addDays(currentDate, 1);
        if (isAfter(startOfDay(nextDay), today)) return;
        setCurrentDate(nextDay);
      } else {
        const nextWeek = addDays(currentDate, 7);
        if (isAfter(startOfWeek(nextWeek, { weekStartsOn: 1 }), startOfWeek(today, { weekStartsOn: 1 }))) return;
        setCurrentDate(nextWeek);
      }
    }
  };

  const isNextDisabled = useMemo(() => {
    if (viewMode === 'day') return isSameDay(currentDate, today) || isAfter(currentDate, today);
    return isSameWeek(currentDate, today, { weekStartsOn: 1 }) || isAfter(currentDate, today);
  }, [currentDate, today, viewMode]);

  const filteredProjectsList = projects.filter(p => p.name.toLowerCase().includes(popupSearch.toLowerCase()) || p.id.includes(popupSearch));

  const getLinkedProjectLabel = (note: ManagerNote) => {
    const proj = note.expand?.relatedProjectId;
    if (proj) {
      const stageItem = config.stages.find(s => s.key === proj.stage || s.label === proj.stage);
      const deptItem = config.departments.find(d => d.key === proj.department || d.label === proj.department);
      return (
        <span className="flex items-center gap-1.5">
           <span className="font-black">#{proj.name}</span>
           <span className="opacity-50 text-[9px] font-bold">
             ({deptItem?.label || proj.department} · {stageItem?.label || proj.stage})
           </span>
        </span>
      );
    }
    if (note.relatedProjectId) return <span className="text-rose-400 italic flex items-center gap-1"> <AlertTriangle size={10} /> 关联项目已失效 </span>;
    if (note.relatedProjectName) return <span>#{note.relatedProjectName} (历史存档)</span>;
    return null;
  };

  if (isLoading) return <div className="h-full flex items-center justify-center text-gray-400"><Loader2 className="animate-spin text-indigo-400" /></div>;

  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight mb-2">
            <PenLine className="text-indigo-600" size={32} /> 每日随手记
          </h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            管理随享，实时关联项目库最新动态
          </p>
        </div>

        <div className="flex items-center bg-white rounded-2xl shadow-sm border border-slate-200 p-1.5">
          <button onClick={() => { setViewMode('day'); setCurrentDate(new Date()); }} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'day' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:text-slate-900'}`}> 日视图 </button>
          <button onClick={() => { setViewMode('week'); setCurrentDate(new Date()); }} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'week' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:text-slate-900'}`}> 周视图 </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 h-full overflow-hidden items-start">
        <div className="lg:w-[400px] flex flex-col gap-6 shrink-0">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 flex flex-col w-full relative overflow-visible">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
              {editingNoteId ? <Pencil size={18} className="text-amber-500"/> : <PenLine size={18} className="text-indigo-500"/>}
              {editingNoteId ? '更新记录' : '快速记录'}
            </h3>
            
            <div className="mb-8">
              <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">记录日期</label>
              <div className="relative">
                <input type="date" max={todayStr} className="w-full h-11 border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 rounded-xl px-12 text-sm font-bold text-slate-700 outline-none transition-all" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>
            </div>

            <div className="relative mb-6">
              <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">记事详情</label>
              <textarea 
                ref={inputRef}
                className="w-full min-h-[160px] border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 rounded-xl p-5 text-sm font-bold text-slate-700 outline-none resize-none leading-relaxed transition-all focus:ring-4 focus:ring-indigo-500/5"
                placeholder="输入随手记... 输入 '@' 关联项目"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !showProjectPopup) { e.preventDefault(); handleSave(); } }}
              />
              
              {showProjectPopup && (
                <div className="absolute top-10 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-[100] animate-in fade-in zoom-in duration-150 border-white/20">
                  <div className="px-5 py-3 bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100"> 关联项目 (Relation) </div>
                  {filteredProjectsList.length > 0 ? (
                    filteredProjectsList.map(p => (
                      <div key={p.id} onClick={() => selectProject(p)} className="px-5 py-4 hover:bg-indigo-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-0 transition-colors">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1 uppercase font-black">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">{(config.departments.find(d => d.key === p.department || d.label === p.department))?.label || p.department}</span>
                          <span>{(config.stages.find(s => s.key === p.stage || s.label === p.stage))?.label || p.stage}</span>
                        </div>
                      </div>
                    ))
                  ) : ( <div className="p-6 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">无匹配项目</div> )}
                </div>
              )}
            </div>

            {linkedProjectId && (
              <div className="mb-8 flex items-center gap-3 bg-indigo-50 px-4 py-3 rounded-xl text-[11px] text-indigo-700 font-black border border-indigo-100 shadow-sm shadow-indigo-100/20 uppercase tracking-widest">
                <FolderKanban size={14} className="text-indigo-400" />
                <span className="truncate">已关联: {projects.find(p => p.id === linkedProjectId)?.name || '未知项目'}</span>
                <button onClick={() => setLinkedProjectId(null)} className="ml-auto hover:text-rose-500 bg-white rounded-full h-5 w-5 flex items-center justify-center transition-colors shadow-sm"><X size={12}/></button>
              </div>
            )}

            <div className="flex gap-4">
              {editingNoteId && ( <button onClick={handleCancelEdit} className="flex-1 h-12 border border-slate-200 rounded-xl text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"> 取消编辑 </button> )}
              <button onClick={handleSave} className="flex-1 h-12 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all">
                {editingNoteId ? <Save size={18} /> : <Plus size={20} />}
                {editingNoteId ? '更新记录' : '立即记录'}
              </button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm flex gap-4 items-start">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 shrink-0"> <Sparkles size={20}/> </div>
            <div className="text-xs font-medium text-slate-500 leading-relaxed">
              <strong className="text-slate-900 block mb-1">升级提示:</strong>
              随手记现已全面接入项目关联（Relation）。点击记录上的项目标签可实时查看该项目的库内最新状态和部门归属。
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-[32px] shadow-sm border border-slate-200 flex flex-col overflow-hidden self-stretch">
          <div className="h-20 border-b border-slate-50 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <button onClick={() => navigateDate('prev')} className="h-11 w-11 flex items-center justify-center hover:bg-slate-50 rounded-2xl text-slate-400 transition-all active:scale-90 border border-transparent hover:border-slate-100"><ChevronLeft size={24}/></button>
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                <Calendar size={20} className="text-indigo-600"/>
                {viewMode === 'day' ? format(currentDate, 'yyyy-MM-dd (EEE)') : `${format(startOfWeek(currentDate, {weekStartsOn: 1}), 'MM.dd')} - ${format(endOfWeek(currentDate, {weekStartsOn: 1}), 'MM.dd')}`}
              </span>
              {isSameDay(currentDate, new Date()) && viewMode === 'day' && (
                <span className="text-[9px] text-indigo-600 font-black bg-indigo-50 px-3 py-1 rounded-full mt-1.5 uppercase tracking-widest">今天</span>
              )}
            </div>
            <button onClick={() => navigateDate('next')} disabled={isNextDisabled} className={`h-11 w-11 flex items-center justify-center rounded-2xl transition-all active:scale-90 border border-transparent ${isNextDisabled ? 'text-slate-100 cursor-not-allowed' : 'hover:bg-slate-50 hover:border-slate-100 text-slate-400'}`}>
              <ChevronRight size={24}/>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-10 bg-slate-50/20 relative custom-scrollbar">
            {filteredNotes.length > 0 && ( <div className="absolute left-[2.45rem] top-10 bottom-10 w-0.5 bg-slate-100"></div> )}

            <div className="space-y-4">
              {filteredNotes.length > 0 ? (
                filteredNotes.map(note => {
                  const date = parseISO(note.date);
                  return (
                    <div key={note.id} className="relative pl-10 group">
                      <div className="absolute left-0 top-1 w-5 h-5 rounded-full border-4 border-white bg-indigo-500 shadow-xl z-10 group-hover:scale-125 transition-all duration-300"></div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-all duration-300 relative group/card">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-[9px] text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg uppercase tracking-[0.1em]"> {format(date, 'MM-dd HH:mm')} </span>
                            {getLinkedProjectLabel(note) && (
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">
                                {getLinkedProjectLabel(note)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-all translate-x-2 group-hover/card:translate-x-0">
                            <button onClick={() => handleEdit(note)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shadow-sm bg-white border border-slate-50" title="编辑"> <Pencil size={12} /> </button>
                            <button onClick={(e) => handleDeleteClick(e, note.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shadow-sm bg-white border border-slate-50" title="删除"> <Trash2 size={12} /> </button>
                          </div>
                        </div>
                        <div className="text-slate-700 text-sm font-bold whitespace-pre-wrap leading-relaxed"> {note.content} </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={PenLine}
                  title="未找到记录"
                  description={viewMode === 'day' 
                    ? `在 ${format(currentDate, 'yyyy年MM月dd日')} 还没有记录，开始记录您的管理洞察吧` 
                    : `本周还没有记录，开始记录您的管理洞察吧`}
                  action={{
                    label: '立即记录',
                    onClick: () => {
                      setInputValue('');
                      setNoteDate(format(currentDate, 'yyyy-MM-dd'));
                      inputRef.current?.focus();
                    },
                    icon: Plus
                  }}
                  illustration="note"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-10 animate-in fade-in zoom-in duration-200 border border-white/20 text-center">
            <div className="mx-auto bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center text-rose-500 mb-6"> <AlertTriangle size={36} /> </div>
            <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">确认删除随手记？</h3>
            <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed">该动作记录将被永久移除，且无法在周报中自动引用。</p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} className="w-full py-4 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-100 font-black text-sm uppercase tracking-widest transition-all hover:bg-rose-700 active:scale-95"> 确认删除 </button>
              <button onClick={() => setDeleteConfirmId(null)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:bg-slate-200 active:scale-95"> 取消操作 </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
