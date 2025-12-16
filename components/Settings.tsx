
import React, { useState, useRef, useEffect } from 'react';
import { storage } from '../services/storage';
import { AppConfig, PROJECT_FIELD_LABELS, ReportTemplate, User, DEFAULT_CONFIG, TagConfig, TypeConfig, DictItem } from '../types';
import { Plus, Trash2, Settings as SettingsIcon, LayoutList, FileText, Edit2, Save, X, Users, Shield, AlertTriangle, List, ChevronRight, GripVertical, Loader2, Palette, Check, RefreshCw, Layers, Key, ExternalLink, ShieldCheck, ShieldAlert, Info, Lock } from 'lucide-react';
import { ResizableTh } from './TableCommon';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

type SettingTab = 'users' | 'dictionaries' | 'columns' | 'templates' | 'api';

interface SettingsProps {
  currentUserId?: string;
}

const PRESET_COLORS = [
  { hex: '#fee2e2', name: '红' }, { hex: '#ffedd5', name: '橙' }, { hex: '#fef3c7', name: '黄' }, { hex: '#dcfce7', name: '绿' }, { hex: '#d1fae5', name: '青' }, { hex: '#ccfbf1', name: '蓝绿' }, { hex: '#dbeafe', name: '蓝' }, { hex: '#e0e7ff', name: '靛' }, { hex: '#f3e8ff', name: '紫' }, { hex: '#fae8ff', name: '粉' }, { hex: '#f3f4f6', name: '灰' }, { hex: '#ffffff', name: '白' },
];

const generateKey = (label: string) => {
  return label.toLowerCase().replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fa5]/g, '') || `id_${Date.now().toString(36)}`;
};

