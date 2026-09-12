/**
 * Speak 场景页静态数据（流量增长 V1.0 模板 E：/speak/[scenario] ×7）
 *
 * 数据来源协议（workerD-pages.md 同步说明）：
 * - travel：聚合 /travel/{country}/{scene} SceneEntry 资产（48 篇，按子场景分组——
 *   restaurant 8 国 / airport 12 国 / hotel 9 国 / shopping 12 国 / transport 6 国
 *   / cafe 2 国 / sightseeing 1 国），顶部表达示例取自 handoff/travel-batch-001-20260817.md
 *   运营示范批（日本餐厅 10 句核心表达），按 origin 注明出处。
 * - work / social / dating：MemeEntry 按 tags（职场 25 / 社交 17 / 恋爱 18）静态快照，
 *   链接全部指向线上真实词条 slug（已对照 2026-09-11 线上 sitemap content.xml 校验）。
 * - business / ecommerce / study：静态文案 + 工具 CTA（蓝图：静态文案+工具 CTA / 学生场景卡）。
 *
 * 注意：本文件为「构建期静态快照」。若后续词条 slug 变更/删除，需同步本文件（词条页均有
 * 404 兜底，链接失效不影响构建）。
 */

export interface SpeakPhrase {
  zh: string; // 中文说法
  native: string; // 英文/当地语说法
  note?: string; // 用法提示
}

export interface SpeakEntry {
  // 词条型表达（link 到 /meme/[slug]）：slug + tags 同时存在才渲染为链接卡
  term: string; // 中文词
  slug?: string; // 站内词条路径（必须真实存在）
  meaning?: string; // 一句话释义
  translation?: string; // 地道英文表达
  example?: string; // 例句（英文）
  exampleZh?: string; // 例句中文
  tags?: string[]; // 关联标签
  // 短语型表达（静态句卡，纯展示）：native + zh
  native?: string; // 英文/当地语说法
  zh?: string; // 中文说法
  note?: string; // 用法提示
}

export interface SpeakLink {
  label: string;
  href: string;
  desc?: string;
}

export interface SpeakDialogue {
  situation: string;
  lines: { zh: string; en: string }[];
}

export interface SpeakSection {
  title: string; // 子场景标题
  intro: string; // 子场景说明
  origin: string; // 数据出处（透明标注）
  links?: SpeakLink[]; // 该子场景的站内链接（真实路由）
  entries?: SpeakEntry[]; // 表达卡
  phrases?: SpeakPhrase[]; // 短语表（travel 等静态场景）
  dialogue?: SpeakDialogue; // 场景对话 ×1
}

export interface SpeakScenario {
  slug: string; // travel | business | ecommerce | work | social | dating | study
  name: string; // 场景名（旅行/商务/…）
  nameEn: string;
  h1: string; // 「{场景}英语怎么说：{场景}场景表达指南」
  title: string; // SEO title
  description: string; // SEO description
  keywords: string[];
  intro: string; // 顶部导语
  top10: SpeakEntry[]; // 首屏 top10 表达卡
  sections: SpeakSection[]; // 分块详解
  arenaLine: string; // 内链 /arena 的推荐语
  toolCtaLabel: string; // 场景化翻译入口文案
  toolScenario?: string; // TranslatorBox 场景预选（business/academic/casual）
}

const memeLink = (slug: string, term: string) => `/meme/${slug}`;
const untrLink = (slug: string) => `/untranslatable/${slug}`;

/* ───────────────────────── 旅行 ───────────────────────── */

const travel: SpeakScenario = {
  slug: 'travel',
  name: '旅行',
  nameEn: 'Travel',
  h1: '旅行英语怎么说：旅行场景表达指南',
  title: '旅行英语怎么说：机场/酒店/点餐/购物全场景表达指南 | 爱翻译',
  description:
    '旅行英语口语大全：机场值机、酒店入住、餐厅点餐、购物砍价、交通问路的高频表达与真实例句，覆盖日语/韩语/泰语等 7 国旅行场景词库，搭配爱翻译 AI 翻译工具随查随用。',
  keywords: ['旅行英语', '旅游英语口语', '机场英语', '酒店英语', '点餐英语', '旅行常用语'],
  intro:
    '出境旅行的语言问题集中在五个瞬间：值机、入住、点餐、购物、问路。这一页把 48 个国家场景页（日本/韩国/泰国/法国/意大利/越南/土耳其/西班牙/印度/波兰/德国/葡萄牙）的高频表达按子场景聚合，先看英文通用说法，再进对应国家的当地语场景页深挖。',
  top10: [
    { term: '值机托运', native: 'I’d like to check in and check this bag, please.', zh: '我要值机，托运这件行李。', note: '机场值机柜台第一句' },
    { term: '过境转机', native: 'Where is the transfer / connecting gate?', zh: '转机口在哪里？', note: '看登机牌上的 gate 对不上就问这句' },
    { term: '办理入住', native: 'I have a reservation under the name Li.', zh: '我有预订，名字是李。', note: 'under the name 是关键搭配' },
    { term: '推迟退房', native: 'Could I have a late check-out?', zh: '可以延迟退房吗？', note: '多数酒店按小时收费或免费半小时' },
    { term: '点餐', native: 'I’ll have this one, please.', zh: '我要这个。', note: '指着菜单说，通用度最高' },
    { term: '忌口过敏', native: 'I’m allergic to peanuts. Does this contain nuts?', zh: '我对花生过敏，这个含坚果吗？', note: '过敏务必说清' },
    { term: '问价', native: 'How much is this?', zh: '这个多少钱？', note: '购物第一句' },
    { term: '讨价还价', native: 'Can you give me a better price?', zh: '能便宜一点吗？', note: '市场/夜市可用' },
    { term: '退税', native: 'Where can I get the tax refund?', zh: '在哪里办退税？', note: '机场退税柜台' },
    { term: '求助', native: 'Could you call a taxi for me?', zh: '能帮我叫辆出租车吗？', note: '酒店前台最常用' },
  ],
  sections: [
    {
      title: '机场：值机、转机、退税',
      intro: '机场表达的关键是「信息确认」：航班、行李、登机口。把这三个词说清楚，值机柜台 90% 的沟通就够了。',
      origin: '聚合 /travel 12 国 airport 场景页（日本/韩国/泰国/法国/意大利/越南/土耳其/西班牙/印度/波兰/德国/葡萄牙）',
      links: [
        { label: '日本 · 机场场景页', href: '/travel/japan/japan-airport', desc: '日语表达 + 罗马音' },
        { label: '韩国 · 机场场景页', href: '/travel/korea/korea-airport' },
        { label: '泰国 · 机场场景页', href: '/travel/thailand/thailand-airport' },
        { label: '法国 · 机场场景页', href: '/travel/france/france-airport' },
        { label: '意大利 · 机场场景页', href: '/travel/italy/italy-airport' },
        { label: '西班牙 · 机场场景页', href: '/travel/spain/spain-airport' },
        { label: '越南 · 机场场景页', href: '/travel/vietnam/vietnam-airport' },
        { label: '土耳其 · 机场场景页', href: '/travel/turkey/turkey-airport' },
      ],
      dialogue: {
        situation: '值机柜台',
        lines: [
          { zh: '早上好，我要值机，飞东京的航班。', en: 'Good morning. I’d like to check in for the flight to Tokyo.' },
          { zh: '这件行李托运，这个背包我随身带。', en: 'I’d like to check this suitcase and take this backpack as carry-on.' },
          { zh: '有靠窗的座位吗？', en: 'Is there a window seat available?' },
        ],
      },
    },
    {
      title: '酒店：入住、退房、加需求',
      intro: '「我有预订」是入住第一句。延迟退房、寄存行李这类小请求，一句 Could I… 就能礼貌搞定。',
      origin: '聚合 /travel 9 国 hotel 场景页（日本/韩国/泰国/法国/意大利/越南/土耳其/西班牙）',
      links: [
        { label: '日本 · 酒店场景页', href: '/travel/japan/japan-hotel' },
        { label: '韩国 · 酒店场景页', href: '/travel/korea/korea-hotel' },
        { label: '泰国 · 酒店场景页', href: '/travel/thailand/thailand-hotel' },
        { label: '法国 · 酒店场景页', href: '/travel/france/france-hotel' },
        { label: '意大利 · 酒店场景页', href: '/travel/italy/italy-hotel' },
        { label: '西班牙 · 酒店场景页', href: '/travel/spain/spain-hotel' },
      ],
      dialogue: {
        situation: '前台入住',
        lines: [
          { zh: '我有预订，名字是李。', en: 'I have a reservation under the name Li.' },
          { zh: '退房是中午十二点吗？可以延迟吗？', en: 'Is check-out at noon? Could I have a late check-out?' },
          { zh: '退房后能寄存一下行李吗？', en: 'Could I leave my luggage here after check-out?' },
        ],
      },
    },
    {
      title: '点餐：从进门到买单',
      intro: '点餐英语的核心不是菜名，是流程句：要菜单、点这个、加单、打包、买单。日本餐厅的完整礼仪版（用「すみません」举手示意、饭前饭后固定礼节）见下方场景页。',
      origin: '聚合 /travel 8 国 restaurant 场景页 + handoff/travel-batch-001（日本餐厅 10 句示范，运营产出）',
      links: [
        { label: '日本 · 餐厅场景页', href: '/travel/japan/japan-restaurant', desc: '10 句核心点餐日语' },
        { label: '韩国 · 餐厅场景页', href: '/travel/korea/korea-restaurant' },
        { label: '泰国 · 餐厅场景页', href: '/travel/thailand/thailand-restaurant' },
        { label: '法国 · 餐厅场景页', href: '/travel/france/france-restaurant' },
        { label: '意大利 · 餐厅场景页', href: '/travel/italy/italy-restaurant' },
        { label: '西班牙 · 餐厅场景页', href: '/travel/spain/spain-restaurant' },
        { label: '越南 · 餐厅场景页', href: '/travel/vietnam/vietnam-restaurant' },
        { label: '土耳其 · 餐厅场景页', href: '/travel/turkey/turkey-restaurant' },
      ],
      phrases: [
        { zh: '不好意思，点单（举手示意）', native: 'Excuse me, could we order?', note: '日本店：すみません（Sumimasen）' },
        { zh: '我要这个', native: 'I’ll have this one, please.', note: '指着菜单；日语：これをください（Kore o kudasai）' },
        { zh: '有什么推荐？', native: 'What do you recommend?', note: '日语：おすすめは何ですか' },
        { zh: '我有点过敏', native: 'I’m allergic to ___.', note: '日语：アレルギーがあります' },
        { zh: '打包带走', native: 'To go, please.', note: '日语：持ち帰りでお願いします' },
        { zh: '买单', native: 'Check, please.', note: '日语：お会計お願いします' },
      ],
      dialogue: {
        situation: '餐厅点餐',
        lines: [
          { zh: '有什么推荐吗？', en: 'What do you recommend?' },
          { zh: '我要这个套餐，不要辣。', en: 'I’ll have this set. Not spicy, please.' },
          { zh: '好吃！买单，谢谢。', en: 'Delicious! Check, please. Thank you.' },
        ],
      },
    },
    {
      title: '购物与砍价',
      intro: '购物三件套：问价、试穿/试用、退税。市场类场景加上一句礼貌砍价，比手势比划高效得多。',
      origin: '聚合 /travel 12 国 shopping 场景页',
      links: [
        { label: '日本 · 购物场景页', href: '/travel/japan/japan-shopping' },
        { label: '韩国 · 购物场景页', href: '/travel/korea/korea-shopping' },
        { label: '泰国 · 购物场景页', href: '/travel/thailand/thailand-shopping' },
        { label: '法国 · 购物场景页', href: '/travel/france/france-shopping' },
        { label: '西班牙 · 购物场景页', href: '/travel/spain/spain-shopping' },
        { label: '越南 · 购物场景页', href: '/travel/vietnam/vietnam-shopping' },
        { label: '德国 · 购物场景页', href: '/travel/germany/germany-shopping' },
      ],
    },
    {
      title: '交通与问路',
      intro: '地铁票怎么买、这趟车去不去机场、最近的站在哪——交通表达重在「确认」，出发前先确认，比坐错了再问省一半时间。',
      origin: '聚合 /travel 6 国 transport 场景页（日本/韩国/泰国/西班牙/土耳其/越南）',
      links: [
        { label: '日本 · 交通场景页', href: '/travel/japan/japan-transport' },
        { label: '韩国 · 交通场景页', href: '/travel/korea/korea-transport' },
        { label: '泰国 · 交通场景页', href: '/travel/thailand/thailand-transport' },
        { label: '西班牙 · 交通场景页', href: '/travel/spain/spain-transport' },
        { label: '土耳其 · 交通场景页', href: '/travel/turkey/turkey-transport' },
        { label: '越南 · 交通场景页', href: '/travel/vietnam/vietnam-transport' },
      ],
    },
    {
      title: '咖啡店与景点',
      intro: '法国/意大利的咖啡文化有独特的「吧台 vs 座位」价格差；景点门票、拍照表达也有固定句式。这两个子场景目前覆盖法国、意大利（cafe）与意大利（sightseeing）。',
      origin: '聚合 /travel cafe 场景（法国/意大利）+ sightseeing 场景（意大利）',
      links: [
        { label: '法国 · 咖啡店场景页', href: '/travel/france/france-cafe' },
        { label: '意大利 · 咖啡店场景页', href: '/travel/italy/italy-cafe' },
        { label: '意大利 · 观光场景页', href: '/travel/italy/italy-sightseeing' },
      ],
    },
  ],
  arenaLine: '旅行里同一句中文，三个 AI 谁翻得更地道？去擂台看看实时战绩。',
  toolCtaLabel: '把你的旅行句子放进翻译框试试 →',
  toolScenario: 'casual',
};

