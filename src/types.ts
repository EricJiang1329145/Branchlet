// 笔记节点类型定义
export interface NoteNode {
  id: string;
  title: string;
  content: string;
  children: NoteNode[];
  expanded: boolean;
  synced?: boolean; // 添加同步状态字段，标记笔记是否已同步到GitHub
  similarity?: number; // 添加相似度字段，用于搜索结果排序
}