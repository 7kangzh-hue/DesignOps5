
import React, { useState, useEffect } from 'react';
import { pb, storage } from '../services/storage';
import { User, UserRole } from '../types';
import { Lock, User as UserIcon, AlertCircle, Loader2, HelpCircle, LayoutGrid, Settings, Save, RotateCcw, X, ShieldCheck, UserCheck } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState(storage.getCurrentServerUrl());

  useEffect(() => {
    const savedUsername = localStorage.getItem('saved_username');
    const savedPasswordEncoded = localStorage.getItem('saved_password');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
      if (savedPasswordEncoded) {
        try {
          setPassword(atob(savedPasswordEncoded));
        } catch (e) {
          console.error("Failed to decode saved password");
        }
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const authData = await pb.collection('users').authWithPassword(username, password);
      
      const user: User = {
        id: authData.record.id,
        username: authData.record.username,
        name: authData.record.name,
        role: (authData.record.role as UserRole) || 'member',
      };
      
      if (rememberMe) {
        localStorage.setItem('saved_username', username);
        localStorage.setItem('saved_password', btoa(password));
      } else {
        localStorage.removeItem('saved_username');
        localStorage.removeItem('saved_password');
      }

      onLogin(user);
    } catch (err: any) {
      console.error("Login attempt failed:", err);
      if (err.status === 0 || err.message?.includes('Failed to fetch')) {
        setError(`无法连接到服务器 (${serverUrl})。请点击右上角设置图标检查服务器地址是否正确，或确保后端已启动。`);
      } else {
        setError('账号或密码错误。请确保已在 PocketBase 后台创建用户记录（非后台管理员）。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fillDefaultAdmin = () => {
    setUsername('admin');
    setPassword('123456');
    setError('');
  };

  const enterMockMode = (role: UserRole) => {
    try {
      storage.enableMockMode();
      const mockUser: User = {
        id: role === 'manager' ? 'mock_u1' : 'mock_u2',
        username: role === 'manager' ? 'admin' : 'wang',
        name: role === 'manager' ? '管理员(预览)' : '王大神(预览)',
        role: role
      };
      onLogin(mockUser);
    } catch (e) {
      setError("进入演示模式失败，请检查浏览器存储设置。");
    }
  };

  const handleSaveServerUrl = () => {
    storage.updatePocketBaseUrl(serverUrl);
    setShowServerModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row relative z-10 border border-white/50">
        <button onClick={() => setShowServerModal(true)} className="absolute top-4 right-4 z-50 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="服务器设置">
          <Settings size={20} />
        </button>

        <div className="hidden md:flex w-5/12 bg-gradient-to-br from-blue-600 to-indigo-700 p-10 flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')] bg-cover opacity-20 mix-blend-overlay"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md mb-6 border border-white/20 shadow-lg">
              <LayoutGrid size={24} className="text-white"/>
            </div>
            <h2 className="text-3xl font-bold mb-3 tracking-tight">DesignOps Pro</h2>
            <p className="text-blue-100 text-sm leading-relaxed opacity-90">专为设计团队打造的效能管理平台。集成项目追踪、智能工时统计与 AI 辅助汇报。</p>
          </div>
          <div className="relative z-10 text-[10px] text-blue-200 uppercase tracking-widest font-semibold">© 2024 Team Efficiency System</div>
        </div>

        <div className="flex-1 p-8 md:p-12 lg:p-14">
          <div className="text-center md:text-left mb-10">
            <h1 className="text-2xl font-bold text-gray-800">欢迎回来</h1>
            <p className="text-gray-500 text-sm mt-2">请登录您的账户以继续管理工作</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">账号</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                  <UserIcon size={18} />
                </div>
                <input 
                  type="text" 
                  required 
                  className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm outline-none transition-all font-medium" 
                  placeholder="请输入登录账号" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  disabled={isLoading} 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">密码</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required 
                  className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm outline-none transition-all font-medium" 
                  placeholder="请输入密码" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  disabled={isLoading} 
                />
              </div>
            </div>

            <div className="flex items-center">
              <input 
                id="remember-me" 
                type="checkbox" 
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 cursor-pointer font-medium">记住账号和密码</label>
            </div>

            {error && (
              <div className="flex items-start gap-3 text-red-600 text-sm bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <button 
                type="submit" 
                disabled={isLoading} 
                className="w-full flex justify-center py-3.5 border border-transparent rounded-xl shadow-lg shadow-blue-200 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all transform active:scale-[0.98] disabled:bg-blue-400 items-center gap-2"
              >
                {isLoading && <Loader2 className="animate-spin" size={18} />}
                {isLoading ? '正在登录...' : '立即登录'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400 text-[10px] uppercase font-bold tracking-widest">进入演示模式</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={() => enterMockMode('manager')} 
                  className="flex flex-col items-center justify-center py-3 px-4 border border-dashed border-slate-300 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all group"
                >
                  <ShieldCheck size={18} className="text-slate-400 group-hover:text-blue-500 mb-1"/>
                  <span className="text-xs font-bold text-slate-600 group-hover:text-blue-700">经理预览</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => enterMockMode('member')} 
                  className="flex flex-col items-center justify-center py-3 px-4 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all group"
                >
                  <UserCheck size={18} className="text-slate-400 group-hover:text-slate-600 mb-1"/>
                  <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">成员预览</span>
                </button>
              </div>
            </div>
          </form>

          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-gray-50 px-4 py-2 rounded-full border border-gray-100 shadow-sm">
              <HelpCircle size={14} className="text-blue-400"/>
              <span>无法登录?</span>
              <button type="button" onClick={fillDefaultAdmin} className="text-blue-600 hover:text-blue-800 font-bold hover:underline">一键填入 Admin</button>
            </div>
          </div>
        </div>
      </div>

      {showServerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Settings size={20} className="text-blue-600"/> 服务器配置
              </h3>
              <button onClick={() => setShowServerModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 mb-2">POCKETBASE URL</label>
              <input 
                type="text" 
                value={serverUrl} 
                onChange={(e) => setServerUrl(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                placeholder="http://82.156.7.149:8090" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleSaveServerUrl} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2">
                <Save size={16} /> 保存并刷新
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
