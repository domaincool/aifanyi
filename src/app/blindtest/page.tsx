// /blindtest → /arena 迁移期兼容层（V1.0 D11）
// next.config redirects 已配置 301；此文件为兜底渲染（canonical 由 redirects 处理）
export const dynamic = 'force-dynamic';
export { default } from '../arena/page';