/* ───────────────────────── 商务 ───────────────────────── */

const business: SpeakScenario = {
  slug: 'business',
  name: '商务',
  nameEn: 'Business',
  h1: '商务英语怎么说：商务场景表达指南',
  title: '商务英语怎么说：邮件/会议/谈判高频表达指南 | 爱翻译',
  description:
    '商务英语高频表达指南：邮件开场与结尾、会议发言、进度汇报、谈判与跟进的礼貌句式与真实例句，商务翻译模式一键套用，爱翻译 AI 翻译工作台。',
  keywords: ['商务英语', '商务邮件', '会议英语', '商务翻译', '职场英语表达'],
  intro:
    '商务英语的要领不是「难词」，是「礼貌层级」：同一件事，对客户、对同事、对老板的说法完全不同。这一页按邮件、会议、汇报、谈判四个子场景给出可直接套用的句式，配合翻译框的「商务翻译」模式使用。',
  top10: [
    { term: '邮件开场', native: 'I hope this email finds you well.', zh: '见信好（邮件万能开场）。', note: '正式度高的开场' },
    { term: '说明来意', native: 'I’m writing to follow up on…', zh: '写这封邮件是想跟进一下……', note: '跟进事项第一句' },
    { term: '附件', native: 'Please find the proposal attached.', zh: '提案请见附件。', note: 'attached 后置更地道' },
    { term: '请求确认', native: 'Could you confirm by Friday?', zh: '能在周五前确认吗？', note: '给明确时限' },
    { term: '委婉不同意', native: 'I see your point, but I have a slightly different take.', zh: '我理解你的观点，但我的看法略有不同。', note: '先让步再转折' },
    { term: '会议主持', native: 'Let’s get started. Today we’ll cover three items.', zh: '我们开始吧，今天过三项议程。', note: '开场三件套' },
    { term: '请对方发言', native: 'Would you like to weigh in?', zh: '您怎么看/要不要说说您的意见？', note: '比 any thoughts 更正式' },
    { term: '进度汇报', native: 'We’re on track for the Q3 launch.', zh: '第三季度上线进度正常。', note: 'on track = 进度正常' },
    { term: '延期请求', native: 'Would it be possible to push the deadline back a week?', zh: '截止日期能否推迟一周？', note: '委婉请求句式' },
    { term: '邮件结尾', native: 'Looking forward to hearing from you. Best regards,', zh: '期待回复。此致敬礼，', note: '万能结尾组合' },
  ],
  sections: [
    {
      title: '商务邮件：开场、正文、结尾',
      intro: '邮件三段式：一句开场 → 说明来意（I’m writing to…）→ 明确行动项（Could you… by…）。收件人只关心两件事：你要什么、什么时候要。',
      origin: '静态编写（爱翻译内容组），例句对齐商务翻译模式 prompt 风格',
      dialogue: {
        situation: '跟进报价的邮件',
        lines: [
          { zh: '见信好。写这封邮件是想跟进上周发送的报价单。', en: 'I hope this email finds you well. I’m writing to follow up on the quotation we sent last week.' },
          { zh: '如需更多信息，请随时联系我。', en: 'Please don’t hesitate to reach out if you need any further details.' },
          { zh: '期待您的回复。', en: 'Looking forward to hearing from you.' },
        ],
      },
    },
    {
      title: '会议与讨论',
      intro: '会议英语重在「流程词」：开场 cover、推进 move on、收尾 wrap up。委婉表达（I’m afraid / That said…）比直接否定更容易推进共识。',
      origin: '静态编写（爱翻译内容组）',
      dialogue: {
        situation: '视频会议开场',
        lines: [
          { zh: '人齐了，我们开始吧。今天过三项：预算、排期、分工。', en: 'Everyone’s here, so let’s get started. Today we’ll cover three items: budget, timeline, and ownership.' },
          { zh: '这个话题我们下次再细聊，先往下走。', en: 'Let’s take this offline and move on for now.' },
          { zh: '会前我总结一下：三项都定了，我发会议纪要。', en: 'To wrap up: all three items are settled. I’ll send out the minutes.' },
        ],
      },
    },
    {
      title: '汇报与谈判',
      intro: '汇报用数据说话：on track / ahead of schedule / behind schedule 三个短语覆盖 90% 的进度状态。谈判多用条件句（If you can… then we can…），给对方留台阶。',
      origin: '静态编写（爱翻译内容组）',
      entries: [
        { term: '进度正常', native: 'We’re on track.', meaning: '汇报最常用的定心丸', translation: 'We’re on track.' },
        { term: '略有延迟', native: 'We’re slightly behind schedule because of…', meaning: '说延迟必带原因', translation: 'We’re slightly behind schedule.' },
        { term: '条件交换', native: 'If you can extend the term, we can adjust the price.', meaning: '谈判经典让步句式', translation: 'If you can extend the term, we can adjust the price.' },
        { term: '请示上限', native: 'What’s your budget range for this project?', meaning: '先问范围再报价', translation: 'What’s your budget range?' },
      ],
    },
    {
      title: '职场黑话破译（进阶）',
      intro: '中文职场有一套自己的「黑话」——画饼、甩锅、卷王。和海外同事协作时，知道这些词的英文对译能少踩很多坑。',
      origin: 'MemeEntry 职场标签词条（tags=职场，按 popularity 排序前 8）',
      entries: [
        { term: '画饼', meaning: '开空头支票', translation: 'Pie in the sky', example: 'The boss is serving pie in the sky again.', exampleZh: '老板又在画饼了。', tags: ['职场'], slug: 'huabing' },
        { term: '背锅', meaning: '替人承担责任', translation: 'Take the fall', example: 'I have to take the fall again.', exampleZh: '这次又是我背锅。', tags: ['职场'], slug: 'beiguo' },
        { term: '甩锅', meaning: '推卸责任', translation: 'Pass the buck', example: 'When things go wrong, he passes the buck.', exampleZh: '出事了就甩锅。', tags: ['职场'], slug: 'shuaiguo' },
        { term: '内卷', meaning: '同行过度竞争，付出多回报少', translation: 'Rat race', example: 'Even internships have become a rat race now.', exampleZh: '现在连实习都开始内卷了。', tags: ['职场'], slug: 'neijuan' },
        { term: '精神离职', meaning: '人在工位、心已离职', translation: 'Quiet quitting', example: 'I’m quiet quitting — I leave the moment the clock hits five.', exampleZh: '我已经精神离职了，到点就走。', tags: ['职场'], slug: 'jing-shen-li-zhi' },
        { term: '卷王', meaning: '拼命竞争、疯狂加班的人', translation: 'The grind king', example: 'The grind king in our team is at it again.', exampleZh: '组里那个卷王又加班到十一点。', tags: ['职场'], slug: 'juan-wang' },
        { term: '摸鱼', meaning: '上班偷懒', translation: 'Slacking off', example: 'Slacking off again — careful the boss does not catch you.', exampleZh: '又在摸鱼，小心被老板抓。', tags: ['职场'], slug: 'moyu' },
        { term: '35岁危机', meaning: '中年职场瓶颈', translation: 'The 35-year-old career cliff', example: 'Programmers all fear the 35-year-old career cliff.', exampleZh: '程序员都有35岁危机。', tags: ['职场'], slug: '35suiweiji' },
      ],
      links: [
        { label: '职场网络用语完整库（25 条）', href: '/meme/tag/%E8%81%8C%E5%9C%BA' },
        { label: '打工人', href: memeLink('dagongren', '打工人') },
        { label: '职场PUA', href: memeLink('zhichang-pua', '职场PUA') },
        { label: '提桶跑路', href: memeLink('titongpaolu', '提桶跑路') },
      ],
    },
  ],
  arenaLine: '商务合同句、邮件措辞——三个 AI 谁的译法更专业？擂台见分晓。',
  toolCtaLabel: '商务翻译模式已就绪，把文案贴进来 →',
  toolScenario: 'business',
};

