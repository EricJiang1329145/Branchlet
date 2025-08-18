import React, { useState, useEffect, useRef } from 'react';
import "./App.css";
import "./Clock.css";
import GithubSync from "./GithubSync";
import Clock from "./Clock";
import { v4 as uuidv4 } from "uuid";
import NoteStructureManager from "./NoteStructureManager";
import { NoteNode } from "./types";
import { similarity } from "./levenshtein";
import { FixedSizeList as List } from 'react-window';

// 扁平化笔记树结构
const flattenNoteTree = (nodes: NoteNode[], level: number = 0, parentPath: NoteNode[] = [], selectedNodePath?: NoteNode[]): {node: NoteNode, level: number, parentPath: NoteNode[]}[] => {
  let result: {node: NoteNode, level: number, parentPath: NoteNode[]}[] = [];
  
  // 如果有选中的节点，计算需要显示的节点
  if (selectedNodePath && selectedNodePath.length > 0) {
    const selectedNode = selectedNodePath[selectedNodePath.length - 1];
    
    // 计算需要显示的路径节点（最多显示4个节点：选中节点及其向上3个层级）
    const pathToShow = selectedNodePath.length > 4 
      ? selectedNodePath.slice(selectedNodePath.length - 4) 
      : selectedNodePath;
    
    // 获取需要显示的节点ID集合
    const nodesToShow = new Set(pathToShow.map(n => n.id));
    
    // 添加选中节点的兄弟节点
    if (selectedNodePath.length > 1) {
      const parentNode = selectedNodePath[selectedNodePath.length - 2];
      parentNode.children.forEach(child => nodesToShow.add(child.id));
    } else {
      // 如果选中的是根节点，添加所有根节点
      nodes.forEach(node => nodesToShow.add(node.id));
    }
    
    // 添加选中节点的子节点
    selectedNode.children.forEach(child => nodesToShow.add(child.id));
    
    nodes.forEach(node => {
      // 检查当前节点是否应该显示
      if (nodesToShow.has(node.id)) {
        result.push({ node, level, parentPath });
        
        // 如果节点是展开的且有子节点，则递归处理子节点
        if (node.expanded && node.children.length > 0) {
          result = result.concat(flattenNoteTree(node.children, level + 1, [...parentPath, node], selectedNodePath));
        }
      } else {
        // 即使节点不在显示集合中，如果它有展开的子节点且子节点在显示集合中，也需要处理
        if (node.expanded && node.children.length > 0) {
          const childResults = flattenNoteTree(node.children, level + 1, [...parentPath, node], selectedNodePath);
          // 只有当子节点有需要显示的内容时才添加当前节点
          if (childResults.length > 0) {
            result.push({ node, level, parentPath });
            result = result.concat(childResults);
          }
        }
      }
    });
  } else {
    // 如果没有选中的节点，显示所有根节点及其展开的子节点
    nodes.forEach(node => {
      result.push({ node, level, parentPath });
      
      // 如果节点是展开的且有子节点，则递归处理子节点
      if (node.expanded && node.children.length > 0) {
        result = result.concat(flattenNoteTree(node.children, level + 1, [...parentPath, node], selectedNodePath));
      }
    });
  }
  
  return result;
};

