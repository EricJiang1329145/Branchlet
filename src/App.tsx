import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import GithubSync from "./GithubSync";
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
    
    nodes.forEach(node => {
      // 计算当前节点与选中节点的关系
      const nodeIndex = selectedNodePath.findIndex(n => n.id === node.id);
      
      // 检查当前节点是否应该显示
      // 显示条件：选中节点本身、选中节点的所有父级节点、选中节点的所有子级节点（递归）
      const isNodeInPath = nodeIndex >= 0;  // 节点是否在选中路径上
      const isChildOfSelected = selectedNode.children.some(child => child.id === node.id);  // 是否为选中节点的直接子节点
      
      // 如果节点在选中路径上，或者是选中节点的直接子节点，则显示
      if (node.id === selectedNode.id || isNodeInPath || isChildOfSelected) {
        result.push({ node, level, parentPath });
        
        // 如果节点是展开的且有子节点，则递归处理子节点
        if (node.expanded && node.children.length > 0) {
          result = result.concat(flattenNoteTree(node.children, level + 1, [...parentPath, node], selectedNodePath));
        }
      }
      // 如果当前节点是选中节点的祖先节点，也需要递归处理其子节点以确保完整显示
      else if (isNodeInPath) {
        // 如果节点是展开的且有子节点，则递归处理子节点
        if (node.expanded && node.children.length > 0) {
          result = result.concat(flattenNoteTree(node.children, level + 1, [...parentPath, node], selectedNodePath));
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
    onNodeSelect: (node: NoteNode) => void
  }, 
  index: number, 
  style: React.CSSProperties 
}) => {
  const { flattenedNodes, selectedNodeId, onNodeSelect } = data;
  const { node, level } = flattenedNodes[index];
  
  const hasChildren = node.children.length > 0;
  
  return (
    <div style={style}>
      <div 
        className={`note-node-header ${selectedNodeId === node.id ? 'selected' : ''}`}
        onClick={() => onNodeSelect(node)}
        style={{ paddingLeft: `${level * 15 + 10}px` }}
      >
        {hasChildren && (
          <span className="expand-icon">{node.expanded ? '▼' : '▶'}</span>
        )}
        <span className="node-title">{node.title}</span>
        {node.synced === false && (
          <span className="sync-status-icon" title="未同步">●</span>
        )}
      </div>
    </div>
  );
};

// 笔记树组件
function NoteTree({ nodes, onNodeSelect, selectedNodeId, selectedNodePath }: { 
  nodes: NoteNode[]; 
  onNodeSelect: (node: NoteNode) => void; 
  selectedNodeId: string | null;
  selectedNodePath?: NoteNode[];
}) {
  // 扁平化当前显示的节点
  const flattenedNodes = flattenNoteTree(nodes, 0, [], selectedNodePath);
  
  return (
    <div className="note-tree">
      <List
        height={600} // 设置容器高度
        itemCount={flattenedNodes.length}
        itemSize={35} // 每个节点的高度
        itemData={{
          flattenedNodes,
          selectedNodeId,
          onNodeSelect
        }}
        width="100%"
      >
        {NoteTreeNode}
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
    // 切换展开状态
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
    setNoteNodes(updateNodeExpanded(noteNodes));
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
    
    // 创建新笔记
    const newNote: NoteNode = {
      id: newId,
      title: '新笔记',
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
      setSelectedNode(newNote);
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
    setSelectedNode(newNote);
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



  return (
    <div className="app-container">
      <header className="app-header">
  <h1>Branchlet - 笔记应用</h1>
  <GithubSync 
    ref={githubSyncRef} 
    onNotesSync={handleNotesSync} 
    notes={noteNodes} 
    selectedNode={selectedNode}
    onDeleteNote={handleDeleteNote}
  />
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
                        <span className="breadcrumb-item">...</span>
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
          
          <NoteTree 
            nodes={isSearching ? searchResults : noteNodes} 
            onNodeSelect={handleNodeSelect} 
            selectedNodeId={selectedNode?.id || null}
            selectedNodePath={selectedNode ? getNodePath(noteNodes, selectedNode.id) || undefined : undefined}
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