/* ───────────────────────── 电商 ───────────────────────── */

const ecommerce: SpeakScenario = {
  slug: 'ecommerce',
  name: '电商',
  nameEn: 'E-commerce',
  h1: '电商英语怎么说：跨境电商表达指南',
  title: '电商英语怎么说：Listing/客服/营销文案表达指南 | 爱翻译',
  description:
    '跨境电商英语指南：产品标题、五点描述、A+ 页面、客服话术、营销文案的高频句式与真实例句，配合爱翻译电商工作台与 AI 翻译工具。',
  keywords: ['电商英语', '跨境电商', 'listing 翻译', '亚马逊英语', '客服英语话术'],
  intro:
    '跨境电商的英语不是「翻译」，是「改写」：标题要塞关键词、五点要短平快、客服要留证据。这一页按 Listing、客服、营销三个子场景给出可复用句式，再进电商工作台批量生产。',
  top10: [
    { term: '标题公式', native: 'Wireless Earbuds, Bluetooth 5.3, 36H Playtime, IPX7 Waterproof', zh: '品类词 + 核心参数 + 卖点堆叠', note: '标题不是句子，是搜索词' },
    { term: '卖点开头', native: 'UP TO 36 hours of playtime', zh: '续航长达 36 小时', note: 'UP TO + 数字开头最抓眼' },
    { term: '痛点场景', native: 'Say goodbye to tangled wires', zh: '告别缠成一团的线材', note: 'Say goodbye to 万能句' },
    { term: '售后承诺', native: '12-month worry-free warranty', zh: '12 个月无忧保修', note: 'worry-free 高频词' },
    { term: '客服开场', native: 'Thanks for reaching out! How can I help?', zh: '感谢联系！请问有什么可以帮您？', note: '响应快更要语气暖' },
    { term: '请求订单号', native: 'Could you provide your order number?', zh: '能提供一下订单号吗？', note: '客服第一问' },
    { term: '退款话术', native: 'You’re fully covered by our 30-day return policy.', zh: '您适用 30 天无理由退货。', note: '先给定心丸' },
    { term: '催评话术', native: 'Your feedback helps small shops like ours grow.', zh: '您的评价对小店成长很重要。', note: '合规且真诚' },
    { term: '促销文案', native: 'Limited-time offer: 20% off ends Sunday.', zh: '限时优惠：8 折周日截止。', note: '给截止日才有转化' },
    { term: '物流安抚', native: 'Your order is on the way and will arrive by Friday.', zh: '订单已发出，周五前送达。', note: '给确定时间' },
  ],
  sections: [
    {
      title: 'Listing：标题与五点描述',
      intro: '英文 Listing 的阅读逻辑是「扫」，不是「读」。标题堆关键词，五点每条一个卖点 + 一个场景，长度控制在 200 字符内。',
      origin: '静态编写（爱翻译内容组），对齐 /ecommerce 工作台生成规范',
      dialogue: {
        situation: '五点描述示例（无线耳机）',
        lines: [
          { zh: '续航长达 36 小时，充电 10 分钟听歌 2 小时。', en: 'UP TO 36 hours of playtime — 10-minute charge gives you 2 hours of listening.' },
          { zh: 'IPX7 防水，雨天跑步无忧。', en: 'IPX7 waterproof — sweat and rain are no problem for your runs.' },
          { zh: '蓝牙 5.3，连接稳定不掉线。', en: 'Bluetooth 5.3 keeps a rock-solid connection.' },
        ],
      },
    },
    {
      title: '客服话术：纠纷降温三步',
      intro: '跨境客服的黄金三步：共情（Sorry for the trouble）→ 行动（Here’s what I’ll do）→ 时间点（within 24 hours）。有纠纷时永远给出「下一步 + 时间」。',
      origin: '静态编写（爱翻译内容组）',
      dialogue: {
        situation: '物流投诉回复',
        lines: [
          { zh: '非常抱歉给您带来不便，我完全理解您的心情。', en: 'We’re so sorry for the inconvenience — I completely understand how frustrating this is.' },
          { zh: '我已为您加急处理，订单将在 48 小时内重新发出。', en: 'I’ve escalated your case: a replacement will ship within 48 hours.' },
          { zh: '处理完第一时间同步您。', en: 'I’ll keep you posted the moment it’s on its way.' },
        ],
      },
    },
    {
      title: '中文电商梗出海对照',
      intro: '中文电商话术里有一批「黑话」——种草、拔草、剁手、秒杀。做海外市场时，它们的英文对译直接影响文案地道度。',
      origin: 'MemeEntry 购物/消费标签词条',
      entries: [
        { term: '种草', meaning: '被推荐后想买', translation: 'Put (an item) on one’s wishlist / be sold on it', example: 'That video put the gadget on my wishlist.', exampleZh: '那条视频把我种草了。', tags: ['购物'], slug: 'zhongcao' },
        { term: '剁手', meaning: '忍不住买买买', translation: 'Splash out / go on a shopping spree', example: 'The sale made everyone go on a shopping spree.', exampleZh: '大促一来人人都剁手。', tags: ['购物'], slug: 'duoshou' },
        { term: '秒杀', meaning: '限时超低价抢购', translation: 'Lightning deal / flash sale', example: 'The flash sale sold out in minutes.', exampleZh: '秒杀几分钟就抢光了。', tags: ['购物'], slug: 'miaosha' },
        { term: '白嫖', meaning: '不花钱享受资源', translation: 'Freeload / get it for free', example: 'He freeloads on every free trial.', exampleZh: '所有免费试用他都要白嫖一遍。', tags: ['购物'], slug: 'baipiao' },
        { term: '月光族', meaning: '每月花光工资的人', translation: 'Living paycheck to paycheck', example: 'Living paycheck to paycheck, no savings at all.', exampleZh: '月光族一枚，毫无存款。', tags: ['购物'], slug: 'yueguangzu' },
        { term: '吃土', meaning: '购物后穷到吃土', translation: 'Broke after shopping', example: 'Double 11 left me eating dirt till payday.', exampleZh: '双十一过完穷到吃土。', tags: ['购物'], slug: 'chitu' },
      ],
      links: [
        { label: '跨境电商工作台（Listing 生成/翻译）', href: '/ecommerce' },
        { label: '购物类网络用语（10 条）', href: '/meme/tag/%E8%B4%AD%E7%89%A9' },
      ],
    },
  ],
  arenaLine: 'Listing 文案三个 AI 谁写得更像 native seller？去擂台投一票。',
  toolCtaLabel: '把 Listing 文案贴进翻译框 →',
  toolScenario: 'business',
};

