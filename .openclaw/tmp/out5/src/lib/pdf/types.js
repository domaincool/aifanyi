"use strict";
/**
 * PDF 翻译阅读器 · 类型定义（P1）
 * 数据结构为 P2/P3 铺路：块级结构 + bbox + 字体信息
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfError = void 0;
/** 解析错误（12 类错误之一） */
class PdfError extends Error {
    constructor(errorType, message) {
        super(message);
        this.errorType = errorType;
        this.name = 'PdfError';
    }
}
exports.PdfError = PdfError;
