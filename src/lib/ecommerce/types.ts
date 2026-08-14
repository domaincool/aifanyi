/**
 * 跨境电商工作台 · 领域类型（服务端）
 */

/** 商品资料（创建/更新 Product 时的可写字段） */
export interface ProductDraft {
  name: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  sku?: string | null;
  features?: string[] | null;
  specifications?: string[] | null;
  materials?: string[] | null;
  dimensions?: { length?: string; width?: string; height?: string; weight?: string; unit?: string } | null;
  targetMarket?: string | null;
  platform?: string | null;
  sourceLang?: string;
}

/** AI 提取（enrich）输出结构 */
export interface EnrichOutput {
  category?: string | null;
  brand?: string | null;
  features?: string[];
  specifications?: string[];
  materials?: string[];
  targetMarket?: string | null;
  keywords?: string[];
  sellingPoints?: string[];
  /** 需要用户确认的信息点（AI 不确定/需人工核实） */
  needConfirm?: string[];
  [k: string]: unknown;
}
