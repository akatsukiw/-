import React, { useState, useRef } from 'react';
import { FileDown, Type, Image as ImageIcon, Heading, Save, FolderOpen } from 'lucide-react';
import { Block, BlockType } from './types';
import { BlockRenderer } from './components/BlockRenderer';
import { exportToDocx } from './services/docxService';
import FileSaver from 'file-saver';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper: Convert Blob URL to Base64
const blobUrlToBase64 = async (blobUrl: string): Promise<string> => {
  // If it's already base64, return it
  if (blobUrl.startsWith('data:')) return blobUrl;
  
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [margin, setMargin] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  
  // Drag and Drop State
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

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
          });
        }
      });
      setBlocks(prev => [...prev, ...newBlocks]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addTextRow = () => {
    setBlocks(prev => [...prev, {
      id: generateId(),
      type: BlockType.TEXT_ROW,
      content: '新文本',
      subContent: '备注信息'
    }]);
  };

  const addTitleRow = () => {
    setBlocks(prev => [...prev, {
      id: generateId(),
      type: BlockType.TITLE,
      content: '1月份网络平台表扬表'
    }]);
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  // --- Save / Load Project ---

  const handleSaveProject = async () => {
    try {
      // Convert all image contents to Base64 so the JSON file works offline/on other computers
      const portableBlocks = await Promise.all(blocks.map(async (b) => {
        if (b.type === BlockType.IMAGE) {
          const base64 = await blobUrlToBase64(b.content);
          return { ...b, content: base64 };
        }
        return b;
      }));

      const projectData = {
        version: 1,
        margin,
        blocks: portableBlocks
      };

      const blob = new Blob([JSON.stringify(projectData)], { type: "application/json;charset=utf-8" });
      FileSaver.saveAs(blob, "layout-project.json");
    } catch (error) {
      console.error("Save failed", error);
      alert("保存失败");
    }
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (json.blocks) {
            setBlocks(json.blocks);
          }
          if (json.margin !== undefined) {
            setMargin(json.margin);
          }
        } catch (err) {
          alert("无法读取项目文件，格式可能错误。");
        }
      };
      reader.readAsText(file);
    }
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleExportDocx = async () => {
    try {
      let filename = "导出文档";
      const titleBlock = blocks.find(b => b.type === BlockType.TITLE && b.content && b.content.trim().length > 0 && b.content !== '文档标题');
      if (titleBlock) {
        filename = titleBlock.content.trim();
      } else {
        const textRow = blocks.find(b => b.type === BlockType.TEXT_ROW && b.content && b.content.trim().length > 0 && b.content !== '新文本');
        if (textRow) {
            filename = textRow.content.trim();
        }
      }
      filename = filename.replace(/[<>:"/\\|?*]/g, '_');
      await exportToDocx(blocks, margin, filename);
    } catch (error) {
      console.error("Export failed", error);
      alert("导出失败，请检查控制台。");
    }
  };

  // --- Drag & Drop Logic ---
  
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (editingBlockId !== null) {
        e.preventDefault();
        return;
    }
    setDraggedBlockIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Important: Set data type to distinguish from file drag
    e.dataTransfer.setData("application/react-dnd-internal", "true");
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Allow dropping

    // 1. If dragging files from OS, do nothing here (wait for Drop)
    if (e.dataTransfer.types.includes("Files")) {
        e.dataTransfer.dropEffect = "copy";
        return;
    }

    // 2. Internal Reorder (Swap) Logic
    if (draggedBlockIndex === null || draggedBlockIndex === index) return;
    
    // Only swap if we are dragging an internal item
    const newBlocks = [...blocks];
    const temp = newBlocks[draggedBlockIndex];
    newBlocks[draggedBlockIndex] = newBlocks[index];
    newBlocks[index] = temp;
    
    setBlocks(newBlocks);
    setDraggedBlockIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedBlockIndex(null);
  };

  // Handle drop on the container for External Files
  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Check if it's an external file drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter((f) => (f as File).type.startsWith('image/')) as File[];
        if (files.length === 0) return;

        const newBlocks: Block[] = files.map(file => ({
            id: generateId(),
            type: BlockType.IMAGE,
            content: URL.createObjectURL(file),
        }));

        // Determine where to insert
        // Look for the closest block element to the drop target
        const targetElement = (e.target as HTMLElement).closest('[data-block-index]');
        
        let insertIndex = blocks.length; // Default to end
        if (targetElement) {
            const indexStr = targetElement.getAttribute('data-block-index');
            if (indexStr) {
                insertIndex = parseInt(indexStr, 10);
                // Inserting *before* the target by default feels more natural for "push down"
            }
        }

        const updatedBlocks = [...blocks];
        // Splice: insert at index, removing 0
        updatedBlocks.splice(insertIndex, 0, ...newBlocks);
        setBlocks(updatedBlocks);
    }
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      // Need this to allow dropping on the container background
  };

  return (
    <div className="min-h-screen bg-[#333333] flex flex-col items-center py-5 font-sans">
      
      {/* --- Toolbar --- */}
      <div className="bg-white px-6 py-3 rounded-lg shadow-xl mb-8 sticky top-4 z-50 flex flex-wrap gap-6 items-center border border-gray-200">
        
        <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
           {/* Save / Load Buttons */}
          <button 
            onClick={() => jsonInputRef.current?.click()}
            className="flex items-center gap-2 text-gray-700 hover:text-black hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            title="导入工程 (.json)"
          >
            <FolderOpen size={16} /> 导入
          </button>
          <button 
            onClick={handleSaveProject}
            className="flex items-center gap-2 text-gray-700 hover:text-black hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            title="保存工程 (.json)"
          >
            <Save size={16} /> 保存
          </button>
        </div>

        <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <ImageIcon size={16} /> 添加图片
          </button>
          <button 
            onClick={addTextRow}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-black border border-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <Type size={16} /> 添加文本
          </button>
          <button 
            onClick={addTitleRow}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-black border border-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <Heading size={16} /> 添加标题
          </button>
        </div>

        <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">间距</label>
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
                onClick={handleExportDocx}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
                <FileDown size={16} /> 导出Word
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
        <input 
          type="file" 
          ref={jsonInputRef} 
          hidden 
          accept=".json" 
          onChange={handleLoadProject} 
        />
      </div>

      {/* --- Page Container --- */}
      <div id="page-container" className="flex flex-col items-center w-full overflow-y-auto pb-10">
        <div 
            className="a4-page bg-white p-[10mm] box-border flex flex-wrap content-start gap-[10px] shadow-2xl relative transition-all"
            onDrop={handleContainerDrop}
            onDragOver={handleContainerDragOver}
            style={{ 
                width: '210mm', 
                minHeight: '297mm', // A4 Height
            }}
        >
            {blocks.length === 0 && (
                <div className="absolute inset-0 m-[10mm] flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-lg pointer-events-none">
                    <p className="font-medium">画布为空</p>
                    <p className="text-sm">拖入图片 或 点击工具栏添加</p>
                </div>
            )}

            {blocks.map((block, index) => (
                <div
                    key={block.id}
                    data-block-index={index} // Used for detecting drop target index
                    // Disable drag if this block is currently being edited
                    draggable={editingBlockId !== block.id}
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
                        onEditStart={() => setEditingBlockId(block.id)}
                        onEditEnd={() => setEditingBlockId(null)}
                    />
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default App;