import React, { useState, useEffect, useRef } from 'react';
import { Activity, ShieldAlert, TrendingUp, ChevronRight, Clock, Plus, Edit2, Trash2, X, Check, LogOut, Sparkles, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from './supabase';

type TensionLevel = '极高' | '高' | '中等' | '较低';

interface CrisisBase {
  id: string;
  time: string;
  title: string;
  details: string;
  tension: TensionLevel;
  trend: 'up' | 'down' | 'stable';
  created_at?: string;
  updated_at?: string;
}

interface Crisis extends CrisisBase {
  state_id: string;
}

interface NationalCrisis extends CrisisBase {
}

interface CrisisDetailModalData extends CrisisBase {
  scopeLabel: string;
}

interface StateData {
  id: string;
  stateName: string;
  stateEn: string;
  electoralVotes: number;
  overallTension: TensionLevel;
  tensionPercent: number;
  crises: Crisis[];
}

const getTodayIsoDate = () => new Date().toISOString().slice(0, 10);

const formatDateParts = (isoDate: string) => {
  const [year = '----', month = '--', day = '--'] = isoDate.split('-');
  return { year, month, day };
};

const formatHeaderDate = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return 'DATE --';
  }
  return date
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    .toUpperCase();
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const defaultPercentByLevel = (level: TensionLevel) => {
  switch (level) {
    case '极高':
      return 90;
    case '高':
      return 72;
    case '中等':
      return 50;
    default:
      return 30;
  }
};

