import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Octokit } from '@octokit/rest';

interface GithubSyncProps {
  onNotesSync: (notes: any[]) => void;
  notes: any[];
  selectedNode?: any;
  onDeleteNote?: (noteId: string) => void;
}

const GithubSync = forwardRef(({ onNotesSync, notes, selectedNode, onDeleteNote }: GithubSyncProps, ref) => {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState('');
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(0); // 自动同步间隔（分钟），0表示不自动同步
  const [autoSyncTimer, setAutoSyncTimer] = useState<any>(null);

  // 初始化时从本地存储获取token和username
  useEffect(() => {
    const savedToken = localStorage.getItem('github_token');
    const savedUsername = localStorage.getItem('github_username');
    const savedAutoSyncInterval = localStorage.getItem('auto_sync_interval');
    if (savedToken) setToken(savedToken);
    if (savedUsername) {
      setUsername(savedUsername);
    }
    if (savedAutoSyncInterval) {
      setAutoSyncInterval(parseInt(savedAutoSyncInterval, 10));
    }
  }, []);

  // 处理自动同步
  useEffect(() => {
    // 清除之前的定时器
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      setAutoSyncTimer(null);
    }
    
    // 如果设置了自动同步间隔且大于0，则启动新的定时器
    if (autoSyncInterval > 0) {
      const timer = setInterval(() => {
        // 只有在空闲状态下才执行自动同步
        if (syncStatus === 'idle') {
          pullNotes();
        }
      }, autoSyncInterval * 60 * 1000); // 转换为毫秒
      
      setAutoSyncTimer(timer);
    }
    
    // 组件卸载时清除定时器
    return () => {
      if (autoSyncTimer) {
        clearInterval(autoSyncTimer);
      }
    };
  }, [autoSyncInterval]);

  // 当token变化时，自动获取用户名
  useEffect(() => {
    if (token) {
      fetchUsernameFromToken();
    }
  }, [token]);

  // 保存token、用户名和自动同步设置到本地存储
  const saveCredentials = () => {
    localStorage.setItem('github_token', token);
    localStorage.setItem('github_username', username);
    localStorage.setItem('auto_sync_interval', autoSyncInterval.toString());
    setIsSettingsOpen(false);
  };

  // 创建Octokit实例
  const getOctokit = () => {
    if (!token) {
      throw new Error('请先设置GitHub token');
    }
    return new Octokit({ auth: token });
  };

  // 通过token获取用户名
  const fetchUsernameFromToken = async () => {
    if (!token) return;
    
    try {
      const octokit = getOctokit();
      const { data } = await octokit.rest.users.getAuthenticated();
      setUsername(data.login);
      localStorage.setItem('github_username', data.login);
    } catch (error) {
      console.error('获取用户名失败:', error);
    }
  };

  // 创建仓库
  const createRepository = async () => {
    try {
      const octokit = getOctokit();
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name: 'Branchlet-nts',
        description: 'Branchlet notes storage',
        auto_init: true
      });
      return data;
    } catch (error: any) {
      if (error.status === 422) {
        // 仓库已存在，这是正常的
        return null;
      }
      throw error;
    }
  };

  // 重试机制函数
  const retryOperation = async (operation: () => Promise<any>, maxRetries: number = 3, delay: number = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        // 如果是速率限制错误且不是最后一次重试，则等待后重试
        if (error.message.includes('rate limit') && i < maxRetries - 1) {
          console.warn(`遇到速率限制，${delay}ms后进行第${i + 1}次重试...`);
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // 指数退避
          continue;
        }
        throw error;
      }
    }
  };

  // 从GitHub拉取笔记
  const pullNotes = async () => {
    setSyncStatus('syncing');
    setSyncMessage('正在从GitHub拉取笔记...');
    
    try {
      const octokit = getOctokit();
      
      // 如果用户名为空，先获取用户名
      if (!username) {
        await retryOperation(async () => {
          await fetchUsernameFromToken();
          
          // 如果获取用户名后仍然为空，则抛出错误
          if (!username) {
            throw new Error('无法获取GitHub用户名，请检查Token是否正确设置');
          }
        });
      }
      
      // 检查仓库是否存在，如果不存在则创建
      await retryOperation(createRepository);
      
      // 获取仓库中的文件
      const { data } = await retryOperation(() => octokit.rest.repos.getContent({
        owner: username,
        repo: 'Branchlet-nts',
        path: ''
      }));
      
      // 过滤出结构文件和笔记内容文件
      const structureFile = (data as any[]).find((file: any) => file.name === 'structure.json' && file.type === 'file');
      const noteFiles = (data as any[]).filter((file: any) => file.name.endsWith('.json') && file.type === 'file' && file.name !== 'structure.json');
      
      // 如果没有结构文件，使用旧的同步方式
      if (!structureFile) {
        // 下载并解析所有笔记文件
        const notesPromises = noteFiles.map(async (file: any) => {
          const { data: fileData } = await retryOperation(() => octokit.rest.repos.getContent({
            owner: username,
            repo: 'Branchlet-nts',
            path: file.path
          }));
          
          // 解码Base64内容，处理非Latin1字符
          const content = decodeURIComponent(escape(atob((fileData as any).content)));
          return JSON.parse(content);
        });
        
        const pulledNotes = await Promise.all(notesPromises);
        
        // 更新应用中的笔记
        onNotesSync(pulledNotes);
        
        setSyncStatus('success');
        setSyncMessage('笔记同步成功!');
        
        // 3秒后清除状态消息
        setTimeout(() => {
          setSyncStatus('idle');
          setSyncMessage('');
        }, 3000);
        return;
      }
      
      // 下载结构文件
      const { data: structureData } = await retryOperation(() => octokit.rest.repos.getContent({
        owner: username,
        repo: 'Branchlet-nts',
        path: 'structure.json'
      }));
      
      // 解码Base64内容，处理非Latin1字符
      const structureContent = decodeURIComponent(escape(atob((structureData as any).content)));
      const structure = JSON.parse(structureContent);
      
      // 下载并解析所有笔记内容文件
      const noteContents: Record<string, any> = {};
      const noteContentPromises = noteFiles.map(async (file: any) => {
        const { data: fileData } = await retryOperation(() => octokit.rest.repos.getContent({
          owner: username,
          repo: 'Branchlet-nts',
          path: file.path
        }));
        
        // 解码Base64内容，处理非Latin1字符
        const content = decodeURIComponent(escape(atob((fileData as any).content)));
        const note = JSON.parse(content);
        noteContents[note.id] = note;
      });
      
      await Promise.all(noteContentPromises);
      
      // 重建笔记树
      const noteStructureManager = new (await import('./NoteStructureManager')).default();
      noteStructureManager.initializeStructureFromData(structure);
      const pulledNotes = noteStructureManager.rebuildNoteTree(noteContents);
      
      // 更新应用中的笔记
      onNotesSync(pulledNotes);
      
      setSyncStatus('success');
      setSyncMessage('笔记同步成功!');
      
      // 3秒后清除状态消息
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('拉取笔记失败:', error);
      setSyncStatus('error');
      
      // 提供更友好的错误消息
      if (error.message.includes('rate limit')) {
        setSyncMessage('GitHub API速率限制，请稍后再试或减少同步频率');
      } else {
        setSyncMessage(`拉取失败: ${error.message}`);
      }
      
      // 5秒后清除状态消息
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
    }
  };

  // 推送笔记到GitHub
  const pushNotes = async () => {
    setSyncStatus('syncing');
    setSyncMessage('正在推送笔记到GitHub...');
    
    try {
      const octokit = getOctokit();
      
      // 如果用户名为空，先获取用户名
      if (!username) {
        await retryOperation(async () => {
          await fetchUsernameFromToken();
          
          // 如果获取用户名后仍然为空，则抛出错误
          if (!username) {
            throw new Error('无法获取GitHub用户名，请检查Token是否正确设置');
          }
        });
      }
      
      // 检查仓库是否存在，如果不存在则创建
      await retryOperation(createRepository);
      
      // 获取现有的文件列表
      let existingFiles: any[] = [];
      try {
        const { data } = await retryOperation(() => octokit.rest.repos.getContent({
          owner: username,
          repo: 'Branchlet-nts',
          path: ''
        }));
        existingFiles = (data as any[]).filter((file: any) => file.name.endsWith('.json') && file.type === 'file');
      } catch (error) {
        // 如果获取文件列表失败，继续执行推送操作
        console.warn('获取现有文件列表失败:', error);
      }
      
      // 创建笔记结构管理器并初始化
      const noteStructureManager = new (await import('./NoteStructureManager')).default();
      noteStructureManager.initializeStructure(notes);
      
      // 获取笔记结构
      const structure = noteStructureManager.getStructure();
      
      // 推送结构文件
      const structureFileName = 'structure.json';
      const structureContent = btoa(unescape(encodeURIComponent(JSON.stringify(structure, null, 2))));
      const existingStructureFile = existingFiles.find((file: any) => file.name === structureFileName);
      
      if (existingStructureFile) {
        // 更新现有结构文件
        await retryOperation(() => octokit.rest.repos.createOrUpdateFileContents({
          owner: username,
          repo: 'Branchlet-nts',
          path: structureFileName,
          message: 'Update note structure',
          content: structureContent,
          sha: existingStructureFile.sha
        }));
      } else {
        // 创建新结构文件
        await retryOperation(() => octokit.rest.repos.createOrUpdateFileContents({
          owner: username,
          repo: 'Branchlet-nts',
          path: structureFileName,
          message: 'Create note structure',
          content: structureContent
        }));
      }
      
      // 为每个笔记创建或更新文件
      // 逐个推送笔记以避免触发速率限制
      for (const note of notes) {
        const fileName = `${note.id}.json`;
        // 使用encodeURIComponent和unescape处理非Latin1字符
        const content = btoa(unescape(encodeURIComponent(JSON.stringify({
          id: note.id,
          title: note.title,
          content: note.content,
          expanded: note.expanded
        }, null, 2))));
        
        // 检查文件是否已存在
        const existingFile = existingFiles.find((file: any) => file.name === fileName);
        
        if (existingFile) {
          // 更新现有文件
          await retryOperation(() => octokit.rest.repos.createOrUpdateFileContents({
            owner: username,
            repo: 'Branchlet-nts',
            path: fileName,
            message: `Update note ${note.title}`,
            content: content,
            sha: existingFile.sha
          }));
        } else {
          // 创建新文件
          await retryOperation(() => octokit.rest.repos.createOrUpdateFileContents({
            owner: username,
            repo: 'Branchlet-nts',
            path: fileName,
            message: `Create note ${note.title}`,
            content: content
          }));
        }
        
        // 在每次推送后添加小延迟以避免触发速率限制
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setSyncStatus('success');
      setSyncMessage('笔记推送成功!');
      
      // 3秒后清除状态消息
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('推送笔记失败:', error);
      setSyncStatus('error');
      
      // 提供更友好的错误消息
      if (error.message.includes('rate limit')) {
        setSyncMessage('GitHub API速率限制，请稍后再试或减少同步频率');
      } else {
        setSyncMessage(`推送失败: ${error.message}`);
      }
      
      // 5秒后清除状态消息
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
    }
  };

  // 删除笔记
  const handleDeleteNote = () => {
    if (selectedNode && onDeleteNote) {
      // 检查是否是根笔记
      const isRootNote = notes.some(note => note.id === selectedNode.id && note.title === '我的笔记');
      
      // 如果不是根笔记，则显示删除确认模态框
      if (!isRootNote) {
        setIsDeleteModalOpen(true);
        setDeleteConfirmationId('');
      }
    }
  };

  // 确认删除笔记
  const confirmDeleteNote = () => {
    if (selectedNode && onDeleteNote && deleteConfirmationId === selectedNode.id) {
      onDeleteNote(selectedNode.id);
      setIsDeleteModalOpen(false);
      setDeleteConfirmationId('');
      
      // 显示删除成功消息
      setSyncStatus('success');
      setSyncMessage('笔记删除成功!');
      
      // 3秒后清除状态消息
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 3000);
    } else {
      // 显示删除失败消息
      setSyncStatus('error');
      setSyncMessage('UUID不匹配，无法删除笔记!');
      
      // 3秒后清除状态消息
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 3000);
    }
  };

  // 将pullNotes方法暴露给父组件
  useImperativeHandle(ref, () => ({
    pullNotes
  }));

  return (
    <div className="github-sync">
      {/* 同步状态显示 */}
      <div className="sync-status">
        <button 
          className={`sync-btn pull-btn ${syncStatus === 'syncing' ? 'disabled' : ''}`}
          onClick={pullNotes}
          disabled={syncStatus === 'syncing'}
          title="从GitHub拉取笔记"
        >
          拉取
        </button>
        <button 
          className={`sync-btn push-btn ${syncStatus === 'syncing' ? 'disabled' : ''}`}
          onClick={pushNotes}
          disabled={syncStatus === 'syncing'}
          title="推送笔记到GitHub"
        >
          推送
        </button>
        <button 
          className={`sync-btn delete-btn ${!selectedNode || (notes.some(note => note.id === selectedNode.id && note.title === '我的笔记')) ? 'disabled' : ''}`}
          onClick={handleDeleteNote}
          disabled={!selectedNode || (notes.some(note => note.id === selectedNode.id && note.title === '我的笔记'))}
          title="删除选中的笔记（包含所有子笔记）"
        >
          删除
        </button>
        {syncMessage && (
          <span className={`sync-message ${syncStatus}`}>
            {syncMessage}
          </span>
        )}
      </div>
      
      {/* 设置按钮 */}
      <button 
        className="settings-btn"
        onClick={() => setIsSettingsOpen(true)}
        title="GitHub设置"
      >
        设置
      </button>
      
      {/* 删除确认模态框 */}
      {isDeleteModalOpen && (
        <div className="settings-modal">
          <div className="settings-content">
            <h3>确认删除笔记</h3>
            <p>您确定要删除笔记 "{selectedNode?.title}" 及其所有子笔记吗？</p>
            <p>请输入笔记的UUID以确认删除：</p>
            <div className="form-group">
              <input
                type="text"
                value={deleteConfirmationId}
                onChange={(e) => setDeleteConfirmationId(e.target.value)}
                placeholder="请输入笔记UUID"
              />
              {syncStatus === 'error' && syncMessage && (
                <div className="delete-error-message">
                  {syncMessage}
                </div>
              )}
            </div>
            <div className="settings-actions">
              <button onClick={confirmDeleteNote}>确认删除</button>
              <button onClick={() => setIsDeleteModalOpen(false)}>取消</button>
            </div>
          </div>
      </div>
    )}
    
    {/* 设置模态框 */}
      {isSettingsOpen && (
        <div className="settings-modal">
          <div className="settings-content">
            <h3>GitHub设置</h3>
            <div className="form-group">
              <label>GitHub用户名:</label>
              <input
                type="text"
                value={username}
                readOnly
                style={{
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  cursor: 'not-allowed'
                }}
                placeholder="请输入GitHub用户名"
              />
            </div>
            <div className="form-group">
              <label>GitHub Token:</label>
              <div className="token-input-container">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="请输入GitHub Personal Access Token"
                />
                <button 
                  type="button"
                  className="toggle-token-visibility"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? '隐藏' : '显示'}
                </button>
              </div>
              <a 
                href="https://github.com/settings/tokens/new" 
                target="_blank" 
                rel="noopener noreferrer"
                className="create-token-link"
              >
                新建Token
              </a>
            </div>
            <div className="form-group">
              <label>自动同步间隔:</label>
              <select
                value={autoSyncInterval}
                onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
              >
                <option value="0">不自动同步</option>
                <option value="10">每10秒</option>
                <option value="30">每半分钟</option>
                <option value="60">每分钟</option>
                <option value="180">每3分钟</option>
                <option value="600">每10分钟</option>
                <option value="300">每5分钟</option>
                <option value="900">每15分钟</option>
                <option value="1800">每30分钟</option>
                <option value="3600">每小时</option>
              </select>
            </div>
            <div className="settings-actions">
              <button onClick={saveCredentials}>保存</button>
              <button onClick={() => setIsSettingsOpen(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default GithubSync;