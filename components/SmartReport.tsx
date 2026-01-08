
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { generateWeeklyReport, refineWeeklyReport } from '../services/geminiService';
import { WeeklyReport, AppConfig, DEFAULT_CONFIG } from '../types';
import { Sparkles, Loader2, Save, History, MessageSquare, Send, Trash2, FileText, AlertTriangle, Calendar, Wand2, Copy, Check, Plus, Edit3, Eye } from 'lucide-react';
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { EmptyState } from './EmptyState';

// 解析行内 markdown 格式（粗体、代码等）
const parseInlineMarkdown = (text: string): React.ReactNode[] => {
  if (!text) return [];
  
  const parts: React.ReactNode[] = [];
  // 使用正则表达式分割文本，匹配 **粗体** 或 __粗体__
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;
  const matches: Array<{ type: 'bold' | 'code'; content: string; index: number; length: number }> = [];
  let match;
  
  // 收集所有匹配项
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    let type: 'bold' | 'code' = 'bold';
    let content = '';
    
    if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
      type = 'code';
      content = fullMatch.slice(1, -1);
    } else if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
      type = 'bold';
      content = fullMatch.slice(2, -2);
    } else if (fullMatch.startsWith('__') && fullMatch.endsWith('__')) {
      type = 'bold';
      content = fullMatch.slice(2, -2);
    }
    
    matches.push({
      type,
      content,
      index: match.index,
      length: fullMatch.length
    });
  }
  
  // 如果没有匹配项，直接返回文本
  if (matches.length === 0) {
    return [text];
  }
  
  // 构建结果
  let lastIndex = 0;
  matches.forEach((matchItem, idx) => {
    // 添加匹配项之前的文本
    if (matchItem.index > lastIndex) {
      const beforeText = text.substring(lastIndex, matchItem.index);
      if (beforeText) {
        parts.push(beforeText);
      }
    }
    
    // 添加匹配项
    if (matchItem.type === 'bold') {
      parts.push(
        <strong key={`bold-${idx}`} className="font-black text-indigo-600">
          {matchItem.content}
        </strong>
      );
    } else {
      parts.push(
        <code key={`code-${idx}`} className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-indigo-700">
          {matchItem.content}
        </code>
      );
    }
    
    // 计算匹配项的结束位置（使用原始匹配长度）
    lastIndex = matchItem.index + matchItem.length;
  });
  
  // 添加最后剩余的文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts;
};

const SimpleMarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-loose prose-li:text-slate-600 prose-strong:text-indigo-600 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-blockquote:border-l-4 prose-blockquote:border-indigo-200 prose-blockquote:bg-indigo-50/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:italic">
      {content.split('\n').map((line, i) => {
        const trimmedLine = line.trim();
        
        // 标题
        if (trimmedLine.startsWith('# ')) {
          const titleText = trimmedLine.replace(/^#+\s+/, '');
          return (
            <h1 key={i} className="text-2xl font-black mb-6 mt-8 pb-4 border-b border-slate-100">
              {parseInlineMarkdown(titleText)}
            </h1>
          );
        }
        if (trimmedLine.startsWith('## ')) {
          const titleText = trimmedLine.replace(/^##+\s+/, '');
          return (
            <h2 key={i} className="text-xl font-black mb-4 mt-8 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
              <span>{parseInlineMarkdown(titleText)}</span>
            </h2>
          );
        }
        if (trimmedLine.startsWith('### ')) {
          const titleText = trimmedLine.replace(/^###+\s+/, '');
          return (
            <h3 key={i} className="text-lg font-black mb-3 mt-6 text-slate-800">
              {parseInlineMarkdown(titleText)}
            </h3>
          );
        }
        
        // 列表项
        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
          const listText = trimmedLine.replace(/^[-*]\s+/, '');
          return (
            <li key={i} className="ml-4 mb-2 flex gap-2">
              <span className="text-indigo-400 mt-1.5 shrink-0 text-[8px]">●</span>
              <span className="text-slate-600 leading-relaxed">{parseInlineMarkdown(listText)}</span>
            </li>
          );
        }
        
        // 空行
        if (trimmedLine === '') {
          return <div key={i} className="h-4"></div>;
        }
        
        // 普通段落
        return (
          <p key={i} className="mb-2 text-slate-700 leading-relaxed font-medium">
            {parseInlineMarkdown(trimmedLine)}
          </p>
        );
      })}
    </div>
  );
};