export const Settings: React.FC<SettingsProps> = ({ currentUserId }) => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [newItems, setNewItems] = useState<Partial<Record<keyof AppConfig, string>>>({});
  const [activeTab, setActiveTab] = useState<SettingTab>('users');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modals state
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [deleteUserConfirmId, setDeleteUserConfirmId] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<{ key: 'levels' | 'stages', item: TagConfig } | null>(null);
  const [editingType, setEditingType] = useState<TypeConfig | null>(null);
  const [editingDictItem, setEditingDictItem] = useState<{ key: keyof AppConfig, item: DictItem, index: number } | null>(null);
  
  const [newSubTypeLabel, setNewSubTypeLabel] = useState('');
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [keyCheckLoading, setKeyCheckLoading] = useState(true);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  const [userColWidths, setUserColWidths] = useState<Record<string, number>>({ 
    name: 200, username: 250, role: 150, actions: 120 
  });

  useEffect(() => { 
    loadConfig(); 
    checkApiKeyStatus();
  }, []);

  const checkApiKeyStatus = async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      const has = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(has);
    } else {
      setHasApiKey(!!(process.env.API_KEY || ''));
    }
    setKeyCheckLoading(false);
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      await checkApiKeyStatus();
    } else {
      alert("当前运行环境不支持在线密钥配置。");
    }
  };

  const loadConfig = async () => {
    setIsLoading(true);
    try { const c = await storage.getConfig(); setConfig(c); } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const saveConfigChange = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    try { await storage.saveConfig(newConfig); } catch (e) { alert("保存失败"); }
  };

  const handleAddDictItem = async (key: keyof AppConfig) => {
    const val = newItems[key];
    if (!val || !val.trim()) return;
    const currentList = (config[key] as DictItem[]) || [];
    const trimmedVal = val.trim();
    if (currentList.some(i => i.label === trimmedVal)) { alert("名称已存在"); return; }
    const newItem = { key: generateKey(trimmedVal), label: trimmedVal };
    const updated = { ...config, [key]: [...currentList, newItem] };
    setNewItems(prev => ({ ...prev, [key]: '' }));
    await saveConfigChange(updated);
  };

  const handleUpdateDictItem = async () => {
    if (!editingDictItem) return;
    const { key, index, item } = editingDictItem;
    if (!item.label.trim()) return;
    const currentList = [...(config[key] as DictItem[])];
    currentList[index] = { ...item };
    const updated = { ...config, [key]: currentList };
    await saveConfigChange(updated);
    setEditingDictItem(null);
  };

  const handleDeleteDictItem = async (key: keyof AppConfig, itemKey: string) => {
    if (!confirm("确定要删除此选项吗？这可能会影响历史数据的显示。")) return;
    const currentList = (config[key] as DictItem[]) || [];
    const updated = { ...config, [key]: currentList.filter(i => i.key !== itemKey) };
    await saveConfigChange(updated);
  };

  const handleAddMajorType = async () => {
    const val = newItems['types'];
    if (!val || !val.trim()) return;
    if (config.types.some(t => t.label === val.trim())) { alert("名称已存在"); return; }
    const newType: TypeConfig = { key: generateKey(val.trim()), label: val.trim(), subTypes: [] };
    const updated = { ...config, types: [...config.types, newType] };
    setNewItems(prev => ({ ...prev, types: '' }));
    await saveConfigChange(updated);
  };

  const handleUpdateTypeConfig = async () => {
    if (!editingType) return;
    const updatedTypes = config.types.map(t => t.key === editingType.key ? editingType : t);
    const updated = { ...config, types: updatedTypes };
    await saveConfigChange(updated);
    setEditingType(null);
  };

  const handleAddTag = async (key: 'levels' | 'stages') => {
    const val = newItems[key];
    if (!val || !val.trim()) return;
    const currentList = config[key] as TagConfig[];
    if (currentList.some(item => item.label === val.trim())) { alert("名称已存在"); return; }
    const newItem: TagConfig = { key: generateKey(val.trim()), label: val.trim(), color: PRESET_COLORS[6].hex };
    const updated = { ...config, [key]: [...currentList, newItem] };
    setNewItems(prev => ({ ...prev, [key]: '' }));
    await saveConfigChange(updated);
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !editingTag.item.label.trim()) return;
    const { key, item } = editingTag;
    const currentList = config[key] as TagConfig[];
    const updatedList = currentList.map(i => i.key === item.key ? item : i);
    const updated = { ...config, [key]: updatedList };
    await saveConfigChange(updated);
    setEditingTag(null);
  };

  const saveUser = async () => {
    if (!editingUser || !editingUser.name || !editingUser.username) { alert("请填写完整姓名和账号"); return; }
    setIsSaving(true);
    try { 
      await storage.saveUser(editingUser); 
      await loadConfig(); 
      setIsUserModalOpen(false); 
    } catch (e: any) { 
      alert("保存失败"); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.name || !editingTemplate.content) { alert("请填写模板信息"); return; }
    let updatedTemplates = [...config.reportTemplates];
    if (editingTemplate.id) updatedTemplates = updatedTemplates.map(t => t.id === editingTemplate.id ? editingTemplate : t);
    else updatedTemplates.push({ ...editingTemplate, id: Date.now().toString() });
    await saveConfigChange({ ...config, reportTemplates: updatedTemplates });
    setIsTemplateModalOpen(false);
  };

  const handleDragEnd = async () => {
    const dIdx = dragItem.current, oIdx = dragOverItem.current;
    if (dIdx !== null && oIdx !== null && dIdx !== oIdx) {
      const newOrder = [...config.projectColumnOrder];
      const [dragged] = newOrder.splice(dIdx, 1);
      newOrder.splice(oIdx, 0, dragged);
      await saveConfigChange({ ...config, projectColumnOrder: newOrder });
    }
    dragItem.current = dragOverItem.current = null;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"> <Users size={20} /> </div>
                <div>
                   <h3 className="font-black text-slate-900 tracking-tight">团队成员管理</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">管理系统登录账户及角色权限</p>
                </div>
              </div>
              <button onClick={() => { setEditingUser({ name: '', username: '', password: '', role: 'member' }); setIsUserModalOpen(true); }} className="bg-indigo-600 text-white h-11 px-6 rounded-xl hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-100 font-black text-xs uppercase transition-all active:scale-95">
                <Plus size={18} /> 新增成员
              </button>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left table-fixed border-separate border-spacing-0">
                <thead className="bg-slate-50">
                  <tr>
                    <ResizableTh width={userColWidths.name} onResize={(w) => setUserColWidths({...userColWidths, name: w})}>显示姓名</ResizableTh>
                    <ResizableTh width={userColWidths.username} onResize={(w) => setUserColWidths({...userColWidths, username: w})}>登录账号</ResizableTh>
                    <ResizableTh width={userColWidths.role} onResize={(w) => setUserColWidths({...userColWidths, role: w})}>系统角色</ResizableTh>
                    <th className="px-8 py-4 text-center font-black text-[10px] uppercase text-slate-400 tracking-widest border-b border-slate-200">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {config.users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-5 font-bold text-slate-700 truncate">{user.name}</td>
                      <td className="px-8 py-5 font-mono text-sm text-slate-500 truncate">{user.username}</td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${user.role === 'manager' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-100 text-slate-600'}`}>
                           {user.role === 'manager' ? <Shield size={10} /> : <Users size={10} />}
                           {user.role === 'manager' ? '部门经理' : '普通成员'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setEditingUser({ ...user, password: '' }); setIsUserModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-white rounded-lg shadow-sm border border-slate-100"> <Edit2 size={14} /> </button>
                          <button onClick={() => { if (currentUserId && user.id === currentUserId) { alert("无法删除当前账号"); return; } setDeleteUserConfirmId(user.id); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg shadow-sm border border-slate-100"> <Trash2 size={14} /> </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'dictionaries':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-[20px] flex items-center justify-center text-indigo-600"> <Layers size={24} /> </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 tracking-tight">需求类别与子类</h3>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">定义业务需求的层级分类结构</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <input type="text" placeholder="输入大类名称..." className="h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm font-bold w-48 outline-none" value={newItems['types'] || ''} onChange={e => setNewItems({...newItems, types: e.target.value})} />
                    <button onClick={handleAddMajorType} className="bg-indigo-600 text-white h-11 px-5 rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"> <Plus size={20} /> </button>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {config.types.map(type => (
                  <div key={type.key} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all hover:bg-white hover:shadow-xl hover:shadow-indigo-100/20">
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-sm font-black text-slate-900 flex items-center gap-2"> <LayoutList size={14} className="text-indigo-500" /> {type.label} </span>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingType({ ...type })} className="p-1.5 text-indigo-600 hover:bg-white rounded-lg"> <Edit2 size={12} /> </button>
                         <button onClick={() => { if (confirm(`确定删除此大类吗？`)) { const updated = config.types.filter(t => t.key !== type.key); saveConfigChange({...config, types: updated}); } }} className="p-1.5 text-rose-500 hover:bg-white rounded-lg"> <Trash2 size={12} /> </button>
                       </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {type.subTypes.length > 0 ? type.subTypes.map(sub => (
                        <span key={sub.key} className="bg-white border border-slate-100 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-500 shadow-sm"> {sub.label} </span>
                      )) : <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">暂无子类</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[ { key: 'levels' as const, label: '项目级别 (Levels)', icon: <Palette size={20} /> }, { key: 'stages' as const, label: '项目阶段 (Stages)', icon: <Check size={20} /> } ].map(group => (
                <div key={group.key} className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                   <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"> {group.icon} </div>
                         <h3 className="font-black text-slate-900 tracking-tight">{group.label}</h3>
                      </div>
                      <div className="flex gap-2">
                         <input type="text" placeholder="新增..." className="h-10 border border-slate-200 bg-slate-50 rounded-xl px-3 text-xs font-bold w-24" value={newItems[group.key] || ''} onChange={e => setNewItems({...newItems, [group.key]: e.target.value})} />
                         <button onClick={() => handleAddTag(group.key)} className="bg-slate-900 text-white h-10 w-10 rounded-xl flex items-center justify-center"> <Plus size={18}/> </button>
                      </div>
                   </div>
                   <div className="space-y-3">
                      {(config[group.key] as TagConfig[]).map(item => (
                        <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-md transition-all">
                           <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-lg border border-black/5" style={{ backgroundColor: item.color }}></div>
                              <span className="text-sm font-bold text-slate-700">{item.label}</span>
                           </div>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingTag({ key: group.key, item: { ...item } })} className="p-1.5 text-indigo-600"> <Edit2 size={14} /> </button>
                              <button onClick={() => handleDeleteDictItem(group.key, item.key)} className="p-1.5 text-rose-500"> <Trash2 size={14} /> </button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
              {[ { key: 'departments' as const, label: '归属部门' }, { key: 'platforms' as const, label: '开发平台' }, { key: 'attributes' as const, label: '项目属性' } ].map(dict => (
                <div key={dict.key} className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{dict.label}</h4>
                     <button onClick={() => handleAddDictItem(dict.key)} className="text-indigo-600"> <Plus size={18}/> </button>
                  </div>
                  <input type="text" placeholder="快速添加..." className="w-full h-9 border border-slate-100 bg-slate-50 rounded-lg px-3 text-xs mb-4" value={newItems[dict.key] || ''} onChange={e => setNewItems({...newItems, [dict.key]: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleAddDictItem(dict.key)} />
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                     {(config[dict.key] as DictItem[]).map((item, idx) => (
                       <div key={item.key} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group transition-colors">
                          <span className="text-xs font-bold text-slate-600">{item.label}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingDictItem({ key: dict.key, item: { ...item }, index: idx })} className="text-indigo-400 hover:text-indigo-600"> <Edit2 size={10} /> </button>
                            <button onClick={() => handleDeleteDictItem(dict.key, item.key)} className="text-slate-300 hover:text-rose-600"> <X size={12}/> </button>
                          </div>
                       </div>
                     ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'columns':
        return (
          <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
             <div className="flex items-start gap-4 mb-10 border-b border-slate-50 pb-8">
                <div className="w-12 h-12 bg-indigo-50 rounded-[20px] flex items-center justify-center text-indigo-600"> <LayoutList size={24} /> </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 tracking-tight">项目库字段排序</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">通过拖拽决定项目库表格中字段的显示先后顺序</p>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.projectColumnOrder.map((key, index) => (
                  <div 
                    key={key}
                    draggable
                    onDragStart={() => dragItem.current = index}
                    onDragEnter={() => dragOverItem.current = index}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-grab active:cursor-grabbing hover:bg-white hover:shadow-lg transition-all"
                  >
                    <GripVertical className="text-slate-300" size={18} />
                    <span className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">{index + 1}</span>
                    <span className="text-sm font-bold text-slate-700">{PROJECT_FIELD_LABELS[key] || key}</span>
                    <span className="ml-auto text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">{key}</span>
                  </div>
                ))}
             </div>
          </div>
        );

      case 'templates':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-indigo-50 rounded-[20px] flex items-center justify-center text-indigo-600"> <FileText size={24} /> </div>
                     <h3 className="text-xl font-black text-slate-900 tracking-tight">智能周报模版</h3>
                  </div>
                  <button onClick={() => { setEditingTemplate({ id: '', name: '', content: '' }); setIsTemplateModalOpen(true); }} className="bg-indigo-600 text-white h-11 px-6 rounded-xl hover:bg-indigo-700 flex items-center gap-2 font-black text-xs uppercase shadow-lg shadow-indigo-100"> <Plus size={18} /> 新增模版 </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {config.reportTemplates.map(tpl => (
                   <div key={tpl.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[24px] group hover:border-indigo-200 transition-all hover:bg-white hover:shadow-xl hover:shadow-indigo-100/20">
                      <div className="flex items-center justify-between mb-4">
                         <h4 className="font-bold text-slate-800 flex items-center gap-2"> <FileText size={14} className="text-indigo-500" /> {tpl.name} </h4>
                         <div className="flex gap-2">
                            <button onClick={() => { setEditingTemplate({ ...tpl }); setIsTemplateModalOpen(true); }} className="p-2 text-indigo-600 bg-white rounded-lg shadow-sm border border-slate-100"> <Edit2 size={14} /> </button>
                            <button onClick={async () => { if (confirm("确定删除此模版吗？")) { const updated = config.reportTemplates.filter(t => t.id !== tpl.id); await saveConfigChange({...config, reportTemplates: updated}); } }} className="p-2 text-slate-400 hover:text-rose-600 bg-white rounded-lg shadow-sm border border-slate-100"> <Trash2 size={14} /> </button>
                         </div>
                      </div>
                      <div className="text-xs text-slate-400 line-clamp-3 leading-loose font-mono bg-white p-3 rounded-xl border border-slate-100"> {tpl.content} </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="bg-white rounded-[32px] border border-slate-200 p-10 shadow-sm text-center">
            <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-[28px] flex items-center justify-center text-indigo-600 mb-8"> <Key size={36} /> </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Google Gemini API 配置</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-10 leading-relaxed font-medium"> 智能周报功能基于 Gemini 大语言模型。为了系统安全和计费准确，请确保您在当前运行环境中已配置有效的密钥。 </p>
            
            <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 p-8 rounded-[32px] flex flex-col items-center gap-6">
              {keyCheckLoading ? ( <Loader2 className="animate-spin text-indigo-400" /> ) : hasApiKey ? (
                <div className="flex flex-col items-center gap-3">
                   <div className="flex items-center gap-2 text-emerald-600 font-black uppercase tracking-widest text-[10px] bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100"> <ShieldCheck size={14}/> 密钥已就绪 </div>
                   <p className="text-xs text-slate-400 font-medium">当前运行环境已包含 API 密钥，您可以正常使用智能报告功能。</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                   <div className="flex items-center gap-2 text-rose-500 font-black uppercase tracking-widest text-[10px] bg-rose-50 px-4 py-1.5 rounded-full border border-rose-100"> <ShieldAlert size={14}/> 缺少 API 密钥 </div>
                   <p className="text-xs text-slate-400 font-medium">检测到环境变量中缺少 API_KEY。</p>
                </div>
              )}
              <button onClick={handleOpenKeySelector} className="w-full h-12 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"> <Key size={18} /> 配置密钥 </button>
            </div>
            
            <div className="mt-10 flex items-center justify-center gap-6">
               <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline flex items-center gap-1"> <Info size={12}/> 计费说明 </a>
               <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 flex items-center gap-1"> <ExternalLink size={12}/> 获取密钥 </a>
            </div>
          </div>
        );

      default: return null;
    }
  };

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-400" /></div>;

  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight"> <SettingsIcon className="text-indigo-600" size={32} /> 基础设置 </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">定义系统运行规则、团队成员与业务词典</p>
        </div>
      </div>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2 custom-scrollbar shrink-0">
        {[
          { id: 'users', label: '成员管理', icon: <Users size={16} /> },
          { id: 'dictionaries', label: '业务词典', icon: <Layers size={16} /> },
          { id: 'columns', label: '列表字段', icon: <LayoutList size={16} /> },
          { id: 'templates', label: '周报模版', icon: <FileText size={16} /> },
          { id: 'api', label: 'API 配置', icon: <Key size={16} /> }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as SettingTab)}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0
              ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
            `}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        {renderTabContent()}
      </div>

      {/* 用户编辑 Modal */}
      {isUserModalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
           <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 border border-white/20">
              <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                 <h3 className="text-xl font-black text-slate-900 tracking-tight"> {editingUser.id ? '编辑成员' : '新增成员'} </h3>
                 <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-900"> <X size={24} /> </button>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">成员姓名</label>
                    <input className="w-full h-11 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-4 outline-none font-bold text-slate-700" value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">登录账号 (唯一)</label>
                    <input className="w-full h-11 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-4 outline-none font-bold text-slate-700 font-mono" value={editingUser.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">登录密码 {editingUser.id && '(留空表示不修改)'}</label>
                    <div className="relative">
                       <input type="password" className="w-full h-11 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-12 outline-none font-bold text-slate-700" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} placeholder={editingUser.id ? '••••••••' : '至少8位密码'} />
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">系统角色</label>
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => setEditingUser({...editingUser, role: 'member'})} className={`h-11 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${editingUser.role === 'member' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:border-slate-200'}`}> 普通成员 </button>
                       <button onClick={() => setEditingUser({...editingUser, role: 'manager'})} className={`h-11 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${editingUser.role === 'manager' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:border-slate-200'}`}> 部门经理 </button>
                    </div>
                 </div>
              </div>
              <div className="px-8 py-6 bg-slate-50 border-t border-slate-50 flex justify-end gap-3 rounded-b-[32px]">
                 <button onClick={() => setIsUserModalOpen(false)} className="px-6 py-2.5 text-slate-500 font-black text-[10px] uppercase tracking-widest"> 取消 </button>
                 <button onClick={saveUser} disabled={isSaving} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl shadow-xl shadow-indigo-100 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"> {isSaving && <Loader2 className="animate-spin" size={14} />} {editingUser.id ? '更新成员' : '创建成员'} </button>
              </div>
           </div>
        </div>
      )}

      {/* 删除确认 Modal */}
      {deleteUserConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-10 border border-white/20 animate-in fade-in zoom-in">
            <div className="mx-auto bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center text-rose-500 mb-6"> <AlertTriangle size={36} /> </div>
            <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">确认删除成员？</h3>
            <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed">该账号将被永久注销，请确保已转移其负责的项目。</p>
            <div className="flex flex-col gap-3">
              <button onClick={async () => { setIsLoading(true); try { await storage.deleteUser(deleteUserConfirmId); await loadConfig(); setDeleteUserConfirmId(null); } finally { setIsLoading(false); } }} className="w-full py-4 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-100 font-black text-sm uppercase"> 确认删除 </button>
              <button onClick={() => setDeleteUserConfirmId(null)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase"> 取消 </button>
            </div>
          </div>
        </div>
      )}

      {/* 字典项编辑 Modal (普通项) */}
      {editingDictItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
             <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">修改名称</h3>
                <button onClick={() => setEditingDictItem(null)} className="text-slate-400"> <X size={24} /> </button>
             </div>
             <div className="p-8">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">新标签名称</label>
                <input className="w-full h-11 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-4 font-bold" value={editingDictItem.item.label} onChange={e => setEditingDictItem({...editingDictItem, item: {...editingDictItem.item, label: e.target.value}})} onKeyDown={e => e.key === 'Enter' && handleUpdateDictItem()} autoFocus />
             </div>
             <div className="px-8 py-6 bg-slate-50 flex justify-end gap-3 rounded-b-[32px]">
                <button onClick={() => setEditingDictItem(null)} className="px-6 py-2.5 text-slate-500 font-black text-[10px] uppercase">取消</button>
                <button onClick={handleUpdateDictItem} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl shadow-indigo-100">确认修改</button>
             </div>
          </div>
        </div>
      )}

      {/* 标签/颜色编辑 Modal (Levels/Stages) */}
      {editingTag && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
             <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">配置标签</h3>
                <button onClick={() => setEditingTag(null)} className="text-slate-400"> <X size={24} /> </button>
             </div>
             <div className="p-8 space-y-6">
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">标签名称</label>
                   <input className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 font-bold" value={editingTag.item.label} onChange={e => setEditingTag({...editingTag, item: {...editingTag.item, label: e.target.value}})} />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">视觉颜色</label>
                   <div className="grid grid-cols-6 gap-3">
                      {PRESET_COLORS.map(c => (
                        <button 
                          key={c.hex} 
                          onClick={() => setEditingTag({...editingTag, item: {...editingTag.item, color: c.hex}})}
                          className={`w-10 h-10 rounded-xl border-2 transition-all ${editingTag.item.color === c.hex ? 'border-indigo-600 scale-110 shadow-lg' : 'border-transparent shadow-sm'}`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                   </div>
                </div>
             </div>
             <div className="px-8 py-6 bg-slate-50 flex justify-end gap-3 rounded-b-[32px]">
                <button onClick={() => setEditingTag(null)} className="px-6 py-2.5 text-slate-500 font-black text-[10px] uppercase">取消</button>
                <button onClick={handleUpdateTag} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl shadow-indigo-100">保存修改</button>
             </div>
          </div>
        </div>
      )}

      {/* 需求类型/子类编辑 Modal */}
      {editingType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
             <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center shrink-0">
                <h3 className="text-xl font-black text-slate-900">分类及其子类配置</h3>
                <button onClick={() => setEditingType(null)} className="text-slate-400"> <X size={24} /> </button>
             </div>
             <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">大类名称</label>
                   <input className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 font-bold" value={editingType.label} onChange={e => setEditingType({...editingType, label: e.target.value})} />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">包含子类</label>
                   <div className="flex gap-2 mb-4">
                      <input type="text" placeholder="输入新子类..." className="flex-1 h-10 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm font-bold" value={newSubTypeLabel} onChange={e => setNewSubTypeLabel(e.target.value)} onKeyDown={e => {
                        if (e.key === 'Enter' && newSubTypeLabel.trim()) {
                          const newSub = { key: generateKey(newSubTypeLabel.trim()), label: newSubTypeLabel.trim() };
                          setEditingType({...editingType, subTypes: [...editingType.subTypes, newSub]});
                          setNewSubTypeLabel('');
                        }
                      }} />
                      <button onClick={() => {
                        if (!newSubTypeLabel.trim()) return;
                        const newSub = { key: generateKey(newSubTypeLabel.trim()), label: newSubTypeLabel.trim() };
                        setEditingType({...editingType, subTypes: [...editingType.subTypes, newSub]});
                        setNewSubTypeLabel('');
                      }} className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"> <Plus size={18}/> </button>
                   </div>
                   <div className="space-y-2">
                      {editingType.subTypes.map((sub, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{sub.label}</span>
                           <button onClick={() => {
                             const updated = editingType.subTypes.filter((_, i) => i !== idx);
                             setEditingType({...editingType, subTypes: updated});
                           }} className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"> <Trash2 size={14} /> </button>
                        </div>
                      ))}
                      {editingType.subTypes.length === 0 && (
                        <div className="py-10 text-center text-[10px] text-slate-300 font-black uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-2xl"> 暂无子类，点击上方新增 </div>
                      )}
                   </div>
                </div>
             </div>
             <div className="px-8 py-6 bg-slate-50 flex justify-end gap-3 rounded-b-[32px] shrink-0">
                <button onClick={() => setEditingType(null)} className="px-6 py-2.5 text-slate-500 font-black text-[10px] uppercase">取消</button>
                <button onClick={handleUpdateTypeConfig} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl shadow-indigo-100">保存设置</button>
             </div>
          </div>
        </div>
      )}

      {/* 周报模板编辑 Modal */}
      {isTemplateModalOpen && editingTemplate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
             <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                <h3 className="text-2xl font-black text-slate-900">{editingTemplate.id ? '编辑周报模板' : '新增周报模板'}</h3>
                <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400"> <X size={28} /> </button>
             </div>
             <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">模板名称</label>
                   <input className="w-full h-12 border border-slate-200 bg-slate-50 rounded-xl px-4 font-bold text-lg" value={editingTemplate.name} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} placeholder="例如：设计周报管理版" />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Markdown 内容 & 变量标签</label>
                   <div className="mb-4 flex flex-wrap gap-2">
                      <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 uppercase">{"{startDate}"} 开始日期</span>
                      <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 uppercase">{"{endDate}"} 结束日期</span>
                   </div>
                   <textarea className="w-full h-80 border border-slate-200 bg-slate-50 rounded-xl p-5 font-mono text-sm leading-relaxed outline-none focus:bg-white focus:border-indigo-400 transition-all resize-none" value={editingTemplate.content} onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})} placeholder="# 输入您的模板内容..." />
                </div>
             </div>
             <div className="px-10 py-6 bg-slate-50 flex justify-end gap-4 rounded-b-[32px] shrink-0">
                <button onClick={() => setIsTemplateModalOpen(false)} className="px-8 py-3 text-slate-500 font-black text-xs uppercase">取消</button>
                <button onClick={saveTemplate} className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-indigo-100 active:scale-95 transition-all">保存模板</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