const toEpoch = (value?: string) => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const LOCAL_ACCOUNTS: Array<{ id: string; username: string; password: string; role: 'admin' | 'viewer' }> = [
  { id: 'u1', username: 'SAMUN ELECTION', password: 'ACMUNC2026', role: 'admin' },
  { id: 'u2', username: 'SAMUN', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u3', username: 'Georgia', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u4', username: 'Pennsylvania', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u5', username: 'Michigan', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u6', username: 'Arizona', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u7', username: 'Wisconsin', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u8', username: 'Nevada', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u9', username: 'NorthCarolina', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u10', username: 'Democratic', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u11', username: 'Republican', password: 'ELECTION2020', role: 'viewer' }
];

const getTensionColor = (level: TensionLevel) => {
  switch (level) {
    case '极高': return 'text-[#A34A51] bg-[#A34A51]/10 border-[#A34A51]/30';
    case '高': return 'text-[#D97757] bg-[#D97757]/10 border-[#D97757]/30';
    case '中等': return 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  }
};

const calculateStateOverallTension = (crises: Crisis[]): TensionLevel => {
  if (crises.length === 0) {
    return '较低';
  }

  const counts = crises.reduce(
    (acc, crisis) => {
      acc[crisis.tension] += 1;
      return acc;
    },
    { '极高': 0, '高': 0, '中等': 0, '较低': 0 } as Record<TensionLevel, number>
  );

  const weightedScore =
    (counts['极高'] * 4 + counts['高'] * 3 + counts['中等'] * 2 + counts['较低']) / crises.length;

  // "极高"占比很高或综合评分很高时，判定为州级极高。
  if (counts['极高'] >= 2 || weightedScore >= 3.4) {
    return '极高';
  }
  if (counts['高'] + counts['极高'] >= 2 || weightedScore >= 2.6) {
    return '高';
  }
  if (counts['中等'] + counts['高'] + counts['极高'] > 0) {
    return '中等';
  }
  return '较低';
};

const Logo = ({
  className,
  style,
  iconSize = 48
}: {
  className?: string;
  style?: React.CSSProperties;
  iconSize?: number;
}) => (
  <div className={`inline-flex items-center gap-2 font-serif font-black tracking-tighter ${className}`} style={{ fontSize: '1.75rem', lineHeight: 1, ...style }}>
    <img
      src="/samun-logo.png"
      alt="SAMUN logo"
      width={iconSize}
      height={iconSize}
      className="shrink-0 object-contain"
    />
    <span>SAMUN</span>
  </div>
);

const CrisisCard = ({ 
  crisis, 
  isAdmin, 
  onUpdateTension,
  onDelete,
  onEdit,
  onOpenDetail
}: { 
  crisis: CrisisBase; 
  isAdmin: boolean; 
  onUpdateTension: (id: string, tension: TensionLevel) => void;
  onDelete: (id: string) => void;
  onEdit: (crisis: CrisisBase) => void;
  onOpenDetail: (crisis: CrisisBase) => void;
  key?: string | number 
}) => {
  const isCritical = crisis.tension === '极高';
  const createdAt = toEpoch(crisis.created_at);
  const updatedAt = toEpoch(crisis.updated_at);
  const now = Date.now();
  const isRecentlyCreated = createdAt > 0 && now - createdAt <= 10 * 60 * 1000;
  const isRecentlyUpdated = updatedAt > 0 && updatedAt > createdAt && now - updatedAt <= 10 * 60 * 1000;
  const shouldHighlightNewCard = isRecentlyCreated;
  
  return (
    <div className={`relative p-5 rounded-xl border transition-all duration-300 overflow-hidden group flex flex-col
      ${
        shouldHighlightNewCard
          ? 'bg-[#1A1520] border-[#A34A51]/60 shadow-[0_0_0_1px_rgba(163,74,81,0.18),0_8px_20px_rgba(0,0,0,0.25)] hover:border-[#A34A51]/80'
          : `bg-[#131B2F] ${isCritical ? 'border-[#A34A51]/50 shadow-[0_0_20px_rgba(163,74,81,0.15)]' : 'border-white/5 hover:border-white/20'}`
      } cursor-pointer`}
      onClick={() => {
        onOpenDetail(crisis);
      }}
    >
      {shouldHighlightNewCard && (
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#7F343B]/70 via-[#A34A51]/70 to-[#7F343B]/70"></div>
      )}

      {isCritical && (
        <div className="absolute top-0 left-0 w-1 h-full bg-[#A34A51]"></div>
      )}

      {isAdmin && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(crisis);
            }}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
            title="编辑"
          >
            <Edit2 size={12} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(crisis.id);
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
        {(isRecentlyCreated || isRecentlyUpdated) && (
          <div
            className={`text-[10px] font-bold px-2 py-1 rounded border ${
              isRecentlyCreated
                ? 'text-[#F1C9CF] border-[#A34A51]/60 bg-[#2A1A23]'
                : 'text-[#D97757] border-[#D97757]/50 bg-[#D97757]/10'
            }`}
          >
            {isRecentlyCreated ? (
              <span className="inline-flex items-center gap-1 tracking-wide">
                <Sparkles size={11} />
                NEW 新增危机
              </span>
            ) : (
              '更新危机'
            )}
          </div>
        )}
        
        {isAdmin ? (
          <select 
            value={crisis.tension}
            onChange={(e) => onUpdateTension(crisis.id, e.target.value as TensionLevel)}
            onClick={(e) => e.stopPropagation()}
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
      
      <div className="mt-auto pt-4 border-t border-white/5 flex items-center">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
          <span>TREND</span>
          {crisis.trend === 'up' && <TrendingUp size={14} className="text-[#A34A51]" />}
          {crisis.trend === 'down' && <TrendingUp size={14} className="text-green-500 transform rotate-180" />}
          {crisis.trend === 'stable' && <Activity size={14} className="text-gray-400" />}
        </div>
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
  const [nationalCrises, setNationalCrises] = useState<NationalCrisis[]>([]);
  const [activeStateId, setActiveStateId] = useState<string>('');
  const [isAddingCrisis, setIsAddingCrisis] = useState(false);
  const [editingCrisisId, setEditingCrisisId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    time: '',
    title: '',
    details: '',
    tension: '中等' as TensionLevel,
    trend: 'up' as 'up' | 'down' | 'stable'
  });
  const [displayDate, setDisplayDate] = useState<string>(getTodayIsoDate());
  const [nationalTensionPercent, setNationalTensionPercent] = useState<number>(85);
  const [nationalTensionInput, setNationalTensionInput] = useState<string>('85');
  const [isEditingDisplayDate, setIsEditingDisplayDate] = useState(false);
  const [dateInput, setDateInput] = useState<string>(getTodayIsoDate());
  const [isAddingNationalCrisis, setIsAddingNationalCrisis] = useState(false);
  const [editingNationalCrisisId, setEditingNationalCrisisId] = useState<string | null>(null);
  const [isFrontPageCollapsed, setIsFrontPageCollapsed] = useState(false);
  const [selectedCrisisDetail, setSelectedCrisisDetail] = useState<CrisisDetailModalData | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; scope: 'state' | 'national' } | null>(null);
  const [nationalFormData, setNationalFormData] = useState({
    time: '',
    title: '',
    details: '',
    tension: '中等' as TensionLevel,
    trend: 'up' as 'up' | 'down' | 'stable'
  });
  const [stateTensionInput, setStateTensionInput] = useState<string>('0');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);
  const queuedFetchRef = useRef(false);

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
    if (isFetchingRef.current) {
      queuedFetchRef.current = true;
      return;
    }
    isFetchingRef.current = true;
    try {
      const [
        { data: states, error: statesError },
        { data: crises, error: crisesError },
        { data: settings, error: settingsError },
        { data: national, error: nationalError }
      ] = await Promise.all([
        supabase.from('states').select('*'),
        supabase.from('crises').select('*'),
        supabase.from('app_settings').select('display_date, national_tension_percent').eq('id', 1).maybeSingle(),
        supabase.from('national_crises').select('*')
      ]);

      if (statesError) {
        throw statesError;
      }
      if (crisesError) {
        throw crisesError;
      }
      if (settingsError) {
        throw settingsError;
      }
      if (nationalError) {
        throw nationalError;
      }

      const grouped = (states || []).map((state: any) => {
        const stateCrises = ((crises || []).filter((c: any) => c.state_id === state.id) as Crisis[])
          .sort((a, b) => {
            const aSort = Math.max(toEpoch(a.updated_at), toEpoch(a.created_at));
            const bSort = Math.max(toEpoch(b.updated_at), toEpoch(b.created_at));
            if (bSort !== aSort) {
              return bSort - aSort;
            }
            return b.id.localeCompare(a.id);
          });
        const derivedOverall = calculateStateOverallTension(stateCrises);
        return {
          ...state,
          overallTension: derivedOverall,
          tensionPercent: clampPercent(
            typeof state.tension_percent === 'number' ? state.tension_percent : defaultPercentByLevel(derivedOverall)
          ),
          crises: stateCrises
        };
      })
        .sort((a: any, b: any) => {
          if (b.tensionPercent !== a.tensionPercent) {
            return b.tensionPercent - a.tensionPercent;
          }
          return b.electoralVotes - a.electoralVotes;
        }) as StateData[];

      setStatesData(grouped);
      setNationalCrises(
        ((national || []) as NationalCrisis[]).sort((a, b) => {
          const aSort = Math.max(toEpoch(a.updated_at), toEpoch(a.created_at));
          const bSort = Math.max(toEpoch(b.updated_at), toEpoch(b.created_at));
          if (bSort !== aSort) {
            return bSort - aSort;
          }
          return b.id.localeCompare(a.id);
        })
      );
      const currentDate = settings?.display_date || getTodayIsoDate();
      setDisplayDate(currentDate);
      setNationalTensionPercent(
        clampPercent(
          typeof settings?.national_tension_percent === 'number' ? settings.national_tension_percent : 85
        )
      );
      if (!isEditingDisplayDate) {
        setDateInput(currentDate);
      }
      if (grouped.length > 0 && !activeStateId) {
        setActiveStateId(grouped[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      isFetchingRef.current = false;
      if (queuedFetchRef.current) {
        queuedFetchRef.current = false;
        void fetchData();
      }
    }
  };

  const scheduleDataRefresh = (delayMs = 250) => {
    if (!isAuthenticated) {
      return;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void fetchData();
    }, delayMs);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const channel = supabase
      .channel('election-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'states' }, () => {
        scheduleDataRefresh(220);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crises' }, () => {
        scheduleDataRefresh(220);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        scheduleDataRefresh(220);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'national_crises' }, () => {
        scheduleDataRefresh(220);
      })
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  const handleUpdateDisplayDate = async () => {
    const nextDate = dateInput || getTodayIsoDate();
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ id: 1, display_date: nextDate }, { onConflict: 'id' });

      if (error) {
        throw error;
      }
      setDisplayDate(nextDate);
      setIsEditingDisplayDate(false);
    } catch (err) {
      console.error('Failed to update display date', err);
      alert('更新日期失败，请稍后重试。');
    }
  };

  const handleUpdateNationalTensionPercent = async (value: number) => {
    const nextValue = clampPercent(value);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            id: 1,
            display_date: displayDate || getTodayIsoDate(),
            national_tension_percent: nextValue
          },
          { onConflict: 'id' }
        );
      if (error) {
        throw error;
      }
      setNationalTensionPercent(nextValue);
    } catch (err) {
      console.error('Failed to update national tension percent', err);
      alert('更新全国紧张度失败，请稍后重试。');
    }
  };

  const activeState = statesData.find(s => s.id === activeStateId) || statesData[0];
  const dateParts = formatDateParts(displayDate);
  const headerDateLabel = formatHeaderDate(displayDate);

  const handleUpdateTension = async (id: string, tension: TensionLevel) => {
    try {
      const { error } = await supabase
        .from('crises')
        .update({ tension })
        .eq('id', id);
      if (error) {
        throw error;
      }
      scheduleDataRefresh(120);
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
      scheduleDataRefresh(120);
    } catch (err) {
      console.error('Failed to delete crisis', err);
    }
  };

  const handleDeleteNationalCrisis = async (id: string) => {
    try {
      const { error } = await supabase
        .from('national_crises')
        .delete()
        .eq('id', id);
      if (error) {
        throw error;
      }
      scheduleDataRefresh(120);
    } catch (err) {
      console.error('Failed to delete national crisis', err);
    }
  };

  const requestDeleteCrisis = (id: string) => {
    setDeleteConfirmTarget({ id, scope: 'state' });
  };

  const requestDeleteNationalCrisis = (id: string) => {
    setDeleteConfirmTarget({ id, scope: 'national' });
  };

  const confirmDeleteTarget = async () => {
    if (!deleteConfirmTarget) {
      return;
    }
    const { id, scope } = deleteConfirmTarget;
    if (scope === 'state') {
      await handleDeleteCrisis(id);
    } else {
      await handleDeleteNationalCrisis(id);
    }
    setDeleteConfirmTarget(null);
  };

  const handleUpdateNationalTension = async (id: string, tension: TensionLevel) => {
    try {
      const { error } = await supabase
        .from('national_crises')
        .update({ tension })
        .eq('id', id);
      if (error) {
        throw error;
      }
      scheduleDataRefresh(120);
    } catch (err) {
      console.error('Failed to update national tension', err);
    }
  };

  const handleUpdateStateTensionPercent = async (stateId: string, value: number) => {
    const nextValue = clampPercent(value);
    try {
      const { error } = await supabase
        .from('states')
        .update({ tension_percent: nextValue })
        .eq('id', stateId);
      if (error) {
        throw error;
      }
      setStatesData((prev) =>
        prev.map((state) => (state.id === stateId ? { ...state, tensionPercent: nextValue } : state))
      );
    } catch (err) {
      console.error('Failed to update state tension percent', err);
      alert('更新州紧张度失败，请稍后重试。');
    }
  };

  const openStateCrisisDetail = (crisis: CrisisBase) => {
    setSelectedCrisisDetail({
      ...crisis,
      scopeLabel: activeState?.stateName || '州级危机'
    });
  };

  const openNationalCrisisDetail = (crisis: CrisisBase) => {
    setSelectedCrisisDetail({
      ...crisis,
      scopeLabel: '头版新闻'
    });
  };

  useEffect(() => {
    setNationalTensionInput(String(nationalTensionPercent));
  }, [nationalTensionPercent]);

  useEffect(() => {
    if (activeState) {
      setStateTensionInput(String(activeState.tensionPercent));
    }
  }, [activeStateId, activeState?.tensionPercent]);

  const openEditForm = (crisis: Crisis) => {
    setEditingCrisisId(crisis.id);
    setFormData({
      time: crisis.time,
      title: crisis.title,
      details: crisis.details,
      tension: crisis.tension,
      trend: crisis.trend
    });
    setIsAddingCrisis(true);
  };

  const openAddForm = () => {
    setEditingCrisisId(null);
    setFormData({ time: formatCrisisTime(), title: '', details: '', tension: '中等', trend: 'up' });
    setIsAddingCrisis(true);
  };

  const closeForm = () => {
    setIsAddingCrisis(false);
    setEditingCrisisId(null);
  };

  const openEditNationalForm = (crisis: NationalCrisis) => {
    setEditingNationalCrisisId(crisis.id);
    setNationalFormData({
      time: crisis.time,
      title: crisis.title,
      details: crisis.details,
      tension: crisis.tension,
      trend: crisis.trend
    });
    setIsAddingNationalCrisis(true);
  };

  const openAddNationalForm = () => {
    setEditingNationalCrisisId(null);
    setNationalFormData({ time: formatCrisisTime(), title: '', details: '', tension: '中等', trend: 'up' });
    setIsAddingNationalCrisis(true);
  };

  const closeNationalForm = () => {
    setIsAddingNationalCrisis(false);
    setEditingNationalCrisisId(null);
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
            ...formData
          });
        if (error) {
          throw error;
        }
      }
      closeForm();
      scheduleDataRefresh(120);
    } catch (err) {
      console.error('Failed to save crisis', err);
    }
  };

  const handleSubmitNationalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingNationalCrisisId) {
        const { error } = await supabase
          .from('national_crises')
          .update(nationalFormData)
          .eq('id', editingNationalCrisisId);
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('national_crises')
          .insert({
            id: `nat-${Date.now()}`,
            ...nationalFormData
          });
        if (error) {
          throw error;
        }
      }
      closeNationalForm();
      scheduleDataRefresh(120);
    } catch (err) {
      console.error('Failed to save national crisis', err);
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
              <Logo className="text-white" style={{ fontSize: '3.5rem' }} iconSize={60} />
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
              <div className="text-[#A34A51] font-mono font-bold text-lg">{headerDateLabel}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-end gap-2">
                <span className="w-2 h-2 rounded-full bg-[#A34A51] animate-pulse"></span>
                Live Timeline
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
          <div className="bg-[#131B2F] border border-[#A34A51]/30 rounded-2xl p-6 flex items-center gap-6 min-w-[340px] shadow-[0_0_40px_rgba(163,74,81,0.15)] relative">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#1F2937" strokeWidth="8" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#A34A51" strokeWidth="8" strokeDasharray="283" strokeDashoffset="42" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold text-[#A34A51] font-mono">{dateParts.day}</span>
                <span className="text-[10px] text-gray-400 font-mono">DAY</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 font-mono mb-1">CURRENT DATE</div>
              <div className="text-2xl font-bold text-white tracking-widest">{dateParts.year}.{dateParts.month}</div>
              <div className="text-xs text-[#A34A51] mt-1 flex items-center gap-1 font-mono">
                <Clock size={12} /> {displayDate}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                  <span>NATIONAL TENSION</span>
                  <span className="text-[#A34A51] font-bold">{nationalTensionPercent}%</span>
                </div>
                <div className="w-48 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#D97757] to-[#A34A51] transition-all duration-300"
                    style={{ width: `${nationalTensionPercent}%` }}
                  ></div>
                </div>
                {isAdmin && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={nationalTensionInput}
                      onChange={(e) => setNationalTensionInput(e.target.value)}
                      className="w-20 bg-[#0B0F19] border border-white/15 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#A34A51]"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateNationalTensionPercent(Number(nationalTensionInput))}
                      className="text-xs px-2.5 py-1 rounded border border-[#A34A51]/50 text-[#A34A51] hover:bg-[#A34A51] hover:text-white transition-colors"
                    >
                      保存
                    </button>
                  </div>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="absolute right-4 top-4">
                {isEditingDisplayDate ? (
                  <div className="flex items-center gap-2 bg-black/50 p-2 rounded-lg border border-white/10">
                    <input
                      type="date"
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      className="bg-[#0B0F19] border border-white/15 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#A34A51]"
                    />
                    <button
                      type="button"
                      onClick={handleUpdateDisplayDate}
                      className="text-green-400 hover:text-green-300"
                      title="保存日期"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateInput(displayDate);
                        setIsEditingDisplayDate(false);
                      }}
                      className="text-gray-400 hover:text-white"
                      title="取消"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingDisplayDate(true)}
                    className="p-2 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                    title="修改日期"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Front Page News Board */}
        <section className="mb-10">
          <div className="bg-[#131B2F] border border-[#A34A51]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(163,74,81,0.12)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-2xl font-serif font-bold text-white">头版新闻</h3>
                <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-1">Front Page News Feed</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && !isAddingNationalCrisis && !isFrontPageCollapsed && (
                  <button
                    onClick={openAddNationalForm}
                    className="px-3 py-2 rounded-lg border border-[#A34A51] text-[#A34A51] hover:bg-[#A34A51] hover:text-white transition-colors flex items-center gap-2 text-sm font-bold"
                  >
                    <Plus size={16} />
                    添加全国危机
                  </button>
                )}
                <button
                  onClick={() => setIsFrontPageCollapsed((v) => !v)}
                  className="px-3 py-2 rounded-lg border border-white/15 text-gray-300 hover:text-white hover:border-white/35 transition-colors flex items-center gap-2 text-sm font-bold"
                  title={isFrontPageCollapsed ? '展开头版新闻' : '折叠头版新闻'}
                >
                  {isFrontPageCollapsed ? '展开' : '折叠'}
                  <ChevronRight size={16} className={`transition-transform ${isFrontPageCollapsed ? '-rotate-90' : 'rotate-90'}`} />
                </button>
              </div>
            </div>

            {!isFrontPageCollapsed && nationalCrises.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {nationalCrises.map(crisis => (
                  <CrisisCard
                    key={crisis.id}
                    crisis={crisis}
                    isAdmin={isAdmin}
                    onUpdateTension={handleUpdateNationalTension}
                    onDelete={requestDeleteNationalCrisis}
                    onEdit={(c) => openEditNationalForm(c as NationalCrisis)}
                    onOpenDetail={openNationalCrisisDetail}
                  />
                ))}
              </div>
            ) : !isFrontPageCollapsed ? (
              <div className="border border-dashed border-white/15 rounded-xl p-8 text-center text-gray-500 font-mono text-sm">
                暂无全国性危机事件
              </div>
            ) : (
              <div className="text-xs text-gray-500 font-mono">已折叠，点击右上角“展开”查看内容。</div>
            )}
          </div>
        </section>

        {/* Admin Add/Edit National Crisis Form */}
        {isAdmin && isAddingNationalCrisis && !isFrontPageCollapsed && (
          <form onSubmit={handleSubmitNationalForm} className="bg-[#131B2F] border border-[#A34A51] rounded-2xl p-6 mb-10 shadow-[0_0_30px_rgba(163,74,81,0.2)] relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                {editingNationalCrisisId ? <Edit2 size={18} className="text-[#A34A51]" /> : <Plus size={18} className="text-[#A34A51]" />}
                {editingNationalCrisisId ? '编辑全国危机事件' : '添加全国危机事件'}
              </h4>
              <button type="button" onClick={closeNationalForm} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">危机标题</label>
                <input
                  required
                  type="text"
                  value={nationalFormData.title}
                  onChange={e => setNationalFormData({ ...nationalFormData, title: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51]"
                  placeholder="输入标题..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">紧张程度</label>
                  <select
                    value={nationalFormData.tension}
                    onChange={e => setNationalFormData({ ...nationalFormData, tension: e.target.value as TensionLevel })}
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
                    value={nationalFormData.trend}
                    onChange={e => setNationalFormData({ ...nationalFormData, trend: e.target.value as 'up' | 'down' | 'stable' })}
                    className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51]"
                  >
                    <option value="up">上升 (Up)</option>
                    <option value="stable">平稳 (Stable)</option>
                    <option value="down">下降 (Down)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">事件时间</label>
              <input
                required
                type="text"
                value={nationalFormData.time}
                onChange={e => setNationalFormData({ ...nationalFormData, time: e.target.value })}
                className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51]"
                placeholder="格式：MM-DD HH:mm（示例 11-04 14:15）"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs text-gray-400 mb-1">详细描述</label>
              <textarea
                required
                value={nationalFormData.details}
                onChange={e => setNationalFormData({ ...nationalFormData, details: e.target.value })}
                className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51] h-24 resize-none"
                placeholder="输入详细描述..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeNationalForm}
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#A34A51] text-white hover:bg-[#8A3A41] transition-colors text-sm font-bold flex items-center gap-2"
              >
                <Check size={16} />
                {editingNationalCrisisId ? '保存修改' : '确认添加'}
              </button>
            </div>
          </form>
        )}

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
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-serif font-bold text-lg ${activeStateId === state.id ? 'text-[#A34A51]' : 'text-white'}`}>
                      {state.stateName}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono uppercase">{state.stateEn}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 font-mono">{state.electoralVotes} EV</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mb-1">
                      <span>STATE TENSION</span>
                      <span className="text-[#A34A51] font-bold">{state.tensionPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D97757] to-[#A34A51] transition-all duration-300"
                        style={{ width: `${state.tensionPercent}%` }}
                      ></div>
                    </div>
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
                <div className="relative px-4 py-2.5 rounded-lg border border-[#A34A51]/30 bg-[#0B0F19] overflow-hidden min-w-[220px]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(163,74,81,0.22),transparent_55%)] pointer-events-none"></div>
                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="text-left">
                      <div className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.25em]">Swing State Brief</div>
                      <div className="text-sm text-white font-serif tracking-wide">Election Watch</div>
                    </div>
                    <div className="flex items-end gap-1.5 h-7">
                      <span className="w-1.5 h-3 rounded bg-white/30"></span>
                      <span className="w-1.5 h-5 rounded bg-[#D97757]/70"></span>
                      <span className="w-1.5 h-7 rounded bg-[#A34A51]"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="bg-[#131B2F] border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">
                    {activeState.stateName} 州紧张度
                  </span>
                  <span className="text-sm font-mono font-bold text-[#A34A51]">{activeState.tensionPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-[#D97757] to-[#A34A51] transition-all duration-300"
                    style={{ width: `${activeState.tensionPercent}%` }}
                  ></div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={stateTensionInput}
                    onChange={(e) => setStateTensionInput(e.target.value)}
                    className="w-24 bg-[#0B0F19] border border-white/15 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#A34A51]"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateStateTensionPercent(activeState.id, Number(stateTensionInput))}
                    className="text-xs px-2.5 py-1 rounded border border-[#A34A51]/50 text-[#A34A51] hover:bg-[#A34A51] hover:text-white transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}

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
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1">事件时间</label>
                  <input
                    required
                    type="text"
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#A34A51]"
                    placeholder="格式：MM-DD HH:mm（示例 11-04 14:15）"
                  />
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
                  onDelete={requestDeleteCrisis}
                  onEdit={openEditForm}
                  onOpenDetail={openStateCrisisDetail}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      {selectedCrisisDetail && (
        <div
          className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedCrisisDetail(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#131B2F] border border-[#A34A51]/50 rounded-2xl shadow-[0_0_60px_rgba(163,74,81,0.25)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] text-gray-400 font-mono uppercase tracking-widest mb-2">
                  {selectedCrisisDetail.scopeLabel}
                </div>
                <h4 className="text-xl font-serif font-bold text-white leading-snug">
                  {selectedCrisisDetail.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCrisisDetail(null)}
                className="text-gray-400 hover:text-white transition-colors"
                title="关闭"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
                <span className="inline-flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded">
                  <Clock size={12} />
                  {selectedCrisisDetail.time}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${getTensionColor(selectedCrisisDetail.tension)}`}>
                  {selectedCrisisDetail.tension}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded">
                  TREND
                  {selectedCrisisDetail.trend === 'up' && <TrendingUp size={12} className="text-[#A34A51]" />}
                  {selectedCrisisDetail.trend === 'down' && <TrendingUp size={12} className="text-green-500 rotate-180" />}
                  {selectedCrisisDetail.trend === 'stable' && <Activity size={12} className="text-gray-400" />}
                </span>
              </div>
              <div className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                {selectedCrisisDetail.details}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmTarget && (
        <div
          className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmTarget(null)}
        >
          <div
            className="w-full max-w-md bg-[#131B2F] border border-[#A34A51]/45 rounded-2xl shadow-[0_0_40px_rgba(163,74,81,0.18)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#A34A51]/15 border border-[#A34A51]/40 flex items-center justify-center text-[#D9878E]">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-white font-bold">确认删除</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {deleteConfirmTarget.scope === 'national' ? '头版新闻危机' : '州危机'}删除后无法恢复
                </p>
              </div>
            </div>
            <div className="px-5 py-4 text-sm text-gray-300 leading-relaxed">
              你确定要删除这条信息吗？此操作会立即同步给所有在线用户。
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-lg border border-white/15 text-gray-300 hover:text-white hover:border-white/35 transition-colors text-sm font-bold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteTarget}
                className="px-4 py-2 rounded-lg bg-[#A34A51] text-white hover:bg-[#8A3A41] transition-colors text-sm font-bold"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


