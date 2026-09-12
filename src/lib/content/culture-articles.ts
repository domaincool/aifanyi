/**
 * Explore 文化页静态内容（流量增长 V1.0 模板 F：/culture/[slug] 首批 3 篇）
 *
 * 数据来源协议（workerD-pages.md 同步说明）：
 * - 文章为本批新写（蓝图：/culture 是唯一「从零填内容」的栏目），内容遵循模板 F：
 *   一句话定义 + 高频误解 → 3-5 个文化子点（每点配语言现象实例）→ 文化冲突对话 ×2 → 工具 CTA。
 * - 所有内链 slug 已对照 2026-09-11 线上 sitemap content.xml 校验（0 坏链）；
 *   释义引用以 prisma 种子数据（meme-data / meme-batch-001~005）为准，未验证含义的 slug 不引用。
 * - 待运营深化项在 workerD-pages.md 中列明（如补充例句语料、扩充第 4/5 子点）。
 */

export interface CulturePoint {
  title: string; // 子点标题
  body: string; // 讲解
  examples: { label: string; text: string }[]; // 语言现象实例
  links?: { label: string; href: string }[]; // 站内真实词条内链
}

export interface CultureDialogue {
  situation: string;
  lines: { zh: string; en: string }[];
}

export interface CultureArticle {
  slug: string;
  h1: string; // 「{主题}：语言背后的文化」
  title: string; // SEO title
  description: string;
  keywords: string[];
  oneLiner: string; // 一句话定义（首屏快答）
  misconception: string; // 高频误解
  points: CulturePoint[]; // 3-5 个文化子点
  dialogues: CultureDialogue[]; // 文化冲突场景对话 ×2
  relatedLinks: { label: string; href: string; desc?: string }[]; // 栏目级内链
}

