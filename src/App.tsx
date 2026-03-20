import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Activity, ShieldAlert, TrendingUp, ChevronRight, Clock, Plus, Edit2, Trash2, X, Check, LogOut, AlertTriangle, CalendarMinus, CalendarPlus, Newspaper } from 'lucide-react';
import { motion, LayoutGroup } from 'motion/react';
import { supabase } from './supabase';

type TensionLevel = '极高' | '高' | '中等' | '较低';

/** 每条危机单独保存；random 表示打开详情时抽签。 */
type NewsOutletSetting = 'random' | 'nyt' | 'cnn' | 'wapo' | 'reuters';
type NewsOutletResolved = 'nyt' | 'cnn' | 'wapo' | 'reuters';

const NEWS_OUTLET_POOL: NewsOutletResolved[] = ['nyt', 'cnn', 'wapo', 'reuters'];

const parseNewsOutletSetting = (raw: unknown): NewsOutletSetting => {
  const v = typeof raw === 'string' ? raw : '';
  if (v === 'random' || v === 'nyt' || v === 'cnn' || v === 'wapo' || v === 'reuters') {
    return v;
  }
  return 'random';
};

const resolveNewsOutletSetting = (setting: NewsOutletSetting): NewsOutletResolved => {
  if (setting === 'random') {
    return NEWS_OUTLET_POOL[Math.floor(Math.random() * NEWS_OUTLET_POOL.length)]!;
  }
  return setting;
};

const DISPLAY_OUTLET_FORM_OPTIONS: { value: NewsOutletSetting; label: string }[] = [
  { value: 'random', label: '随机（打开时再抽一种）' },
  { value: 'nyt', label: '纽约时报风 · Newsreader 米色' },
  { value: 'cnn', label: 'CNN 风 · Barlow 红黑' },
  { value: 'wapo', label: '华盛顿邮报风 · Baskerville 蓝' },
  { value: 'reuters', label: '路透社风 · 灰底 Plex Mono' }
];

interface CrisisBase {
  id: string;
  time: string;
  title: string;
  details: string;
  tension: TensionLevel;
  trend: 'up' | 'down' | 'stable';
  /** 详情弹窗美术风格，按卡片存储 */
  display_outlet: NewsOutletSetting;
  created_at?: string;
  updated_at?: string;
}

interface Crisis extends CrisisBase {
  state_id: string;
}

interface NationalCrisis extends CrisisBase {
}

const outletForCrisis = (crisis: CrisisBase): NewsOutletResolved =>
  resolveNewsOutletSetting(crisis.display_outlet ?? 'random');

interface CrisisDetailModalData extends CrisisBase {
  scopeLabel: string;
  detailSource: 'national' | 'state';
  displayOutlet: NewsOutletResolved;
}

interface StateData {
  id: string;
  stateName: string;
  stateEn: string;
  electoralVotes: number;
  /** 由危机事件综合推导的档位（仅作参考，不参与百分数显示） */
  overallTension: TensionLevel;
  /** 与 states.tension_percent 一致，完全由管理员手动设定 */
  tensionPercent: number;
  crises: Crisis[];
}

const getTodayIsoDate = () => new Date().toISOString().slice(0, 10);

const addDaysIso = (isoDate: string, deltaDays: number) => {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return getTodayIsoDate();
  }
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

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

const sortStatesByTension = (a: StateData, b: StateData) => {
  if (b.tensionPercent !== a.tensionPercent) {
    return b.tensionPercent - a.tensionPercent;
  }
  return b.electoralVotes - a.electoralVotes;
};

