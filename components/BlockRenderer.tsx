import React, { useRef, useState, useEffect } from 'react';
import { Block, BlockType } from '../types';
import { X, GripHorizontal } from 'lucide-react';

interface BlockRendererProps {
  block: Block;
  onUpdate: (id: string, updates: Partial<Block>) => void;
  onRemove: (id: string) => void;
  isDragging?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({ 
  block, 
  onUpdate, 
  onRemove, 
  isDragging,
  onEditStart,
  onEditEnd 
}) => {
  const [imgHeight, setImgHeight] = useState<number | undefined>(block.height);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartHeight = useRef<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Sync state with props if props change externally
  useEffect(() => {
    setImgHeight(block.height);
  }, [block.height]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(block.id);
  };

  // When user clicks input, notify parent to disable dragging
  const handleInputMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditStart?.();
  };

  // When input loses focus, re-enable dragging
  const handleInputBlur = () => {
    onEditEnd?.();
  };

  // --- Resize/Crop Logic ---
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startY = e.clientY;
    const currentHeight = containerRef.current?.clientHeight || 0;
    
    // Lock layout height to prevent page jumping during crop
    setIsResizing(true);
    resizeStartHeight.current = currentHeight;

    const fullImageHeight = imgRef.current?.getBoundingClientRect().height || 1000;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      let newHeight = currentHeight + delta;
      newHeight = Math.max(50, Math.min(newHeight, fullImageHeight));
      setImgHeight(newHeight);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
        const delta = upEvent.clientY - startY;
        let finalHeight = currentHeight + delta;
        const fullImageHeight = imgRef.current?.getBoundingClientRect().height || 1000;
        finalHeight = Math.max(50, Math.min(finalHeight, fullImageHeight));

        onUpdate(block.id, { height: finalHeight });
        setIsResizing(false);
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (block.type === BlockType.TITLE) {
    return (
      <div 
        className={`group relative w-full border border-dashed border-gray-400 min-h-[50px] flex items-center justify-center hover:bg-gray-50 transition-colors ${isDragging ? 'opacity-50' : ''}`}
      >
        <button 
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X size={14} />
        </button>
        <input 
          value={block.content}
          onChange={(e) => onUpdate(block.id, { content: e.target.value })}
          onMouseDown={handleInputMouseDown}
          onBlur={handleInputBlur}
          className="text-center text-3xl font-extrabold text-[#111] bg-transparent outline-none border-b border-transparent focus:border-blue-500 focus:bg-white transition-colors py-2 max-w-full"
          placeholder="文档标题"
          style={{ width: `${Math.max((block.content.length || 0) + 1, 4)}em` }}
        />
      </div>
    );
  }

  if (block.type === BlockType.TEXT_ROW) {
    return (
      <div 
        className={`group relative w-full border border-dashed border-gray-400 px-4 py-1 flex items-baseline gap-4 min-h-[40px] hover:bg-gray-50 transition-colors ${isDragging ? 'opacity-50' : ''}`}
      >
        <button 
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X size={14} />
        </button>
        
        {/* Main Text Input: Auto width based on content */}
        <input
          value={block.content}
          onChange={(e) => onUpdate(block.id, { content: e.target.value })}
          onMouseDown={handleInputMouseDown}
          onBlur={handleInputBlur}
          className="text-xl font-bold text-[#333] bg-transparent outline-none border-b border-dashed border-transparent focus:border-blue-500 focus:bg-white"
          placeholder="姓名/标题"
          style={{ width: `${Math.max((block.content.length || 0) + 1, 4)}em` }} 
        />

        {/* Sub Text Input: Auto width, removed flex-grow so user can click empty space to drag */}
        <input
          value={block.subContent || ''}
          onChange={(e) => onUpdate(block.id, { subContent: e.target.value })}
          onMouseDown={handleInputMouseDown}
          onBlur={handleInputBlur}
          className="text-sm text-[#666] bg-transparent outline-none border-b border-dashed border-transparent focus:border-blue-500 focus:bg-white"
          placeholder="备注信息"
          style={{ width: `${Math.max((block.subContent?.length || 0) + 1, 4)}em` }} 
        />
      </div>
    );
  }

  if (block.type === BlockType.IMAGE) {
    return (
      <div 
        className="w-full relative" 
        style={{ minHeight: isResizing ? `${resizeStartHeight.current}px` : 'auto' }}
      >
        <div 
            ref={containerRef}
            className={`group relative w-full border border-dashed border-gray-300 bg-white hover:border-blue-400 overflow-hidden select-none ${isDragging ? 'opacity-50' : ''}`}
            style={{ height: imgHeight ? `${imgHeight}px` : 'auto' }}
        >
            <button 
                onClick={handleDelete}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
            >
            <X size={14} />
            </button>
            
            <img 
                ref={imgRef}
                src={block.content} 
                alt="Uploaded" 
                className="w-full h-auto block pointer-events-none"
            />

            <div 
            onMouseDown={handleMouseDownResize}
            className="absolute bottom-0 left-0 w-full h-5 bg-black/10 hover:bg-blue-500/50 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
            <GripHorizontal size={16} className="text-white drop-shadow-md" />
            </div>
        </div>
      </div>
    );
  }

  return null;
};