/* ───────────────────────── 职场 ───────────────────────── */

const work: SpeakScenario = {
  slug: 'work',
  name: '职场',
  nameEn: 'Work',
  h1: '职场英语怎么说：职场场景表达指南',
  title: '职场英语怎么说：打工人黑话地道英文指南 | 爱翻译',
  description:
    '职场网络用语英译指南：打工人、社畜、摸鱼、画饼、甩锅、内卷、躺平、牛马等 25 条职场梗的地道英文说法与真实例句，和海外同事对齐零障碍。',
  keywords: ['职场英语', '打工人英文', '社畜英文', '摸鱼英文', '内卷英文', '职场黑话'],
  intro:
    '「我是打工人」怎么说才地道？不是 worker，是 Corporate slave / 9-to-5er。这一页聚合 25 条职场标签词条，从自嘲、摸鱼、内卷到离职，每个梗都配地道英文与真实例句——跨文化吐槽必备。',
  top10: [
    { term: '打工人', meaning: '上班族自嘲', translation: 'Corporate slave / 9-to-5er', example: 'Corporate slave, corporate soul.', exampleZh: '打工人，打工魂。', slug: 'dagongren', tags: ['职场'] },
    { term: '社畜', meaning: '被工作压榨的上班族', translation: 'Corporate drone', example: 'A corporate drone working till midnight.', exampleZh: '加班到深夜的社畜。', slug: 'shechu', tags: ['职场'] },
    { term: '摸鱼', meaning: '上班偷懒', translation: 'Slacking off', example: 'Slacking off again — careful the boss does not catch you.', exampleZh: '又在摸鱼，小心被老板抓。', slug: 'moyu', tags: ['职场'] },
    { term: '搬砖', meaning: '打工的戏称', translation: 'Grinding / working', example: 'Gotta go, back to the grind.', exampleZh: '不聊了，搬砖去了。', slug: 'banzhuan', tags: ['职场'] },
    { term: '996', meaning: '早9晚9一周6天', translation: '9-to-9, 6 days a week', example: 'Working 9-to-9 six days a week is brutal.', exampleZh: '996 真的熬人。', slug: '996', tags: ['职场'] },
    { term: '内卷', meaning: '过度竞争', translation: 'Rat race / involution', example: 'Even internships have become a rat race now.', exampleZh: '现在连实习都开始内卷了。', slug: 'neijuan', tags: ['职场'] },
    { term: '躺平', meaning: '放弃内卷，低欲望生活', translation: 'Lie flat', example: 'I’m done grinding — I’m going to lie flat.', exampleZh: '我不想卷了，我要躺平。', slug: 'tangping', tags: ['职场'] },
    { term: '画饼', meaning: '开空头支票', translation: 'Pie in the sky', example: 'The boss is serving pie in the sky again.', exampleZh: '老板又在画饼了。', slug: 'huabing', tags: ['职场'] },
    { term: '背锅', meaning: '替人承担责任', translation: 'Take the fall', example: 'I have to take the fall again.', exampleZh: '这次又是我背锅。', slug: 'beiguo', tags: ['职场'] },
    { term: '牛马', meaning: '被压榨的普通打工人', translation: 'Beasts of burden', example: 'Another day as a beast of burden begins.', exampleZh: '牛马的一天又开始了。', slug: 'niu-ma', tags: ['职场'] },
  ],
  sections: [
    {
      title: '自嘲与身份：打工人、社畜、牛马',
      intro: '中文职场自嘲的三件套，英文里全有对应梗——corporate slave 最贴近「打工人」的酸味，corporate drone 强调「被压榨的麻木」，beast of burden 则是牛马本身的直译梗。',
      origin: 'MemeEntry 词条（slug 已对照线上 sitemap 校验）',
      entries: [
        { term: '打工人', meaning: '上班族自嘲', translation: 'Corporate slave / 9-to-5er', example: 'Corporate slave, corporate soul.', exampleZh: '打工人，打工魂。', slug: 'dagongren' },
        { term: '社畜', meaning: '被工作压榨的上班族', translation: 'Corporate drone', example: 'A corporate drone working till midnight.', exampleZh: '加班到深夜的社畜。', slug: 'shechu' },
        { term: '牛马', meaning: '被压榨的普通打工人，多为自嘲', translation: 'Beasts of burden / corporate draft animals', example: 'Another day as a beast of burden begins.', exampleZh: '牛马的一天又开始了。', slug: 'niu-ma' },
        { term: '螺丝钉', meaning: '可有可无的小职员', translation: 'Cog in the machine', example: 'I am just a cog in the machine.', exampleZh: '我只是公司的一颗螺丝钉。', slug: 'luosiding' },
        { term: '工具人', meaning: '被利用的对象', translation: 'Being used / tool', example: 'Do not treat me like a tool.', exampleZh: '别把我当工具人。', slug: 'gongjuren' },
        { term: '天选打工人', meaning: '注定打工的命，自嘲', translation: 'The chosen one of the grind', example: 'Squeezing onto the metro at dawn — guess I’m the chosen one of the grind.', exampleZh: '早起挤地铁，天选打工人没跑了。', slug: 'tianxuan-dagongren' },
        { term: '班味', meaning: '被工作腌入味的气质', translation: 'That burnt-out 9-to-5 aura', example: 'The subway is full of commuters radiating that burnt-out 9-to-5 aura.', exampleZh: '地铁上全是班味十足的打工人。', slug: 'ban-wei' },
      ],
      links: [
        { label: '打工人词条', href: '/meme/dagongren' },
        { label: '社畜词条', href: '/meme/shechu' },
        { label: '牛马词条', href: '/meme/niu-ma' },
        { label: '班味词条', href: '/meme/ban-wei' },
      ],
    },
    {
      title: '状态与摸鱼：划水、摸鱼、精神离职',
      intro: '上班状态的鄙视链：摸鱼（偷懒）→ 划水（出工不出力）→ 精神离职（到点就走）。英文对应 slacking off / phoning it in / quiet quitting。',
      origin: 'MemeEntry 词条',
      entries: [
        { term: '摸鱼', meaning: '上班偷懒', translation: 'Slacking off', example: 'Slacking off again — careful the boss does not catch you.', exampleZh: '又在摸鱼，小心被老板抓。', slug: 'moyu' },
        { term: '划水', meaning: '出工不出力', translation: 'Phoning it in', example: 'He phoned it in the whole meeting.', exampleZh: '他开会全程划水。', slug: 'huashui' },
        { term: '精神离职', meaning: '人在工位、心已离职', translation: 'Quiet quitting', example: 'I’m quiet quitting — I leave the moment the clock hits five.', exampleZh: '我已经精神离职了，到点就走。', slug: 'jing-shen-li-zhi' },
        { term: '45度人生', meaning: '卷不动也躺不平', translation: 'The 45-degree life', example: 'Too tired to grind, too restless to lie flat — living the 45-degree life.', exampleZh: '卷不动也躺不平，就过 45 度人生吧。', slug: 'sishiwudu-rensheng' },
        { term: '搞钱', meaning: '一门心思赚钱', translation: 'Hustle for money / make that bread', example: 'Skip the ideals — first, let’s make that bread.', exampleZh: '别谈理想了，先搞钱。', slug: 'gao-qian' },
      ],
      links: [
        { label: '摸鱼词条', href: '/meme/moyu' },
        { label: '精神离职词条', href: '/meme/jing-shen-li-zhi' },
        { label: '搞钱词条', href: '/meme/gao-qian' },
      ],
    },
    {
      title: '文化批判：内卷、画饼、甩锅、PUA',
      intro: '批评职场文化的高频词：内卷（rat race）已成英文媒体引用词；画饼、甩锅、职场 PUA 则是吐槽老板的三板斧。',
      origin: 'MemeEntry 词条',
      entries: [
        { term: '内卷', meaning: '同行过度竞争，付出多回报少', translation: 'Rat race / involution', example: 'Even internships have become a rat race now.', exampleZh: '现在连实习都开始内卷了。', slug: 'neijuan' },
        { term: '卷王', meaning: '拼命竞争、疯狂加班的人', translation: 'The grind king', example: 'The grind king in our team is at it again, working till 11pm.', exampleZh: '组里那个卷王又加班到十一点。', slug: 'juan-wang' },
        { term: '画饼', meaning: '开空头支票', translation: 'Pie in the sky', example: 'The boss is serving pie in the sky again.', exampleZh: '老板又在画饼了。', slug: 'huabing' },
        { term: '甩锅', meaning: '推卸责任', translation: 'Pass the buck', example: 'When things go wrong, he passes the buck.', exampleZh: '出事了就甩锅。', slug: 'shuaiguo' },
        { term: '背锅', meaning: '替人承担责任', translation: 'Take the fall', example: 'I have to take the fall again.', exampleZh: '这次又是我背锅。', slug: 'beiguo' },
        { term: '职场PUA', meaning: '职场精神打压', translation: 'Workplace manipulation', example: 'The constant workplace manipulation is driving me nuts.', exampleZh: '天天被职场PUA，快抑郁了。', slug: 'zhichang-pua' },
        { term: '35岁危机', meaning: '中年职场瓶颈', translation: 'The 35-year-old career cliff', example: 'Programmers all fear the 35-year-old career cliff.', exampleZh: '程序员都有35岁危机。', slug: '35suiweiji' },
      ],
      links: [
        { label: '内卷词条', href: '/meme/neijuan' },
        { label: '画饼词条', href: '/meme/huabing' },
        { label: '职场PUA词条', href: '/meme/zhichang-pua' },
        { label: '职场 tag 全部词条', href: '/meme/tag/%E8%81%8C%E5%9C%BA' },
      ],
    },
    {
      title: '去留之间：躺平、提桶跑路、斜杠青年',
      intro: '离职文化梗：躺平是消极抵抗，提桶跑路是干脆走人，斜杠青年是主动多点开花。英文报道里 lie flat 已被直接引用。',
      origin: 'MemeEntry 词条 + /untranslatable/tang-ping（躺平文化词收录）',
      entries: [
        { term: '躺平', meaning: '放弃内卷，低欲望生活', translation: 'Lie flat', example: 'I’m done grinding — I’m going to lie flat.', exampleZh: '我不想卷了，我要躺平。', slug: 'tangping' },
        { term: '提桶跑路', meaning: '辞职走人', translation: 'Quit and bail', example: 'Could not take it anymore — quit and bailed.', exampleZh: '干不下去，提桶跑路了。', slug: 'titongpaolu' },
        { term: '斜杠青年', meaning: '多职业身份的自由工作者', translation: 'Slash youth / multi-hyphenate', example: 'Designer/blogger/barista — a true multi-hyphenate.', exampleZh: '她是设计师/博主/咖啡师，标准斜杠青年。', slug: 'xie-gang-qing-nian' },
        { term: '灵魂拷问', meaning: '直击本质的尖锐问题', translation: 'Soul-searching question', example: 'The interviewer’s soul-searching question left me speechless.', exampleZh: '面试官的灵魂拷问让我当场沉默。', slug: 'ling-hun-kao-wen' },
      ],
      links: [
        { label: '躺平词条', href: '/meme/tangping' },
        { label: '躺平（不可译文化词）', href: untrLink('tang-ping') },
        { label: '提桶跑路词条', href: '/meme/titongpaolu' },
        { label: '斜杠青年词条', href: '/meme/xie-gang-qing-nian' },
      ],
    },
    {
      title: '场景对话：周一早会',
      intro: '把词条串成对话——如何用英文优雅地表达「班味上身」。',
      origin: '爱翻译内容组基于词条例句改编',
      dialogue: {
        situation: '周一早会',
        lines: [
          { zh: '周末加了两天班，班味都腌进骨头里了。', en: 'Worked all weekend — my burnt-out 9-to-5 aura is marinated to the bone.' },
          { zh: '老板还在画饼，说年底有期权。', en: 'The boss keeps serving pie in the sky about year-end equity.' },
          { zh: '我已读乱回，先保住搞钱要紧。', en: 'I just nod along — making that bread comes first.' },
        ],
      },
      links: [{ label: '已读乱回词条', href: '/meme/yidu-luanhui' }],
    },
  ],
  arenaLine: '「画饼」翻译成 pie in the sky 还是 empty promises？去擂台看三个 AI 怎么译。',
  toolCtaLabel: '把你的职场句子放进翻译框试试 →',
  toolScenario: 'casual',
};