const wenzhang1: CultureArticle = {
  slug: 'why-so-many-chinese-internet-abbreviations',
  h1: '中文为什么有这么多网络缩写：语言背后的文化',
  title: '中文为什么有这么多网络缩写？xswl/yyds/gkd 的语言逻辑 | 爱翻译',
  description:
    '从 xswl 到 yyds：中文网络缩写为什么这么多？拼音效率、平台生态、圈层身份三层逻辑拆解，附高频缩写词条内链与地道英文对照。',
  keywords: ['网络缩写', 'xswl', 'yyds', '拼音缩写', '网络用语', '中国网络文化'],
  oneLiner:
    '中文网络缩写潮的本质是三股合力：拼音输入法的「首字母效率」、平台内容生态的「规避与过审」、以及圈层社交的「暗号身份」——缺一个都火不起来。',
  misconception:
    '常见误解有二：①「缩写纯粹为了打字快」——错，yyds 并不比「永远的神」短多少，效率解释不了它；②「缩写是年轻人把语言搞坏了」——语言每一代都在变，缩写在电报时代就是常态（电报按字收费），只是换了载体。',
  points: [
    {
      title: '子点一：拼音输入法的「首字母效率」',
      body: '中文输入靠拼音，常用词组的首字母组合天然成为快捷键：笑死我了 → xswl，对不起 → dbq，真情实感 → zqsg。这是缩写潮的物理基础——任何拼音输入法用户都无师自通这套编码。',
      examples: [
        { label: '效率型缩写', text: 'xswl（笑死我了）· dbq（对不起）· zqsg（真情实感）· gkd（搞快点）' },
        { label: '英文对照', text: '英语圈的 lol / brb / imo 是同一逻辑，但拼音缩写的还原歧义更大（见子点四）' },
      ],
      links: [
        { label: 'xswl 词条', href: '/meme/xswl' },
        { label: 'dbq 词条', href: '/meme/dbq' },
        { label: 'zqsg 词条', href: '/meme/zqsg' },
        { label: 'gkd 词条', href: '/meme/gkd' },
      ],
    },
    {
      title: '子点二：平台生态的「规避与过审」',
      body: '直播、弹幕、电商平台上，敏感词与广告词过滤是一套明规则。文字被过滤，用户就换写法：谐音、拆字、首字母。u1s1（有一说一）、awsl 这类变体在特定平台的火热，与平台的审核环境直接相关。缩写成了平台生态的「天气预报」。',
      examples: [
        { label: '规避型缩写', text: 'u1s1（有一说一，数字谐音混写）· awsl（啊我死了，回避平台对「死」的判定偏好）' },
        { label: '英文对照', text: '英文社区用 unalive 规避 dead/die 的算法降权——同一机制，不同语言' },
      ],
      links: [
        { label: 'u1s1 词条', href: '/meme/u1s1' },
        { label: 'awsl 词条', href: '/meme/awsl' },
      ],
    },
    {
      title: '子点三：圈层社交的「暗号身份」',
      body: '缩写最大的社交功能是划圈：看得懂 = 自己人。饭圈先造（yyds 源自电竞解说后泛化），大众跟进，出圈即「毕业」。缩写在圈内是效率，在圈外是门槛——这正是它作为身份标签的价值。',
      examples: [
        { label: '身份型缩写', text: 'yyds（永远的神）· nsdd（你说得对）· kswl（磕死我了，嗑CP圈专用）' },
        { label: '语言现象', text: '当一个缩写需要被「科普」时，说明它已经出圈——出圈后往往固化成新词' },
      ],
      links: [
        { label: 'yyds 词条', href: '/meme/yyds' },
        { label: 'nsdd 词条', href: '/meme/nsdd' },
        { label: 'kswl 词条', href: '/meme/kswl' },
      ],
    },
    {
      title: '子点四：中文音节结构的「解谜快感」',
      body: '中文同音字海量，一个 xswl 能还原出无数组合——这种歧义反而制造了解谜乐趣：猜缩写成了社区游戏。英语字母文字同形歧义远少于汉字，缩写还原基本唯一，解谜属性弱得多。这是中文缩写潮比英文更「上头」的结构性原因。',
      examples: [
        { label: '一形多义', text: 'awsl = 啊我死了（被萌到）= 啊我锁了（磕到了）——语境定含义' },
        { label: '英文对照', text: 'lol 几乎只有 laughing out loud 一个读法，猜谜空间小' },
      ],
      links: [{ label: 'awsl 词条', href: '/meme/awsl' }],
    },
    {
      title: '子点五：从缩写到新词——语言的「成词」闭环',
      body: '缩写一旦被主流媒体、品牌文案引用，就完成「出圈 → 固化 → 成词」三部曲：yyds 出现在官方海报里，nsdd 进了日常口语。语言从不「变坏」，只是在做新陈代谢——电报时代省字费，社交媒体时代省注意力，机制一模一样。',
      examples: [
        { label: '成词案例', text: 'yyds 被品牌广泛用作营销语 · xswl 进入热搜标题 · nbcs（nobody cares）反向从英语圈进入中文社区' },
        { label: '翻译视角', text: '向老外解释这些缩写，比解释「永远的神」三个字难得多——这正是文化翻译的价值' },
      ],
      links: [
        { label: 'nbcs 词条', href: '/meme/npc' },
        { label: '网络用语完整库', href: '/meme' },
      ],
    },
  ],
  dialogues: [
    {
      situation: '文化冲突 ×1：老外看中国群聊',
      lines: [
        { zh: '你们群聊我完全看不懂：xswl、nsdd、gkd……这是加密电报吗？', en: 'I can’t understand your group chat at all: xswl, nsdd, gkd… Is this coded telegram?' },
        { zh: '哈哈，是拼音首字母。xswl 就是笑死我了，英语大概等于 LMAO。', en: 'Haha, they’re pinyin initials. xswl means “laughing to death”, roughly like LMAO in English.' },
        { zh: '所以你们打字更快，但也更难学？', en: 'So you type faster, but it’s also harder to learn?' },
        { zh: '对，而且看懂缩写 = 自己人。这就是门槛的意义。', en: 'Exactly. And understanding the codes means you’re one of us — that’s the point of the gate.' },
      ],
    },
    {
      situation: '文化冲突 ×2：把缩写给 AI 翻',
      lines: [
        { zh: '「这个盲测 yyds，gkd 上车」——机器直译会翻成什么？', en: '“This blind test is yyds, gkd and join” — what would a literal machine translation make of it?' },
        { zh: '字面翻译会输出拼音和一串乱码，但懂网络用语的 AI 会译成：This blind test is god-tier, hurry up and join.', en: 'A literal translation outputs pinyin gibberish, but an AI that knows internet slang renders it: This blind test is god-tier, hurry up and join.' },
        { zh: '所以缩写翻译考的不是词汇，是文化。', en: 'So translating slang isn’t about vocabulary — it’s about culture.' },
      ],
    },
  ],
  relatedLinks: [
    { label: '网络用语翻译库（500+ 词条）', href: '/meme', desc: '按标签浏览全部网络用语' },
    { label: '看懂·缩写专区', href: '/understand/slang' },
    { label: 'AI 翻译擂台：缩写谁翻得最地道', href: '/arena' },
  ],
};

