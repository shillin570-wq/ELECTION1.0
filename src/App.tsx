import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, TrendingUp, ChevronRight, Clock, Plus, Edit2, Trash2, X, Check, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from './supabase';

type TensionLevel = '极高' | '高' | '中等' | '较低';

interface Crisis {
  id: string;
  state_id: string;
  time: string;
  title: string;
  details: string;
  tension: TensionLevel;
  trend: 'up' | 'down' | 'stable';
}

interface StateData {
  id: string;
  stateName: string;
  stateEn: string;
  electoralVotes: number;
  overallTension: TensionLevel;
  crises: Crisis[];
}

const LOCAL_ACCOUNTS: Array<{ id: string; username: string; password: string; role: 'admin' | 'viewer' }> = [
  { id: 'u1', username: 'SAMUN ELECTION', password: 'ACMUNC2026', role: 'admin' },
  { id: 'u2', username: 'SAMUN', password: 'ELECTION2020', role: 'viewer' }
];

const getTensionColor = (level: TensionLevel) => {
  switch (level) {
    case '极高': return 'text-[#A34A51] bg-[#A34A51]/10 border-[#A34A51]/30';
    case '高': return 'text-[#D97757] bg-[#D97757]/10 border-[#D97757]/30';
    case '中等': return 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  }
};

const Logo = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
  <div className={`font-serif font-black tracking-tighter ${className}`} style={{ fontSize: '1.75rem', lineHeight: 1, ...style }}>
    SAMUN
  </div>
);