const toEpoch = (value?: string) => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const LOCAL_ACCOUNTS: Array<{ id: string; username: string; password: string; role: 'admin' | 'viewer' }> = [
  { id: 'u1', username: 'SAMUN ELECTION', password: 'ACMUNC2026', role: 'admin' },
  { id: 'u2', username: 'SAMUN', password: 'ELECTION2020', role: 'viewer' },
  { id: 'u12', username: 'SAMUN', password: '2020ELECTION', role: 'admin' },
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

const trendMeta = (trend: CrisisBase['trend']) => {
  switch (trend) {
    case 'up':
      return {
        label: '上升',
        hint: '紧张加剧',
        pill: 'border-[#A34A51]/45 bg-[#A34A51]/12 text-[#F4D0D4]',
        iconClass: 'text-[#A34A51]'
      };
    case 'down':
      return {
        label: '下降',
        hint: '紧张趋缓',
        pill: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
        iconClass: 'text-emerald-400'
      };
    default:
      return {
        label: '平稳',
        hint: '维持现状',
        pill: 'border-white/22 bg-white/[0.06] text-gray-200',
        iconClass: 'text-gray-400'
      };
  }
};

const tensionLabelEn = (level: TensionLevel) => {
  switch (level) {
    case '极高':
      return 'Critical';
    case '高':
      return 'High';
    case '中等':
      return 'Moderate';
    default:
      return 'Low';
  }
};

const trendLabelEn = (trend: CrisisBase['trend']) => {
  switch (trend) {
    case 'up':
      return 'Escalating';
    case 'down':
      return 'Cooling';
    default:
      return 'Steady';
  }
};

/** 各「报纸风」示意文案与主题；非官方稿件。 */
const OUTLET_COPY: Record<
  NewsOutletResolved,
  {
    styleLine: string;
    natKicker: string;
    natDeck: string;
    stateDeck: string;
    /** 州级详情：可选「小字报眉」，与 stateHeaderTitle 同时设则形成大小字层次 */
    stateHeaderKicker?: string;
    stateHeaderTitle?: string;
  }
> = {
  nyt: {
    styleLine: 'editorial spread',
    natKicker: 'From the National desk · final edition',
    natDeck: 'Cover Story — National',
    stateDeck: 'Statehouse correspondence'
  },
  cnn: {
    styleLine: 'Cable news — breaking wall',
    natKicker: 'This is a developing situation',
    natDeck: 'Breaking · National',
    stateDeck: 'State coverage · now'
  },
  wapo: {
    styleLine: 'Metro broadsheet — capital edition',
    natKicker: 'Sunday filing / A-section lead',
    natDeck: 'Above the fold — National',
    stateDeck: 'Metro & states — extra',
    stateHeaderKicker: 'SAMUN — Metro broadsheet',
    stateHeaderTitle: 'capital & states — extra'
  },
  reuters: {
    styleLine: 'Wire service — plain text',
    natKicker: 'REFILE · verified lines only',
    natDeck: 'WM / National bulletin',
    stateDeck: 'State line / wire'
  }
};

const OUTLET_THEME: Record<
  NewsOutletResolved,
  {
    rootFont: string;
    shell: string;
    paper: string;
    paperNoise: string;
    border: string;
    shadow: string;
    closeBtn: string;
    backdrop: string;
    nationalBanner: string;
    nationalBannerInnerRule: string;
    nationalKicker: string;
    nationalHeadline: string;
    nationalMastMuted: string;
    borderLeftLead: string;
    bodyLeadWrap: string;
    stateHeader: string;
    stateMastheadMuted: string;
    stateTitle: string;
    dateline: string;
    bodyNational: string;
    bodyState: string;
    bodyStateCols: string;
    stateMastRow: string;
    tagPrimary: string;
    tagSecondary: string;
    footer: string;
    headlineNat: string;
    headlineState: string;
  }
> = {
  nyt: {
    rootFont: "font-['Newsreader',Georgia,'Times New Roman',serif]",
    shell: 'w-full max-w-[44rem]',
    paper: 'bg-[#ebe4cf]',
    paperNoise: 'opacity-[0.14]',
    border: 'border-2 border-[#3d2914]/35',
    shadow: 'shadow-[0_22px_55px_rgba(45,30,18,0.4)]',
    closeBtn: 'border-[#5c4030]/40 bg-[#ebe4cf]/95 text-[#2a1810] hover:border-[#3d2914]',
    backdrop: 'bg-[#3d2b1f]/90',
    nationalBanner: 'bg-[#ebe4cf] text-[#2a1810] border-b-[4px] border-[#5c2d2d]',
    nationalBannerInnerRule: 'border-[#8b6914]/35',
    nationalKicker:
      "italic text-[#5c4030] text-sm sm:text-base tracking-[0.03em] normal-case font-['Newsreader',serif]",
    nationalHeadline:
      "font-semibold text-2xl sm:text-[2.15rem] leading-[1.1] text-[#3d2914] font-['Newsreader',serif]",
    nationalMastMuted: 'text-[#6b5344]',
    borderLeftLead: 'border-l-0 pl-0',
    bodyLeadWrap: 'max-w-[26rem] mx-auto',
    stateHeader: 'border-b-[4px] border-[#5c2d2d] pb-6 text-center bg-[#e8e0cb]/60',
    stateMastRow: 'justify-center',
    stateMastheadMuted: 'text-[#6b5344]',
    stateTitle: 'text-[#2a1810] font-semibold',
    dateline: 'text-[#5c4030] border-b border-[#8b6914]/40',
    bodyNational:
      "text-[1.07rem] sm:text-[1.14rem] leading-[1.97] text-[#241811] text-justify font-['Newsreader',serif]",
    bodyState:
      "text-[0.98rem] sm:text-[1.05rem] leading-[1.93] text-[#342418] text-left font-['Newsreader',serif]",
    bodyStateCols: 'columns-1 w-full',
    tagPrimary: 'border border-[#5c2d2d] bg-[#ddd2bc] text-[#2a1810] rounded-sm',
    tagSecondary: 'border border-[#8b6914]/45 bg-[#f7f2e4] text-[#342418] rounded-sm',
    footer: 'border-[#8b6914]/30 text-[#6b5344]',
    headlineNat:
      "font-semibold text-[1.8rem] sm:text-[2.5rem] text-[#1f140c] leading-[1.08] font-['Newsreader',serif]",
    headlineState:
      "font-semibold text-[1.6rem] sm:text-[2.05rem] text-[#1f140c] leading-[1.12] font-['Newsreader',serif]"
  },
  cnn: {
    rootFont: "font-['Barlow Condensed','Arial Narrow',Arial,sans-serif]",
    shell: 'w-full max-w-[56rem]',
    paper: 'bg-[#f8f8f8]',
    paperNoise: 'opacity-[0.03]',
    border: 'border-0 ring-[3px] ring-[#0057B8] ring-offset-2 ring-offset-black/5',
    shadow: 'shadow-[12px_16px_0_0_#000,0_20px_50px_rgba(225,6,0,0.2)]',
    closeBtn: 'border-[#0057B8]/30 bg-[#f8f8f8]/95 text-[#111] hover:border-[#E10600]',
    backdrop: 'bg-[#001a33]/88',
    nationalBanner:
      'bg-gradient-to-r from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] text-white border-t-[18px] border-[#E10600] pt-6 pb-8',
    nationalBannerInnerRule: 'border-[#0057B8]/40',
    nationalKicker:
      'inline-flex items-center gap-2 font-black text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-black bg-[#FFD000] px-3 py-1.5 border-2 border-black',
    nationalHeadline:
      'font-black uppercase text-xl sm:text-2xl text-white tracking-[0.04em] mt-4 drop-shadow-md',
    nationalMastMuted: 'text-neutral-400',
    borderLeftLead: 'border-l-[10px] border-[#0057B8] pl-5 sm:pl-6 bg-[#eef4ff] py-5',
    bodyLeadWrap: 'max-w-none',
    stateHeader:
      'border-b-[10px] border-[#E10600] pb-5 text-center bg-gradient-to-b from-[#f0f0f0] to-white -mx-6 sm:-mx-10 px-6 sm:px-10 pt-8',
    stateMastRow: 'justify-center',
    stateMastheadMuted: 'text-[#0057B8]',
    stateTitle: 'text-[#111] font-black uppercase tracking-wide',
    dateline: 'text-[#111] border-b-4 border-[#0057B8] font-black tracking-wide',
    bodyNational:
      'text-[1.06rem] sm:text-[1.14rem] leading-[1.65] text-neutral-900 text-left font-semibold antialiased',
    bodyState:
      'text-[0.98rem] sm:text-[1.05rem] leading-[1.72] text-neutral-800 text-left font-medium',
    bodyStateCols: 'columns-1 w-full',
    tagPrimary: 'rounded-none border-2 border-black bg-[#E10600] text-white font-black text-[11px]',
    tagSecondary: 'rounded-none border-2 border-[#0057B8] bg-[#0057B8] text-white font-black text-[11px]',
    footer: 'border-[#0057B8]/30 text-neutral-600 font-black uppercase text-[9px] tracking-widest',
    headlineNat: 'font-black text-[2.2rem] sm:text-[3.15rem] text-[#111] uppercase leading-[0.96]',
    headlineState: 'font-black text-[1.85rem] sm:text-[2.35rem] text-[#111] uppercase leading-[1]'
  },
  wapo: {
    rootFont: "font-['Libre Baskerville',Georgia,'Times New Roman',serif]",
    shell: 'w-full max-w-3xl',
    paper: 'bg-gradient-to-br from-[#dfeaf4] via-[#eef6ff] to-[#cfddee]',
    paperNoise: 'opacity-[0.05]',
    border: 'border-[4px] border-[#0f3d6b]',
    shadow: 'shadow-[0_22px_60px_rgba(15,61,107,0.35)]',
    closeBtn: 'border-[#0f3d6b]/45 bg-[#eef6ff]/95 text-[#0b2d4d] hover:border-[#0f3d6b]',
    backdrop: 'bg-[#06182d]/90',
    nationalBanner:
      'bg-[#0f3d6b] text-[#e8f4ff] border-b-[12px] border-[#ffb81c] pt-8 pb-8 shadow-[inset_0_-20px_40px_rgba(0,0,0,0.12)]',
    nationalBannerInnerRule: 'border-[#7eb8e8]/35',
    nationalKicker:
      'font-sans font-bold text-[11px] sm:text-xs tracking-[0.26em] uppercase text-[#ffb81c]',
    nationalHeadline: 'font-bold text-2xl sm:text-[2.55rem] leading-[1.06] text-white',
    nationalMastMuted: 'text-[#b8d9f5]',
    borderLeftLead: 'border-l-[8px] border-[#ffb81c] bg-white/90 pl-6 py-4 shadow-sm',
    bodyLeadWrap: '',
    stateHeader:
      'border-b-[12px] border-[#0f3d6b] pb-6 text-center bg-white/90 border-t-4 border-[#ffb81c]',
    stateMastRow: 'justify-center',
    stateMastheadMuted: 'text-[#0f3d6b]',
    stateTitle: 'text-[#082642] font-bold',
    dateline: 'text-[#14436f] border-y-2 border-[#0f3d6b]/25 bg-[#ddebf7]/80',
    bodyNational:
      'text-[1.05rem] sm:text-[1.15rem] leading-[1.92] text-[#0d1f2d] text-justify font-normal',
    bodyState: 'text-[0.98rem] sm:text-[1.06rem] leading-[1.9] text-[#0d1f2d] text-left',
    bodyStateCols: 'columns-1 w-full',
    tagPrimary: 'rounded-sm border-2 border-[#0f3d6b] bg-[#cfe2f7] text-[#082642] font-bold',
    tagSecondary: 'rounded-sm border border-[#ffb81c] bg-white text-[#0d1f2d]',
    footer: 'border-[#0f3d6b]/30 text-[#14436f]',
    headlineNat: 'font-bold text-[1.9rem] sm:text-[2.85rem] text-[#071a2e] leading-[1.06]',
    headlineState: 'font-bold text-[1.5rem] sm:text-[2.15rem] text-[#071a2e] leading-[1.1]'
  },
  reuters: {
    rootFont: "font-['IBM Plex Mono','Menlo',monospace]",
    shell: 'w-full max-w-[32rem]',
    paper: 'bg-[#c9cfc4]',
    paperNoise: 'opacity-0',
    border: 'border-2 border-[#1c2e1f] rounded-none',
    shadow: 'shadow-[6px_6px_0_0_#1c2e1f]',
    closeBtn: 'rounded-none border-[#1c2e1f] bg-[#c9cfc4]/95 text-[#0f1a12] hover:border-[#00a651]',
    backdrop: 'bg-[#0d120e]/92',
    nationalBanner:
      'bg-[#1a241c] text-[#e8ede5] border-t-[8px] border-[#00a651] px-5 sm:px-8 pt-5 pb-6',
    nationalBannerInnerRule: 'border-[#4a5d4a]/55',
    nationalKicker:
      'text-[#7fd4a4] text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold',
    nationalHeadline: 'font-bold text-xs sm:text-sm leading-relaxed text-[#f0f4ec] uppercase',
    nationalMastMuted: 'text-[#9aaa9a]',
    borderLeftLead: 'border-l-2 border-dotted border-[#1c2e1f] pl-4 bg-[#dde3d8] py-3',
    bodyLeadWrap: '',
    bodyNational: 'text-[0.88rem] sm:text-[0.92rem] leading-[1.68] text-[#0f1a12] text-left font-normal',
    stateHeader:
      'border-t-2 border-[#00a651] border-b-2 border-dashed border-[#1c2e1f] pb-5 pt-5 text-left bg-[#dde3d8]/50',
    stateMastRow: 'justify-start',
    stateMastheadMuted: 'text-[#3d5c3d]',
    stateTitle: 'text-[#0f1a12] font-bold uppercase text-base sm:text-lg',
    dateline: 'text-[#2a3d2a] border-b border-dotted border-[#1c2e1f] text-[11px]',
    bodyState: 'text-[0.84rem] sm:text-[0.9rem] leading-[1.72] text-[#1a261a] text-left',
    bodyStateCols: 'columns-1 w-full',
    tagPrimary:
      'rounded-none border border-[#1c2e1f] bg-[#aab6aa] text-[#0f1a12] text-[9px] uppercase px-2 py-1 font-semibold',
    tagSecondary:
      'rounded-none border border-dashed border-[#00a651] bg-transparent text-[#0f1a12] text-[9px] uppercase px-2 py-1',
    footer: 'border-[#1c2e1f]/40 text-[#3d5c3d] text-[9px]',
    headlineNat: 'font-bold text-lg sm:text-[1.35rem] text-[#0a120c] leading-snug normal-case',
    headlineState: 'font-bold text-base sm:text-lg text-[#0a120c] leading-snug normal-case'
  }
};

function TrendBadge({
  trend,
  size = 'md'
}: {
  trend: CrisisBase['trend'];
  size?: 'sm' | 'md' | 'lg';
}) {
  const m = trendMeta(trend);
  const iconSz = size === 'lg' ? 18 : size === 'md' ? 16 : 13;
  const pad = size === 'lg' ? 'px-3 py-2' : size === 'md' ? 'px-2.5 py-1.5' : 'px-2 py-1';
  const titleCls = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-xs' : 'text-[11px]';
  const tagCls = size === 'sm' ? 'text-[8px]' : 'text-[9px]';
  const hintCls = size === 'sm' ? 'text-[10px]' : 'text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border ${m.pill} ${pad} shadow-sm max-w-full`}
      title={`趋势：${m.label}（${m.hint}）`}
    >
      <span className={`shrink-0 ${m.iconClass}`}>
        {trend === 'up' && <TrendingUp size={iconSz} strokeWidth={2.25} />}
        {trend === 'down' && <TrendingUp size={iconSz} className="rotate-180" strokeWidth={2.25} />}
        {trend === 'stable' && <Activity size={iconSz} strokeWidth={2.25} />}
      </span>
      <span className="min-w-0 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
        <span className={`font-mono uppercase tracking-widest text-white/45 shrink-0 ${tagCls}`}>趋势</span>
        <span className={`font-bold shrink-0 ${titleCls}`}>{m.label}</span>
        <span className={`font-normal text-white/55 shrink-0 ${hintCls}`}>· {m.hint}</span>
      </span>
    </span>
  );
}

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
              <span className="tracking-wide">NEW 新增危机</span>
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
      
      <div className="mt-auto pt-4 border-t border-white/5">
        <TrendBadge trend={crisis.trend} size="md" />
      </div>
    </div>
  );
};