/* ───────────────────────── 社交 ───────────────────────── */

const social: SpeakScenario = {
  slug: 'social',
  name: '社交',
  nameEn: 'Social',
  h1: '社交英语怎么说：社交场景表达指南',
  title: '社交英语怎么说：社恐/社牛/搭子等社交梗地道英文指南 | 爱翻译',
  description:
    '社交网络用语英译指南：社死、社恐、社牛、尬聊、搭子、已读不回、无效社交等 17 条社交梗的地道英文说法与真实例句，看懂中国式社交。',
  keywords: ['社交英语', '社恐英文', '社死英文', '搭子英文', '已读不回英文', '社交梗'],
  intro:
    '中国式社交有一整套自带评价体系的词：社恐/社牛定义性格，搭子定义关系，已读不回/已读乱回定义边界。这一页聚合 17 条社交标签词条，配上地道英文——老外问起「什么叫搭子」直接甩这页。',
  top10: [
    { term: '社死', meaning: '当众出丑到想钻地缝', translation: 'Died of cringe', example: 'I called my boss by the wrong name at the annual party — died of cringe.', exampleZh: '在年会上叫错老板名字，当场社死。', slug: 'shesi', tags: ['社交'] },
    { term: '社恐', meaning: '社交恐惧症', translation: 'Socially anxious', example: 'I have social anxiety — I skip parties whenever I can.', exampleZh: '我是社恐，聚会能不去就不去。', slug: 'shekong', tags: ['社交'] },
    { term: '社牛', meaning: '自来熟，跟谁都聊得来', translation: 'Social butterfly', example: 'He is such a social butterfly, chatting with strangers for an hour.', exampleZh: '他社牛到跟陌生人聊一小时。', slug: 'sheniu', tags: ['社交'] },
    { term: '尬聊', meaning: '尴尬地聊天', translation: 'Awkward small talk', example: 'With strangers, it is just awkward small talk.', exampleZh: '跟不熟的人只能尬聊。', slug: 'galiao', tags: ['社交'] },
    { term: '搭子', meaning: '一起做某件事的伙伴', translation: 'Activity buddy', example: 'Looking for a lunch buddy to grab grub with.', exampleZh: '找个饭搭子一起干饭。', slug: 'da-zi', tags: ['社交'] },
    { term: '已读不回', meaning: '看到消息却不回复', translation: 'Left on read', example: 'It’s been three days and I’m still left on read.', exampleZh: '消息发出去三天了，还是已读不回。', slug: 'yidu-buhui', tags: ['社交'] },
    { term: '已读乱回', meaning: '敷衍式回应', translation: 'Read but replied with nonsense', example: 'He read my message but replied with total nonsense — clearly brushing me off.', exampleZh: '他消息已读乱回，明显在敷衍。', slug: 'yidu-luanhui', tags: ['社交'] },
    { term: '嘴替', meaning: '替别人说出心声的人', translation: 'My mouthpiece / says it for me', example: 'That comment is literally my mouthpiece.', exampleZh: '这条评论简直是我的嘴替。', slug: 'zuo-ti', tags: ['社交'] },
    { term: '显眼包', meaning: '爱出风头的人', translation: 'Attention seeker / the show-off', example: 'He’s the one attention seeker in the whole room.', exampleZh: '全场就他一个显眼包。', slug: 'xianyan-bao', tags: ['社交'] },
    { term: '无效社交', meaning: '毫无价值和收获的社交', translation: 'Pointless socializing', example: 'Rather than pointless socializing, I’d rather sleep.', exampleZh: '与其无效社交，不如回家睡觉。', slug: 'wu-xiao-shejiao', tags: ['社交'] },
  ],
  sections: [
    {
      title: '性格光谱：社恐 ↔ 社牛',
      intro: '社恐不是害羞，是「能线上绝不线下」；社牛也不是外向，是「见谁都能唠」。英文社交光谱里，socially anxious 到 social butterfly 正好两端。',
      origin: 'MemeEntry 词条',
      entries: [
        { term: '社恐', meaning: '社交恐惧症', translation: 'Socially anxious', example: 'I have social anxiety — I skip parties whenever I can.', exampleZh: '我是社恐，聚会能不去就不去。', slug: 'shekong' },
        { term: '社牛', meaning: '社交牛逼症，自来熟', translation: 'Social butterfly / born extrovert', example: 'He is such a social butterfly, chatting with strangers for an hour.', exampleZh: '他社牛到跟陌生人聊一小时。', slug: 'sheniu' },
        { term: '社牛症', meaning: '社交牛逼症', translation: 'Ultra-extrovert energy', example: 'He has ultra-extrovert energy — chats with anyone.', exampleZh: '他有社牛症，见谁都能聊。', slug: 'sheniuzheng' },
        { term: '社恐福音', meaning: '社恐的救星', translation: 'A blessing for the socially anxious', example: 'Ordering online is a blessing for the socially anxious.', exampleZh: '线上点餐是社恐福音。', slug: 'shekongfuyin' },
        { term: '尬聊', meaning: '尴尬地聊天', translation: 'Awkward small talk', example: 'With strangers, it is just awkward small talk.', exampleZh: '跟不熟的人只能尬聊。', slug: 'galiao' },
      ],
      links: [
        { label: '社恐词条', href: '/meme/shekong' },
        { label: '社牛词条', href: '/meme/sheniu' },
        { label: '社死（不可译文化词）', href: untrLink('social-death') },
      ],
    },
    {
      title: '线上社交礼仪：已读不回、已读乱回、嘴替',
      intro: '微信社交的边界感全靠回复方式表达：已读不回是冷暴力，已读乱回是敷衍，一条好评论就是嘴替。英文 social media 词汇正好一一对应。',
      origin: 'MemeEntry 词条',
      entries: [
        { term: '已读不回', meaning: '看到消息却不回复，社交冷暴力', translation: 'Left on read', example: 'It’s been three days and I’m still left on read.', exampleZh: '消息发出去三天了，还是已读不回。', slug: 'yidu-buhui' },
        { term: '已读乱回', meaning: '回复毫无关系的敷衍内容', translation: 'Read but replied with nonsense', example: 'He read my message but replied with total nonsense — clearly brushing me off.', exampleZh: '他消息已读乱回，明显在敷衍。', slug: 'yidu-luanhui' },
        { term: '嘴替', meaning: '替别人说出心声的人', translation: 'My mouthpiece / says it for me', example: 'That comment is literally my mouthpiece.', exampleZh: '这条评论简直是我的嘴替。', slug: 'zuo-ti' },
        { term: 'pyq', meaning: '朋友圈（拼音缩写）', translation: 'Moments (WeChat feed)', example: 'Check the photos he posted on Moments.', exampleZh: '看他在 pyq 晒的图。', slug: 'pyq' },
        { term: '双标', meaning: '对人对己两套标准', translation: 'Double standards', example: 'One standard for himself, another for everyone else — such double standards.', exampleZh: '他对自己一套标准对别人一套，太双标了。', slug: 'shuang-biao' },
        { term: '阴阳怪气', meaning: '话里带刺、含沙射影', translation: 'Sarcastic and snide', example: 'Stop being snide — just say it.', exampleZh: '别阴阳怪气的，有话直说。', slug: 'yinyangguaiqi' },
      ],
      links: [
        { label: '已读不回词条', href: '/meme/yidu-buhui' },
        { label: '嘴替词条', href: '/meme/zuo-ti' },
        { label: '阴阳怪气词条', href: '/meme/yinyangguaiqi' },
      ],
    },
    {
      title: '新关系命名学：搭子、老铁、铁子、姐妹',
      intro: '「搭子」是当代社交的精准轻关系——饭搭子、旅游搭子，各管一段。铁子/老铁是多年交情，姐妹早已泛化成 bestie。',
      origin: 'MemeEntry 词条',
      entries: [
        { term: '搭子', meaning: '一起做某件事的伙伴，如饭搭子、学习搭子', translation: 'Activity buddy', example: 'Looking for a lunch buddy to grab grub with.', exampleZh: '找个饭搭子一起干饭。', slug: 'da-zi' },
        { term: '老铁', meaning: '东北方言：铁哥们', translation: 'Bro / buddy', example: 'Bro, smash that like button!', exampleZh: '老铁们，双击666！', slug: 'laotie' },
        { term: '铁子', meaning: '铁哥们、好兄弟', translation: 'My bro / my ride-or-die', example: 'My bro, I’m counting on you for this.', exampleZh: '铁子，这事儿就拜托你了。', slug: 'tie-zi' },
        { term: '姐妹', meaning: '女性亲密称呼，泛化为 bestie', translation: 'Sis / Bestie', example: 'Sis, this outfit is way too cute!', exampleZh: '姐妹，这件衣服也太好看了吧！', slug: 'jie-mei' },
        { term: '家人们', meaning: '直播间对观众亲昵称呼', translation: 'Hey fam', example: 'Hey fam, this is a real bargain.', exampleZh: '家人们，这个真的便宜。', slug: 'jiarenmen' },
        { term: '老登', meaning: '对中老年男性的戏谑称呼', translation: 'Old geezer', example: 'Those old geezers are bossing everyone around again.', exampleZh: '这群老登又在指手画脚了。', slug: 'lao-deng' },
      ],
      links: [
        { label: '搭子词条', href: '/meme/da-zi' },
        { label: '老铁词条', href: '/meme/laotie' },
        { label: '家人们词条', href: '/meme/jiarenmen' },
        { label: '社交 tag 全部词条', href: '/meme/tag/%E7%A4%BE%E4%BA%A4' },
      ],
    },
    {
      title: '场景对话：群聊日常',
      intro: '把社交梗串进一段真实群聊。',
      origin: '爱翻译内容组基于词条例句改编',
      dialogue: {
        situation: '周末聚餐群聊',
        lines: [
          { zh: '找个饭搭子，周六火锅走起？', en: 'Looking for a hotpot buddy this Saturday?' },
          { zh: '社恐路过，但火锅可以。', en: 'Socially anxious here, but for hotpot I’ll make an exception.' },
          { zh: '你这嘴替发言我给满分。', en: 'That comment speaks for all of us — ten out of ten.' },
        ],
      },
    },
  ],
  arenaLine: '「搭子」译成 buddy 还是 partner？三个 AI 的答案去擂台对比。',
  toolCtaLabel: '把你的聊天记录放进翻译框试试 →',
  toolScenario: 'casual',
};

