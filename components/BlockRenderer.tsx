import React, { useRef, useState, useEffect } from 'react';
import { Block, BlockType } from '../types';
import { X, GripHorizontal } from 'lucide-react';

interface BlockRendererProps {
  block: Block;
  onUpdate: (id: string, updates: Partial<Block>) => void;
  onRemove: (id: string) => void;
  isDragging?: boolean;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({ block, onUpdate, onRemove, isDragging }) => {
  const [imgHeight, setImgHeight] = useState<number | undefined>(block.height);
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

  const preventDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // --- Resize/Crop Logic ---
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startY = e.clientY;
    // Current visual height of the container
    const startHeight = containerRef.current?.clientHeight || 0;
    
    // The full height of the image if it wasn't cropped
    // We can get this from the img element itself, which is rendered full width
    const fullImageHeight = imgRef.current?.getBoundingClientRect().height || 1000;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      // Calculate new height
      let newHeight = startHeight + delta;
      
      // Constraints:
      // Min: 50px
      // Max: fullImageHeight (cannot drag container larger than the image inside)
      newHeight = Math.max(50, Math.min(newHeight, fullImageHeight));
      
      setImgHeight(newHeight);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
        // Calculate final height similar to mouse move to ensure consistency
        const delta = upEvent.clientY - startY;
        let finalHeight = startHeight + delta;
        const fullImageHeight = imgRef.current?.getBoundingClientRect().height || 1000;
        finalHeight = Math.max(50, Math.min(finalHeight, fullImageHeight));

        onUpdate(block.id, { height: finalHeight });
      
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (block.type === BlockType.TITLE) {
    return (
      <div 
        className={`group relative w-full border border-dashed border-gray-300 min-h-[50px] flex items-center justify-center hover:bg-gray-50 transition-colors ${isDragging ? 'opacity-50' : ''}`}
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
          onMouseDown={preventDrag}
          className="text-center text-2xl font-extrabold text-black bg-transparent w-full outline-none focus:border-b focus:border-blue-500 placeholder-gray-400"
          placeholder="Document Title"
        />
      </div>
    );
  }

  if (block.type === BlockType.TEXT_ROW) {
    return (
      <div 
        className={`group relative w-full border border-dashed border-gray-300 px-4 py-2 flex items-center min-h-[40px] hover:bg-gray-50 transition-colors ${isDragging ? 'opacity-50' : ''}`}
      >
        <button 
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X size={14} />
        </button>
        <textarea 
          value={block.content}
          onChange={(e) => onUpdate(block.id, { content: e.target.value })}
          onMouseDown={preventDrag}
          rows={1}
          className="w-full text-lg text-black bg-transparent outline-none focus:border-b focus:border-blue-500 resize-none overflow-hidden"
          placeholder="Enter text here..."
          style={{ height: 'auto' }}
          onInput={(e) => {
            // Auto-grow textarea
            (e.target as HTMLTextAreaElement).style.height = 'auto';
            (e.target as HTMLTextAreaElement).style.height = (e.target as HTMLTextAreaElement).scrollHeight + 'px';
          }}
        />
      </div>
    );
  }

  if (block.type === BlockType.IMAGE) {
    return (
      <div 
        ref={containerRef}
        className={`group relative w-full border border-dashed border-gray-300 bg-white hover:border-blue-400 overflow-hidden select-none ${isDragging ? 'opacity-50' : ''}`}
        // If height is undefined, use 'auto' to show full image. If set, use pixel value to crop.
        style={{ height: imgHeight ? `${imgHeight}px` : 'auto' }}
      >
        <button 
            onClick={handleDelete}
            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
        >
          <X size={14} />
        </button>
        
        {/* Image: Width 100%, Height Auto to maintain aspect ratio. 
            The container simply cuts off the bottom if height < natural height. 
        */}
        <img 
            ref={imgRef}
            src={block.content} 
            alt="Uploaded" 
            className="w-full h-auto block pointer-events-none"
        />

        {/* Resize Handle */}
        <div 
          onMouseDown={handleMouseDownResize}
          className="absolute bottom-0 left-0 w-full h-5 bg-black/10 hover:bg-blue-500/50 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <GripHorizontal size={16} className="text-white drop-shadow-md" />
        </div>
      </div>
    );
  }

  return null;
};