const wenzhang2: CultureArticle = {
  slug: 'chinese-vs-western-terms-of-address',
  h1: '东西方称呼文化差异：语言背后的文化',
  title: '东西方称呼文化差异：七大姑八大姨 vs 一个 aunt | 爱翻译',
  description:
    '为什么中文有七大姑八大姨，英语只有一个 aunt？从亲戚称谓分辨率、职场称呼、亲属泛化到敬语谦辞，拆解称呼背后的家庭结构与权力距离。',
  keywords: ['称呼文化', '亲戚称呼', '中西方文化差异', '亲属称谓', '敬语', '跨文化交际'],
  oneLiner:
    '中文称呼按「血缘 + 辈分 + 长幼」做高分辨率编码（姑妈/姨妈/舅妈各不相同），西方用 firstName + 泛化称谓做低分辨率覆盖（一个 aunt 打天下）——差异背后是家庭结构与权力距离的不同默认设置。',
  misconception:
    '两大误解：①「西方人不重视亲戚」——错，他们只是不把亲疏写进称谓，重视程度与编码分辨率无关；②「中文称谓更落后繁琐」——恰恰相反，高分辨率称谓自带「义务说明书」：叫一声舅妈，赡养与走动的亲疏预期就自动生效。',
  points: [
    {
      title: '子点一：亲戚称谓的分辨率差异',
      body: '中文把亲戚网络编成了精确坐标系：姑妈（父系姐妹）、姨妈（母系姐妹）、舅妈（舅舅之妻）、婶婶（叔叔之妻）——四个词在英语里统一叫 aunt；爷爷/外公在英语里都是 grandpa。高分辨率的意义在于「定位义务」：谁随份子、谁帮忙带孩子，称谓一出口就清楚了。',
      examples: [
        { label: '一对多', text: 'aunt = 姑妈/姨妈/舅妈/婶婶；uncle = 伯伯/叔叔/舅舅/姑父/姨父' },
        { label: '跨文化对照', text: '土耳其语 elalem（夫家亲属——婚姻附带的一整个关系网）、印地语 didi（妹妹/年长女性通称）都是英语无法直译的称谓坑' },
      ],
      links: [
        { label: 'elalem（土耳其·不可译称谓）', href: '/untranslatable/elalem' },
        { label: 'didi（印地·妹妹尊称）', href: '/untranslatable/didi' },
        { label: 'atithi-devo-bhava（梵语·待客之道）', href: '/untranslatable/atithi-devo-bhava' },
      ],
    },
    {
      title: '子点二：职场称呼——头衔系 vs 平等系',
      body: '中文职场默认「头衔 + 亲属泛化」：张总、李工、王老师、刘哥——职级与亲近度同时编码。西方职场默认直呼其名（first name），连对 CEO 也是。直接用中文逻辑直译称呼（Teacher Wang）是英语面试的经典翻车现场——正确说法是 Mr. Wang 或直接 Wang。',
      examples: [
        { label: '中文编码', text: '张总（职级）· 李工（职业）· 王老师（职业+敬称）· 刘哥（亲属泛化）' },
        { label: '英文对照', text: '统一 first name；需要敬称时用 Mr./Ms. + 姓，头衔只出现在正式场合' },
      ],
      links: [
        { label: '职场英语怎么说（Speak 场景页）', href: '/speak/work' },
        { label: '商务英语怎么说（Speak 场景页）', href: '/speak/business' },
      ],
    },
    {
      title: '子点三：亲属泛化——把陌生人拉进家谱',
      body: '中文可以把亲属词泛化到陌生人：快递小哥、服务员小姐姐、叔叔阿姨、家人们。这是「拟亲属称谓」——用家庭语感稀释陌生感。英语几乎不对陌生人用 uncle/auntie（除了对长辈熟人的 child-directed 用法），主播喊一声「Hey fam」已经是最接近的形态。',
      examples: [
        { label: '拟亲属称谓', text: '老铁（铁哥们 → 泛化朋友）· 姐妹（bestie 化，性别中立）· 家人们（主播对观众）· 老登（对中老年男性的戏谑）' },
        { label: '英文对照', text: 'bro / sis / fam 是英文里少数同类泛化，但适用面远窄于「哥/姐/家人们」' },
      ],
      links: [
        { label: '老铁词条', href: '/meme/laotie' },
        { label: '姐妹词条', href: '/meme/jie-mei' },
        { label: '家人们词条', href: '/meme/jiarenmen' },
        { label: '老登词条', href: '/meme/lao-deng' },
      ],
    },
    {
      title: '子点四：敬语与谦辞——中文的「礼貌坐标系」',
      body: '中文有一整套「抬对方、压自己」的敬谦系统：贵姓、府上、令郎 vs 鄙人、寒舍、犬子。这套系统在现代口语里简化了，但「您」与「你」的区分仍是日常礼貌的硬通货。东亚邻国走得更远：日语的表里文化、韩国的敬语阶位都是语言等级的显性化。',
      examples: [
        { label: '敬谦对', text: '贵姓？/ 免贵姓王 · 令郎真优秀 / 犬子不敢当' },
        { label: '日语对照', text: 'honne/tatemae（真心话与场面话）、omotenashi（不预设回报的服务之道）都是英语无对应词的文化概念' },
      ],
      links: [
        { label: 'honne-tatemae（日语·表与里）', href: '/untranslatable/honne-tatemae' },
        { label: 'omotenashi（日语·待客之心）', href: '/untranslatable/omotenashi' },
      ],
    },
    {
      title: '子点五：名字的社交信号——连名带姓是生气预警',
      body: '在中文语境里，被连名带姓地喊全名，大概率是老师点名或家长发火；喊「小王」「老李」是熟稔，喊「王工」「李老师」是职业尊重。西方语境里 full name 只是正式登记用，不携带情绪。翻译时丢了这层信号，人物关系就全变了味。',
      examples: [
        { label: '中文信号链', text: '王伟（点名/生气）→ 小王（前辈对后辈）→ 老王（平辈熟络）→ 王老师/王工（职业尊重）→ 王总（职级）' },
        { label: '翻译视角', text: '小说英译时「老王」译成 Old Wang 会引发年龄误解——老≠old，是熟络前缀' },
      ],
      links: [{ label: '称呼类词条标签：称呼', href: '/meme/tag/%E7%A7%B0%E5%91%BC' }],
    },
  ],
  dialogues: [
    {
      situation: '文化冲突 ×1：家谱翻译事故',
      lines: [
        { zh: '我妈让我转告二姨，让她跟三舅妈说一声聚会改期。', en: 'Mom asked me to tell second aunt to let third uncle’s wife know the reunion is postponed.' },
        { zh: '等等……second aunt 是你妈妈的姐姐还是爸爸的姐姐？third uncle’s wife 又是谁的嫂子？', en: 'Wait… is “second aunt” mom’s sister or dad’s sister? And whose wife is “third uncle’s wife”?' },
        { zh: '中文一个词就解决了：二姨、三舅妈。', en: 'In Chinese it’s one word each: èryí (maternal aunt), sān jiùmā (wife of mother’s third brother).' },
        { zh: '所以中文称谓自带家谱，英语称谓自带猜测。', en: 'So Chinese kinship terms come with a built-in family tree, while English ones come with guesswork.' },
      ],
    },
    {
      situation: '文化冲突 ×2：职场称呼翻车',
      lines: [
        { zh: '面试时我叫面试官 Teacher Zhang，气氛突然尴尬了。', en: 'I called the interviewer “Teacher Zhang” and the room went awkward.' },
        { zh: '英语里“Teacher+姓”不是称呼，是描述职业。直接说 Mr. Zhang 或者您好就行。', en: 'In English “Teacher + surname” isn’t an address form — it’s a job description. Just say Mr. Zhang or hello.' },
        { zh: '但在国内叫「张老师」是尊称，真拿不准就叫张总。', en: 'But in China “张老师” is an honorific. When unsure, “张总” works too.' },
        { zh: '同一句话，两套礼貌系统。', en: 'Same sentence, two different politeness systems.' },
      ],
    },
  ],
  relatedLinks: [
    { label: '不可直译的词（193 个文化词）', href: '/untranslatable' },
    { label: '语言与文化栏目', href: '/culture' },
    { label: '生活场景表达（42 篇）', href: '/life' },
  ],
};