/* ───────────────────────── 恋爱 ───────────────────────── */

const dating: SpeakScenario = {
  slug: 'dating',
  name: '恋爱',
  nameEn: 'Dating',
  h1: '恋爱英语怎么说：恋爱场景表达指南',
  title: '恋爱英语怎么说：舔狗/海王/官宣等恋爱梗地道英文指南 | 爱翻译',
  description:
    '恋爱网络用语英译指南：舔狗、海王、备胎、官宣、撒狗粮、母胎solo、恋爱脑等 18 条恋爱梗的地道英文说法与真实例句，中英恋爱文化对照。',
  keywords: ['恋爱英语', '舔狗英文', '海王英文', '官宣英文', '恋爱梗', '恋爱 slang'],
  intro:
    '中文恋爱语境的高分辨率为全球罕见：海王/舔狗/备胎/养鱼精确划分了关系里的每个位置。这一页聚合 18 条恋爱标签词条 + 英文 dating slang 对照（ghosting、situationship 等），恋爱文化对照一站看全。',
  top10: [
    { term: '舔狗', meaning: '卑微讨好对方的人', translation: 'Simp / doormat', example: 'Stop being a simp.', exampleZh: '别再当舔狗了。', slug: 'tiangou', tags: ['恋爱'] },
    { term: '海王', meaning: '到处撩、广撒网的人', translation: 'Player / serial flirt', example: 'He is a total player, do not trust him.', exampleZh: '他就是个海王，别信他。', slug: 'haiwang', tags: ['恋爱'] },
    { term: '官宣', meaning: '正式公开恋情', translation: 'Go public / official announcement', example: 'They finally went public!', exampleZh: '他俩官宣了！', slug: 'guanxuan', tags: ['恋爱'] },
    { term: '撒狗粮', meaning: '情侣秀恩爱虐单身狗', translation: 'Couple flaunting (to singles)', example: 'My feed is full of couple posts again.', exampleZh: '朋友圈又被撒狗粮了。', slug: 'sagouliang', tags: ['恋爱'] },
    { term: '母胎solo', meaning: '从出生一直单身', translation: 'Single since birth', example: 'He has been single since birth for over 20 years.', exampleZh: '他母胎solo二十多年。', slug: 'mutai-solo', tags: ['恋爱'] },
    { term: '恋爱脑', meaning: '满脑子只有爱情', translation: 'Love-obsessed / lovestruck fool', example: 'Sis, stop being love-obsessed.', exampleZh: '别当恋爱脑了姐妹。', slug: 'lian-ainao', tags: ['恋爱'] },
    { term: '备胎', meaning: '恋爱中的替补人选', translation: 'Backup / benchwarmer', example: 'He is just my backup.', exampleZh: '他不过是我的备胎。', slug: 'beitai', tags: ['恋爱'] },
    { term: '养鱼', meaning: '同时吊着多个人', translation: 'Keeping options open', example: 'She is keeping multiple options open.', exampleZh: '她同时在养鱼。', slug: 'yangyu', tags: ['恋爱'] },
    { term: '网恋', meaning: '网上恋爱', translation: 'Online romance', example: 'Online romance is risky — meet in person with caution.', exampleZh: '网恋有风险，奔现需谨慎。', slug: 'wanglian', tags: ['恋爱'] },
    { term: '搭讪', meaning: '主动找人聊天', translation: 'Hit on / strike up a chat', example: 'He plucked up the courage to hit on her.', exampleZh: '他鼓起勇气去搭讪。', slug: 'dashan', tags: ['恋爱'] },
  ],
  sections: [
    {
      title: '关系位置图：舔狗、备胎、养鱼、海王',
      intro: '中文恋爱词的精髓是「位置学」：舔狗在最低位，备胎是替补席，养鱼是吊着别人，海王是同时钓一片。英文 dating slang 里 simp / benchwarmer / keeping options open / player 一一对应。',
      origin: 'MemeEntry 词条',
      entries: [
        { term: '舔狗', meaning: '卑微讨好对方的人', translation: 'Simp / doormat', example: 'Stop being a simp.', exampleZh: '别再当舔狗了。', slug: 'tiangou' },
        { term: '备胎', meaning: '恋爱中的替补人选', translation: 'Backup / benchwarmer', example: 'He is just my backup.', exampleZh: '他不过是我的备胎。', slug: 'beitai' },
        { term: '养鱼', meaning: '同时吊着多个人', translation: 'Keeping options open', example: 'She is keeping multiple options open.', exampleZh: '她同时在养鱼。', slug: 'yangyu' },
        { term: '海王', meaning: '到处撩、广撒网的人', translation: 'Player / serial flirt', example: 'He is a total player, do not trust him.', exampleZh: '他就是个海王，别信他。', slug: 'haiwang' },
        { term: '中央空调', meaning: '对谁都暖（多指渣男）', translation: 'Heater to everyone (a flirt)', example: 'He is warm to everyone — a classic flirt.', exampleZh: '他中央空调，对谁都好。', slug: 'zhongyangkongtiao' },
        { term: '渣男', meaning: '玩弄感情、不负责任的男人', translation: 'A trash guy / a player', example: 'Her ex is a complete trash guy.', exampleZh: '她前男友是个彻头彻尾的渣男。', slug: 'zha-nan' },
      ],
      links: [
        { label: '舔狗词条', href: '/meme/tiangou' },
        { label: '海王词条', href: '/meme/haiwang' },
        { label: '备胎词条', href: '/meme/beitai' },
      ],
    },
    {
      title: '秀恩爱光谱：官宣、撒狗粮、秀恩爱',
      intro: '从官宣（go public）到撒狗粮（couple flaunting），公开程度递增。英文 PDA（public display of affection）涵盖秀恩爱全场景。',
      origin: 'MemeEntry 词条',
      entries: [
        { term: '官宣', meaning: '正式公开（恋情等）', translation: 'Go public / official announcement', example: 'They finally went public!', exampleZh: '他俩官宣了！', slug: 'guanxuan' },
        { term: '秀恩爱', meaning: '公开晒甜蜜', translation: 'PDA / flaunt love', example: 'Stop with the PDA, you are feeding us dog food.', exampleZh: '别秀恩爱了，撒狗粮。', slug: 'xiuenai' },
        { term: '撒狗粮', meaning: '情侣秀恩爱虐单身狗', translation: 'Couple flaunting (to singles)', example: 'My feed is full of couple posts again.', exampleZh: '朋友圈又被撒狗粮了。', slug: 'sagouliang' },
        { term: 'kswl', meaning: '磕死我了（嗑CP）', translation: 'Shipping them to death', example: 'This pairing — shipping them to death!', exampleZh: '这CP互动 kswl！', slug: 'kswl' },
      ],
      links: [
        { label: '官宣词条', href: '/meme/guanxuan' },
        { label: '撒狗粮词条', href: '/meme/sagouliang' },
      ],
    },
    {
      title: '单身叙事：母胎solo、网恋、奔现、见光死',
      intro: '单身与网恋全流程词汇：母胎solo（single since birth）→ 网恋（online romance）→ 奔现（meet in person）→ 见光死（the meetup killed the fantasy）。',
      origin: 'MemeEntry 词条',
      entries: [
        { term: '母胎solo', meaning: '从出生一直单身', translation: 'Single since birth', example: 'He has been single since birth for over 20 years.', exampleZh: '他母胎solo二十多年。', slug: 'mutai-solo' },
        { term: '网恋', meaning: '网上恋爱', translation: 'Online romance', example: 'Online romance is risky — meet in person with caution.', exampleZh: '网恋有风险，奔现需谨慎。', slug: 'wanglian' },
        { term: '奔现', meaning: '网恋对象线下见面', translation: 'Meet in person (after online romance)', example: 'Their online romance worked out in person.', exampleZh: '他们奔现成功了。', slug: 'benxian' },
        { term: '见光死', meaning: '见面后幻想破灭', translation: 'The meetup killed the fantasy', example: 'The moment they met, the fantasy died.', exampleZh: '一奔现就见光死。', slug: 'jianguangsi' },
        { term: '恋爱脑', meaning: '满脑子只有爱情的人', translation: 'Love-obsessed / lovestruck fool', example: 'Sis, stop being love-obsessed.', exampleZh: '别当恋爱脑了姐妹。', slug: 'lian-ainao' },
        { term: '搭讪', meaning: '主动找人聊天', translation: 'Hit on / strike up a chat', example: 'He plucked up the courage to hit on her.', exampleZh: '他鼓起勇气去搭讪。', slug: 'dashan' },
        { term: '小奶狗', meaning: '奶萌黏人的年下男友类型', translation: 'A puppy-type boyfriend', example: 'She’s into the puppy-type boyfriend.', exampleZh: '她喜欢小奶狗类型的男朋友。', slug: 'xiao-nai-gou' },
        { term: '绿茶', meaning: '表面清纯实则心机的女生', translation: 'Two-faced sweetheart', example: 'She is such a two-faced sweetheart.', exampleZh: '她可真是个绿茶。', slug: 'lvcha' },
      ],
      links: [
        { label: '母胎solo词条', href: '/meme/mutai-solo' },
        { label: '恋爱脑词条', href: '/meme/lian-ainao' },
        { label: '恋爱 tag 全部词条', href: '/meme/tag/%E6%81%8B%E7%88%B1' },
      ],
    },
    {
      title: '英文 dating slang 对照（西式恋爱黑话）',
      intro: '英文世界也有一套自己的恋爱黑话：ghosting（玩消失）、situationship（暧昧不成名分）、soft launch（软官宣）。这些词条已收录在爱翻译网络用语库。',
      origin: 'MemeEntry 英文词条（lang=en，线上 sitemap 校验存在）',
      links: [
        { label: 'ghosting — 玩消失', href: '/meme/ghosting' },
        { label: 'situationship — 暧昧关系', href: '/meme/situationship' },
        { label: 'soft-launch — 软官宣', href: '/meme/soft-launch' },
        { label: 'hard-launch — 硬官宣', href: '/meme/hard-launch' },
        { label: 'talking-stage — 暧昧期', href: '/meme/talking-stage' },
        { label: 'breadcrumbing — 面包屑式吊人', href: '/meme/breadcrumbing' },
        { label: 'rizz — 魅力/撩人功力', href: '/meme/rizz' },
        { label: 'love-bombing — 爱情轰炸', href: '/meme/love-bombing' },
        { label: 'delulu — 迷之自信恋爱脑', href: '/meme/delulu' },
      ],
    },
    {
      title: '场景对话：朋友八卦时间',
      intro: '把恋爱梗串成一段真实八卦对话。',
      origin: '爱翻译内容组基于词条例句改编',
      dialogue: {
        situation: '闺蜜八卦',
        lines: [
          { zh: '她跟那个人还只是暧昧期，没官宣。', en: 'They’re still in the talking stage — not official yet.' },
          { zh: '他上周玩消失，这周又来点赞，什么操作？', en: 'He ghosted her last week and is liking her posts again this week — what’s his deal?' },
          { zh: '典型的养鱼，别当舔狗快跑。', en: 'Classic keeping-options-open. Stop being a simp and run.' },
        ],
      },
      links: [
        { label: 'ghosting 词条', href: '/meme/ghosting' },
        { label: 'talking-stage 词条', href: '/meme/talking-stage' },
      ],
    },
  ],
  arenaLine: '「舔狗」译成 simp 还是 doormat？三个 AI 的答案去擂台对比。',
  toolCtaLabel: '把你的聊天记录放进翻译框试试 →',
  toolScenario: 'casual',
};