// 笔记树节点渲染组件
const NoteTreeNode = ({ 
  data, 
  index, 
  style 
}: { 
  data: { 
    flattenedNodes: {node: NoteNode, level: number, parentPath: NoteNode[]}[], 
    selectedNodeId: string | null,
    onNodeSelect: (node: NoteNode) => void,
    onNodeDelete: (nodeId: string) => void  // 添加删除回调函数
  }, 
  index: number, 
  style: React.CSSProperties 
}) => {
  const { flattenedNodes, selectedNodeId, onNodeSelect, onNodeDelete } = data;
  const { node, level } = flattenedNodes[index];
  
  const hasChildren = node.children.length > 0;
  
  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 创建上下文菜单
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.zIndex = '1000';
    
    // 添加菜单项
    const renameItem = document.createElement('div');
    renameItem.className = 'context-menu-item';
    renameItem.textContent = '重命名';
    renameItem.onclick = () => {
      const newTitle = prompt('请输入新标题:', node.title);
      if (newTitle !== null && newTitle !== node.title) {
        // 这里应该调用重命名函数
        console.log(`重命名节点 ${node.id} 为 ${newTitle}`);
      }
      document.body.removeChild(menu);
    };
    
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.textContent = '删除';
    deleteItem.onclick = () => {
      if (window.confirm(`确定要删除笔记 "${node.title}" 吗？`)) {
        onNodeDelete(node.id);
      }
      document.body.removeChild(menu);
    };
    
    menu.appendChild(renameItem);
    menu.appendChild(deleteItem);
    
    // 添加到页面
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    const handleClickOutside = () => {
      document.body.removeChild(menu);
      document.removeEventListener('click', handleClickOutside);
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  };
  
  // 确定节点图标
  const getNodeIcon = () => {
    if (hasChildren) {
      // 有子节点的节点显示为文件夹图标
      return (
        <span className="node-icon folder-icon">📁</span>
      );
    } else {
      // 没有子节点的节点显示为文档图标
      return (
        <span className="node-icon document-icon">📄</span>
      );
    }
  };
  
  return (
    <div style={style}>
      <div 
        className={`note-node-header ${selectedNodeId === node.id ? 'selected' : ''}`}
        onClick={() => onNodeSelect(node)}
        onContextMenu={handleContextMenu}  // 添加右键菜单事件
        style={{ paddingLeft: `${level * 15 + 10}px` }}
      >
        {hasChildren && (
          <span className="expand-icon">{node.expanded ? '▼' : '▶'}</span>
        )}
        {getNodeIcon() /* 添加节点图标 */}
        <span className="node-title">{node.title}</span>
        {node.synced === false && (
          <span className="sync-status-icon" title="未同步">●</span>
        )}
      </div>
    </div>
  );
};

