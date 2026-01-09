import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Settings2, Check } from 'lucide-react';

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

interface ColumnManagerProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  storageKey: string; // 用于 localStorage 存储
  title?: string;
}

export const ColumnManager: React.FC<ColumnManagerProps> = ({
  columns,
  onColumnsChange,
  storageKey,
  title = '列管理'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false); // 点击外部时关闭（更改已实时保存）
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // 初始化时从 localStorage 加载配置
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 合并保存的配置和默认配置，确保新列也会显示
        const merged = columns.map(col => {
          const savedCol = parsed.find((c: ColumnConfig) => c.key === col.key);
          return savedCol ? { ...col, ...savedCol } : col;
        });
        // 添加新列（如果有）
        parsed.forEach((savedCol: ColumnConfig) => {
          if (!merged.find(c => c.key === savedCol.key)) {
            merged.push(savedCol);
          }
        });
        setLocalColumns(merged);
        onColumnsChange(merged);
      } catch (e) {
        console.error('Failed to load column config:', e);
      }
    }
  }, []);

  // 当外部 columns 变化时同步
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      setLocalColumns(columns);
    }
  }, [columns, storageKey]);

  const handleToggleVisibility = (key: string) => {
    const updated = localColumns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    setLocalColumns(updated);
    // 实时保存
    localStorage.setItem(storageKey, JSON.stringify(updated));
    onColumnsChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return; // 已经在最顶部
    const newColumns = [...localColumns];
    [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
    setLocalColumns(newColumns);
    // 实时保存
    localStorage.setItem(storageKey, JSON.stringify(newColumns));
    onColumnsChange(newColumns);
  };

  const handleMoveDown = (index: number) => {
    if (index === localColumns.length - 1) return; // 已经在最底部
    const newColumns = [...localColumns];
    [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
    setLocalColumns(newColumns);
    // 实时保存
    localStorage.setItem(storageKey, JSON.stringify(newColumns));
    onColumnsChange(newColumns);
  };

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(localColumns));
    onColumnsChange(localColumns);
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalColumns(columns);
    localStorage.removeItem(storageKey);
    onColumnsChange(columns);
  };

  const visibleColumns = localColumns.filter(col => col.visible);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 px-4 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-all font-black text-sm uppercase shadow-sm"
        title="列管理"
      >
        <Settings2 size={18} />
        列设置
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-[2000] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="p-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{title}</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {visibleColumns.length} / {localColumns.length}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1">
              点击箭头调整顺序，勾选控制显隐
            </p>
          </div>

          <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-1">
              {localColumns.map((col, index) => (
                <div
                  key={col.key}
                  className={`flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-all ${
                    !col.visible ? 'opacity-50' : ''
                  }`}
                >
                  <span className="h-5 w-5 rounded bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                    {index + 1}
                  </span>
                  
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className={`h-5 w-5 rounded flex items-center justify-center transition-all ${
                        index === 0
                          ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                          : 'bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 active:scale-95'
                      }`}
                      title="上移"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === localColumns.length - 1}
                      className={`h-5 w-5 rounded flex items-center justify-center transition-all ${
                        index === localColumns.length - 1
                          ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                          : 'bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 active:scale-95'
                      }`}
                      title="下移"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>

                  <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                    <div className="relative shrink-0">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => handleToggleVisibility(col.key)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          col.visible
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {col.visible && <Check size={10} className="text-white" />}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 truncate">{col.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="p-2 border-t border-slate-100 flex justify-end gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              重置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};