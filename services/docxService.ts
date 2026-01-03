import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  ImageRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType,
  AlignmentType,
  BorderStyle
} from "docx";
import FileSaver from "file-saver";
import { Block, BlockType } from "../types";

// Helper to determine image type from blob type
const getImageType = (mimeType: string): "png" | "jpg" | "gif" | "bmp" => {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("bmp")) return "bmp";
    return "jpg";
};

// Helper to convert base64/url to ArrayBuffer for docx
// Now supports cropping via Canvas if a cropHeight is provided
const processImage = async (url: string, cropHeight?: number): Promise<{ data: ArrayBuffer, type: "png" | "jpg" | "gif" | "bmp" }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    
    const resolveOriginal = () => {
        fetch(url)
            .then(r => r.blob())
            .then(async blob => {
                resolve({ 
                    data: await blob.arrayBuffer(), 
                    type: getImageType(blob.type) 
                });
            })
            .catch(reject);
    };

    img.onload = () => {
      // Logic: 
      // The web editor displays images at approx 354px width (Half of A4 210mm - padding).
      // We need to calculate the crop ratio based on that to match "what you see".
      const REFERENCE_DISPLAY_WIDTH = 354; 
      
      if (cropHeight) {
        // Calculate expected height if image was full width (scale logic)
        // If cropHeight >= expectedHeight, we don't need to crop (or user expanded it fully)
        // Actually, if cropHeight is present, we should trust it, but we need to map 
        // screen pixels to image pixels.
        
        const scale = img.naturalWidth / REFERENCE_DISPLAY_WIDTH;
        const targetIntrinsicHeight = cropHeight * scale;

        // If target height covers the whole image, just return original
        if (targetIntrinsicHeight >= img.naturalHeight - 1) { // epsilon
             resolveOriginal();
             return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.naturalWidth;
        canvas.height = targetIntrinsicHeight;

        if (ctx) {
          // Draw image top-aligned. The bottom part is cut off.
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
             if (blob) {
                blob.arrayBuffer().then(buffer => {
                    resolve({ data: buffer, type: "png" });
                });
             }
             else {
                resolve({ data: new ArrayBuffer(0), type: "png" });
             }
          }, 'image/png');
        } else {
           resolveOriginal();
        }
      } else {
        resolveOriginal();
      }
    };

    img.onerror = () => {
      resolveOriginal();
    };
  });
};

export const exportToDocx = async (blocks: Block[], margin: number) => {
  const docChildren: (Paragraph | Table)[] = [];
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === BlockType.TITLE) {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            new TextRun({
              text: block.content,
              bold: true,
              size: 32, // 16pt
              color: "000000"
            }),
          ],
        })
      );
    } 
    
    else if (block.type === BlockType.TEXT_ROW) {
      // Changed to simple paragraph, left aligned
      docChildren.push(
        new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 100, after: 100 },
            children: [
                new TextRun({
                    text: block.content,
                    size: 24, // 12pt
                    color: "000000"
                })
            ]
        })
      );
    } 
    
    else if (block.type === BlockType.IMAGE) {
      const nextBlock = blocks[i + 1];
      const isNextImage = nextBlock && nextBlock.type === BlockType.IMAGE;

      const img1 = await processImage(block.content, block.height);
      
      if (isNextImage) {
        const img2 = await processImage(nextBlock.content, nextBlock.height);

        const table = new Table({
            alignment: AlignmentType.CENTER,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NIL, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NIL, size: 0, color: "auto" },
                left: { style: BorderStyle.NIL, size: 0, color: "auto" },
                right: { style: BorderStyle.NIL, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NIL, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NIL, size: 0, color: "auto" },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER, // Center image in cell
                                    children: [
                                        new ImageRun({
                                            data: img1.data,
                                            transformation: { width: 300, height: block.height ? (300 * block.height / 354) : (300 * (await getImageAspectRatio(block.content))) }, 
                                            // Note: If we don't have block.height, it's auto. 
                                            // The processImage returns full or cropped buffer. 
                                            // Docx needs width/height. We fix width to 300 (approx half page).
                                            // Height should be proportional. 
                                            // For simplicity, we can let docx handle ratio if we only set width? 
                                            // docx usually requires both. We estimate height from the buffer aspect ratio if needed,
                                            // or simplistically we trust the cropHeight logic. 
                                            // If height is undefined in block, it was full scale.
                                            type: img1.type,
                                        })
                                    ]
                                })
                            ]
                        }),
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER, // Center image in cell
                                    children: [
                                        new ImageRun({
                                            data: img2.data,
                                            transformation: { width: 300, height: nextBlock.height ? (300 * nextBlock.height / 354) : (300 * (await getImageAspectRatio(nextBlock.content))) },
                                            type: img2.type,
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        });
        docChildren.push(table);
        i++; // Skip next
      } else {
        // Single Image
        const table = new Table({
            alignment: AlignmentType.CENTER,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NIL, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NIL, size: 0, color: "auto" },
                left: { style: BorderStyle.NIL, size: 0, color: "auto" },
                right: { style: BorderStyle.NIL, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NIL, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NIL, size: 0, color: "auto" },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER, // Center image
                                    children: [
                                        new ImageRun({
                                            data: img1.data,
                                            transformation: { width: 300, height: block.height ? (300 * block.height / 354) : (300 * (await getImageAspectRatio(block.content))) }, 
                                            type: img1.type,
                                        })
                                    ]
                                })
                            ]
                        }),
                        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [] })
                    ]
                })
            ]
        });
        docChildren.push(table);
      }
      
      docChildren.push(new Paragraph({ spacing: { after: margin * 10 } })); 
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
            page: {
                margin: {
                    top: 567,
                    bottom: 567,
                    left: 567,
                    right: 567
                }
            }
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  FileSaver.saveAs(blob, `export_${new Date().toISOString().slice(0,10)}.docx`);
};

// Helper to get Aspect Ratio (H/W) for Docx scaling
const getImageAspectRatio = (url: string): Promise<number> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            resolve(img.naturalHeight / img.naturalWidth);
        };
        img.onerror = () => resolve(1);
    });
};
