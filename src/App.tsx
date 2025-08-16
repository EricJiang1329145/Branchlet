import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import GithubSync from "./GithubSync";
import { v4 as uuidv4 } from "uuid";
import NoteStructureManager from "./NoteStructureManager";

// 笔记节点类型定义
interface NoteNode {
  id: string;
  title: string;
  content: string;
  children: NoteNode[];
  expanded: boolean;
}

// 笔记树组件
function NoteTree({ nodes, onNodeSelect, selectedNodeId, maxLevels = 2, selectedNodePath }: { 
  nodes: NoteNode[]; 
  onNodeSelect: (node: NoteNode) => void; 
  selectedNodeId: string | null;
  maxLevels?: number;
  selectedNodePath?: NoteNode[];
}) {
  const renderNode = (node: NoteNode, level: number = 0) => {
    // 如果有选中的节点路径，根据路径调整显示层级
    if (selectedNodePath && selectedNodePath.length > 0) {
      // 找到当前节点在路径中的位置
      const nodeIndex = selectedNodePath.findIndex(n => n.id === node.id);
      
      // 找到选中节点在路径中的位置
      const selectedIndex = selectedNodePath.length - 1;
      
      // 计算相对于选中节点的层级
      const relativeLevel = nodeIndex - selectedIndex;
      
      // 只显示选中节点上下各maxLevels层的节点
      if (Math.abs(relativeLevel) > maxLevels) {
        return null;
      }
      
      // 如果是选中节点的直接子节点，且超出显示层级，则显示省略号
      if (relativeLevel === maxLevels && node.children.length > 0) {
        return (
          <div key={node.id} className="note-tree-node">
            <div 
              className={`note-node-header ${selectedNodeId === node.id ? 'selected' : ''}`}
              onClick={() => onNodeSelect(node)}
              style={{ paddingLeft: `${level * 15 + 10}px` }}
            >
              {node.children.length > 0 && (
                <span className="expand-icon">{node.expanded ? '▼' : '▶'}</span>
              )}
              <span className="node-title">{node.title}</span>
            </div>
            {node.children.length > 0 && node.expanded && (
              <div className="note-children">
                <div 
                  key={`ellipsis-${node.id}`}
                  className="note-tree-node"
                  style={{ paddingLeft: `${(level + 1) * 15 + 10}px` }}
                >
                  <div className="note-node-header">
                    <span className="node-title">...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
    } else {
      // 如果没有选中的节点，只显示根节点
      if (level > 0) {
        return null;
      }
    }
    
    const hasChildren = node.children.length > 0;
    
    return (
      <div key={node.id} className="note-tree-node">
        <div 
          className={`note-node-header ${selectedNodeId === node.id ? 'selected' : ''}`}
          onClick={() => onNodeSelect(node)}
          style={{ paddingLeft: `${level * 15 + 10}px` }}
        >
          {hasChildren && (
            <span className="expand-icon">{node.expanded ? '▼' : '▶'}</span>
          )}
          <span className="node-title">{node.title}</span>
        </div>
        {hasChildren && node.expanded && (
          <div className="note-children">
            {node.children.map(child => (
              // 递归渲染子节点
              <div key={child.id}>
                {renderNode(child, level + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="note-tree">
      {nodes.map(node => (
        <div key={node.id}>
          {renderNode(node, 0)}
        </div>
      ))}
    </div>
  );
}

// 笔记编辑器组件
function NoteEditor({ note, onNoteChange }: { 
  note: NoteNode | null; 
  onNoteChange: (note: NoteNode) => void;
}) {
  if (!note) {
    return (
      <div className="note-editor-placeholder">
        <p>选择一个笔记开始编辑</p>
      </div>
    );
  }

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
            onClick={() => {
              navigator.clipboard.writeText(note.id);
              // 可以添加一个提示，表明UUID已复制
            }}
            title="复制UUID"
          >
            复制
          </button>
        </div>
      </div>
    </div>
  );
}

// 主应用组件
  function App() {
    // 示例笔记数据
  const [noteNodes, setNoteNodes] = useState<NoteNode[]>([]);

  const [selectedNode, setSelectedNode] = useState<NoteNode | null>(null);
  const noteStructureManager = useRef<NoteStructureManager>(new NoteStructureManager());
  const githubSyncRef = useRef<any>(null);

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
          return updatedNote;
        }
        if (n.children.length > 0) {
          return { ...n, children: updateNoteContent(n.children) };
        }
        return n;
      });
    };
    setNoteNodes(updateNoteContent(noteNodes));
    setSelectedNode(updatedNote);
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
      expanded: true
    };

    // 如果没有选中任何笔记，则将新笔记添加为"我的笔记"的子笔记
    if (!selectedNode) {
      const addNoteToRoot = (nodes: NoteNode[]): NoteNode[] => {
        return nodes.map(node => {
          // 如果是根节点"我的笔记"，则添加新笔记作为其子节点
          if (node.title === '我的笔记') {
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

    setNoteNodes(addNoteToParent(noteNodes));
    setSelectedNode(newNote);
  };

  // 删除笔记
  const handleDeleteNote = (noteId: string) => {
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
          
          {/* 面包屑导航 */}
          <div className="breadcrumb">
            {selectedNode && (
              (() => {
                const path = getNodePath(noteNodes, selectedNode.id);
                return path ? (
                  <>
                    {path.length > 4 && (
                      <>
                        <span className="breadcrumb-item">...</span>
                        <span className="breadcrumb-separator">/</span>
                      </>
                    )}
                    {path.slice(Math.max(0, path.length - 4)).map((node, index) => (
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
                        {index < Math.min(path.length, 4) - 1 && (
                          <span className="breadcrumb-separator">/</span>
                        )}
                      </React.Fragment>
                    ))}
                  </>
                ) : null;
              })()
            )}
          </div>
          
          <NoteTree 
            nodes={noteNodes} 
            onNodeSelect={handleNodeSelect} 
            selectedNodeId={selectedNode?.id || null}
            maxLevels={2}
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
