"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * PDF P1 阶段9：50 段盲测清单生成（规格 18：10 类 × 5 段）
 * 每段调用 DeepSeek / GLM / Google 三模型（匿名 A/B/C，顺序随机，modelMap 供评分后统计）
 * 输出：workspace handoff/pdf-blindtest-50-20260810.json（运营评判用）
 * 运行：npx tsx scripts/pdf-blindtest-50.ts
 */
const fs = __importStar(require("fs"));
const deepseek_1 = require("../src/lib/translator/providers/deepseek");
const glm_1 = require("../src/lib/translator/providers/glm");
const google_1 = require("../src/lib/translator/providers/google");
// ---- 手动加载 .env（独立 tsx 不加载 .env） ----
const envPath = 'G:\\\\autoclaw\\\\aifanyi\\\\.env';
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]])
            process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^\x27(.*)\x27$/, "$1");
    }
}
const SOURCES = [
    // 1. general 普通
    { category: 'general', text: 'Thank you for choosing our product. Please read this manual carefully before first use and keep it for future reference.' },
    { category: 'general', text: 'The meeting has been rescheduled to 3:00 PM next Tuesday. All department heads are expected to attend and bring their monthly reports.' },
    { category: 'general', text: 'To activate your account, simply enter the verification code we sent to your email address and follow the on-screen instructions.' },
    { category: 'general', text: 'Our customer service team is available from 9:00 AM to 6:00 PM, Monday through Friday. For urgent issues, please call our 24-hour hotline.' },
    { category: 'general', text: 'The hotel offers complimentary breakfast, free Wi-Fi in all rooms, and a fitness center on the third floor.' },
    // 2. long-sentence 长句
    { category: 'long-sentence', text: 'The company, which was founded in 1998 by two engineers who had previously worked for a major semiconductor manufacturer, has grown from a small startup operating out of a garage into a multinational corporation employing more than 20,000 people across 30 countries.' },
    { category: 'long-sentence', text: 'Despite the fact that the economy has shown signs of recovery over the past two quarters, many small businesses, particularly those in the retail sector, continue to struggle with rising rents and changing consumer habits that were accelerated by the pandemic.' },
    { category: 'long-sentence', text: 'The report, which was compiled by a team of independent researchers and reviewed by three external experts before publication, concludes that the proposed policy would have significant but uneven effects across different regions, depending on local economic conditions and the availability of alternative energy sources.' },
    { category: 'long-sentence', text: 'What distinguishes this approach from previous attempts is not merely the technology involved, but the way it integrates user feedback at every stage of development, from initial concept through prototyping and final deployment, ensuring that the end product reflects actual needs rather than assumptions.' },
    { category: 'long-sentence', text: 'Although the new regulation applies primarily to publicly traded companies with annual revenues exceeding one billion dollars, it also contains provisions that could affect smaller firms indirectly through their supply chain relationships with larger partners.' },
    // 3. terminology 术语
    { category: 'terminology', text: 'The patient presented with tachycardia, hypotension, and elevated cardiac enzymes, consistent with acute myocardial infarction. Immediate reperfusion therapy was initiated.' },
    { category: 'terminology', text: 'Under the terms of the non-disclosure agreement, the licensee may not reverse-engineer, decompile, or disassemble the software, nor may it sublicense the source code to any third party.' },
    { category: 'terminology', text: 'The court held that the plaintiff\'s claim for punitive damages was barred by the statute of limitations, and granted summary judgment in favor of the defendant.' },
    { category: 'terminology', text: 'In quantum computing, a qubit can exist in a superposition of states, and entanglement between qubits enables computational parallelism that classical bits cannot achieve.' },
    { category: 'terminology', text: 'The bond\'s yield to maturity is calculated by solving for the discount rate that equates the present value of future coupon payments and the principal repayment with the current market price.' },
    // 4. finance 财经
    { category: 'finance', text: 'Net profit attributable to shareholders rose 12.4% year-on-year to RMB 8.6 billion, driven by strong growth in our cloud computing segment and improved operating margins.' },
    { category: 'finance', text: 'The Federal Reserve kept interest rates unchanged at its September meeting, citing moderating inflation and a cooling labor market as key considerations.' },
    { category: 'finance', text: 'Investors should be aware that past performance is not indicative of future results, and that investments in emerging markets carry additional currency and political risks.' },
    { category: 'finance', text: 'The company announced a share buyback program of up to $500 million, funded from existing cash reserves, and reaffirmed its full-year earnings guidance.' },
    { category: 'finance', text: 'Following the merger, the combined entity will have a market capitalization of approximately $40 billion and is expected to achieve cost synergies of $300 million annually by 2027.' },
    // 5. tech 科技
    { category: 'tech', text: 'The new API supports batch processing of up to 10,000 records per request, with automatic retry and exponential backoff for transient failures.' },
    { category: 'tech', text: 'To deploy the application, run the provided Docker image on any Kubernetes cluster, ensuring that the environment variables for database credentials are configured before startup.' },
    { category: 'tech', text: 'The model was trained on 1.4 trillion tokens using a mixture-of-experts architecture, achieving state-of-the-art results on 12 out of 15 benchmark tasks.' },
    { category: 'tech', text: 'Data is encrypted in transit using TLS 1.3 and at rest using AES-256; access keys are rotated every 90 days and audit logs are retained for one year.' },
    { category: 'tech', text: 'The system automatically detects anomalies in network traffic using a machine learning classifier that was trained on five years of historical data.' },
    // 6. academic 学术
    { category: 'academic', text: 'This study examines the relationship between social media usage and adolescent mental health, drawing on survey data from 12,000 participants across eight countries.' },
    { category: 'academic', text: 'The results suggest that the observed effect is statistically significant (p < 0.01), although the magnitude is modest and the causal mechanism remains unclear.' },
    { category: 'academic', text: 'Previous literature has largely focused on urban populations; this paper extends the analysis to rural communities, where access to digital infrastructure differs markedly.' },
    { category: 'academic', text: 'We employed a difference-in-differences design to control for unobserved heterogeneity, with robustness checks including alternative specifications and placebo tests.' },
    { category: 'academic', text: 'The findings contribute to the growing body of evidence on climate adaptation, and we discuss their policy implications for coastal regions in developing countries.' },
    // 7. passive 被动
    { category: 'passive', text: 'The samples were collected from three different sites and were analyzed using gas chromatography. The results were compared against established reference values.' },
    { category: 'passive', text: 'It is recommended that the equipment be inspected annually and that any worn parts be replaced before they cause further damage.' },
    { category: 'passive', text: 'The contract was signed on March 15 and was ratified by the board on April 2. Copies were distributed to all relevant departments.' },
    { category: 'passive', text: 'All personal data is processed in accordance with applicable privacy laws and is stored on servers located within the European Union.' },
    { category: 'passive', text: 'The findings were published in the journal last month and were widely discussed by researchers in the field, although several aspects have been questioned by later studies.' },
    // 8. coreference 指代
    { category: 'coreference', text: 'The manager rejected the proposal because she believed it was too risky. Her concerns were shared by the rest of the team, who voted against it unanimously.' },
    { category: 'coreference', text: 'When the new software was installed, many employees found it difficult to use. They complained that its interface was confusing, so the company hired a trainer to help them.' },
    { category: 'coreference', text: 'The university announced that its enrollment would increase next year. This decision was welcomed by local businesses, which expect the expansion to boost the economy.' },
    { category: 'coreference', text: 'Sarah met with the client and presented the revised budget. He approved it after making several minor changes, which she incorporated into the final version.' },
    { category: 'coreference', text: 'The two companies signed a partnership agreement. Under it, they will share technology and co-develop products, a move that analysts say could reshape the industry.' },
    // 9. list 列表
    { category: 'list', text: 'The application requires the following documents:\n1. A valid passport or national ID\n2. Proof of residence (utility bill or lease agreement)\n3. Two recent passport-sized photographs\n4. A completed application form' },
    { category: 'list', text: 'Safety precautions:\n- Wear protective goggles at all times\n- Keep flammable materials away from the work area\n- Report any equipment malfunction immediately\n- Follow the emergency evacuation plan' },
    { category: 'list', text: 'The conference program includes:\n\u2022 Keynote address by the CEO\n\u2022 Three parallel workshop sessions\n\u2022 An industry exhibition with 50 exhibitors\n\u2022 A networking dinner on the final evening' },
    { category: 'list', text: 'To troubleshoot the issue:\nStep 1: Restart the device and wait 30 seconds\nStep 2: Check the network connection status\nStep 3: Update the firmware to the latest version\nStep 4: Contact support if the problem persists' },
    { category: 'list', text: 'The report covers the following topics:\n1. Market overview and growth trends\n2. Competitive landscape analysis\n3. Consumer behavior insights\n4. Strategic recommendations\n5. Implementation roadmap' },
    // 10. mixed 中英混合
    { category: 'mixed', text: 'Our team will follow up on the P0 issues first, 尤其是支付模块的稳定性问题, before moving on to the A/B test 的后续迭代.' },
    { category: 'mixed', text: 'Please review the attached SOW and confirm the milestone 时间表 by Friday. Any 变更请求 should be submitted through the Change Control Board.' },
    { category: 'mixed', text: 'The KPI for this quarter is 转化率提升 15%, with a stretch goal of 20%. We will track 漏斗各环节 daily and report weekly.' },
    { category: 'mixed', text: 'This document outlines the 合规要求 for our overseas operations, including GDPR, 数据本地化, and 出口管制 regulations.' },
    { category: 'mixed', text: 'The 产品经理 will present the roadmap at the 季度评审会 next week, covering 优先级排序 and 资源分配 for the next three sprints.' },
];
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
async function main() {
    const deepseek = new deepseek_1.DeepSeekProvider();
    const glm = new glm_1.GlmProvider();
    const google = new google_1.GoogleTranslateProvider();
    const items = [];
    let ok = 0, fail = 0;
    const progressPath = 'G:\\autoclaw\\aifanyi\\.openclaw\\tmp\\blindtest-progress.jsonl';
    if (fs.existsSync(progressPath))
        fs.unlinkSync(progressPath);
    for (let i = 0; i < SOURCES.length; i++) {
        const src = SOURCES[i];
        const req = { text: src.text, sourceLang: 'en', targetLang: 'zh', scenario: 'pdf' };
        const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((res) => setTimeout(() => res({ text: '', model: tag, error: 'timeout' }), ms))]);
        const results = await Promise.all([
            withTimeout(deepseek.translate({ ...req }), 40000, 'deepseek'),
            withTimeout(glm.translate({ ...req }), 40000, 'glm'),
            withTimeout(google.translate({ ...req }), 40000, 'google'),
        ]);
        const named = results.map((r) => ({ text: r.text, model: r.model, error: r.error || null }));
        const shuffled = shuffle(named).map(({ text, model }) => ({ text, model }));
        items.push({
            id: `pdf-blind-${String(i + 1).padStart(3, '0')}`,
            category: src.category,
            sourceText: src.text,
            A: { text: shuffled[0].text, model: shuffled[0].model },
            B: { text: shuffled[1].text, model: shuffled[1].model },
            C: { text: shuffled[2].text, model: shuffled[2].model },
        });
        const fails = named.filter((n) => n.error || !n.text).length;
        if (fails)
            fail += fails;
        else
            ok++;
        fs.appendFileSync(progressPath, JSON.stringify({ i: i + 1, category: src.category, fails, time: new Date().toISOString() }) + '\n');
        console.log(`[${i + 1}/50] ${src.category} ${fails ? 'FAIL(' + fails + ')' : 'ok'} ${(Date.now() % 1000)}`);
    }
    const out = {
        meta: {
            generatedAt: new Date().toISOString(),
            direction: 'en → zh',
            scenario: 'pdf',
            models: ['deepseek', 'glm', 'google'],
            total: items.length,
            categories: [...new Set(SOURCES.map((s) => s.category))],
            anonymousNote: 'A/B/C 顺序已随机；model 字段为真实映射，评判时只看 text，评分后供统计',
            judgingGuide: '每段评级：A(准确流畅) / B(基本达意有瑕疵) / C(错译或严重问题)；标注错译/漏译/风格问题',
        },
        items,
    };
    const outPath = 'C:\\Users\\Administrator\\.openclaw-autoclaw\\agents\\agent-nc6bvi\\workspace\\handoff\\pdf-blindtest-50-20260810.json';
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log(`\n完成：${items.length} 段，成功 ${ok}，失败段数 ${fail}，输出 ${outPath}`);
}
main().catch((e) => { console.error('脚本异常：', e); process.exit(1); });
