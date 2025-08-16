import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Octokit } from '@octokit/rest';

interface GithubSyncProps {
  onNotesSync: (notes: any[]) => void;
  notes: any[];
}

const GithubSync = forwardRef(({ onNotesSync, notes }: GithubSyncProps, ref) => {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  // 初始化时从本地存储获取token和username
  useEffect(() => {
    const savedToken = localStorage.getItem('github_token');
    const savedUsername = localStorage.getItem('github_username');
    if (savedToken) setToken(savedToken);
    if (savedUsername) {
      setUsername(savedUsername);
    } else if (savedToken) {
      // 如果有token但没有用户名，尝试获取用户名
      fetchUsernameFromToken();
    }
  }, []);

  // 保存token到本地存储
  const saveCredentials = () => {
    localStorage.setItem('github_token', token);
    // 不再保存用户名到本地存储
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

  // 从GitHub拉取笔记
  const pullNotes = async () => {
    setSyncStatus('syncing');
    setSyncMessage('正在从GitHub拉取笔记...');
    
    try {
      const octokit = getOctokit();
      
      // 检查仓库是否存在，如果不存在则创建
      await createRepository();
      
      // 获取仓库中的文件
      const { data } = await octokit.rest.repos.getContent({
        owner: username,
        repo: 'Branchlet-nts',
        path: ''
      });
      
      // 过滤出.json文件
      const noteFiles = data.filter((file: any) => file.name.endsWith('.json') && file.type === 'file');
      
      // 下载并解析所有笔记文件
      const notesPromises = noteFiles.map(async (file: any) => {
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner: username,
          repo: 'Branchlet-nts',
          path: file.path
        });
        
        // 解码Base64内容，处理非Latin1字符
        const content = decodeURIComponent(escape(atob(fileData.content)));
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
    } catch (error: any) {
      console.error('拉取笔记失败:', error);
      setSyncStatus('error');
      setSyncMessage(`拉取失败: ${error.message}`);
      
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
      
      // 检查仓库是否存在，如果不存在则创建
      await createRepository();
      
      // 获取现有的文件列表
      let existingFiles: any[] = [];
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: username,
          repo: 'Branchlet-nts',
          path: ''
        });
        existingFiles = data.filter((file: any) => file.name.endsWith('.json') && file.type === 'file');
      } catch (error) {
        // 如果获取文件列表失败，继续执行推送操作
        console.warn('获取现有文件列表失败:', error);
      }
      
      // 为每个笔记创建或更新文件
      const pushPromises = notes.map(async (note) => {
        const fileName = `${note.id}.json`;
        // 使用encodeURIComponent和unescape处理非Latin1字符
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(note, null, 2))));
        
        // 检查文件是否已存在
        const existingFile = existingFiles.find((file: any) => file.name === fileName);
        
        if (existingFile) {
          // 更新现有文件
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: username,
            repo: 'Branchlet-nts',
            path: fileName,
            message: `Update note ${note.title}`,
            content: content,
            sha: existingFile.sha
          });
        } else {
          // 创建新文件
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: username,
            repo: 'Branchlet-nts',
            path: fileName,
            message: `Create note ${note.title}`,
            content: content
          });
        }
      });
      
      await Promise.all(pushPromises);
      
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
      setSyncMessage(`推送失败: ${error.message}`);
      
      // 5秒后清除状态消息
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
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
      
      {/* 设置模态框 */}
      {isSettingsOpen && (
        <div className="settings-modal">
          <div className="settings-content">
            <h3>GitHub设置</h3>
            <div className="form-group">
              <label>GitHub Token:</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="请输入GitHub Personal Access Token"
              />
              <a 
                href="https://github.com/settings/tokens/new" 
                target="_blank" 
                rel="noopener noreferrer"
                className="create-token-link"
              >
                新建Token
              </a>
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