/** 头版新闻：报纸式列表，与下方摇摆州网格卡片区分 */
interface FrontPageNewsRowProps {
  crisis: NationalCrisis;
  isAdmin: boolean;
  onUpdateTension: (id: string, tension: TensionLevel) => void | Promise<void>;
  onDelete: (id: string) => void;
  onEdit: (crisis: NationalCrisis) => void;
  onOpenDetail: (crisis: CrisisBase) => void;
}

function FrontPageNewsRow({
  crisis,
  isAdmin,
  onUpdateTension,
  onDelete,
  onEdit,
  onOpenDetail
}: FrontPageNewsRowProps) {
  const isCritical = crisis.tension === '极高';
  const createdAt = toEpoch(crisis.created_at);
  const updatedAt = toEpoch(crisis.updated_at);
  const now = Date.now();
  const isRecentlyCreated = createdAt > 0 && now - createdAt <= 10 * 60 * 1000;
  const isRecentlyUpdated = updatedAt > 0 && updatedAt > createdAt && now - updatedAt <= 10 * 60 * 1000;

  return (
    <div
      className={`group relative flex flex-col lg:flex-row gap-4 lg:gap-8 pl-4 lg:pl-5 border-l-2 cursor-pointer rounded-r-lg transition-colors
        ${isCritical ? 'border-l-[#A34A51] bg-[#A34A51]/[0.06]' : 'border-l-[#D4AF37]/45 bg-black/15'}
        hover:bg-white/[0.04] py-5 px-3 sm:pr-4`}
      onClick={() => onOpenDetail(crisis)}
    >
      {isAdmin && (
        <div className="absolute top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(crisis);
            }}
            className="p-1.5 rounded-md bg-[#0B0F19]/90 border border-white/10 hover:border-white/25 text-gray-300 hover:text-white transition-colors"
            title="编辑"
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(crisis.id);
            }}
            className="p-1.5 rounded-md bg-[#0B0F19]/90 border border-red-500/25 hover:border-red-400/50 text-red-400 hover:text-red-300 transition-colors"
            title="删除"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      <div className="shrink-0 lg:w-28 flex flex-row lg:flex-col gap-3 lg:gap-2 items-start">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#D4AF37]/80">
          <Newspaper size={13} className="shrink-0 opacity-90" />
          <span>Headline</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono bg-black/25 px-2 py-1 rounded-md">
          <Clock size={12} className="shrink-0" />
          {crisis.time}
        </div>
        {(isRecentlyCreated || isRecentlyUpdated) && (
          <div
            className={`text-[9px] font-bold px-2 py-0.5 rounded border w-fit ${
              isRecentlyCreated
                ? 'text-[#F1C9CF] border-[#A34A51]/55 bg-[#2A1A23]'
                : 'text-[#D97757] border-[#D97757]/45 bg-[#D97757]/10'
            }`}
          >
            {isRecentlyCreated ? (
              <span className="tracking-wide">NEW</span>
            ) : (
              'UPDATED'
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-10 lg:pr-12">
        <h4
          className={`font-serif font-bold text-xl sm:text-2xl lg:text-[1.65rem] leading-snug tracking-tight ${isCritical ? 'text-[#E8A8AD]' : 'text-[#F5F2EC]'}`}
        >
          {crisis.title}
        </h4>
        <p className="mt-2.5 text-sm sm:text-base text-gray-400 leading-relaxed line-clamp-2 lg:line-clamp-3 font-serif">
          {crisis.details}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <select
              value={crisis.tension}
              onChange={(e) => onUpdateTension(crisis.id, e.target.value as TensionLevel)}
              onClick={(e) => e.stopPropagation()}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-bold outline-none cursor-pointer ${getTensionColor(crisis.tension)}`}
            >
              <option value="极高" className="bg-[#0B0F19] text-[#A34A51]">
                极高
              </option>
              <option value="高" className="bg-[#0B0F19] text-[#D97757]">
                高
              </option>
              <option value="中等" className="bg-[#0B0F19] text-[#D4AF37]">
                中等
              </option>
              <option value="较低" className="bg-[#0B0F19] text-gray-400">
                较低
              </option>
            </select>
          ) : (
            <div className={`px-2.5 py-1 rounded-md border text-[11px] font-bold inline-flex items-center gap-1 ${getTensionColor(crisis.tension)}`}>
              {crisis.tension === '极高' ? <ShieldAlert size={12} /> : <Activity size={12} />}
              {crisis.tension}
            </div>
          )}
          <TrendBadge trend={crisis.trend} size="sm" />
        </div>
      </div>
    </div>
  );
}

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
    trend: 'up' as 'up' | 'down' | 'stable',
    display_outlet: 'random' as NewsOutletSetting
  });
  const [displayDate, setDisplayDate] = useState<string>(getTodayIsoDate());
  const [nationalTensionPercent, setNationalTensionPercent] = useState<number>(85);
  const [nationalTensionInput, setNationalTensionInput] = useState<string>('85');
  const [dateInput, setDateInput] = useState<string>(getTodayIsoDate());
  const [timelinePulse, setTimelinePulse] = useState(false);
  const timelinePulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineDataHydratedRef = useRef(false);
  const prevDisplayDateForFxRef = useRef(displayDate);
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
    trend: 'up' as 'up' | 'down' | 'stable',
    display_outlet: 'random' as NewsOutletSetting
  });
  const [stateTensionInput, setStateTensionInput] = useState<string>('0');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);
  const queuedFetchRef = useRef(false);
  const activeStateIdRef = useRef<string>('');
  const stateListLayoutTransition = {
    layout: {
      type: 'tween' as const,
      duration: 2.3,
      ease: [0.16, 1, 0.3, 1] as const
    }
  };

  const formatCrisisTime = () => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    activeStateIdRef.current = activeStateId;
  }, [activeStateId]);

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
        const stateCrises = (
          (crises || []).filter((c: any) => c.state_id === state.id).map((c: any) => ({
            ...c,
            display_outlet: parseNewsOutletSetting(c.display_outlet)
          })) as Crisis[]
        )
          .sort((a, b) => {
            const aSort = Math.max(toEpoch(a.updated_at), toEpoch(a.created_at));
            const bSort = Math.max(toEpoch(b.updated_at), toEpoch(b.created_at));
            if (bSort !== aSort) {
              return bSort - aSort;
            }
            return b.id.localeCompare(a.id);
          });
        const derivedOverall = calculateStateOverallTension(stateCrises);
        const tensionPercent = clampPercent(
          typeof state.tension_percent === 'number' ? state.tension_percent : 60
        );
        return {
          ...state,
          overallTension: derivedOverall,
          tensionPercent,
          crises: stateCrises
        };
      })
        .sort((a: any, b: any) => sortStatesByTension(a, b)) as StateData[];

      setStatesData(grouped);
      setNationalCrises(
        ((national || []) as any[])
          .map((c) => ({
            ...c,
            display_outlet: parseNewsOutletSetting(c.display_outlet)
          }))
          .sort((a, b) => {
            const aSort = Math.max(toEpoch(a.updated_at), toEpoch(a.created_at));
            const bSort = Math.max(toEpoch(b.updated_at), toEpoch(b.created_at));
            if (bSort !== aSort) {
              return bSort - aSort;
            }
            return b.id.localeCompare(a.id);
          }) as NationalCrisis[]
      );
      const currentDate = settings?.display_date || getTodayIsoDate();
      if (!timelineDataHydratedRef.current) {
        timelineDataHydratedRef.current = true;
        prevDisplayDateForFxRef.current = currentDate;
      }
      setDisplayDate(currentDate);
      setNationalTensionPercent(
        clampPercent(
          typeof settings?.national_tension_percent === 'number' ? settings.national_tension_percent : 85
        )
      );
      setDateInput(currentDate);
      if (grouped.length > 0) {
        const currentActiveId = activeStateIdRef.current;
        const hasCurrentActive = currentActiveId
          ? grouped.some((state) => state.id === currentActiveId)
          : false;

        if (!hasCurrentActive) {
          setActiveStateId(grouped[0].id);
        }
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

  const handleUpdateDisplayDate = async (nextDateOverride?: string) => {
    const nextDate = nextDateOverride ?? dateInput ?? getTodayIsoDate();
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            id: 1,
            display_date: nextDate,
            national_tension_percent: nationalTensionPercent
          },
          { onConflict: 'id' }
        );

      if (error) {
        throw error;
      }
      setDisplayDate(nextDate);
      setDateInput(nextDate);
    } catch (err) {
      console.error('Failed to update display date', err);
      setDateInput(displayDate);
      alert('更新日期失败，请稍后重试。');
    }
  };

  const bumpDisplayDate = (deltaDays: number) => {
    const base = displayDate || dateInput || getTodayIsoDate();
    const next = addDaysIso(base, deltaDays);
    void handleUpdateDisplayDate(next);
  };

  useEffect(() => {
    if (!timelineDataHydratedRef.current) {
      return;
    }
    if (prevDisplayDateForFxRef.current === displayDate) {
      return;
    }
    prevDisplayDateForFxRef.current = displayDate;
    setTimelinePulse(true);
    if (timelinePulseTimerRef.current) {
      clearTimeout(timelinePulseTimerRef.current);
    }
    timelinePulseTimerRef.current = setTimeout(() => {
      timelinePulseTimerRef.current = null;
      setTimelinePulse(false);
    }, 1100);
    return () => {
      if (timelinePulseTimerRef.current) {
        clearTimeout(timelinePulseTimerRef.current);
        timelinePulseTimerRef.current = null;
      }
    };
  }, [displayDate]);

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
      setStatesData((prev) => {
        const next = prev.map((state) =>
          state.id === stateId ? { ...state, tensionPercent: nextValue } : state
        );
        next.sort(sortStatesByTension);
        return next;
      });
    } catch (err) {
      console.error('Failed to update state tension percent', err);
      alert('更新州紧张度失败，请稍后重试。');
    }
  };

  const openStateCrisisDetail = (crisis: CrisisBase) => {
    setSelectedCrisisDetail({
      ...crisis,
      scopeLabel: activeState?.stateName || 'State desk',
      detailSource: 'state',
      displayOutlet: outletForCrisis(crisis)
    });
  };

  const openNationalCrisisDetail = (crisis: CrisisBase) => {
    setSelectedCrisisDetail({
      ...crisis,
      scopeLabel: 'National Desk — Front Page',
      detailSource: 'national',
      displayOutlet: outletForCrisis(crisis)
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
      trend: crisis.trend,
      display_outlet: crisis.display_outlet ?? 'random'
    });
    setIsAddingCrisis(true);
  };

  const openAddForm = () => {
    setEditingCrisisId(null);
    setFormData({
      time: formatCrisisTime(),
      title: '',
      details: '',
      tension: '中等',
      trend: 'up',
      display_outlet: 'random'
    });
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
      trend: crisis.trend,
      display_outlet: crisis.display_outlet ?? 'random'
    });
    setIsAddingNationalCrisis(true);
  };

  const openAddNationalForm = () => {
    setEditingNationalCrisisId(null);
    setNationalFormData({
      time: formatCrisisTime(),
      title: '',
      details: '',
      tension: '中等',
      trend: 'up',
      display_outlet: 'random'
    });
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
            <div className="text-right hidden md:block border-l border-white/10 pl-4 min-w-[9rem]">
              <motion.div
                key={displayDate}
                initial={{ opacity: 0.65, y: -5, filter: 'blur(4px)' }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: 'blur(0px)'
                }}
                transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                className={`text-[#A34A51] font-mono font-bold text-lg ${timelinePulse ? 'drop-shadow-[0_0_12px_rgba(163,74,81,0.55)]' : ''}`}
              >
                {headerDateLabel}
              </motion.div>
              <motion.div
                animate={timelinePulse ? { opacity: [0.6, 1, 0.85] } : { opacity: 1 }}
                transition={{ duration: 0.6, repeat: timelinePulse ? 2 : 0 }}
                className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-end gap-2 mt-0.5"
              >
                <motion.span
                  className="w-2 h-2 rounded-full bg-[#A34A51]"
                  animate={timelinePulse ? { scale: [1, 1.45, 1], opacity: [1, 0.55, 1] } : { scale: 1, opacity: 1 }}
                  transition={{ duration: 0.55, repeat: timelinePulse ? 2 : 0, ease: 'easeInOut' }}
                />
                Live Timeline
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Title Section — 大屏顶对齐 CURRENT DATE 卡片 */}
        <div className="mb-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6 lg:gap-10">
          <div className="min-w-0 flex-1 max-w-3xl">
            <h2 className="text-5xl md:text-6xl lg:text-[3.35rem] xl:text-[3.65rem] font-serif font-bold leading-[1.06] tracking-tight">
              七大摇摆州<br/>
              <span className="text-[#A34A51]">选举周危机档案</span>
            </h2>
          </div>
          
          {/* Overall Threat Meter */}
          <motion.div
            className="bg-[#131B2F] border border-[#A34A51]/30 rounded-xl p-5 sm:p-6 w-full lg:w-auto lg:shrink-0 lg:min-w-[26rem] xl:min-w-[30rem] lg:max-w-2xl shadow-[0_0_32px_rgba(163,74,81,0.14)] relative overflow-hidden lg:self-start"
            animate={
              timelinePulse
                ? {
                    boxShadow: [
                      '0 0 40px rgba(163,74,81,0.15)',
                      '0 0 52px rgba(163,74,81,0.42)',
                      '0 0 40px rgba(163,74,81,0.15)'
                    ],
                    borderColor: ['rgba(163,74,81,0.3)', 'rgba(163,74,81,0.65)', 'rgba(163,74,81,0.3)']
                  }
                : {
                    boxShadow: '0 0 40px rgba(163,74,81,0.15)',
                    borderColor: 'rgba(163,74,81,0.3)'
                  }
            }
            transition={{ duration: 0.55, ease: 'easeInOut' }}
          >
            {timelinePulse && (
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#A34A51]/12 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
              />
            )}
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 sm:gap-5">
              <div className="flex gap-4 sm:gap-5 items-center min-w-0 flex-1">
                <div className="relative w-[4.25rem] h-[4.25rem] sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#1F2937" strokeWidth="8" />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#A34A51"
                      strokeWidth="8"
                      strokeDasharray="283"
                      strokeDashoffset="42"
                      animate={
                        timelinePulse
                          ? { strokeWidth: [8, 10, 8], opacity: [1, 0.92, 1] }
                          : { strokeWidth: 8, opacity: 1 }
                      }
                      transition={{ duration: 0.45, ease: 'easeInOut' }}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
                    <motion.span
                      key={displayDate + '-day'}
                      initial={{ scale: 1.35, opacity: 0.3 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                      className="text-xl sm:text-2xl font-bold text-[#A34A51] font-mono tabular-nums"
                    >
                      {dateParts.day}
                    </motion.span>
                    <span className="text-[9px] sm:text-[10px] text-gray-500 font-mono mt-0.5 uppercase tracking-wider">day</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Current date</div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <motion.div
                      key={displayDate + '-ym'}
                      initial={{ opacity: 0.5, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                      className="text-xl sm:text-2xl font-bold text-white tracking-widest font-mono"
                    >
                      {dateParts.year}.{dateParts.month}
                    </motion.div>
                    <span className="text-xs sm:text-sm text-[#A34A51]/90 flex items-center gap-1.5 font-mono">
                      <Clock size={13} className="opacity-80 shrink-0" />
                      {displayDate}
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-[10px] sm:text-[11px] text-gray-500 font-mono uppercase tracking-wider mb-2">时间线 · 即时同步</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          title="向前一天"
                          onClick={() => bumpDisplayDate(-1)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-white/12 bg-[#0B0F19] text-xs font-mono text-gray-200 hover:border-[#A34A51]/45 hover:text-[#F1C9CF] transition-colors"
                        >
                          <CalendarMinus size={15} className="text-[#A34A51]" />
                          <span>−1</span>
                        </button>
                        <input
                          type="date"
                          value={dateInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDateInput(v);
                            void handleUpdateDisplayDate(v);
                          }}
                          className="min-w-0 flex-1 basis-[9.5rem] max-w-[13rem] bg-[#0B0F19] border border-white/12 rounded-md px-2 py-1.5 text-xs sm:text-sm text-white outline-none focus:border-[#A34A51] font-mono [color-scheme:dark]"
                        />
                        <button
                          type="button"
                          title="向后一天"
                          onClick={() => bumpDisplayDate(1)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-white/12 bg-[#0B0F19] text-xs font-mono text-gray-200 hover:border-[#A34A51]/45 hover:text-[#F1C9CF] transition-colors"
                        >
                          <span>+1</span>
                          <CalendarPlus size={15} className="text-[#A34A51]" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:w-px sm:min-h-[5.5rem] sm:self-stretch bg-white/10 shrink-0 hidden sm:block" aria-hidden />

              <div className="sm:w-[9.5rem] md:w-36 sm:shrink-0 sm:pt-0 pt-3 border-t border-white/10 sm:border-t-0 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">
                  <span>National</span>
                  <span className="text-[#A34A51] font-bold tabular-nums text-xs sm:text-sm">{nationalTensionPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#D97757] to-[#A34A51] transition-all duration-300"
                    style={{ width: `${nationalTensionPercent}%` }}
                  />
                </div>
                {isAdmin && (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={nationalTensionInput}
                      onChange={(e) => setNationalTensionInput(e.target.value)}
                      className="w-full min-w-0 bg-[#0B0F19] border border-white/12 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-[#A34A51]"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateNationalTensionPercent(Number(nationalTensionInput))}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#A34A51]/45 text-[#A34A51] hover:bg-[#A34A51] hover:text-white transition-colors shrink-0"
                    >
                      保存
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Front Page News Board */}
        <section className="mb-10">
          <div className="bg-[#0F1424] border border-[#D4AF37]/25 rounded-2xl p-6 shadow-[0_0_36px_rgba(212,175,55,0.08)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/35 to-transparent" />
            <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="mt-1 hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]">
                  <Newspaper size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#F5F0E6] tracking-tight">头版新闻</h3>
                  <p className="text-xs text-[#D4AF37]/80 font-mono uppercase tracking-widest mt-1">Front Page · National desk</p>
                  <div className="mt-2 h-0.5 w-16 rounded-full bg-gradient-to-r from-[#D4AF37]/80 to-transparent" />
                </div>
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
              <div className="divide-y divide-white/[0.07] rounded-xl border border-white/[0.06] bg-black/20">
                {nationalCrises.map((crisis) => (
                  <Fragment key={crisis.id}>
                    <FrontPageNewsRow
                      crisis={crisis}
                      isAdmin={isAdmin}
                      onUpdateTension={handleUpdateNationalTension}
                      onDelete={requestDeleteNationalCrisis}
                      onEdit={openEditNationalForm}
                      onOpenDetail={openNationalCrisisDetail}
                    />
                  </Fragment>
                ))}
              </div>
            ) : !isFrontPageCollapsed ? (
              <div className="border border-dashed border-[#D4AF37]/25 rounded-xl p-8 text-center text-gray-500 font-mono text-sm bg-black/15">
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

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">详情弹窗美术风格（仅本条头版稿）</label>
              <select
                value={nationalFormData.display_outlet}
                onChange={(e) =>
                  setNationalFormData({
                    ...nationalFormData,
                    display_outlet: e.target.value as NewsOutletSetting
                  })
                }
                className="w-full max-w-xl bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#A34A51] [color-scheme:dark]"
              >
                {DISPLAY_OUTLET_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
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
          <LayoutGroup id="state-sidebar-rank">
            <motion.div layout className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-3">
              <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2 px-1">Select State</div>
              {statesData.map(state => (
                <motion.button
                  key={state.id}
                  layout="position"
                  transition={stateListLayoutTransition}
                  onClick={() => {
                    setActiveStateId(state.id);
                    closeForm();
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors duration-300 flex items-center justify-between group will-change-transform
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
                </motion.button>
              ))}
            </motion.div>
          </LayoutGroup>

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
                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                  左侧列表与排序仅使用此处保存的紧张度（0–100），与下方危机条目的等级不会自动互相覆盖。
                </p>
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
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1">详情弹窗美术风格（仅本条危机卡片）</label>
                  <select
                    value={formData.display_outlet}
                    onChange={(e) =>
                      setFormData({ ...formData, display_outlet: e.target.value as NewsOutletSetting })
                    }
                    className="w-full max-w-xl bg-[#0B0F19] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#A34A51] [color-scheme:dark]"
                  >
                    {DISPLAY_OUTLET_FORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
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
          className="fixed left-0 right-0 top-[73px] bottom-0 z-[120] flex"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crisis-detail-title"
        >
          <button
            type="button"
            className="flex-1 min-h-0 min-w-0 cursor-default border-0 bg-[#0B0F19]/50 backdrop-blur-[2px] p-0"
            aria-label="关闭详情"
            onClick={() => setSelectedCrisisDetail(null)}
          />
          {(() => {
            const isNationalFront = selectedCrisisDetail.detailSource === 'national';
            const o = selectedCrisisDetail.displayOutlet;
            const theme = OUTLET_THEME[o];
            const copy = OUTLET_COPY[o];
            const tensionEn = tensionLabelEn(selectedCrisisDetail.tension);
            const trendEn = trendLabelEn(selectedCrisisDetail.trend);
            const stateMastSamunLine =
              o === 'nyt' ? `SAMUN —${copy.styleLine}` : `SAMUN — ${copy.styleLine}`;
            const stateKickerText = copy.stateHeaderKicker ?? stateMastSamunLine;
            const stateTitleText = copy.stateHeaderTitle ?? copy.stateDeck;
            return (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className={`relative h-full w-full max-w-[min(100vw,36rem)] sm:max-w-[40rem] md:max-w-[44rem] lg:max-w-[48rem] xl:max-w-[52rem] shrink-0 overflow-y-auto overflow-x-hidden border-l-[3px] border-black/20 shadow-[-16px_0_48px_rgba(0,0,0,0.35)] antialiased ${theme.rootFont} ${theme.paper} text-stone-900 ${theme.shadow}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`pointer-events-none absolute inset-0 ${theme.paperNoise}`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
              }}
              aria-hidden
            />

            <button
              type="button"
              onClick={() => setSelectedCrisisDetail(null)}
              className={`absolute top-3 right-3 z-10 p-2 rounded-sm border transition-colors ${theme.closeBtn}`}
              title="Close"
            >
              <X size={18} strokeWidth={2.25} />
            </button>

            <div className="relative pb-8">
              {isNationalFront ? (
                <>
                  <div className={`relative -mx-px px-6 sm:px-10 pt-8 pb-6 ${theme.nationalBanner}`}>
                    <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 ${theme.nationalBannerInnerRule} border-b`}>
                      <div className={`flex items-center gap-2 ${theme.nationalMastMuted}`}>
                        <Newspaper className="w-4 h-4 shrink-0" strokeWidth={2} />
                        <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase font-mono">
                          {o === 'nyt' ? `SAMUN —${copy.styleLine}` : `SAMUN — ${copy.styleLine}`}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono uppercase tracking-[0.12em] ${theme.nationalMastMuted}`}>
                        National · Front Page
                      </span>
                    </div>
                    <p className={`${theme.nationalKicker} mb-2`}>
                      {copy.natKicker}
                    </p>
                    <h1 className={theme.nationalHeadline}>
                      {copy.natDeck}
                    </h1>
                  </div>

                  <div className="px-6 sm:px-10 pt-8">
                    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] sm:text-xs font-mono mb-5 pb-3 ${theme.dateline}`}>
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <Clock size={13} strokeWidth={2} />
                        {selectedCrisisDetail.time}
                      </span>
                      <span className="opacity-40 hidden sm:inline">·</span>
                      <span className="uppercase tracking-wider">
                        {selectedCrisisDetail.scopeLabel}
                      </span>
                    </div>

                    <h2 id="crisis-detail-title" className={`${theme.headlineNat} mb-6 sm:mb-7 [text-wrap:balance]`}>
                      {selectedCrisisDetail.title}
                    </h2>

                    <div className="flex flex-wrap gap-2 mb-8 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wide">
                      <span className={`px-2.5 py-1.5 ${theme.tagPrimary}`}>
                        Tension · {tensionEn}
                      </span>
                      <span className={`px-2.5 py-1.5 ${theme.tagSecondary}`}>
                        Trajectory · {trendEn}
                      </span>
                    </div>

                    <p className="text-[11px] font-mono uppercase tracking-[0.14em] opacity-70 mb-2">
                      Lead story (full column)
                    </p>
                    <div className={`whitespace-pre-wrap ${theme.bodyLeadWrap} ${theme.bodyNational} ${theme.borderLeftLead}`}>
                      {selectedCrisisDetail.details}
                    </div>

                    <p className={`mt-8 sm:mt-10 pt-4 border-t-2 text-center text-[10px] font-mono tracking-[0.12em] ${theme.footer}`}>
                      — 点击左侧区域或 ✕ 关闭 —
                    </p>
                  </div>
                </>
              ) : (
                <div className="px-6 sm:px-10 pt-10">
                  <header className={`${theme.stateHeader} mb-6`}>
                    <div
                      className={`flex items-start gap-2.5 mb-1.5 ${theme.stateMastRow} ${theme.stateMastheadMuted}`}
                    >
                      <Newspaper className="w-4 h-4 shrink-0 opacity-80 mt-0.5" strokeWidth={2} />
                      <span className="text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] uppercase font-mono leading-snug opacity-[0.82]">
                        {stateKickerText}
                      </span>
                    </div>
                    <h1
                      className={`text-[1.65rem] sm:text-[2.2rem] md:text-[2.35rem] tracking-tight leading-[1.12] font-bold mt-1 ${theme.stateTitle}`}
                    >
                      {stateTitleText}
                    </h1>
                    <div className={`mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] sm:text-xs font-mono border-y py-2 px-2 ${theme.dateline}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} strokeWidth={2} />
                        {selectedCrisisDetail.time}
                      </span>
                      <span className="hidden sm:inline opacity-40">|</span>
                      <span className="uppercase tracking-wider">
                        {selectedCrisisDetail.scopeLabel}
                      </span>
                    </div>
                  </header>

                  <h2 id="crisis-detail-title" className={`${theme.headlineState} mb-5 sm:mb-6`}>
                    {selectedCrisisDetail.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-2 mb-6 sm:mb-8 text-[10px] sm:text-[11px] font-mono uppercase tracking-wide">
                    <span className={`px-2 py-1 ${theme.tagPrimary}`}>
                      Tension · {tensionEn}
                    </span>
                    <span className={`px-2 py-1 ${theme.tagSecondary}`}>
                      Trajectory · {trendEn}
                    </span>
                  </div>

                  <div className={`whitespace-pre-wrap ${theme.bodyStateCols} ${theme.bodyState}`}>
                    {selectedCrisisDetail.details}
                  </div>

                  <p className={`mt-8 sm:mt-10 pt-4 border-t-2 text-center text-[10px] font-mono tracking-[0.12em] ${theme.footer}`}>
                    — 点击左侧区域或 ✕ 关闭 —
                  </p>
                </div>
              )}
            </div>
          </motion.div>
            );
          })()}
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


