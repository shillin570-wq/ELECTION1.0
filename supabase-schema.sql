-- ELECTION2 Supabase 初始化脚本（当前前端写死账号版）
-- 可直接粘贴到 Supabase SQL Editor 执行
-- 仅包含业务数据表：states / crises（不包含 users）

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tension_level') then
    create type public.tension_level as enum ('极高', '高', '中等', '较低');
  end if;
  if not exists (select 1 from pg_type where typname = 'trend_level') then
    create type public.trend_level as enum ('up', 'down', 'stable');
  end if;
end
$$;

create table if not exists public.states (
  id text primary key,
  "stateName" text not null,
  "stateEn" text not null,
  "electoralVotes" integer not null check ("electoralVotes" > 0),
  "overallTension" public.tension_level not null,
  tension_percent integer not null default 60 check (tension_percent >= 0 and tension_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crises (
  id text primary key,
  state_id text not null references public.states(id) on delete cascade,
  time text not null,
  title text not null,
  details text not null,
  tension public.tension_level not null,
  trend public.trend_level not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.national_crises (
  id text primary key,
  time text not null,
  title text not null,
  details text not null,
  tension public.tension_level not null,
  trend public.trend_level not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id integer primary key,
  display_date date not null,
  national_tension_percent integer not null default 85 check (national_tension_percent >= 0 and national_tension_percent <= 100),
  updated_at timestamptz not null default now()
);

-- Backward-compatible migration for existing databases.
do $$
begin
  -- Old schema had `current_date`; rename to `display_date` if needed.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'current_date'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'display_date'
  ) then
    alter table public.app_settings rename column "current_date" to display_date;
  end if;

  -- Ensure state percentage column exists for old schema.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'states' and column_name = 'tension_percent'
  ) then
    alter table public.states add column tension_percent integer;
  end if;

  -- Ensure national percentage column exists for old schema.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'national_tension_percent'
  ) then
    alter table public.app_settings add column national_tension_percent integer;
  end if;
end
$$;

update public.states
set tension_percent = 60
where tension_percent is null;

alter table public.states
  alter column tension_percent set default 60,
  alter column tension_percent set not null;

update public.app_settings
set display_date = current_date
where display_date is null;

update public.app_settings
set national_tension_percent = 85
where national_tension_percent is null;

alter table public.app_settings
  alter column display_date set not null,
  alter column national_tension_percent set default 85,
  alter column national_tension_percent set not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists states_set_updated_at on public.states;
create trigger states_set_updated_at
before update on public.states
for each row execute function public.set_updated_at();

drop trigger if exists crises_set_updated_at on public.crises;
create trigger crises_set_updated_at
before update on public.crises
for each row execute function public.set_updated_at();

drop trigger if exists national_crises_set_updated_at on public.national_crises;
create trigger national_crises_set_updated_at
before update on public.national_crises
for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create index if not exists idx_crises_state_id on public.crises(state_id);
create index if not exists idx_crises_tension on public.crises(tension);
create index if not exists idx_national_crises_tension on public.national_crises(tension);

alter table public.states disable row level security;
alter table public.crises disable row level security;
alter table public.national_crises disable row level security;
alter table public.app_settings disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.states to anon, authenticated;
grant select, insert, update, delete on public.crises to anon, authenticated;
grant select, insert, update, delete on public.national_crises to anon, authenticated;
grant select, insert, update, delete on public.app_settings to anon, authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.states;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.crises;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.national_crises;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.app_settings;
  exception when duplicate_object then null;
  end;
end
$$;

insert into public.app_settings (id, display_date, national_tension_percent)
values (1, current_date, 85)
on conflict (id) do update
set
  display_date = excluded.display_date,
  national_tension_percent = excluded.national_tension_percent;

insert into public.national_crises (id, time, title, details, tension, trend)
values
  ('nat-1', '11-05 20:00', '全国性选后法律战升级', '多个摇摆州同步出现法律挑战与重新计票诉讼，媒体和公众对最终认证流程高度关注。', '高', 'up')
on conflict (id) do update
set
  time = excluded.time,
  title = excluded.title,
  details = excluded.details,
  tension = excluded.tension,
  trend = excluded.trend;

insert into public.states (id, "stateName", "stateEn", "electoralVotes", "overallTension", tension_percent)
values
  ('pa', '宾夕法尼亚州', 'Pennsylvania', 20, '极高', 90),
  ('ga', '佐治亚州', 'Georgia', 16, '极高', 88),
  ('mi', '密歇根州', 'Michigan', 16, '极高', 87),
  ('az', '亚利桑那州', 'Arizona', 11, '高', 76),
  ('wi', '威斯康星州', 'Wisconsin', 10, '高', 74),
  ('nv', '内华达州', 'Nevada', 6, '中等', 58),
  ('nc', '北卡罗来纳州', 'North Carolina', 15, '中等', 61)
on conflict (id) do update
set
  "stateName" = excluded."stateName",
  "stateEn" = excluded."stateEn",
  "electoralVotes" = excluded."electoralVotes",
  "overallTension" = excluded."overallTension",
  tension_percent = excluded.tension_percent;