const wenzhang3: CultureArticle = {
  slug: 'chinese-euphemism-guide',
  h1: '中式委婉语图鉴：语言背后的文化',
  title: '中式委婉语图鉴：「再说吧」到底是不是「不行」？| 爱翻译',
  description:
    '「再说吧」「我考虑一下」「原则上可以」到底是什么意思？拆解中文委婉语的留白逻辑：拒绝、金钱、职场、互联网四大场景对照英文表达，看懂弦外之音。',
  keywords: ['中式委婉语', '再说吧什么意思', '高语境文化', '弦外之音', '职场黑话', '跨文化交际'],
  oneLiner:
    '中式委婉语的核心不是「不直说」，而是「把结论留给语境」：说者给线索，听者自己补全——这是高语境文化（high-context）的典型沟通协议，同一段对话，中文 listeners 默认自动补全，英文 listeners 默认字面理解。',
  misconception:
    '两大误解：①「委婉 = 虚伪」——委婉是留体面，留的是双方退路；②「只有中文委婉」——英语同样有 pass away、I’m afraid、Let’s take this offline，只是中文的留白密度更高、需要补全的场合更细。',
  points: [
    {
      title: '子点一：拒绝的留白——「再说吧」的语法',
      body: '中文拒绝有一套渐进光谱：「再说吧」→「最近有点忙」→「下次一定」→「我看一下日程」，热度递减，含义都指向「不」。英语的拒绝同样委婉（I’ll pass / Maybe another time），但更接近明确的 decline；中文的「下次一定」字面上是承诺，语境里是告别。',
      examples: [
        { label: '留白拒绝', text: '「再说吧」（= 不）·「下次一定」（= 大概率没有下次）·「我回去考虑一下」（= 已经拒绝了）' },
        { label: '英文对照', text: 'I’ll take a rain check（改天吧）在英文里仍保留「真会改期」的可能，留白程度低于「下次一定」' },
      ],
      links: [
        { label: '已读不回（数字时代的留白拒绝）', href: '/meme/yidu-buhui' },
        { label: '已读乱回（敷衍式回应）', href: '/meme/yidu-luanhui' },
      ],
    },
    {
      title: '子点二：金钱话题——「还行」的模糊艺术',
      body: '中文谈钱默认模糊处理：工资「还行」= 谈不了细节；红包「意思意思」= 金额是心意不是价格；请客「随便点」= 有预算上限但要给面子。英语文化谈钱直接得多（salary expectation 是面试标准题），直译中文的「还行」会让对方以为真是可接受的数字。',
      examples: [
        { label: '金钱留白', text: '「还行」（不评价）·「意思意思」（心意 > 金额）·「随便点」（请客的排场面子）' },
        { label: '翻译视角', text: '面试被问期望薪资，回答 It’s okay 会被视为回避——该给区间给区间，中文的模糊在这里必须破' },
      ],
      links: [
        { label: '职场英语怎么说（Speak 场景页）', href: '/speak/work' },
        { label: '月光族（金钱自嘲词条）', href: '/meme/yueguangzu' },
      ],
    },
    {
      title: '子点三：职场委婉——「原则上可以」的潜台词',
      body: '职场中文的留白已经发展成一门显学：「原则上可以」= 有条件的不行；「再想想」= 没戏；「你很有想法」= 别折腾了；「画饼」则是老板级委婉的集中体现——愿景说得具体，兑现遥遥无期。英文职场用 I’m afraid / That’s a bit tricky 表达同类意思，但潜台词密度远低于中文。',
      examples: [
        { label: '职场黑话', text: '「原则上可以」（= 不行）·「再研究研究」（= 缓办）·「画饼」（= pie in the sky）·「灵魂拷问」（= 直击要害的问题）' },
        { label: '英文对照', text: 'Quiet quitting（精神离职）这类词被英文直接吸收——中文职场文化反向输出' },
      ],
      links: [
        { label: '画饼词条', href: '/meme/huabing' },
        { label: '阴阳怪气词条', href: '/meme/yinyangguaiqi' },
        { label: '精神离职词条', href: '/meme/jing-shen-li-zhi' },
      ],
    },
    {
      title: '子点四：生死与疾病——最庄重的留白',
      body: '中文对生死话题的委婉分层最密：「走了 / 没了 / 去世 / 百年之后 / 驾鹤西去」，正式度递增；医院里家属之间用「情况不太好」代替确诊名词。英语同样有 pass away / at rest，但中文的忌讳层级更多、使用场合更敏感——翻译讣告类文本时，died 与 passed away 的选择就是文体的选择。',
      examples: [
        { label: '委婉分层', text: '走了（口语）→ 去世（通用）→ 逝世（书面）→ 与世长辞（正式）' },
        { label: '英文对照', text: 'pass away（通用委婉）→ pass（口语）→ at rest / departed（书面）' },
      ],
      links: [{ label: '成语俗语·中英对照（如「入乡随俗」等敬谦表达）', href: '/idioms/shi-de-qi-fan' }],
    },
    {
      title: '子点五：互联网时代的委婉新形态',
      body: '社交媒体把委婉语推向新维度：已读不回（留白拒绝的数字形态）、阴阳怪气（反讽式委婉，「好棒棒哦」）、发疯文学（用夸张表演绕开直说）。委婉没有消失，只是从语气层迁移到了「行为层」——不回复本身就是回复。',
      examples: [
        { label: '数字委婉', text: '已读不回（沉默即答案）· 阴阳怪气（夸奖式批评）· 「哈哈哈哈」（四个哈以下都可能是敷衍）' },
        { label: '英文对照', text: '英语圈 similarly 有 left on read / sarcastic clapback——机制相同，密度不同' },
      ],
      links: [
        { label: '阴阳怪气词条', href: '/meme/yinyangguaiqi' },
        { label: '社交英语怎么说（Speak 场景页）', href: '/speak/social' },
      ],
    },
  ],
  dialogues: [
    {
      situation: '文化冲突 ×1：饭局邀约',
      lines: [
        { zh: '周六聚会来不来？', en: 'Are you coming to the party on Saturday?' },
        { zh: '哎呀，最近有点忙，再说吧，下次一定！', en: 'Ah, I’ve been swamped lately. Let’s play it by ear — next time for sure!' },
        { zh: '（外国同事小声）所以他是来还是不来？在我听来他答应了。', en: 'A foreign colleague whispers: So is he coming or not? The way I heard it, he said yes.' },
        { zh: '（中国同事）他的意思是：不来了。下次一定 = 没有下次。', en: 'The Chinese colleague: He means no. “Next time for sure” = there is no next time.' },
      ],
    },
    {
      situation: '文化冲突 ×2：面试谈薪',
      lines: [
        { zh: '您现在的薪资是多少？', en: 'What’s your current salary?' },
        { zh: '还行吧，跟行业平均水平差不多。', en: 'It’s okay, roughly in line with the industry average.' },
        { zh: '（外国面试官困惑）okay 是具体多少？我需要一个数字来做 offer。', en: 'The interviewer is puzzled: “Okay” is how much exactly? I need a number to build an offer.' },
        { zh: '中文的「还行」是在给双方台阶，但跨文化场景要直接给区间：25k–30k。', en: 'Chinese “还行” saves face for both sides, but across cultures you must give a range: 25k–30k.' },
      ],
    },
  ],
  relatedLinks: [
    { label: '社交网络用语库', href: '/meme' },
    { label: '语言与文化栏目', href: '/culture' },
    { label: '图片翻译：看不懂的菜单/路牌直接拍', href: '/tools/image-translator' },
    { label: '网页翻译：外文网页一键对照', href: '/tools/web-translator' },
  ],
};

export const CULTURE_ARTICLES: CultureArticle[] = [wenzhang1, wenzhang2, wenzhang3];

export function getCultureArticle(slug: string): CultureArticle | undefined {
  return CULTURE_ARTICLES.find((a) => a.slug === slug);
}
