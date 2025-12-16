
import React, { useState, useEffect } from 'react';
import { ProjectLibrary } from './components/ProjectLibrary';
import { MemberWeeklyLog } from './components/MemberWeeklyLog';
import { ManagerNotes } from './components/ManagerNotes';
import { SmartReport } from './components/SmartReport';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { ViewState, UserRole, User } from './types';
import { storage, pb } from './services/storage';
import { 
  FolderKanban, 
  PenTool, 
  BarChart3, 
  Settings as SettingsIcon, 
  UserCircle,
  PenLine,
  Sparkles,
  LogOut,
  Loader2,
  WifiOff,
  LayoutGrid
} from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // App State
  const [currentView, setCurrentView] = useState<ViewState>('project-library');
  const [userRole, setUserRole] = useState<UserRole>('member');
  const [currentUser, setCurrentUser] = useState<string>(''); // Display Name
  const [currentUserId, setCurrentUserId] = useState<string>(''); // User ID
  const [isMock, setIsMock] = useState(false);

  // Check for session on load
  useEffect(() => {
    const checkAuth = async () => {
      // Check PB Auth
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh();
          const model = pb.authStore.model;
          if (model) {
            setIsAuthenticated(true);
            setCurrentUser(model.name);
            setCurrentUserId(model.id);
            setUserRole((model.role as UserRole) || 'member');
          }
        } catch (error) {
          pb.authStore.clear();
          setIsAuthenticated(false);
        }
      } 
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (user: User) => {
    setIsAuthenticated(true);
    setCurrentUser(user.name);
    setCurrentUserId(user.id);
    setUserRole(user.role);
    setCurrentView('project-library');
    setIsMock(storage.isMockMode());
  };

  const handleLogout = () => {
    pb.authStore.clear();
    setIsAuthenticated(false);
    setCurrentUser('');
    setCurrentUserId('');
    setUserRole('member');
    if (storage.isMockMode()) {
       window.location.reload();
    }
  };

  const NavItem = ({ view, label, icon: Icon }: { view: ViewState, label: string, icon: any }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 mb-1 group
        ${currentView === view 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
    >
      <Icon size={18} className={currentView === view ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
      {label}
    </button>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white animate-pulse">
               <span className="text-xl font-bold italic">D</span>
            </div>
            <div className="absolute -bottom-2 -right-2">
              <Loader2 className="animate-spin text-indigo-400" size={24} />
            </div>
          </div>
          <p className="text-slate-500 font-bold text-xs tracking-[0.2em] uppercase">DesignOps Pro</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 flex-col overflow-hidden">
      {isMock && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-center shadow-md flex items-center justify-center gap-2 z-50 shrink-0">
          <WifiOff size={12} />
          演示模式 - 数据仅保存在本地
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm shrink-0">
          <div className="p-8 border-b border-slate-50">
            <div className="flex items-center gap-3 text-slate-900 font-black text-2xl tracking-tighter">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <LayoutGrid size={22} />
              </div>
              DesignOps
            </div>
          </div>

          <nav className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-8">
            <div>
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4 opacity-70">工作空间</p>
              <NavItem view="project-library" label="项目库" icon={FolderKanban} />
              <NavItem view="member-log" label="工作台账" icon={PenTool} />
            </div>

            {userRole === 'manager' && (
              <>
                <div>
                  <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4 opacity-70">管理中心</p>
                  <NavItem view="manager-notes" label="每日随手记" icon={PenLine} />
                  <NavItem view="smart-report" label="智能周报" icon={Sparkles} />
                  <NavItem view="reports" label="统计报表" icon={BarChart3} />
                </div>

                <div>
                   <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4 opacity-70">系统设置</p>
                  <NavItem view="settings" label="基础设置" icon={SettingsIcon} />
                </div>
              </>
            )}
          </nav>

          <div className="p-5 border-t border-slate-50 bg-slate-50/30">
            <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm mb-3">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <UserCircle size={24} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-900 truncate">{currentUser}</span>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                      {userRole === 'manager' ? '部门经理' : '部门成员'}
                    </span>
                  </div>
               </div>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 text-slate-500 h-10 rounded-xl text-xs font-bold transition-all"
            >
              <LogOut size={14} /> 退出登录
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 custom-scrollbar relative">
          <div className="w-full min-h-full p-8 lg:p-12">
            {currentView === 'project-library' && (
              <ProjectLibrary userRole={userRole} currentUser={currentUser} currentUserId={currentUserId} />
            )}
            {currentView === 'member-log' && (
              <MemberWeeklyLog userRole={userRole} currentUser={currentUser} currentUserId={currentUserId} />
            )}
            
            {userRole === 'manager' && (
              <>
                {currentView === 'manager-notes' && <ManagerNotes />}
                {currentView === 'smart-report' && <SmartReport />}
                {currentView === 'reports' && <Reports />}
                {currentView === 'settings' && <Settings currentUserId={currentUserId} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