const CrisisCard = ({ 
  crisis, 
  isAdmin, 
  onUpdateTension,
  onDelete,
  onEdit
}: { 
  crisis: Crisis; 
  isAdmin: boolean; 
  onUpdateTension: (id: string, tension: TensionLevel) => void;
  onDelete: (id: string) => void;
  onEdit: (crisis: Crisis) => void;
  key?: string | number 
}) => {
  const isCritical = crisis.tension === '极高';
  
  return (
    <div className={`relative p-5 rounded-xl bg-[#131B2F] border transition-all duration-300 overflow-hidden group flex flex-col
      ${isCritical ? 'border-[#A34A51]/50 shadow-[0_0_20px_rgba(163,74,81,0.15)]' : 'border-white/5 hover:border-white/20'}`}>
      
      {isCritical && (
        <div className="absolute top-0 left-0 w-1 h-full bg-[#A34A51]"></div>
      )}

      {isAdmin && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button 
            onClick={() => onEdit(crisis)}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
            title="编辑"
          >
            <Edit2 size={12} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if(window.confirm('确定要删除这个危机事件吗？')) {
                onDelete(crisis.id);
              }
            }}
            className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
            title="删除"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono bg-black/20 px-2 py-1 rounded">
          <Clock size={12} />
          {crisis.time}
        </div>
        
        {isAdmin ? (
          <select 
            value={crisis.tension}
            onChange={(e) => onUpdateTension(crisis.id, e.target.value as TensionLevel)}
            className={`px-2 py-1 rounded border text-[10px] font-bold outline-none cursor-pointer ${getTensionColor(crisis.tension)} mr-12`}
          >
            <option value="极高" className="bg-[#131B2F] text-[#A34A51]">极高</option>
            <option value="高" className="bg-[#131B2F] text-[#D97757]">高</option>
            <option value="中等" className="bg-[#131B2F] text-[#D4AF37]">中等</option>
            <option value="较低" className="bg-[#131B2F] text-gray-400">较低</option>
          </select>
        ) : (
          <div className={`px-2 py-1 rounded border text-[10px] font-bold flex items-center gap-1 ${getTensionColor(crisis.tension)}`}>
            {crisis.tension === '极高' ? <ShieldAlert size={10} /> : <Activity size={10} />}
            {crisis.tension}
          </div>
        )}
      </div>

      <h4 className={`font-bold text-lg mb-2 leading-snug pr-8 ${isCritical ? 'text-[#A34A51]' : 'text-white'}`}>
        {crisis.title}
      </h4>

      <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-grow">
        {crisis.details}
      </p>
      
      <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
          <span>TREND</span>
          {crisis.trend === 'up' && <TrendingUp size={14} className="text-[#A34A51]" />}
          {crisis.trend === 'down' && <TrendingUp size={14} className="text-green-500 transform rotate-180" />}
          {crisis.trend === 'stable' && <Activity size={14} className="text-gray-400" />}
        </div>
        <button className="text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
          追踪 <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginBox, setShowLoginBox] = useState(false);

  const [statesData, setStatesData] = useState<StateData[]>([]);
  const [activeStateId, setActiveStateId] = useState<string>('');
  const [isAddingCrisis, setIsAddingCrisis] = useState(false);
  const [editingCrisisId, setEditingCrisisId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', details: '', tension: '中等' as TensionLevel, trend: 'up' as 'up' | 'down' | 'stable' });

  const formatCrisisTime = () => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const account = LOCAL_ACCOUNTS.find(
      (u) => u.username === usernameInput && u.password === passwordInput
    );

    if (account) {
      setIsAuthenticated(true);
      setIsAdmin(account.role === 'admin');
      setLoginError('');
    } else {
      setLoginError('用户名或密码错误 / Invalid credentials');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUsernameInput('');
    setPasswordInput('');
  };

  const fetchData = async () => {
    try {
      const [{ data: states, error: statesError }, { data: crises, error: crisesError }] = await Promise.all([
        supabase.from('states').select('*'),
        supabase.from('crises').select('*')
      ]);

      if (statesError) {
        throw statesError;
      }
      if (crisesError) {
        throw crisesError;
      }

      const grouped = (states || []).map((state: any) => ({
        ...state,
        crises: (crises || []).filter((c: any) => c.state_id === state.id)
      })) as StateData[];

      setStatesData(grouped);
      if (grouped.length > 0 && !activeStateId) {
        setActiveStateId(grouped[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const channel = supabase
      .channel('election-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'states' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crises' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  const activeState = statesData.find(s => s.id === activeStateId) || statesData[0];

  const handleUpdateTension = async (id: string, tension: TensionLevel) => {
    try {
      const { error } = await supabase
        .from('crises')
        .update({ tension })
        .eq('id', id);
      if (error) {
        throw error;
      }
      fetchData();
    } catch (err) {
      console.error('Failed to update tension', err);
    }
  };

  const handleDeleteCrisis = async (id: string) => {
    try {
      const { error } = await supabase
        .from('crises')
        .delete()
        .eq('id', id);
      if (error) {
        throw error;
      }
      fetchData();
    } catch (err) {
      console.error('Failed to delete crisis', err);
    }
  };

  const openEditForm = (crisis: Crisis) => {
    setEditingCrisisId(crisis.id);
    setFormData({
      title: crisis.title,
      details: crisis.details,
      tension: crisis.tension,
      trend: crisis.trend
    });
    setIsAddingCrisis(true);
  };

  const openAddForm = () => {
    setEditingCrisisId(null);
    setFormData({ title: '', details: '', tension: '中等', trend: 'up' });
    setIsAddingCrisis(true);
  };

  const closeForm = () => {
    setIsAddingCrisis(false);
    setEditingCrisisId(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCrisisId) {
        const { error } = await supabase
          .from('crises')
          .update(formData)
          .eq('id', editingCrisisId);
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('crises')
          .insert({
            id: `${activeStateId}-${Date.now()}`,
            state_id: activeStateId,
            time: formatCrisisTime(),
            ...formData
          });
        if (error) {
          throw error;
        }
      }
      closeForm();
      fetchData();
    } catch (err) {
      console.error('Failed to save crisis', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans flex items-center justify-center relative overflow-hidden selection:bg-[#A34A51] selection:text-white">
        {/* Massive Brutalist Background */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none overflow-hidden select-none transition-opacity duration-700 ${showLoginBox ? 'opacity-10' : 'opacity-40'}`}>
          <motion.h1 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="text-[28vw] font-display leading-[0.8] text-[#A34A51] whitespace-nowrap tracking-tighter m-0"
          >
            2020
          </motion.h1>
          <motion.h2 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
            className="text-[14vw] font-display leading-[0.8] text-white whitespace-nowrap tracking-tight m-0"
          >
            ELECTION
          </motion.h2>
          <motion.h3
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.6, ease: "easeOut" }}
            className="text-[8vw] font-display leading-[0.8] text-transparent stroke-text whitespace-nowrap tracking-widest m-0 mt-4"
            style={{ WebkitTextStroke: '2px #A34A51' }}
          >
            CRISIS TRACKER
          </motion.h3>
        </div>

        {/* Warning Tapes */}
        <div className={`absolute inset-0 z-0 flex flex-col justify-between py-20 pointer-events-none overflow-hidden transition-opacity duration-700 ${showLoginBox ? 'opacity-20' : 'opacity-60'}`}>
          <div className="w-[120%] -ml-[10%] bg-[#A34A51] text-black py-3 transform -rotate-3 shadow-[0_0_30px_#A34A51]">
             <div className="animate-marquee inline-block font-mono font-black text-2xl tracking-widest">
               CRITICAL ALERT • SWING STATES UNRESOLVED • MAIL-IN BALLOT SURGE • TENSION LEVEL: MAXIMUM • CRITICAL ALERT • SWING STATES UNRESOLVED • MAIL-IN BALLOT SURGE • TENSION LEVEL: MAXIMUM • 
             </div>
          </div>
          <div className="w-[120%] -ml-[10%] bg-white text-black py-3 transform rotate-3 shadow-[0_0_30px_white]">
             <div className="animate-marquee inline-block font-mono font-black text-2xl tracking-widest" style={{ animationDirection: 'reverse' }}>
               PENNSYLVANIA • GEORGIA • MICHIGAN • ARIZONA • WISCONSIN • NEVADA • NORTH CAROLINA • PENNSYLVANIA • GEORGIA • MICHIGAN • ARIZONA • WISCONSIN • NEVADA • NORTH CAROLINA • 
             </div>
          </div>
        </div>

        {/* Initial Interaction Overlay */}
        {!showLoginBox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute inset-0 z-10 flex items-end justify-center cursor-pointer pb-12"
            onClick={() => setShowLoginBox(true)}
          >
            <div className="text-white/50 font-mono text-[10px] tracking-[0.3em] uppercase hover:text-white transition-colors animate-pulse">
              [ Click anywhere to authenticate ]
            </div>
          </motion.div>
        )}

        {/* Login Panel */}
        {showLoginBox && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative z-20 w-full max-w-md bg-black/90 backdrop-blur-xl border-2 border-[#A34A51] p-10 shadow-[0_0_50px_rgba(163,74,81,0.5)]"
          >
            {/* Close button */}
            <button 
              onClick={() => setShowLoginBox(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            {/* Glitchy top border */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[#A34A51] overflow-hidden">
              <motion.div 
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                className="w-1/3 h-full bg-white blur-[2px]"
              />
            </div>
            
            <div className="mb-8 border-b border-white/10 pb-6 flex justify-center">
              <Logo className="text-white" style={{ fontSize: '3.5rem' }} />
            </div>

            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="block text-[11px] text-gray-400 font-mono uppercase tracking-widest font-bold">Operator ID</label>
                <input 
                  type="text" 
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/20 px-0 py-2 text-xl text-white font-mono focus:outline-none focus:border-[#A34A51] transition-colors placeholder:text-white/20 rounded-none"
                  placeholder="ENTER ID"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] text-gray-400 font-mono uppercase tracking-widest font-bold">Passcode</label>
                <input 
                  type="password" 
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/20 px-0 py-2 text-xl text-white font-mono focus:outline-none focus:border-[#A34A51] transition-colors placeholder:text-white/20 tracking-widest rounded-none"
                  placeholder="••••••••"
                  required
                />
              </div>

              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[#A34A51] text-xs font-mono font-bold bg-[#A34A51]/10 border border-[#A34A51]/30 p-3 flex items-start gap-2"
                >
                  <ShieldAlert size={16} className="shrink-0" />
                  <span>ACCESS DENIED. INVALID CREDENTIALS.</span>
                </motion.div>
              )}

              <button 
                type="submit"
                className="w-full bg-[#A34A51] hover:bg-white hover:text-black text-white font-black font-mono py-4 transition-colors tracking-[0.2em] text-sm mt-8 flex items-center justify-center gap-2 group"
              >
                AUTHORIZE <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </motion.div>
        )}
      </div>
    );
  }

  if (statesData.length === 0) {
    return <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white font-sans selection:bg-[#A34A51] selection:text-white pb-12">
      {/* Background glow */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #A34A51 0%, transparent 40%)' }}>
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-[#0B0F19]/90 backdrop-blur-md sticky top-0 z-50 h-[73px] flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Logo className="text-[#A34A51]" />
            <div className="ml-2 border-l border-white/10 pl-4">
              <h1 className="text-xl font-bold tracking-wider font-serif">2020美国大选</h1>
              <h2 className="text-xs text-gray-400 font-mono tracking-widest uppercase mt-0.5">Election Week Crisis Briefing</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono font-bold ${isAdmin ? 'bg-[#A34A51]/20 text-[#A34A51]' : 'bg-white/5 text-gray-300'}`}>
              <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-[#A34A51]' : 'bg-gray-400'}`}></span>
              {isAdmin ? 'ADMIN' : 'VIEWER'}
            </div>
            <button 
              onClick={handleLogout}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
            <div className="text-right hidden md:block border-l border-white/10 pl-4">
              <div className="text-[#A34A51] font-mono font-bold text-lg">NOV 2020</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-end gap-2">
                <span className="w-2 h-2 rounded-full bg-[#A34A51] animate-pulse"></span>
                Historical Archive
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Title Section */}
        <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-8">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-serif font-bold leading-tight">
              七大摇摆州<br/>
              <span className="text-[#A34A51]">选举周危机档案</span>
            </h2>
          </div>
          
          {/* Overall Threat Meter */}
          <div className="bg-[#131B2F] border border-[#A34A51]/30 rounded-2xl p-6 flex items-center gap-6 min-w-[300px] shadow-[0_0_40px_rgba(163,74,81,0.15)]">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#1F2937" strokeWidth="8" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#A34A51" strokeWidth="8" strokeDasharray="283" strokeDashoffset="42" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold text-[#A34A51] font-mono">85</span>
                <span className="text-[10px] text-gray-400 font-mono">INDEX</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 font-mono mb-1">NATIONAL TENSION</div>
              <div className="text-2xl font-bold text-white tracking-widest">CRITICAL</div>
              <div className="text-xs text-[#A34A51] mt-1 flex items-center gap-1 font-mono">
                <ShieldAlert size={12} /> Unprecedented Level
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Layout: Sidebar + Main Area */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar: State Selector */}
          <div className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-3">
            <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2 px-1">Select State</div>
            {statesData.map(state => (
              <button
                key={state.id}
                onClick={() => {
                  setActiveStateId(state.id);
                  closeForm();
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 flex items-center justify-between group
                  ${activeStateId === state.id
                    ? 'bg-[#A34A51]/20 border-[#A34A51] shadow-[0_0_15px_rgba(163,74,81,0.2)]'
                    : 'bg-[#131B2F] border-white/5 hover:border-white/20 hover:bg-[#1a243d]'
                  }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-serif font-bold text-lg ${activeStateId === state.id ? 'text-[#A34A51]' : 'text-white'}`}>
                      {state.stateName}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono uppercase">{state.stateEn}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 font-mono">{state.electoralVotes} EV</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                    <span className={state.overallTension === '极高' ? 'text-[#A34A51]' : state.overallTension === '高' ? 'text-[#D97757]' : 'text-[#D4AF37]'}>
                      {state.overallTension}
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className={`${activeStateId === state.id ? 'text-[#A34A51]' : 'text-gray-600 group-hover:text-gray-400'} transition-colors`} />
              </button>
            ))}
          </div>

          {/* Main Area: Active State Details */}
          <div className="w-full lg:w-2/3 xl:w-3/4">
            {/* Active State Header */}
            <div className="bg-[#131B2F] border border-white/10 rounded-2xl p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
              {/* Decorative background for active state header */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#A34A51]/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

              <div className="flex items-center gap-5 relative z-10">
                <div className="w-16 h-16 rounded-full bg-[#0B0F19] border border-[#A34A51]/50 flex items-center justify-center text-2xl font-serif font-bold text-[#A34A51] shadow-[0_0_20px_rgba(163,74,81,0.3)]">
                  {activeState.id.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-3xl font-serif font-bold text-white tracking-wide">{activeState.stateName}</h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-sm text-gray-400 font-mono uppercase tracking-widest">{activeState.stateEn}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                    <span className="text-sm text-[#A34A51] font-mono font-bold">{activeState.electoralVotes} Electoral Votes</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 relative z-10">
                {isAdmin && !isAddingCrisis && (
                  <button 
                    onClick={openAddForm}
                    className="px-3 py-2 rounded-lg border border-[#A34A51] text-[#A34A51] hover:bg-[#A34A51] hover:text-white transition-colors flex items-center gap-2 text-sm font-bold"
                  >
                    <Plus size={16} />
                    添加危机
                  </button>
                )}
                <div className={`px-4 py-2.5 rounded-lg border text-sm font-bold flex items-center gap-2 ${getTensionColor(activeState.overallTension)} bg-[#0B0F19]`}>
                  <span className="text-gray-400 font-mono text-xs mr-1">STATE TENSION</span>
                  {activeState.overallTension === '极高' ? <ShieldAlert size={16} /> : <Activity size={16} />}
                  {activeState.overallTension}
                </div>
              </div>
            </div>

            {/* Admin Add/Edit Crisis Form */}
            {isAdmin && isAddingCrisis && (
              <form onSubmit={handleSubmitForm} className="bg-[#131B2F] border border-[#A34A51] rounded-2xl p-6 mb-6 shadow-[0_0_30px_rgba(163,74,81,0.2)] relative z-10">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    {editingCrisisId ? <Edit2 size={18} className="text-[#A34A51]" /> : <Plus size={18} className="text-[#A34A51]" />}
                    {editingCrisisId ? '编辑危机事件' : '添加新危机事件'} - {activeState.stateName}
                  </h4>
                  <button type="button" onClick={closeForm} className="text-gray-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">危机标题</label>
                    <input 
                      required
                      type="text" 
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51]"
                      placeholder="输入标题..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">紧张程度</label>
                      <select 
                        value={formData.tension}
                        onChange={e => setFormData({...formData, tension: e.target.value as TensionLevel})}
                        className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51]"
                      >
                        <option value="极高">极高</option>
                        <option value="高">高</option>
                        <option value="中等">中等</option>
                        <option value="较低">较低</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">发展趋势</label>
                      <select 
                        value={formData.trend}
                        onChange={e => setFormData({...formData, trend: e.target.value as 'up'|'down'|'stable'})}
                        className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51]"
                      >
                        <option value="up">上升 (Up)</option>
                        <option value="stable">平稳 (Stable)</option>
                        <option value="down">下降 (Down)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-xs text-gray-400 mb-1">详细描述</label>
                  <textarea 
                    required
                    value={formData.details}
                    onChange={e => setFormData({...formData, details: e.target.value})}
                    className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51] h-24 resize-none"
                    placeholder="输入详细描述..."
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={closeForm}
                    className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#A34A51] text-white hover:bg-[#8A3A41] transition-colors text-sm font-bold flex items-center gap-2"
                  >
                    <Check size={16} />
                    {editingCrisisId ? '保存修改' : '确认添加'}
                  </button>
                </div>
              </form>
            )}

            {/* Crises Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeState.crises.map(crisis => (
                <CrisisCard 
                  key={crisis.id} 
                  crisis={crisis} 
                  isAdmin={isAdmin} 
                  onUpdateTension={handleUpdateTension}
                  onDelete={handleDeleteCrisis}
                  onEdit={openEditForm}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