insert into public.crises (id, state_id, time, title, details, tension, trend)
values
  ('pa-1', 'pa', '11-04 08:30', '邮寄选票截止日期争议', '共和党就州最高法院允许接收大选日后三天内寄达的邮寄选票提出紧急上诉，要求隔离这部分选票。', '极高', 'up'),
  ('pa-2', 'pa', '11-04 14:15', '费城计票中心抗议', '大量抗议者聚集在费城会议中心外，要求"停止计票"或"计算每一张选票"，双方阵营发生肢体冲突。', '极高', 'up'),
  ('pa-3', 'pa', '11-03 19:00', '裸票(Naked Ballots)作废风险', '由于缺乏保密信封，数万张邮寄选票面临被直接作废的风险，可能直接影响最终胜负差距。', '高', 'stable'),
  ('pa-4', 'pa', '11-05 10:00', '观察员距离限制诉讼', '特朗普竞选团队起诉要求其观察员能够更近距离地监督费城的计票过程，法院初步裁决允许靠近至6英尺。', '中等', 'down'),
  ('ga-1', 'ga', '11-03 22:45', '州立农业球馆水管破裂', '亚特兰大主要计票中心因声称的水管破裂导致计票工作突然中断数小时，引发广泛的阴谋论和质疑。', '极高', 'up'),
  ('ga-2', 'ga', '11-05 09:30', '选票差距极微触发重新计票', '两位候选人得票率差距缩小至0.1%以内，州务卿宣布将进行全面的手工重新计票和审计。', '极高', 'stable'),
  ('ga-3', 'ga', '11-03 12:00', '亚特兰大郊区投票机故障', '斯伯丁县等地的投票机在早晨出现软件故障，导致选民排队时间长达数小时，法院下令延长投票时间。', '高', 'down'),
  ('mi-1', 'mi', '11-04 16:00', '底特律TCF中心计票冲突', '数百名抗议者试图冲入底特律TCF计票中心，敲打玻璃要求停止计票，警方被迫介入封锁大楼。', '极高', 'up'),
  ('mi-2', 'mi', '11-06 11:20', '安特里姆县(Antrim)制表错误', '由于县职员未更新软件，导致数千张投给共和党的选票被错误地计入民主党名下，虽已更正但引发全州对Dominion系统的质疑。', '极高', 'stable'),
  ('mi-3', 'mi', '11-04 09:00', '底特律缺席选票接收争议', '共和党观察员指控底特律在凌晨接收了数万张来历不明的缺席选票，提起诉讼要求停止认证结果。', '高', 'up'),
  ('az-1', 'az', '11-04 20:30', '马里科帕县计票中心武装对峙', '大量携带AR-15步枪的抗议者包围了马里科帕县选举部门，高喊"停止偷窃"，工作人员被迫在警察护送下离开。', '极高', 'up'),
  ('az-2', 'az', '11-04 10:15', '"记号笔门(Sharpiegate)"阴谋论', '社交媒体疯传使用Sharpie记号笔填写的选票会被机器作废，导致大量选民涌入投票站抗议，州检察长介入调查。', '高', 'down'),
  ('az-3', 'az', '11-03 23:20', '福克斯新闻提前"Call"州结果争议', '福克斯新闻在计票早期就宣布民主党拿下该州，引发共和党阵营强烈不满和内部混乱。', '中等', 'stable'),
  ('wi-1', 'wi', '11-04 03:30', '密尔沃基深夜选票激增', '密尔沃基市在凌晨报告了约17万张缺席选票结果，导致选情瞬间反转，引发"选票倾倒(Ballot Dump)"的强烈质疑。', '极高', 'up'),
  ('wi-2', 'wi', '11-05 14:00', '重新计票要求与费用争议', '由于差距小于1%，落后方要求重新计票，但根据州法律需自付约300万美元费用，双方就计票范围展开博弈。', '高', 'stable'),
  ('wi-3', 'wi', '11-03 15:45', '选民意向被基诺沙骚乱重塑', '几个月前的基诺沙枪击案和骚乱深刻改变了当地郊区选民的投票倾向，导致该区域选情异常胶着。', '中等', 'down'),
  ('nv-1', 'nv', '11-05 10:30', '克拉克县签名验证机器争议', '诉讼指控克拉克县(拉斯维加斯)使用的自动签名验证机器标准过低，导致大量不合格的邮寄选票被计入。', '高', 'up'),
  ('nv-2', 'nv', '11-05 16:00', '非居民投票欺诈指控', '共和党向司法部提交了数千份据称已搬离内华达州但仍在该州投票的选民名单，要求进行刑事调查。', '高', 'stable'),
  ('nv-3', 'nv', '11-04 12:00', '计票进度极其缓慢', '由于大量邮寄选票和复杂的验证程序，内华达州的计票进度落后于全国，引发全国范围内的焦虑和网络群嘲。', '中等', 'down'),
  ('nc-1', 'nc', '11-03 17:00', '投票站延迟关闭', '由于早晨的技术故障，四个投票站被法院下令延长开放时间45分钟，导致全州选举结果的公布被推迟。', '中等', 'down'),
  ('nc-2', 'nc', '11-06 09:00', '邮寄选票接收宽限期争议', '最高法院允许北卡将邮寄选票的接收截止日期延长至大选后9天，只要邮戳在选举日之前，引发持续的法律挑战。', '高', 'stable'),
  ('nc-3', 'nc', '11-04 11:00', '缺席选票见证人签名缺陷', '数千张缺席选票因缺少见证人签名面临作废，州选举委员会允许选民通过提交宣誓书来"治愈"选票的决定遭到起诉。', '高', 'up')
on conflict (id) do update
set
  state_id = excluded.state_id,
  time = excluded.time,
  title = excluded.title,
  details = excluded.details,
  tension = excluded.tension,
  trend = excluded.trend;

commit;
