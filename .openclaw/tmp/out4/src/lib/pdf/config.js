"use strict";
/**
 * PDF 翻译 · 配置（限制/价格/额度全部配置化，env 可覆盖）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDF_CONFIG = void 0;
exports.buildPdfGroupPrompt = buildPdfGroupPrompt;
exports.PDF_CONFIG = {
    /** 上传限制 */
    maxFileBytes: Number(process.env.PDF_MAX_FILE_MB || 20) * 1024 * 1024, // 20MB
    maxPages: Number(process.env.PDF_MAX_PAGES || 100),
    maxCharacters: Number(process.env.PDF_MAX_CHARACTERS || 1000000),
    /** 翻译组：同页合并 block 数 */
    groupSize: Number(process.env.PDF_GROUP_SIZE || 4), // 3-5 之间
    /** 额度（免费额度，先到为准） */
    quota: {
        dailyFiles: Number(process.env.PDF_DAILY_FILES || 5),
        dailyPages: Number(process.env.PDF_DAILY_PAGES || 50),
        dailyCompareSegments: Number(process.env.PDF_DAILY_COMPARE_SEGMENTS || 20),
        maxConcurrent: Number(process.env.PDF_MAX_CONCURRENT || 3),
    },
    /** 任务数据保留时长（毫秒）：24h */
    taskTtlMs: Number(process.env.PDF_TASK_TTL_HOURS || 24) * 3600 * 1000,
    /** 模型成本（美元/百万 token，与现有 provider 一致；配置化不写死） */
    costs: {
        deepseekIn: Number(process.env.COST_DEEPSEEK_IN || 0.28),
        deepseekOut: Number(process.env.COST_DEEPSEEK_OUT || 1.1),
        glmIn: Number(process.env.COST_GLM_IN || 0.01),
        glmOut: Number(process.env.COST_GLM_OUT || 0.01),
        googlePerChar: 0, // 免费额度内
    },
    /** prompt 版本（改 prompt 时 +1，缓存 key 随版本失效） */
    promptVersion: Number(process.env.PDF_PROMPT_VERSION || 1),
};
/** PDF 翻译专用 prompt（只输出组译文，不得输出原文/解释/分析） */
function buildPdfGroupPrompt(sourceLang, targetLang) {
    return [
        '你是一位专业翻译。下面会给你一组需要翻译的段落，段落之间用 [SEG n] 标记分隔。',
        `翻译方向：${sourceLang} → ${targetLang}。`,
        '要求：',
        '1. 只输出译文本身，按原文顺序用 [SEG n] 标记分隔，与输入段落一一对应。',
        '2. 不得输出原文、解释、上下文说明、分析过程或任何多余内容。',
        '3. 保持每段原有的标题层级感（标题译得简洁有力），列表项保持列表形式。',
        '4. 专业术语要准确，数字、专有名词保持原样。',
    ].join('\n');
}
