import type { NoteNode } from './App';

// 定义笔记结构类型
interface NoteStructure {
  [uuid: string]: {
    parentId: string | null;
    childIds: string[];
  };
}

class NoteStructureManager {
  private structure: NoteStructure = {};
  
  // 初始化结构
  initializeStructure(notes: NoteNode[]) {
    this.structure = {};
    this.buildStructure(notes, null);
  }
  
  // 从数据初始化结构
  initializeStructureFromData(structure: NoteStructure) {
    this.structure = structure;
  }
  
  // 递归构建结构
  private buildStructure(notes: NoteNode[], parentId: string | null) {
    notes.forEach(note => {
      this.structure[note.id] = {
        parentId,
        childIds: note.children.map(child => child.id)
      };
      
      // 递归处理子笔记
      if (note.children.length > 0) {
        this.buildStructure(note.children as NoteNode[], note.id);
      }
    });
  }
  
  // 获取笔记结构
  getStructure(): NoteStructure {
    return this.structure;
  }
  
  // 添加笔记
  addNote(noteId: string, parentId: string | null) {
    // 更新父笔记的子笔记列表
    if (parentId && this.structure[parentId]) {
      this.structure[parentId].childIds.push(noteId);
    }
    
    // 添加新笔记到结构中
    this.structure[noteId] = {
      parentId,
      childIds: []
    };
  }
  
  // 删除笔记
  deleteNote(noteId: string) {
    const note = this.structure[noteId];
    if (!note) return;
    
    // 从父笔记的子笔记列表中移除
    if (note.parentId && this.structure[note.parentId]) {
      this.structure[note.parentId].childIds = 
        this.structure[note.parentId].childIds.filter(id => id !== noteId);
    }
    
    // 递归删除所有子笔记
    note.childIds.forEach((childId: string) => {
      this.deleteNote(childId);
    });
    
    // 从结构中移除该笔记
    delete this.structure[noteId];
  }
  
  // 移动笔记
  moveNote(noteId: string, newParentId: string | null) {
    const note = this.structure[noteId];
    if (!note) return;
    
    // 从原父笔记的子笔记列表中移除
    if (note.parentId && this.structure[note.parentId]) {
      this.structure[note.parentId].childIds = 
        this.structure[note.parentId].childIds.filter(id => id !== noteId);
    }
    
    // 更新笔记的父ID
    note.parentId = newParentId;
    
    // 添加到新父笔记的子笔记列表
    if (newParentId && this.structure[newParentId]) {
      this.structure[newParentId].childIds.push(noteId);
    }
  }
  
  // 获取笔记的完整路径
  getNotePath(noteId: string): string[] {
    const path: string[] = [];
    let currentId: string | null = noteId;
    
    while (currentId) {
      path.unshift(currentId);
      const note = this.structure[currentId];
      currentId = note ? note.parentId : null;
    }
    
    return path;
  }
  
  // 根据结构重建笔记树
  rebuildNoteTree(notes: Record<string, NoteNode>): NoteNode[] {
    // 找到根笔记（没有父笔记的笔记）
    const rootIds = Object.keys(this.structure).filter(id => 
      this.structure[id].parentId === null
    );
    
    // 递归构建笔记树
    const buildTree = (noteId: string): NoteNode => {
      const noteStruct = this.structure[noteId];
      const note = notes[noteId];
      
      if (!note) {
        throw new Error(`笔记内容未找到: ${noteId}`);
      }
      
      return {
        ...note,
        children: noteStruct.childIds.map(childId => buildTree(childId))
      };
    };
    
    return rootIds.map((id: string) => buildTree(id));
  }
}

export default NoteStructureManager;