// 笔记树组件
function NoteTree({ nodes, onNodeSelect, selectedNodeId, selectedNodePath, onUpdateNodes, noteNodes, onDeleteNode }: { 
  nodes: NoteNode[]; 
  onNodeSelect: (node: NoteNode) => void; 
  selectedNodeId: string | null;
  selectedNodePath?: NoteNode[];
  onUpdateNodes: (nodes: NoteNode[]) => void;
  noteNodes: NoteNode[];
  onDeleteNode: (nodeId: string) => void;  // 添加删除回调
}) {
  // 找到当前选中的节点
  const selectedNode = selectedNodePath && selectedNodePath.length > 0 
    ? selectedNodePath[selectedNodePath.length - 1] 
    : null;
  
  // 获取父节点（如果不是根节点）
  const parentNode = selectedNodePath && selectedNodePath.length > 1 
    ? selectedNodePath[selectedNodePath.length - 2] 
    : null;
  
  // 构建要显示的节点列表
  let displayNodes: NoteNode[] = [];
  
  // 如果有选中的节点且不是根节点，则显示选中节点的子节点
  if (selectedNode && selectedNode.id !== 'root') {
    // 只显示当前选中节点的直接子节点
    displayNodes = selectedNode.children;
  } else {
    // 否则显示根节点的子节点
    displayNodes = nodes;
  }
  
  // 扁平化当前显示的节点
  const flattenedNodes = flattenNoteTree(displayNodes, 0, [], selectedNodePath);
  
  // 如果有父节点，添加".."选项到列表开头
  const showParentOption = parentNode !== null;
  const itemCount = showParentOption ? flattenedNodes.length + 1 : flattenedNodes.length;
  
  // 自定义的列表项组件，用于处理".."选项
  const CustomNoteTreeNode = ({ 
    data, 
    index, 
    style 
  }: { 
    data: { 
      flattenedNodes: {node: NoteNode, level: number, parentPath: NoteNode[]}[], 
      selectedNodeId: string | null,
      onNodeSelect: (node: NoteNode) => void,
      parentNode: NoteNode | null,
      showParentOption: boolean,
      onUpdateNodes: (nodes: NoteNode[]) => void,
      noteNodes: NoteNode[]
    }, 
    index: number, 
    style: React.CSSProperties 
  }) => {
    // 如果是".."选项
    if (showParentOption && index === 0) {
      return (
        <div style={style}>
          <div 
            className="note-node-header"
            onClick={() => parentNode && onNodeSelect(parentNode)}
            style={{ paddingLeft: '10px' }}
          >
            <span className="node-title">..</span>
          </div>
        </div>
      );
    }
    
    // 调整索引以匹配flattenedNodes数组
    const actualIndex = showParentOption ? index - 1 : index;
    
    const { flattenedNodes: actualFlattenedNodes, selectedNodeId, onNodeSelect: actualOnNodeSelect } = data;
    const { node, level } = actualFlattenedNodes[actualIndex];
    
    const hasChildren = node.children.length > 0;
    
    // 处理节点展开/折叠
    const handleToggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation(); // 阻止事件冒泡到父级节点
      
      // 更新节点展开状态
      const updateNodeExpanded = (nodes: NoteNode[]): NoteNode[] => {
        return nodes.map(n => {
          if (n.id === node.id) {
            return { ...n, expanded: !n.expanded };
          }
          if (n.children.length > 0) {
            return { ...n, children: updateNodeExpanded(n.children) };
          }
          return n;
        });
      };
      
      // 只更新节点展开状态，不选中节点
      data.onUpdateNodes(updateNodeExpanded(data.noteNodes));
    };
    
    // 处理节点选择
    const handleSelectNode = () => {
      actualOnNodeSelect(node);
    };
    
    return (
      <div style={style}>
        <div 
          className={`note-node-header ${selectedNodeId === node.id ? 'selected' : ''}`}
          onClick={handleSelectNode}
          style={{ paddingLeft: `${level * 15 + 10}px` }}
        >
          {hasChildren && (
            <span className="expand-icon" onClick={handleToggleExpand}>{node.expanded ? '▼' : '▶'}</span>
          )}
          <span className="node-title">{node.title}</span>
          {node.synced === false && (
            <span className="sync-status-icon" title="未同步">●</span>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="note-tree">
      <List
        height={600} // 设置容器高度
        itemCount={itemCount}
        itemSize={35} // 每个节点的高度
        itemData={{
              flattenedNodes,
                selectedNodeId,
                onNodeSelect,
                parentNode,
                showParentOption,
                onUpdateNodes,
                noteNodes,
                onDeleteNode  // 传递删除回调
              }}
        width="100%"
      >
        {CustomNoteTreeNode}
      </List>
    </div>
  );
}

// 笔记编辑器组件
function NoteEditor({ note, onNoteChange }: { 
  note: NoteNode | null; 
  onNoteChange: (note: NoteNode) => void;
}) {
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  if (!note) {
    return (
      <div className="note-editor-placeholder">
        <p>选择一个笔记开始编辑</p>
      </div>
    );
  }

  const handleCopyUUID = () => {
    navigator.clipboard.writeText(note.id);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000); // 2秒后隐藏提示
  };

  return (
    <div className="note-editor">
      <input
        type="text"
        className="note-title-input"
        value={note.title}
        onChange={(e) => onNoteChange({ ...note, title: e.target.value })}
        placeholder="输入笔记标题"
      />
      <textarea
        className="note-content-input"
        value={note.content}
        onChange={(e) => onNoteChange({ ...note, content: e.target.value })}
        placeholder="输入笔记内容"
        rows={20}
      />
      <div className="note-uuid">
        <label>UUID:</label>
        <div className="uuid-container">
          <input
            type="text"
            className="uuid-display"
            value={note.id}
            readOnly
          />
          <button 
            className="copy-uuid-btn"
            onClick={handleCopyUUID}
            title="复制UUID"
          >
            复制
          </button>
          {showCopySuccess && (
            <span className="copy-success-message">已复制!</span>
          )}
        </div>
      </div>
    </div>
  );
}

// 主应用组件
  // 在App组件中添加默认的根笔记
  function App() {
  // 默认的根笔记数据
  const defaultRootNote: NoteNode = {
    id: 'root',
    title: '我的笔记',
    content: '这是您的笔记根目录',
    children: [],
    expanded: true
  };
  
  const [noteNodes, setNoteNodes] = useState<NoteNode[]>([defaultRootNote]);

  const [selectedNode, setSelectedNode] = useState<NoteNode | null>(null);
  const noteStructureManager = useRef<NoteStructureManager>(new NoteStructureManager());
  const githubSyncRef = useRef<any>(null);
  
  // 搜索相关的状态
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<NoteNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // 面包屑省略号弹出列表相关的状态
  const [showBreadcrumbPopup, setShowBreadcrumbPopup] = useState(false);
  const [breadcrumbPopupPosition, setBreadcrumbPopupPosition] = useState({ top: 0, left: 0 });
  const [breadcrumbPopupItems, setBreadcrumbPopupItems] = useState<NoteNode[]>([]);

  // 获取节点路径的辅助函数
  const getNodePath = (nodes: NoteNode[], targetId: string): NoteNode[] | null => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [node];
      }
      
      if (node.children.length > 0) {
        const path = getNodePath(node.children, targetId);
        if (path) {
          return [node, ...path];
        }
      }
    }
    
    return null;
  };

  // 查找节点的辅助函数
  const findNode = (nodes: NoteNode[], targetId: string): NoteNode | undefined => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return node;
      }
      
      if (node.children.length > 0) {
        const found = findNode(node.children, targetId);
        if (found) {
          return found;
        }
      }
    }
  };

  // 搜索笔记的函数
  const searchNotes = (nodes: NoteNode[], term: string): NoteNode[] => {
    const results: NoteNode[] = [];
    
    // 如果搜索词为空，返回空结果
    if (!term.trim()) {
      return results;
    }
    
    const searchRecursive = (node: NoteNode) => {
      // 计算标题、内容和UUID的相似度
      const titleSimilarity = similarity(node.title.toLowerCase(), term.toLowerCase());
      const contentSimilarity = similarity(node.content.toLowerCase(), term.toLowerCase());
      const uuidSimilarity = similarity(node.id.toLowerCase(), term.toLowerCase());
      
      // 设置相似度阈值（例如0.3）
      const SIMILARITY_THRESHOLD = 0.3;
      
      // 如果标题、内容或UUID的相似度超过阈值，则认为匹配
      if (titleSimilarity >= SIMILARITY_THRESHOLD || 
          contentSimilarity >= SIMILARITY_THRESHOLD ||
          uuidSimilarity >= SIMILARITY_THRESHOLD) {
        results.push({
          ...node,
          // 添加相似度信息用于排序
          similarity: Math.max(titleSimilarity, contentSimilarity, uuidSimilarity)
        });
      }
      
      // 递归搜索子节点
      node.children.forEach(child => searchRecursive(child));
    };
    
    nodes.forEach(node => searchRecursive(node));
    
    // 根据相似度对结果进行排序（从高到低）
    return results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  };

  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.trim() !== '') {
      setIsSearching(true);
      const results = searchNotes(noteNodes, term);
      setSearchResults(results);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  // 处理搜索提交
  const handleSearchSubmit = (term: string) => {
    if (term.trim() !== '') {
      // 更新搜索历史记录
      if (!searchHistory.includes(term)) {
        const newHistory = [term, ...searchHistory.slice(0, 9)]; // 限制历史记录数量为10条
        setSearchHistory(newHistory);
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));
      }
    }
  };

  // 应用启动时自动拉取笔记
  useEffect(() => {
    // 检查是否有保存的token
    const savedToken = localStorage.getItem('github_token');
    
    // 如果有token，则自动拉取笔记
    if (savedToken) {
      // 延迟1秒后执行拉取操作，确保组件已完全加载
      const timer = setTimeout(() => {
        if (githubSyncRef.current && githubSyncRef.current.pullNotes) {
          githubSyncRef.current.pullNotes();
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // 初始化笔记结构管理器
    noteStructureManager.current.initializeStructure(noteNodes);
    
    // 从localStorage中获取搜索历史记录
    const savedSearchHistory = localStorage.getItem('searchHistory');
    if (savedSearchHistory) {
      try {
        setSearchHistory(JSON.parse(savedSearchHistory));
      } catch (e) {
        console.error('Failed to parse search history:', e);
      }
    }
  }, []);

  // 处理节点选择
  const handleNodeSelect = (node: NoteNode) => {
    setSelectedNode(node);
  };

  // 处理节点删除
  const handleNodeDelete = (nodeId: string) => {
    handleDeleteNote(nodeId);
  };

  // 处理笔记内容变化
  const handleNoteChange = (updatedNote: NoteNode) => {
    const updateNoteContent = (nodes: NoteNode[]): NoteNode[] => {
      return nodes.map(n => {
        if (n.id === updatedNote.id) {
          // 当笔记内容发生变化时，标记为未同步
          return { ...updatedNote, synced: false };
        }
        if (n.children.length > 0) {
          return { ...n, children: updateNoteContent(n.children) };
        }
        return n;
      });
    };
    setNoteNodes(updateNoteContent(noteNodes));
    setSelectedNode({ ...updatedNote, synced: false });
  };

  // 添加新笔记
  const handleAddNote = () => {
    // 生成唯一ID
    const newId = uuidv4();
    
    // 查找所有现有笔记，收集"新笔记"开头的标题
    const findAllTitles = (nodes: NoteNode[]): string[] => {
      const titles: string[] = [];
      const traverse = (nodes: NoteNode[]) => {
        nodes.forEach(node => {
          if (node.id !== 'root') { // 排除根节点
            titles.push(node.title);
          }
          if (node.children.length > 0) {
            traverse(node.children);
          }
        });
      };
      traverse(nodes);
      return titles;
    };
    
    // 获取所有标题
    const allTitles = findAllTitles(noteNodes);
    
    // 找出"新笔记"开头的标题中的数字
    const usedNumbers = new Set<number>();
    allTitles.forEach(title => {
      const match = title.match(/^新笔记 (\d+)$/);
      if (match) {
        usedNumbers.add(parseInt(match[1]));
      }
    });
    
    // 找到最小的未使用的数字
    let newNumber = 1;
    while (usedNumbers.has(newNumber)) {
      newNumber++;
    }
    
    // 创建新标题
    const newTitle = `新笔记 ${newNumber}`;
    
    // 创建新笔记
    const newNote: NoteNode = {
      id: newId,
      title: newTitle,
      content: '请输入笔记内容',
      children: [],
      expanded: true,
      synced: false // 新笔记默认未同步
    };

    // 如果没有选中任何笔记，则将新笔记添加为根节点的子笔记
    if (!selectedNode) {
      const addNoteToRoot = (nodes: NoteNode[]): NoteNode[] => {
        return nodes.map(node => {
          // 如果是根节点，则添加新笔记作为其子节点
          if (node.id === 'root') {
            // 更新笔记结构
            noteStructureManager.current.addNote(newId, node.id);
            return { ...node, children: [...node.children, newNote], expanded: true };
          }
          
          // 递归处理子节点
          if (node.children.length > 0) {
            return { ...node, children: addNoteToRoot(node.children) };
          }
          
          return node;
        });
      };
      
      setNoteNodes(addNoteToRoot(noteNodes));
      // 根据设置决定是否自动选中新创建的笔记
      if (autoSelectNewNote) {
        setSelectedNode(newNote);
      }
      return;
    }

    // 在选中的笔记下添加子笔记
    const addNoteToParent = (nodes: NoteNode[]): NoteNode[] => {
      return nodes.map(node => {
        // 如果是选中的节点，则添加新笔记作为其子节点
        if (node.id === selectedNode.id) {
          // 更新笔记结构
          noteStructureManager.current.addNote(newId, selectedNode.id);
          // 确保选中的节点展开以显示新添加的子笔记
          return { ...node, children: [...node.children, newNote], expanded: true };
        }
        
        // 递归处理子节点
        if (node.children.length > 0) {
          return { ...node, children: addNoteToParent(node.children) };
        }
        
        return node;
      });
    };

    // 查找选中的节点是否仍然存在于笔记树中
    const findSelectedNode = (nodes: NoteNode[]): NoteNode | undefined => {
      for (const node of nodes) {
        if (node.id === selectedNode.id) {
          return node;
        }
        if (node.children.length > 0) {
          const found = findSelectedNode(node.children);
          if (found) return found;
        }
      }
    };

    // 如果选中的节点仍然存在，则在该节点下添加新笔记
    // 否则，将新笔记添加为根节点的子笔记
    const targetNode = findSelectedNode(noteNodes);
    if (targetNode) {
      setNoteNodes(addNoteToParent(noteNodes));
    } else {
      // 如果选中的节点不存在，则将新笔记添加为根节点的子笔记
      const addNoteToRoot = (nodes: NoteNode[]): NoteNode[] => {
        return nodes.map(node => {
          // 如果是根节点，则添加新笔记作为其子节点
          if (node.id === 'root') {
            // 更新笔记结构
            noteStructureManager.current.addNote(newId, node.id);
            return { ...node, children: [...node.children, newNote], expanded: true };
          }
          
          // 递归处理子节点
          if (node.children.length > 0) {
            return { ...node, children: addNoteToRoot(node.children) };
          }
          
          return node;
        });
      };
      
      setNoteNodes(addNoteToRoot(noteNodes));
    }
    // 根据设置决定是否自动选中新创建的笔记
    if (autoSelectNewNote) {
      setSelectedNode(newNote);
    }
  };

  // 删除笔记
  const handleDeleteNote = (noteId: string) => {
    // 查找要删除的笔记
    const findNote = (nodes: NoteNode[]): NoteNode | undefined => {
      for (const node of nodes) {
        if (node.id === noteId) {
          return node;
        }
        if (node.children.length > 0) {
          const found = findNote(node.children);
          if (found) return found;
        }
      }
    };
    
    const noteToDelete = findNote(noteNodes);
    
    // 使用笔记结构管理器删除笔记
    noteStructureManager.current.deleteNote(noteId);
    
    // 递归删除笔记节点
    const deleteNote = (nodes: NoteNode[]): NoteNode[] => {
      return nodes
        .filter(node => node.id !== noteId)
        .map(node => ({
          ...node,
          children: deleteNote(node.children)
        }));
    };

    const updatedNodes = deleteNote(noteNodes);
    setNoteNodes(updatedNodes);
    
    // 如果删除的是当前选中的笔记，则取消选中
    if (selectedNode && selectedNode.id === noteId) {
      setSelectedNode(null);
    }
    
    // 如果笔记已同步，则通知GithubSync组件删除对应的GitHub文件
    if (noteToDelete && noteToDelete.synced === true) {
      if (githubSyncRef.current && githubSyncRef.current.deleteNote) {
        githubSyncRef.current.deleteNote(noteId);
      }
    }
  };

  const handleNotesSync = (syncedNotes: NoteNode[]) => {
    // 初始化笔记结构管理器
    noteStructureManager.current.initializeStructure(syncedNotes);
    
    setNoteNodes(syncedNotes);
    // 如果有选中的笔记，更新选中笔记的引用
    if (selectedNode) {
      // 递归查找更新后的选中笔记
      const findNode = (nodes: NoteNode[]): NoteNode | undefined => {
        for (const node of nodes) {
          if (node.id === selectedNode.id) {
            return node;
          }
          if (node.children.length > 0) {
            const found = findNode(node.children);
            if (found) {
              return found;
            }
          }
        }
      };
      
      const updatedSelectedNode = findNode(syncedNotes);
      if (updatedSelectedNode) {
        setSelectedNode(updatedSelectedNode);
      }
    }
  };



  // 添加主题状态
  const [theme, setTheme] = useState<'dark' | 'read' | 'miku'>('dark');
  
  // 添加自动选中新建笔记的状态
  const [autoSelectNewNote, setAutoSelectNewNote] = useState<boolean>(true);

  // 切换主题
  const toggleTheme = () => {
    const themes: ('dark' | 'read' | 'miku')[] = ['dark', 'read', 'miku'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const newTheme = themes[nextIndex];
    setTheme(newTheme);
    // 更新CSS变量
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-title">
          <h1>Branchlet-知记</h1>
          <Clock />
        </div>
        <div className="header-controls">
          <GithubSync 
            ref={githubSyncRef} 
            onNotesSync={handleNotesSync} 
            notes={noteNodes} 
            selectedNode={selectedNode}
            onDeleteNote={handleDeleteNote}
            autoSelectNewNote={autoSelectNewNote}
            setAutoSelectNewNote={setAutoSelectNewNote}
          />
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {{
              'dark': '🌙',
              'read': '📖',
              'miku': '🦋'
            }[theme]}
          </button>
        </div>
      </header>
      <div className="app-content">
        <div className="note-sidebar">
          <div className="sidebar-header">
            <button className="new-note-btn" onClick={handleAddNote}>新建笔记</button>
          </div>
          
          {/* 搜索框 */}
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="搜索笔记标题、内容或UUID..."
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit(searchTerm);
                }
              }}
            />
            
            {/* 搜索历史记录 */}
            {searchHistory.length > 0 && (
              <div className="search-history">
                <h4>搜索历史</h4>
                <ul>
                  {searchHistory.map((term, index) => (
                    <li 
                      key={index} 
                      onClick={() => {
                        setSearchTerm(term);
                        setIsSearching(true);
                        const results = searchNotes(noteNodes, term);
                        setSearchResults(results);
                      }}
                    >
                      {term}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* 面包屑导航 */}
          <div className="breadcrumb">
            {selectedNode && (
              (() => {
                const path = getNodePath(noteNodes, selectedNode.id);
                return path ? (
                  <>
                    {path.length > 3 && (
                      <>
                        <span className="breadcrumb-item">{path[0].title}</span>
                        <span className="breadcrumb-separator">/</span>
                        <span 
                          className="breadcrumb-item"
                          onClick={(e) => {
                            // 计算中间省略的节点
                            const omittedNodes = path.slice(1, -2);
                            setBreadcrumbPopupItems(omittedNodes);
                            
                            // 设置弹出位置
                            const rect = e.currentTarget.getBoundingClientRect();
                            setBreadcrumbPopupPosition({
                              top: rect.bottom + window.scrollY,
                              left: rect.left + window.scrollX
                            });
                            
                            // 显示弹出列表
                            setShowBreadcrumbPopup(true);
                          }}
                        >
                          ...
                        </span>
                        <span className="breadcrumb-separator">/</span>
                      </>
                    )}
                    {path.length > 3 
                      ? path.slice(-2).map((node, index) => (
                          <React.Fragment key={node.id}>
                            <span 
                              className={`breadcrumb-item ${node.id === selectedNode.id ? 'active' : ''}`}
                              onClick={() => {
                                const targetNode = findNode(noteNodes, node.id);
                                if (targetNode) handleNodeSelect(targetNode);
                              }}
                            >
                              {node.title}
                            </span>
                            {index < 1 && (
                              <span className="breadcrumb-separator">/</span>
                            )}
                          </React.Fragment>
                        ))
                      : path.map((node, index) => (
                          <React.Fragment key={node.id}>
                            <span 
                              className={`breadcrumb-item ${node.id === selectedNode.id ? 'active' : ''}`}
                              onClick={() => {
                                const targetNode = findNode(noteNodes, node.id);
                                if (targetNode) handleNodeSelect(targetNode);
                              }}
                            >
                              {node.title}
                            </span>
                            {index < path.length - 1 && (
                              <span className="breadcrumb-separator">/</span>
                            )}
                          </React.Fragment>
                        ))
                    }
                  </>
                ) : null;
              })()
            )}
          </div>
          {/* 面包屑省略号弹出列表 */}
          {showBreadcrumbPopup && (
            <div 
              className="breadcrumb-popup"
              style={{
                position: 'absolute',
                top: breadcrumbPopupPosition.top,
                left: breadcrumbPopupPosition.left,
                zIndex: 1000,
              }}
              onClick={() => setShowBreadcrumbPopup(false)}
            >
              {breadcrumbPopupItems.map((node) => (
                <div
                  key={node.id}
                  className="breadcrumb-popup-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeSelect(node);
                    setShowBreadcrumbPopup(false);
                  }}
                >
                  {node.title}
                </div>
              ))}
            </div>
          )}
          <NoteTree 
            nodes={isSearching ? searchResults : noteNodes} 
            onNodeSelect={handleNodeSelect} 
            selectedNodeId={selectedNode?.id || null}
            selectedNodePath={selectedNode ? getNodePath(noteNodes, selectedNode.id) || undefined : undefined}
            onUpdateNodes={setNoteNodes}
            noteNodes={noteNodes}
            onDeleteNode={handleNodeDelete}  // 传递删除回调
          />
        </div>
        <div className="note-main">
          <NoteEditor 
            note={selectedNode} 
            onNoteChange={handleNoteChange} 
          />
        </div>
      </div>
    </div>
  );
}

export default App;
