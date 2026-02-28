<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ELECTION2 Frontend + Supabase

纯前端项目，数据存储在 Supabase，支持实时更新（`states` / `crises`）。

## 本地运行

1. 安装依赖  
   `npm install`
2. 配置环境变量（复制 `.env.example` 为 `.env`）  
   需要以下变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 在 Supabase SQL Editor 执行 `supabase-schema.sql`
4. 启动项目  
   `npm run dev`
