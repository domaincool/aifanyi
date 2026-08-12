/**
 * PDF 翻译阅读器 · 类型定义（P1）
 * 数据结构为 P2/P3 铺路：块级结构 + bbox + 字体信息
 */

export type PdfBlockType = 'heading' | 'paragraph' | 'list-item' | 'table' | 'header' | 'footer' | 'image';

export interface PdfBlock {
  id: string;                 // 全局唯一（pageNumber-order）
  type: PdfBlockType;
  text: string;
  order: number;              // 页内序号
  translations: Record<string, PdfTranslation | undefined>; // deepseek/glm/google
  bbox: { x: number; y: number; width: number; height: number };
  fontSize: number;
  fontFamily: string;         // pdfjs 内部字体名（如实记录）
  fontWeight: string;         // 'normal' | 'bold'（启发式）
  color: string;              // 十六进制色值（启发式，默认 #000000）
}

export interface PdfTranslation {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  cached?: boolean;
  error?: string;
}

export interface PdfPage {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  blocks: PdfBlock[];
}

export interface PdfDocument {
  documentId: string;
  fileName: string;
  sourceLang: string;         // 自动识别（P1 简化为 'auto' 由模型判断，或用户指定）
  targetLang: string;
  pageCount: number;
  pages: PdfPage[];
  limitations: string[];      // 双栏/复杂表格等 limitation 提示
  totalCharacters: number;
  createdAt: number;
}

/** 翻译组：同页 3-5 个 block 合并（局部上下文） */
export interface TranslationGroup {
  groupId: string;
  pageNumber: number;
  blockIds: string[];
  sourceText: string;         // 组内原文拼接
  translatedText: string;     // 模型输出（仅译文）
}

/** Job 状态机：queued → processing → completed / failed */
export type PdfJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface PdfJobSummary {
  taskId: string;
  status: PdfJobStatus;
  progress: number;           // 0-100
  currentPage: number;
  totalPages: number;
  translatedBlocks: number;
  totalBlocks: number;
  errorType?: string;
  message?: string;
  result?: PdfJobResult;      // completed 时返回
}

export interface PdfJobResult {
  documentId: string;
  fileName: string;
  pageCount: number;
  sourceLang: string;
  targetLang: string;
  limitations: string[];
  pages: PdfPage[];           // 含译文（translations 已填充）
  stats: {
    totalBlocks: number;
    translatedBlocks: number;
    failedBlocks: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    durationMs: number;
    apiErrorCount: number;
  };
}

/** 解析错误（12 类错误之一） */
export class PdfError extends Error {
  constructor(
    public errorType: 'encrypted' | 'corrupt' | 'oversize' | 'too_many_pages' | 'too_many_characters' | 'no_text_layer' | 'parse_failed' | 'translation_failed' | 'provider_timeout' | 'provider_rate_limit' | 'partial_translation_failed' | 'docx_failed',
    message: string
  ) {
    super(message);
    this.name = 'PdfError';
  }
}
