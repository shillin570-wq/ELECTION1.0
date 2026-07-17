-- 时间线自动流动：请在 Supabase SQL Editor 执行本脚本（已有库升级用）
-- 速率：现实 40 分钟 = 程序显示 3 天（按整天推进）

begin;

alter table public.app_settings
  add column if not exists timeline_flowing boolean not null default false;

alter table public.app_settings
  add column if not exists timeline_flow_started_at timestamptz;

commit;