export const SmartReport: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  const [startDate, setStartDate] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectedTemplate, setSelectedTemplate] = useState('');
  
  const [reportContent, setReportContent] = useState('');
  const [refineText, setRefineText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [viewingReport, setViewingReport] = useState<WeeklyReport | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedConfig, fetchedReports] = await Promise.all([
        storage.getConfig(),
        storage.getWeeklyReports()
      ]);
      setConfig(fetchedConfig);
      setReports(fetchedReports);
      if (fetchedConfig.reportTemplates.length > 0) {
        setSelectedTemplate(fetchedConfig.reportTemplates[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return alert("请先选择报告模板");
    
    setIsGenerating(true);
    try {
      const notes = await storage.getManagerNotes();
      const logs = await storage.getLogs();
      
      const filteredNotes = notes.filter(n => n.date.startsWith(startDate) || (n.date >= startDate && n.date <= endDate));
      const filteredLogs = logs.filter(l => l.weekStartDate === startDate);
      
      const template = config.reportTemplates.find(t => t.id === selectedTemplate);
      const generated = await generateWeeklyReport(
        filteredNotes,
        filteredLogs,
        startDate,
        endDate,
        template?.content || ''
      );
      
      setReportContent(generated);
    } catch (e) {
      alert("生成周报失败，请检查网络连接或 API 配置");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!refineText.trim() || !reportContent) return;
    
    setIsRefining(true);
    try {
      const refined = await refineWeeklyReport(reportContent, refineText);
      setReportContent(refined);
      setRefineText('');
    } catch (e) {
      alert("调整失败");
    } finally {
      setIsRefining(false);
    }
  };

  const handleSave = async () => {
    if (!reportContent) return;
    setIsSaving(true);
    try {
      await storage.saveWeeklyReport({
        startDate,
        endDate,
        content: reportContent
      });
      const updated = await storage.getWeeklyReports();
      setReports(updated);
      alert("周报已成功保存至历史记录");
    } catch (e) {
      alert("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm("确定删除此历史周报吗？")) return;
    try {
      await storage.deleteWeeklyReport(id);
      setReports(reports.filter(r => r.id !== id));
      if (viewingReport?.id === id) setViewingReport(null);
    } catch (e) {
      alert("删除失败");
    }
  };

  if (isLoading) return <div className="h-full flex items-center justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight mb-2">
            <Sparkles className="text-indigo-600" size={32} /> 智能 AI 周报
          </h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            基于团队数据与管理笔记，自动生成专业级管理报告
          </p>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('create')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Plus size={16} className="inline mr-2" /> 生成新报表
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <History size={16} className="inline mr-2" /> 历史记录
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'create' ? (
          <div className="grid grid-cols-12 gap-8 h-full">
            {/* Left Config Panel */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                  <Calendar size={18} className="text-indigo-500" /> 报告配置
                </h3>

                <div className="space-y-8">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">起止日期</label>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="relative">
                         <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm font-bold outline-none" />
                         <span className="absolute -top-2 left-3 px-2 bg-white text-[9px] font-black text-indigo-500 uppercase">开始</span>
                      </div>
                      <div className="relative">
                         <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm font-bold outline-none" />
                         <span className="absolute -top-2 left-3 px-2 bg-white text-[9px] font-black text-indigo-500 uppercase">结束</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">选择模板</label>
                    <select 
                      value={selectedTemplate} 
                      onChange={e => setSelectedTemplate(e.target.value)}
                      className="w-full h-11 border border-slate-200 bg-slate-50 rounded-xl px-4 text-sm font-bold outline-none"
                    >
                      {config.reportTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={handleGenerate} 
                    disabled={isGenerating}
                    className="w-full h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 font-black text-xs uppercase tracking-[0.15em] hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 mt-4"
                  >
                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                    {isGenerating ? '正在调遣 Gemini...' : '开始魔法生成'}
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[32px] p-8 text-white">
                <h4 className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-4"> <Sparkles size={16}/> 数据源说明 </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  AI 将调取选定周期内的：
                </p>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-start gap-3 text-[11px] font-bold text-slate-300"> <Check size={14} className="text-emerald-500 shrink-0"/> <span>您的【每日随手记】管理动作</span> </li>
                  <li className="flex items-start gap-3 text-[11px] font-bold text-slate-300"> <Check size={14} className="text-emerald-500 shrink-0"/> <span>团队成员在【工作台账】中的产出记录</span> </li>
                  <li className="flex items-start gap-3 text-[11px] font-bold text-slate-300"> <Check size={14} className="text-emerald-500 shrink-0"/> <span>项目库中的实时级别与状态信息</span> </li>
                </ul>
              </div>
            </div>

            {/* Right Preview Panel */}
            <div className="col-span-12 lg:col-span-8 flex flex-col h-full gap-6">
              <div className="flex-1 bg-white rounded-[40px] shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="h-16 border-b border-slate-50 flex items-center justify-between px-8 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">报告预览</span>
                  </div>
                  {reportContent && (
                    <div className="flex items-center gap-2">
                      <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="复制全文">
                        {copySuccess ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                      </button>
                      <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95">
                        {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                        {isSaving ? '保存中...' : '存档到历史'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-slate-50/20">
                  {reportContent ? (
                    <SimpleMarkdownRenderer content={reportContent} />
                  ) : (
                    <EmptyState
                      icon={FileText}
                      title="暂无预览内容"
                      description="请在左侧配置报告参数，然后点击生成按钮开始创建您的周报"
                      illustration="data"
                    />
                  )}
                </div>

                {reportContent && (
                  <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                    <div className="relative group">
                       <input 
                         type="text" 
                         value={refineText}
                         onChange={e => setRefineText(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleRefine()}
                         placeholder="觉得不满意？告诉 AI 如何调整（例如：增加一些对研发中心的表扬、语气再严厉一点...）" 
                         className="w-full h-14 pl-6 pr-32 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                       />
                       <button 
                         onClick={handleRefine}
                         disabled={isRefining || !refineText.trim()}
                         className="absolute right-2 top-2 h-10 px-6 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none transition-all"
                       >
                         {isRefining ? <Loader2 className="animate-spin" size={14} /> : <MessageSquare size={14} />}
                         AI 调优
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* History View */
          <div className="grid grid-cols-12 gap-8 h-full">
            <div className="col-span-4 overflow-y-auto custom-scrollbar pr-2 space-y-4">
              {reports.length > 0 ? reports.map(report => (
                <div 
                  key={report.id} 
                  onClick={() => setViewingReport(report)}
                  className={`p-6 rounded-[28px] border cursor-pointer transition-all ${viewingReport?.id === report.id ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-100 text-white' : 'bg-white border-slate-200 hover:border-indigo-400 text-slate-700'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-xl ${viewingReport?.id === report.id ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                      <FileText size={18} />
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                      className={`p-2 rounded-lg transition-all ${viewingReport?.id === report.id ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="font-black text-sm tracking-tight mb-1">
                    {report.startDate} 至 {report.endDate}
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${viewingReport?.id === report.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                    生成于: {new Date(report.created).toLocaleString()}
                  </div>
                </div>
              )) : (
                <EmptyState
                  icon={History}
                  title="暂无历史记录"
                  description="生成的周报将保存在这里，方便您随时查看和复用"
                  illustration="data"
                />
              )}
            </div>

            <div className="col-span-8 h-full bg-white rounded-[40px] shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              {viewingReport ? (
                <>
                  <div className="h-16 border-b border-slate-50 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-slate-900">{viewingReport.startDate} 至 {viewingReport.endDate}</span>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(viewingReport.content);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      {copySuccess ? <Check size={14} /> : <Copy size={14} />}
                      {copySuccess ? '已复制' : '复制全文'}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                    <SimpleMarkdownRenderer content={viewingReport.content} />
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Eye}
                  title="选择一份周报以查看详情"
                  description="从左侧列表中选择一份历史周报，查看完整内容"
                  illustration="data"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