/* ───────────────────────── 学习 ───────────────────────── */

const study: SpeakScenario = {
  slug: 'study',
  name: '学习',
  nameEn: 'Study',
  h1: '学习英语怎么说：学术场景表达指南',
  title: '学习英语怎么说：论文/课堂/考试学术表达指南 | 爱翻译',
  description:
    '学术英语表达指南：论文写作、课堂发言、文献阅读、留学考试的高频句式与真实例句，学术翻译模式一键套用，配合爱翻译 PDF/文档翻译工具。',
  keywords: ['学术英语', '论文英语', '留学英语', '学术翻译', '课堂英语表达'],
  intro:
    '学术英语的门槛不在词汇量，在「句式规范」：引述要标注、论证要 hedging、结论要留余地。这一页按论文写作、课堂讨论、文献阅读、备考四个子场景给出可直接套用的学术句式，配合「学术翻译」模式与 PDF 翻译工具使用。',
  top10: [
    { term: '论文引言', native: 'This paper aims to examine…', zh: '本文旨在探讨……', note: '引言万能开头' },
    { term: '文献引用', native: 'According to Smith (2023), …', zh: '根据 Smith（2023）的研究……', note: '作者年份制引用' },
    { term: '委婉论证', native: 'The results suggest that…', zh: '结果表明……', note: 'suggest 比 prove 更严谨' },
    { term: '对比转折', native: 'In contrast to previous studies, …', zh: '与已有研究不同……', note: '文献综述句式' },
    { term: '课堂提问', native: 'Could you elaborate on that point?', zh: '这一点能展开讲讲吗？', note: '比 what 更礼貌' },
    { term: '表达观点', native: 'From my perspective, …', zh: '在我看来……', note: '课堂发言缓冲句' },
    { term: '承认局限', native: 'This study has several limitations.', zh: '本研究存在若干局限。', note: '论文必备段落' },
    { term: '总结收尾', native: 'To sum up, the findings indicate…', zh: '总而言之，研究结果显示……', note: '结论段开头' },
    { term: '请求反馈', native: 'I’d appreciate your feedback on my draft.', zh: '欢迎对草稿提出意见。', note: '邮件礼貌句' },
    { term: '组会汇报', native: 'Here’s a quick update on my progress.', zh: '简单汇报一下我的进展。', note: '组会开场' },
  ],
  sections: [
    {
      title: '论文写作：从引言到结论',
      intro: '论文四段式句式库：引言（This paper aims to…）→ 方法（Data were collected via…）→ 结果（The results suggest…）→ 结论（To sum up…）。注意学术英语的 hedging 传统：suggest / indicate / appear to，慎用 prove。',
      origin: '静态编写（爱翻译内容组），对齐学术翻译模式 prompt 风格',
      dialogue: {
        situation: '论文摘要骨架',
        lines: [
          { zh: '本文旨在探讨短视频对青少年注意力的影响。', en: 'This paper aims to examine the impact of short-form videos on adolescent attention.' },
          { zh: '基于 500 份问卷数据，结果显示使用时长与注意力呈负相关。', en: 'Drawing on a survey of 500 respondents, the results suggest a negative correlation between screen time and attention span.' },
          { zh: '这些发现为数字素养教育提供了参考。', en: 'These findings offer implications for digital literacy education.' },
        ],
      },
    },
    {
      title: '课堂与组会：发言、提问、汇报',
      intro: '课堂英语的关键是「缓冲」：先用 From my perspective / I was wondering 缓冲，再说内容。组会汇报用 update 三件套：进展、问题、下一步。',
      origin: '静态编写（爱翻译内容组）',
      dialogue: {
        situation: '组会汇报',
        lines: [
          { zh: '简单汇报一下进展：数据清洗完成了 80%。', en: 'Here’s a quick update: data cleaning is 80% done.' },
          { zh: '遇到一个问题，想听听大家的建议。', en: 'I’ve hit a snag and would appreciate your input.' },
          { zh: '下周计划跑完第一轮实验。', en: 'Next week I plan to finish the first round of experiments.' },
        ],
      },
    },
    {
      title: '文献阅读工具链',
      intro: '读英文文献的最大瓶颈是速度：PDF 翻译保留排版对照读，AI 润色帮你把中文草稿改成学术腔，两者配合能省一半时间。',
      origin: '静态编写（爱翻译内容组）',
      links: [
        { label: 'PDF 翻译（保留排版双语对照）', href: '/tools/pdf-translator' },
        { label: 'Word/PPT 文档翻译', href: '/tools/doc-translator' },
        { label: 'AI 润色（学术腔优化）', href: '/tools/ai-polish' },
        { label: '网页翻译（文献页面直接译）', href: '/tools/web-translator' },
      ],
    },
    {
      title: '中文学习梗英译（学生党高频）',
      intro: '学生场景的中文梗：卷王、内卷、躺平……学术标签词条尚在扩充，但职场/生活类词条已覆盖大半学生高频表达。',
      origin: 'MemeEntry 词条（复用职场/生活标签）',
      entries: [
        { term: '卷王', meaning: '拼命竞争、疯狂学习的人', translation: 'The grind king', example: 'The grind king in our class studies till 1am.', exampleZh: '班里那个卷王学到凌晨一点。', tags: ['学习'], slug: 'juan-wang' },
        { term: '内卷', meaning: '过度竞争', translation: 'Rat race', example: 'Even internships have become a rat race now.', exampleZh: '现在连实习都开始内卷了。', tags: ['学习'], slug: 'neijuan' },
        { term: '躺平', meaning: '放弃竞争，低欲望生活', translation: 'Lie flat', example: 'I’m done grinding — I’m going to lie flat.', exampleZh: '我不想卷了，我要躺平。', tags: ['学习'], slug: 'tangping' },
        { term: '摸鱼', meaning: '该学习/工作时偷懒', translation: 'Slacking off', example: 'Slacking off again in the library?', exampleZh: '又在图书馆摸鱼？', tags: ['学习'], slug: 'moyu' },
        { term: '画饼', meaning: '开空头支票（导师画饼也常用）', translation: 'Pie in the sky', example: 'The advisor is serving pie in the sky again.', exampleZh: '导师又在画饼了。', tags: ['学习'], slug: 'huabing' },
      ],
      links: [
        { label: '成语俗语库（中英对照，含「有志者事竟成」等学习向）', href: '/idioms' },
        { label: '卷王词条', href: '/meme/juan-wang' },
        { label: '摸鱼词条', href: '/meme/moyu' },
      ],
    },
  ],
  arenaLine: '「学而不思则罔」三个 AI 谁译得更学术？擂台对比见分晓。',
  toolCtaLabel: '把你的论文段落贴进翻译框试试 →',
  toolScenario: 'academic',
};

export const SPEAK_SCENARIOS: SpeakScenario[] = [travel, business, ecommerce, work, social, dating, study];

export function getSpeakScenario(slug: string): SpeakScenario | undefined {
  return SPEAK_SCENARIOS.find((s) => s.slug === slug);
}
