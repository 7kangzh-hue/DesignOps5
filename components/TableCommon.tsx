
import React, { useState, useEffect, useRef } from 'react';

interface ResizableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width?: number | string;
  minWidth?: number;
  onResize?: (newWidth: number) => void;
  children: React.ReactNode;
}

export const ResizableTh: React.FC<ResizableThProps> = ({ 
  width, 
  minWidth = 30, 
  onResize, 
  children, 
  className = "", 
  style,
  ...props 
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const thRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const diffX = e.pageX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + diffX);
      
      if (onResize) {
        onResize(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (thRef.current) {
      startXRef.current = e.pageX;
      startWidthRef.current = thRef.current.offsetWidth;
      setIsResizing(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
  };

  return (
    <th 
      ref={thRef}
      className={`relative group bg-slate-50 text-left text-sm font-semibold text-slate-700 border-b border-slate-200 select-none ${className}`}
      style={{ 
        width: width,
        minWidth: minWidth,
        ...style
      }}
      {...props}
    >
      <div className="flex items-center h-full px-4 py-2.5 truncate font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">
        {children}
      </div>
      
      {/* Resizer Handle */}
      {onResize && (
        <div
          onMouseDown={handleMouseDown}
          className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 z-10 transition-colors
            ${isResizing ? 'bg-indigo-500 w-[2px]' : 'bg-transparent'}
          `}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      
      {/* Visual Border Divider */}
      <div className="absolute right-0 top-2 bottom-2 w-px bg-slate-200 pointer-events-none" />
    </th>
  );
};
