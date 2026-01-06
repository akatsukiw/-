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
  const [targetBlockIndex, setTargetBlockIndex] = useState<number | null>(null); // Track where we are hovering
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // --- Auto Count Logic ---
  const recalculateCounts = (currentBlocks: Block[]): Block[] => {
    let currentTextRowId: string | null = null;
    const counts: Record<string, number> = {};

    // Pass 1: Count images per Text Row
    for (const block of currentBlocks) {
      if (block.type === BlockType.TEXT_ROW) {
        currentTextRowId = block.id;
        counts[currentTextRowId] = 0;
      } else if (block.type === BlockType.IMAGE && currentTextRowId) {
        counts[currentTextRowId]++;
      }
    }

    // Pass 2: Update subContent
    return currentBlocks.map(block => {
      if (block.type === BlockType.TEXT_ROW) {
        const count = counts[block.id] || 0;
        const newSubContent = `好评${count}次`;
        if (block.subContent !== newSubContent) {
          return { ...block, subContent: newSubContent };
        }
      }
      return block;
    });
  };

  const setBlocksWithCount = (newBlocksOrUpdater: Block[] | ((prev: Block[]) => Block[])) => {
    setBlocks(prev => {
      const nextBlocks = typeof newBlocksOrUpdater === 'function' 
        ? newBlocksOrUpdater(prev) 
        : newBlocksOrUpdater;
      return recalculateCounts(nextBlocks);
    });
  };

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
      setBlocksWithCount(prev => [...prev, ...newBlocks]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addTextRow = () => {
    setBlocksWithCount(prev => [...prev, {
      id: generateId(),
      type: BlockType.TEXT_ROW,
      content: '新文本',
      subContent: '好评0次'
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
    setBlocksWithCount(prev => prev.filter(b => b.id !== id));
  };

  // --- Save / Load Project ---

  const handleSaveProject = async () => {
    try {
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
            setBlocks(recalculateCounts(json.blocks));
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
    e.dataTransfer.setData("application/react-dnd-internal", "true");
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping

    // External files
    if (e.dataTransfer.types.includes("Files")) {
        e.dataTransfer.dropEffect = "copy";
        setTargetBlockIndex(index); 
        return;
    }

    // Internal Drag
    if (draggedBlockIndex !== null && draggedBlockIndex !== index) {
       setTargetBlockIndex(index);
       e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragEnd = () => {
    setDraggedBlockIndex(null);
    setTargetBlockIndex(null);
  };

  // Handler for dropping ONTO a specific block
  const handleBlockDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to container

    // 1. Handle External File Drop -> Always Insert (Green style logic)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter((f) => (f as File).type.startsWith('image/')) as File[];
        if (files.length > 0) {
            const newBlocks: Block[] = files.map(file => ({
                id: generateId(),
                type: BlockType.IMAGE,
                content: URL.createObjectURL(file),
            }));

            setBlocksWithCount(prev => {
                const updatedBlocks = [...prev];
                updatedBlocks.splice(dropIndex, 0, ...newBlocks);
                return updatedBlocks;
            });
        }
        setTargetBlockIndex(null);
        return;
    }

    // 2. Handle Internal Drop
    if (draggedBlockIndex !== null && draggedBlockIndex !== dropIndex) {
        const sourceBlock = blocks[draggedBlockIndex];
        const targetBlock = blocks[dropIndex];

        // Logic Check: Swap or Insert?
        // Swap: Source is Image AND Target is Image
        const isSwapOperation = sourceBlock.type === BlockType.IMAGE && targetBlock.type === BlockType.IMAGE;

        setBlocksWithCount(prev => {
            const newBlocks = [...prev];

            if (isSwapOperation) {
                // Swap logic: Exchange positions directly
                newBlocks[draggedBlockIndex] = targetBlock;
                newBlocks[dropIndex] = sourceBlock;
            } else {
                // Insert/Push logic: Standard reorder
                const [movedItem] = newBlocks.splice(draggedBlockIndex, 1);
                // Adjust index if dragging from top to bottom
                // But splice-then-splice is safer than index math usually
                newBlocks.splice(dropIndex, 0, movedItem);
            }
            return newBlocks;
        });
    }

    setDraggedBlockIndex(null);
    setTargetBlockIndex(null);
  };

  // Handler for dropping ON THE CONTAINER (Background) - Append to end
  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    // External files -> Append
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter((f) => (f as File).type.startsWith('image/')) as File[];
        if (files.length === 0) return;

        const newBlocks: Block[] = files.map(file => ({
            id: generateId(),
            type: BlockType.IMAGE,
            content: URL.createObjectURL(file),
        }));

        setBlocksWithCount(prev => [...prev, ...newBlocks]);
    } else if (draggedBlockIndex !== null) {
        // Internal drag dropped on whitespace -> move to end
        setBlocksWithCount(prev => {
            const newBlocks = [...prev];
            const [movedItem] = newBlocks.splice(draggedBlockIndex, 1);
            newBlocks.push(movedItem);
            return newBlocks;
        });
    }
    setDraggedBlockIndex(null);
    setTargetBlockIndex(null);
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (e.target === e.currentTarget) {
         setTargetBlockIndex(null);
      }
  };

  return (
    <div className="min-h-screen bg-[#333333] flex flex-col items-center py-5 font-sans">
      
      {/* --- Toolbar --- */}
      <div className="bg-white px-6 py-3 rounded-lg shadow-xl mb-8 sticky top-4 z-50 flex flex-wrap gap-6 items-center border border-gray-200">
        
        <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
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

            {blocks.map((block, index) => {
                // Determine Visual State
                const isSource = draggedBlockIndex === index;
                const isTarget = targetBlockIndex === index && !isSource;
                
                let visualClass = '';
                
                if (isTarget) {
                    // Decide Swap vs Insert Visuals
                    // Case 1: External File Drag -> Always Insert (Green)
                    // We don't have easy access to 'isExternal' here without checking a global or state, 
                    // BUT draggedBlockIndex is null during external drag.
                    const isExternalDrag = draggedBlockIndex === null;

                    if (isExternalDrag) {
                         visualClass = 'border-t-[4px] border-green-500 pt-0';
                    } else {
                        // Internal Drag
                        const sourceBlock = blocks[draggedBlockIndex];
                        const targetBlock = blocks[index];
                        
                        const isSwapMode = sourceBlock.type === BlockType.IMAGE && targetBlock.type === BlockType.IMAGE;

                        if (isSwapMode) {
                            // Swap Visual: Blue Border Box
                            visualClass = 'border-2 border-blue-500 rounded-sm scale-[1.02] z-10';
                        } else {
                            // Insert Visual: Green Top Border
                            visualClass = 'border-t-[4px] border-green-500 pt-0';
                        }
                    }
                }

                return (
                <div
                    key={block.id}
                    data-block-index={index} 
                    draggable={editingBlockId !== block.id}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleBlockDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`
                        ${block.type === BlockType.IMAGE ? 'w-[calc(50%-5px)]' : 'w-full'}
                        transition-all duration-100 ease-out cursor-move relative
                        ${isSource ? 'opacity-30 scale-95' : 'opacity-100'}
                        ${visualClass}
                    `}
                    style={{ marginBottom: `${margin}px` }}
                >
                    <BlockRenderer 
                        block={block} 
                        onUpdate={updateBlock} 
                        onRemove={removeBlock}
                        isDragging={isSource}
                        onEditStart={() => setEditingBlockId(block.id)}
                        onEditEnd={() => setEditingBlockId(null)}
                    />
                </div>
            )})}
        </div>
      </div>
    </div>
  );
}

export default App;