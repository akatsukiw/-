import React, { useState, useRef } from 'react';
import { Printer, FileDown, Type, Image as ImageIcon, Heading } from 'lucide-react';
import { Block, BlockType } from './types';
import { BlockRenderer } from './components/BlockRenderer';
import { exportToDocx } from './services/docxService';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [margin, setMargin] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Drag and Drop State
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);

  // --- Actions ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newBlocks: Block[] = [];
      Array.from(e.target.files).forEach((item) => {
        const file = item as File;
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          newBlocks.push({
            id: generateId(),
            type: BlockType.IMAGE,
            content: url,
            // height: undefined, // Let it be auto (natural aspect ratio)
          });
        }
      });
      setBlocks(prev => [...prev, ...newBlocks]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addTextRow = () => {
    setBlocks(prev => [...prev, {
      id: generateId(),
      type: BlockType.TEXT_ROW,
      content: 'New Text',
    }]);
  };

  const addTitleRow = () => {
    setBlocks(prev => [...prev, {
      id: generateId(),
      type: BlockType.TITLE,
      content: 'Document Title'
    }]);
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleExportDocx = async () => {
    try {
      await exportToDocx(blocks, margin);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export Docx. Please check console.");
    }
  };

  // --- Drag & Drop Logic ---
  
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBlockIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); 
    if (draggedBlockIndex === null || draggedBlockIndex === index) return;
    
    const newBlocks = [...blocks];
    const draggedItem = newBlocks[draggedBlockIndex];
    newBlocks.splice(draggedBlockIndex, 1);
    newBlocks.splice(index, 0, draggedItem);
    
    setBlocks(newBlocks);
    setDraggedBlockIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedBlockIndex(null);
  };

  return (
    <div className="min-h-screen bg-[#333333] flex flex-col items-center py-5 font-sans">
      
      {/* --- Toolbar --- */}
      <div className="bg-white px-6 py-3 rounded-lg shadow-xl mb-8 sticky top-4 z-50 flex flex-wrap gap-6 items-center border border-gray-200">
        
        <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <ImageIcon size={16} /> Add Image
          </button>
          <button 
            onClick={addTextRow}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-black border border-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <Type size={16} /> Add Text
          </button>
          <button 
            onClick={addTitleRow}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-black border border-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <Heading size={16} /> Add Title
          </button>
        </div>

        <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spacing</label>
          <input 
            type="range" 
            min="0" 
            max="50" 
            value={margin} 
            onChange={(e) => setMargin(Number(e.target.value))}
            className="w-24 cursor-pointer accent-black"
          />
          <span className="text-sm font-mono text-gray-600 w-8 text-right">{margin}</span>
        </div>

        <div className="flex gap-3">
            <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 text-gray-700 hover:text-black px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
                <Printer size={16} /> Print
            </button>
            <button 
                onClick={handleExportDocx}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
                <FileDown size={16} /> Export DOCX
            </button>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          hidden 
          multiple 
          accept="image/*" 
          onChange={handleImageUpload} 
        />
      </div>

      {/* --- Page Container --- */}
      <div id="page-container" className="flex flex-col items-center w-full overflow-y-auto pb-10">
        <div 
            className="a4-page bg-white p-[10mm] box-border flex flex-wrap content-start gap-[10px] shadow-2xl relative transition-all"
            style={{ 
                width: '210mm', 
                minHeight: '297mm', // A4 Height
            }}
        >
            {blocks.length === 0 && (
                <div className="absolute inset-0 m-[10mm] flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-lg pointer-events-none">
                    <p className="font-medium">Canvas Empty</p>
                    <p className="text-sm">Add images or text from the toolbar</p>
                </div>
            )}

            {blocks.map((block, index) => (
                <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`
                        ${block.type === BlockType.IMAGE ? 'w-[calc(50%-5px)]' : 'w-full'}
                        transition-transform duration-200 ease-out cursor-move relative
                        ${draggedBlockIndex === index ? 'opacity-30 scale-95' : 'opacity-100'}
                    `}
                    style={{ marginBottom: `${margin}px` }}
                >
                    <BlockRenderer 
                        block={block} 
                        onUpdate={updateBlock} 
                        onRemove={removeBlock}
                        isDragging={draggedBlockIndex === index}
                    />
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default App;
