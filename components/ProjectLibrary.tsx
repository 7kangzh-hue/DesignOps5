
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { Project, AppConfig, PROJECT_FIELD_LABELS, UserRole, DEFAULT_CONFIG, TagConfig, User, TypeConfig, DictItem } from '../types';
import { Plus, Search, Filter, FolderKanban, Calendar, X, ChevronLeft, ChevronRight, Pencil, Trash2, AlertTriangle, Loader2, Layers, Tag, Layout, Check, Lock, ChevronDown, ChevronRight as ChevronRightIcon, User as UserIcon, Download } from 'lucide-react';
import { ResizableTh } from './TableCommon';
import { exportToCSV } from '../services/exportService';
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

const MultiSelect = ({ 
  options = [], 
  value = [], 
  onChange 
}: { 
  options: {id: string, name: string}[], 
  value: string[], 
  onChange: (val: string[]) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (id: string) => {
    const current = Array.isArray(value) ? value : [];
    if (current.includes(id)) {
      onChange(current.filter(v => v !== id));
    } else {
      onChange([...current, id]);
    }
  };

  const removeTag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const current = Array.isArray(value) ? value : [];
    onChange(current.filter(v => v !== id));
  };

  const safeValue = Array.isArray(value) ? value : [];

  return (
    <div className={`relative ${isOpen ? 'z-[400]' : 'z-auto'}`} ref={wrapperRef}>
      <div 
        className={`w-full min-h-[44px] border rounded-xl px-3 py-1.5 transition-all cursor-pointer flex flex-wrap gap-1.5 items-center ${
          isOpen ? 'ring-4 ring-indigo-50 border-indigo-500 bg-white' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {safeValue.length > 0 ? (
          safeValue.map(id => {
            const user = options.find(o => o.id === id || o.name === id);
            return (
              <span key={id} className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                {user ? user.name : id}
                <span onClick={(e) => removeTag(e, id)} className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full hover:bg-indigo-100 transition-colors"><X size={10}/></span>
              </span>
            );
          })
        ) : (
          <span className="text-slate-400 text-sm">选择负责人...</span>
        )}
        <div className="ml-auto pr-1 text-slate-400">
           <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-[9999] animate-in fade-in slide-in-from-top-2 duration-200">
          {options.length > 0 ? (
            options.map(u => (
              <div 
                key={u.id}
                className={`px-4 py-3 text-sm cursor-pointer border-b border-slate-50 last:border-0 flex items-center justify-between transition-colors ${safeValue.includes(u.id) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-indigo-50'}`}
                onClick={() => handleToggle(u.id)}
              >
                {u.name}
                {safeValue.includes(u.id) && <Check size={14} className="text-indigo-600"/>}
              </div>
            ))
          ) : (
            <div className="p-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                <UserIcon size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500">暂无可选择的人员</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Cascader = ({ 
  options = [], 
  value = '', 
  subValue = '', 
  onChange 
}: { 
  options: TypeConfig[], 
  value: string, 
  subValue: string, 
  onChange: (val: string, subVal: string) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredType, setHoveredType] = useState<TypeConfig | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && value) {
      const current = options.find(o => o.key === value || o.label === value);
      if (current) setHoveredType(current);
    }
  }, [isOpen, value, options]);

  const displayLabel = useMemo(() => {
    if (!value) return '选择类型...';
    const major = getLabelFromDict(options, value);
    if (!subValue) return major;
    const majorObj = options.find(o => o.key === value || o.label === value);
    const sub = majorObj ? getLabelFromDict(majorObj.subTypes, subValue) : subValue;
    return `${major} / ${sub}`;
  }, [value, subValue, options]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        className={`w-full h-11 border rounded-xl px-4 flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? 'ring-4 ring-indigo-50 border-indigo-500 bg-white' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`text-sm font-bold ${value ? 'text-slate-700' : 'text-slate-400'}`}>{displayLabel}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 flex z-[9999] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-48 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden shrink-0">
            {options.map(type => (
              <div 
                key={type.key}
                className={`px-4 py-3 text-sm cursor-pointer border-b border-slate-50 last:border-0 flex items-center justify-between transition-colors ${
                  hoveredType?.key === type.key || value === type.key ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
                onMouseEnter={() => setHoveredType(type)}
                onClick={() => { 
                  if (type.subTypes.length === 0) { 
                    onChange(type.key, ''); 
                    setIsOpen(false); 
                  } 
                }}
              >
                {type.label}
                {type.subTypes.length > 0 && <ChevronRightIcon size={14} className="text-slate-300" />}
              </div>
            ))}
          </div>

          {hoveredType && hoveredType.subTypes.length > 0 && (
            <div className="w-48 bg-white border border-slate-200 rounded-xl shadow-2xl ml-2 overflow-hidden shrink-0 animate-in slide-in-from-left-2 duration-200">
              {hoveredType.subTypes.map(sub => (
                <div 
                  key={sub.key}
                  className={`px-4 py-3 text-sm cursor-pointer border-b border-slate-50 last:border-0 flex items-center justify-between transition-colors ${
                    subValue === sub.key && value === hoveredType.key ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => { 
                    onChange(hoveredType.key, sub.key); 
                    setIsOpen(false); 
                  }}
                >
                  {sub.label}
                  {subValue === sub.key && value === hoveredType.key && <Check size={14} className="text-indigo-600"/>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ProjectLibraryProps {
  userRole: UserRole;
  currentUser: string;
  currentUserId: string;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({ userRole, currentUser, currentUserId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([]);

  const [filters, setFilters] = useState({ month: '', department: '', level: '', type: '', attribute: '', owner: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const initialFormState: Partial<Project> = {
    level: 'B', stage: 'not_started', 
    startTime: new Date().toISOString().split('T')[0],
    owner: [], name: '', department: '', type: '', subType: '', attribute: '', platform: '', details: '', contact: ''
  };
  const [formData, setFormData] = useState<Partial<Project>>(initialFormState);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { fetchData(); }, [currentPage, itemsPerPage]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const fetchedConfig = await storage.getConfig();
      const result = await storage.getProjects(currentPage, itemsPerPage);
      setConfig(fetchedConfig);
      setProjects(result.items);
      setTotalItems(result.totalItems);
      
      const initialWidths: Record<string, number> = {};
      fetchedConfig.projectColumnOrder.forEach(key => {
        initialWidths[key] = key === 'name' ? 200 : key === 'details' ? 300 : 120;
      });
      const savedWidths = localStorage.getItem('project_col_widths');
      setColWidths(savedWidths ? { ...initialWidths, ...JSON.parse(savedWidths) } : initialWidths);
      
      // 初始化列配置
      const savedColumnConfig = localStorage.getItem('project_column_config');
      if (savedColumnConfig) {
        try {
          const parsed = JSON.parse(savedColumnConfig);
          setColumnConfig(parsed);
        } catch (e) {
          // 如果解析失败，使用默认配置
          const defaultColumns: ColumnConfig[] = fetchedConfig.projectColumnOrder.map(key => ({
            key,
            label: PROJECT_FIELD_LABELS[key] || key,
            visible: true
          }));
          setColumnConfig(defaultColumns);
        }
      } else {
        // 默认配置：所有列都显示
        const defaultColumns: ColumnConfig[] = fetchedConfig.projectColumnOrder.map(key => ({
          key,
          label: PROJECT_FIELD_LABELS[key] || key,
          visible: true
        }));
        setColumnConfig(defaultColumns);
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleResize = (key: string, newWidth: number) => {
    const updated = { ...colWidths, [key]: newWidth };
    setColWidths(updated);
    localStorage.setItem('project_col_widths', JSON.stringify(updated));
  };

  const handleSave = async () => {
    const required = ['name', 'department', 'type', 'attribute', 'platform', 'level', 'stage', 'startTime', 'details'];
    for (const field of required) {
      if (!formData[field as keyof Project]) { alert(`请填写必填字段：${PROJECT_FIELD_LABELS[field] || field}`); return; }
    }
    const selectedType = config.types.find(t => t.key === formData.type || t.label === formData.type);
    if (selectedType && selectedType.subTypes.length > 0 && !formData.subType) { alert(`需求类型“${selectedType.label}”需要选择详细小类`); return; }
    if (!formData.owner || formData.owner.length === 0) { alert("请选择负责人"); return; }
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData };
      if (!isEditing) dataToSave.createdBy = currentUserId;
      await storage.saveProject(dataToSave);
      await fetchData(); 
      setIsModalOpen(false);
      setFormData(initialFormState);
      setIsEditing(false);
    } catch (e) { alert("保存失败"); } finally { setIsSaving(false); }
  };

  const confirmDelete = async () => {
    if (deleteId) {
      setIsDeleting(true);
      try {
        await storage.deleteProject(deleteId);
        await fetchData();
        setDeleteId(null);
      } catch (e) {
        alert("删除失败");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Note: Backend filtering is not fully implemented in getProjects signature as requested, 
  // so we still filter current page items for frontend experience. 
  // For true server filtering, storage.getProjects would need an options parameter.
  const displayData = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.details || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchMonth = filters.month ? (p.startTime || '').startsWith(filters.month) : true;
      const matchDept = filters.department ? p.department === filters.department : true;
      const matchLevel = filters.level ? p.level === filters.level : true;
      const matchType = filters.type ? p.type === filters.type : true;
      const matchAttr = filters.attribute ? p.attribute === filters.attribute : true;
      const matchOwner = !filters.owner || (p.owner || []).some(o => o === filters.owner);
      return matchSearch && matchMonth && matchDept && matchLevel && matchType && matchAttr && matchOwner;
    });
  }, [projects, searchTerm, filters]);

  const handleExport = async () => {
    // For export, we typically want the full list, but here we'll export current result or a larger batch
    const allResult = await storage.getProjects(1, 1000); 
    const headers: Record<string, string> = {};
    columnConfig.filter(col => col.visible).forEach(col => {
      headers[col.key] = col.label;
    });
    
    const exportData = allResult.items.map(p => {
      const row: any = {};
      columnConfig.filter(col => col.visible).forEach(col => {
        const key = col.key;
        switch (key) {
          case 'level': 
            row[key] = getLabelFromDict(config.levels, p.level);
            break;
          case 'stage':
            row[key] = getLabelFromDict(config.stages, p.stage);
            break;
          case 'type':
            const major = getLabelFromDict(config.types, p.type);
            const majorObj = config.types.find(t => t.key === p.type || t.label === p.type);
            const sub = majorObj && p.subType ? getLabelFromDict(majorObj.subTypes, p.subType) : '';
            row[key] = sub ? `${major} / ${sub}` : major;
            break;
          case 'department': row[key] = getLabelFromDict(config.departments, p.department); break;
          case 'platform': row[key] = getLabelFromDict(config.platforms, p.platform); break;
          case 'attribute': row[key] = getLabelFromDict(config.attributes, p.attribute); break;
          case 'owner': row[key] = (p.owner || []).map(id => config.users.find(u => u.id === id || u.name === id)?.name || id).join(', '); break;
          default: row[key] = p[key as keyof Project] || '';
        }
      });
      return row;
    });

    exportToCSV(exportData, headers, '项目库数据');
  };

  const renderCell = (key: string, project: Project) => {
    switch (key) {
      case 'level': {
        const t = (config.levels as TagConfig[]).find(item => item.key === project.level || item.label === project.level);
        return <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-lg text-[10px] font-black text-slate-700 shadow-sm border border-black/5" style={{ backgroundColor: t?.color || '#f1f5f9' }}>{t?.label || project.level}</span>;
      }
      case 'stage': {
        const t = (config.stages as TagConfig[]).find(item => item.key === project.stage || item.label === project.stage);
        return <span className="inline-block px-3 py-1 rounded-lg text-[10px] font-black text-slate-700 border border-black/5" style={{ backgroundColor: t?.color || '#f1f5f9' }}>{t?.label || project.stage}</span>;
      }
      case 'type': {
        const majorLabel = getLabelFromDict(config.types, project.type);
        const majorObj = config.types.find(t => t.key === project.type || t.label === project.type);
        const subLabel = majorObj && project.subType ? getLabelFromDict(majorObj.subTypes, project.subType) : '';
        return (
          <span className="flex flex-col">
            <span className="text-slate-900">{majorLabel}</span>
            {subLabel && <span className="text-[9px] text-slate-400 font-medium">({subLabel})</span>}
          </span>
        );
      }
      case 'department': return getLabelFromDict(config.departments, project.department);
      case 'platform': return getLabelFromDict(config.platforms, project.platform);
      case 'attribute': return getLabelFromDict(config.attributes, project.attribute);
      case 'owner': return (project.owner || []).map(id => config.users.find(u => u.id === id || u.name === id)?.name || id).join(', ');
      default: return project[key as keyof Project] || '-';
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-400" /></div>;

  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight mb-2">
            <FolderKanban className="text-indigo-600" size={32} /> 项目库
          </h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            全量设计需求资产管理中心 (共 {totalItems} 条数据)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ColumnManager
            columns={columnConfig}
            onColumnsChange={setColumnConfig}
            storageKey="project_column_config"
            title="项目库列管理"
          />
          <button onClick={handleExport} className="h-12 px-6 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-all font-black text-sm uppercase"> <Download size={20} /> 导出 </button>
          <button onClick={() => { setFormData(initialFormState); setIsEditing(false); setIsModalOpen(true); }} className="bg-indigo-600 text-white h-12 px-8 rounded-2xl hover:bg-indigo-700 flex items-center gap-2 shadow-xl shadow-indigo-100 transition-all font-black text-sm uppercase"> <Plus size={20} /> 新增项目 </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 px-3 mr-2 border-r border-slate-100"> <Filter size={16} /> 筛选 </div>
        {[
          { key: 'department', options: config.departments, label: '所有部门' }, 
          { key: 'level', options: config.levels, label: '所有级别' }, 
          { key: 'type', options: config.types, label: '所有类型' }, 
          { key: 'attribute', options: config.attributes, label: '所有属性' }
        ].map(f => (
          <select key={f.key} className="h-10 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-600 outline-none cursor-pointer" value={filters[f.key as keyof typeof filters]} onChange={e => setFilters({...filters, [f.key]: e.target.value})}>
            <option value="">{f.label}</option>
            {f.options.map((o: any) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        ))}
        <select className="h-10 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-600 outline-none cursor-pointer" value={filters.owner} onChange={e => setFilters({...filters, owner: e.target.value})}>
          <option value="">所有负责人</option>
          {config.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="ml-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="搜索项目..." className="h-10 pl-11 pr-5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs outline-none w-72 font-bold text-slate-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-[24px] shadow-md border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed border-separate border-spacing-0">
            <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
              <tr>
                {columnConfig.filter(col => col.visible).map(col => (
                  <ResizableTh key={col.key} width={colWidths[col.key] || 120} onResize={(w) => handleResize(col.key, w)} className="px-6 py-2.5"> {col.label} </ResizableTh>
                ))}
                <th className="px-6 py-2.5 w-24 text-center sticky right-0 bg-slate-50 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400"> 操作 </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayData.length > 0 ? displayData.map(project => (
                    <tr key={project.id} className="hover:bg-indigo-50/30 even:bg-slate-50 transition-colors group">
                      {columnConfig.filter(col => col.visible).map(col => ( <td key={col.key} className="px-6 py-4 truncate text-slate-600 font-bold"> {renderCell(col.key, project)} </td> ))}
                      <td className="px-6 py-4 text-center sticky right-0 bg-white group-even:bg-slate-50 group-hover:bg-indigo-50 shadow-[-12px_0_15px_-10px_rgba(0,0,0,0.1)] z-20">
                        <div className="flex items-center justify-center gap-2">
                          {(userRole === 'manager' || project.createdBy === currentUserId) ? ( <> <button onClick={() => { setFormData({ ...project, owner: Array.isArray(project.owner) ? project.owner : [] }); setIsEditing(true); setIsModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-white rounded-xl shadow-sm"> <Pencil size={14} /> </button> <button onClick={() => setDeleteId(project.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl shadow-sm"> <Trash2 size={14} /> </button> </> ) : ( <Lock size={14} className="text-slate-300" /> )}
                        </div>
                      </td>
                    </tr>
              )) : (
                <tr>
                  <td colSpan={100} className="p-0">
                    <EmptyState
                      icon={FolderKanban}
                      title="暂无项目记录"
                      description="开始创建您的第一个项目，让团队工作更加有序"
                      action={{
                        label: '创建项目',
                        onClick: () => {
                          setIsEditing(false);
                          setFormData({
                            id: '',
                            name: '',
                            level: 'C',
                            details: '',
                            type: '',
                            stage: 'not_started',
                            platform: '',
                            startTime: '',
                            attribute: '',
                            department: '',
                            owner: [],
                            contact: ''
                          });
                          setIsModalOpen(true);
                        },
                        icon: Plus
                      }}
                      illustration="project"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="h-16 border-t border-slate-100 bg-slate-50 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <span>显示 {displayData.length} 条 / 共 {totalItems} 条</span>
            <div className="h-4 w-px bg-slate-200 mx-2"></div>
            <span>第 {currentPage} / {totalPages || 1} 页</span>
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="h-9 bg-white border border-slate-200 rounded-lg px-2 text-[10px] font-black uppercase outline-none mr-2"
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
              <option value={100}>100条/页</option>
            </select>
            <button 
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="h-9 w-9 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="h-9 w-9 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-300 border border-white/20">
            <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight"> {isEditing ? '编辑项目' : '创建项目'} </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 h-10 w-10 flex items-center justify-center"> <X size={24} /> </button>
            </div>
            <div className="px-10 py-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-12 gap-x-8 gap-y-10 pb-10">
                <div className="col-span-8"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">项目名称 *</label> <input className="w-full h-11 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-4 outline-none transition-all font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /> </div>
                <div className="col-span-4"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">归属部门 *</label> <select className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 outline-none font-bold" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} > <option value="">选择部门</option> {config.departments.map(d => <option key={d.key} value={d.key}>{d.label}</option>)} </select> </div>
                <div className="col-span-4"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">需求类型 *</label> <Cascader options={config.types} value={formData.type || ''} subValue={formData.subType || ''} onChange={(val, subVal) => setFormData({...formData, type: val, subType: subVal})} /> </div>
                <div className="col-span-4"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">项目属性 *</label> <select className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 outline-none font-bold" value={formData.attribute} onChange={e => setFormData({...formData, attribute: e.target.value})} > <option value="">选择属性</option> {config.attributes.map(a => <option key={a.key} value={a.key}>{a.label}</option>)} </select> </div>
                <div className="col-span-4"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">开发平台 *</label> <select className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 outline-none font-bold" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} > <option value="">选择平台</option> {config.platforms.map(p => <option key={p.key} value={p.key}>{p.label}</option>)} </select> </div>
                <div className="col-span-4"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">项目级别 *</label> <select className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 outline-none font-bold" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} > {config.levels.map(l => <option key={l.key} value={l.key}>{l.label}</option>)} </select> </div>
                <div className="col-span-4"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">项目阶段 *</label> <select className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 outline-none font-bold" value={formData.stage} onChange={e => setFormData({...formData, stage: e.target.value})} > {config.stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)} </select> </div>
                <div className="col-span-4"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">启动时间 *</label> <input type="date" className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 outline-none font-bold" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} /> </div>
                <div className="col-span-6"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">负责人 *</label> <MultiSelect options={config.users.map(u => ({ id: u.id, name: u.name }))} value={formData.owner || []} onChange={(val) => setFormData({...formData, owner: val})} /> </div>
                <div className="col-span-6"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">对接人</label> <input className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 outline-none font-bold" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} /> </div>
                <div className="col-span-12"> <label className="block text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3">需求描述 *</label> <textarea className="w-full border border-slate-200 bg-slate-50 rounded-xl px-5 py-4 min-h-[140px] outline-none font-bold" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} /> </div>
              </div>
            </div>
            <div className="px-10 py-6 bg-slate-50 border-t border-slate-50 flex justify-end gap-4 rounded-b-[32px] shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-2.5 text-slate-500 font-black uppercase tracking-widest"> 取消 </button>
              <button onClick={handleSave} disabled={isSaving} className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl shadow-xl text-sm font-black uppercase flex items-center gap-2"> {isSaving && <Loader2 className="animate-spin" size={18} />} {isEditing ? '更新项目' : '创建项目'} </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-10 animate-in fade-in zoom-in border border-white/20">
            <div className="mx-auto bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center text-rose-500 mb-6"> <AlertTriangle size={36} /> </div>
            <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">确认删除项目？</h3>
            <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed">该动作将移除该项目及其所有工时记录，操作不可恢复。</p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} disabled={isDeleting} className="w-full py-4 bg-rose-600 text-white rounded-2xl shadow-xl font-black text-sm uppercase"> {isDeleting ? '正在删除...' : '确认删除'} </button>
              <button onClick={() => setDeleteId(null)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase"> 取消 </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
