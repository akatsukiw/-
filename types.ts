export enum BlockType {
  IMAGE = 'IMAGE',
  TEXT_ROW = 'TEXT_ROW',
  TITLE = 'TITLE'
}

export interface Block {
  id: string;
  type: BlockType;
  content: string; // Image URL or Main Text
  subContent?: string; // Secondary Text (for text rows)
  height?: number; // Optional visual height override for images
}
