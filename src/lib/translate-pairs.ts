/**
 * 语言对 SEO 页配置（P0：7 个高价值语言对）
 * 每页文案必须差异化（防近重复内容）：H1/首段/场景/示例句按语言对专属定制
 */
export interface TranslatePair {
  slug: string;            // URL 段：english-to-chinese
  source: string;          // 源语言代码
  target: string;          // 目标语言代码
  sourceName: string;      // 源语言名（中文）
  targetName: string;      // 目标语言名（中文）
  title: string;           // <title>
  description: string;     // meta description
  h1: string;              // 页面主标题
  intro: string;           // 首段说明（场景化，不能只换语言名）
  scenes: { name: string; desc: string }[]; // 2-3 个场景块
  examples: { src: string; dst: string }[]; // 2-3 条专属示例句
}

export const TRANSLATE_PAIRS: TranslatePair[] = [
  {
    slug: 'english-to-chinese',
    source: 'en', target: 'zh',
    sourceName: '英语', targetName: '中文',
    title: '英语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线英语翻译成中文，支持长文、网络梗、跨境电商 Listing。爱翻译基于 DeepSeek/GLM/Google 多模型对比，附真实译文盲测。',
    h1: '英语翻译成中文 - 免费在线英译中',
    intro: '跨境卖家回英文邮件、留学生读文献、刷生肉视频，英语翻译成中文的需求每天都在发生。爱翻译把 DeepSeek / GLM / Google 三个 AI 的译文并排给你，翻译质量高下立判。',
    scenes: [
      { name: '跨境电商', desc: '英文客户差评、售后邮件、产品描述翻译成中文，回复更精准。' },
      { name: '学习工作', desc: '英文论文摘要、合同条款、邮件往来，长文翻译更自然。' },
      { name: '娱乐日常', desc: '美剧台词、英文歌词、梗图，翻出中文的「味儿」。' },
    ],
    examples: [
      { src: 'This item arrived damaged, I\'d like a refund please.', dst: '这件商品到货时已经损坏，我想要退款。' },
      { src: 'He\'s been ghosting me for weeks, honestly I\'m done.', dst: '他鸽了我好几个星期，说真的我受够了。' },
      { src: 'Our new product line is a game-changer for home fitness.', dst: '我们的新产品线将彻底改变家庭健身市场。' },
    ],
  },
  {
    slug: 'chinese-to-english',
    source: 'zh', target: 'en',
    sourceName: '中文', targetName: '英语',
    title: '中文翻译成英语 - 爱翻译 AI翻译',
    description: '中文翻译成英语，AI 多模型对比选最地道表达。网络用语、职场黑话、电商文案都能翻，200+ 网络梗中英对照库。',
    h1: '中文翻译成英语 - 让表达地道起来',
    intro: '中文里「绝绝子」「格局打开」要怎么翻成英语？爱翻译不只是逐字翻译——先理解语境，再按商务、口语、学术、游戏等场景匹配最地道的英语表达，200+ 网络梗中英对照库随查随用。',
    scenes: [
      { name: '跨境电商', desc: '中文产品卖点翻译成英文 Listing，避开中式英语，突出卖点。' },
      { name: '职场沟通', desc: '中文邮件、汇报要点翻成英语，商务场景自动匹配正式得体语气。' },
      { name: '社交表达', desc: '中文热梗、日常口语翻成英语，交流不尴尬。' },
    ],
    examples: [
      { src: '这个产品性价比绝了。', dst: 'This product is an absolute steal for the price.' },
      { src: '老板画饼画得挺大。', dst: 'The boss is promising big things.' },
      { src: '咱们捋一捋这件事的优先级。', dst: 'Let\'s sort out the priorities here.' },
    ],
  },
  {
    slug: 'japanese-to-chinese',
    source: 'ja', target: 'zh',
    sourceName: '日语', targetName: '中文',
    title: '日语翻译成中文 - 爱翻译 AI翻译',
    description: '日语翻译成中文，支持日文合同、日漫台词、日企邮件。AI 翻译对比，帮你选最自然的中文表达。',
    h1: '日语翻译成中文 - 日漫日剧购物都能翻',
    intro: '日文合同看不懂、日漫生肉啃不动、日本亚马逊商品描述拿不准——日语翻译成中文的需求，交给爱翻译。多模型对比，译文地道程度看得见。',
    scenes: [
      { name: '日企工作', desc: '日文邮件、会议纪要、合同条款，正式书面语翻译更准确。' },
      { name: '日淘购物', desc: '日本亚马逊、乐天商品页，说明书翻译成中文再下单。' },
      { name: '娱乐追番', desc: '日漫台词、日剧字幕、歌词，翻出那个味儿。' },
    ],
    examples: [
      { src: 'ご注文ありがとうございます。まもなく発送いたします。', dst: '感谢您的订购，我们将尽快发货。' },
      { src: '承知しました、その方向で進めます。', dst: '明白了，就按这个方向推进。' },
      { src: 'この商品は数量限定となっております。', dst: '该商品为限量发售。' },
    ],
  },
  {
    slug: 'korean-to-chinese',
    source: 'ko', target: 'zh',
    sourceName: '韩语', targetName: '中文',
    title: '韩语翻译成中文 - 爱翻译 AI翻译',
    description: '韩语翻译成中文，韩剧台词、韩国购物、追星内容都能翻。多模型 AI 对比，翻译质量看得见。',
    h1: '韩语翻译成中文 - 追剧追星购物都安排上',
    intro: '韩剧台词、韩国免税店商品说明、爱豆物料——韩语翻译成中文，爱翻译帮你一键搞定。多模型对比，哪个 AI 翻得更自然一目了然。',
    scenes: [
      { name: '韩娱追星', desc: '韩剧字幕、综艺、爱豆访谈，实时翻译不等待。' },
      { name: '韩国购物', desc: '免税店、Gmarket、韩妆产品说明，成分功效看得懂。' },
      { name: '学习交流', desc: '韩语学习辅助、与韩国朋友聊天，翻译自然不机器。' },
    ],
    examples: [
      { src: '이 상품은 피부에 자극이 적어 민감성 피부에도 사용할 수 있습니다.', dst: '这款产品对皮肤刺激小，敏感肌也能使用。' },
      { src: '오늘도 수고했어요!', dst: '今天也辛苦啦！' },
      { src: '세일 기간 동안 30% 할인됩니다.', dst: '促销期间打七折。' },
    ],
  },
  {
    slug: 'french-to-chinese',
    source: 'fr', target: 'zh',
    sourceName: '法语', targetName: '中文',
    title: '法语翻译成中文 - 爱翻译 AI翻译',
    description: '法语翻译成中文，法文文档、奢侈品邮件、旅游用语。AI 翻译工作台，多模型对比选优。',
    h1: '法语翻译成中文 - 法语文档旅行都从容',
    intro: '奢侈品品牌的邮件、法餐厅菜单、巴黎旅行攻略——法语翻译成中文，爱翻译多模型对比，帮你选最准确自然的译法。',
    scenes: [
      { name: '时尚与购物', desc: '法文品牌邮件、商品描述、代购沟通，专业表达不乱翻。' },
      { name: '学习与工作', desc: '法文论文、商务文档、简历翻译，学术商务语境拿捏。' },
      { name: '旅行生活', desc: '餐厅菜单、交通指南、景点介绍，出行处处用得上。' },
    ],
    examples: [
      { src: 'Merci de bien vouloir nous confirmer votre commande.', dst: '请确认您的订单。' },
      { src: 'Ce produit est disponible en plusieurs coloris.', dst: '这款产品有多种颜色可选。' },
      { src: 'Où se trouve la station de métro la plus proche ?', dst: '最近的地铁站在哪里？' },
    ],
  },
  {
    slug: 'german-to-chinese',
    source: 'de', target: 'zh',
    sourceName: '德语', targetName: '中文',
    title: '德语翻译成中文 - 爱翻译 AI翻译',
    description: '德语翻译成中文，德国海淘、德文说明书、商务文档。多模型 AI 对比翻译，准确自然。',
    h1: '德语翻译成中文 - 海淘说明书都看懂',
    intro: '德国亚马逊的电器说明书、厨具锅具说明、德语商务邮件——德语翻译成中文，爱翻译帮你把长难句拆得明明白白。',
    scenes: [
      { name: '德国海淘', desc: '电器说明、产品参数、保修条款，德语说明书不再劝退。' },
      { name: '商务工作', desc: '德企邮件、合同、技术文档，严谨语体准确翻译。' },
      { name: '留学生活', desc: '德文文献、课程材料、租房合同，留学生活刚需。' },
    ],
    examples: [
      { src: 'Bitte bewahren Sie das Gerät an einem trockenen Ort auf.', dst: '请将设备存放在干燥处。' },
      { src: 'Die Lieferung erfolgt innerhalb von 3-5 Werktagen.', dst: '交货期为 3-5 个工作日。' },
      { src: 'Wir freuen uns auf eine gute Zusammenarbeit.', dst: '期待我们的良好合作。' },
    ],
  },
  {
    slug: 'russian-to-chinese',
    source: 'ru', target: 'zh',
    sourceName: '俄语', targetName: '中文',
    title: '俄语翻译成中文 - 爱翻译 AI翻译',
    description: '俄语翻译成中文，俄文合同、跨境电商俄语客服、外贸邮件。AI 多模型对比翻译。',
    h1: '俄语翻译成中文 - 外贸客服文档都搞定',
    intro: '跨境电商的俄语客服消息、外贸合同、俄文产品资料——俄语翻译成中文，爱翻译多模型对比，重要内容翻译不将就。',
    scenes: [
      { name: '跨境电商', desc: '俄语客服对话、买家消息、产品描述，沟通零障碍。' },
      { name: '外贸业务', desc: '俄文合同、报价单、往来邮件，关键条款翻译准确。' },
      { name: '商务出行', desc: '俄语资料、展会沟通、文件翻译，出差更从容。' },
    ],
    examples: [
      { src: 'Товар отправлен, трек-номер вышлем в течение дня.', dst: '商品已发出，运单号今天内发给您。' },
      { src: 'Просим уточнить условия оплаты.', dst: '请确认付款条件。' },
      { src: 'Спасибо за ваш заказ!', dst: '感谢您的订单！' },
    ],
  },
  {
    slug: 'chinese-to-japanese',
    source: 'zh', target: 'ja',
    sourceName: '中文', targetName: '日语',
    title: '中文翻译成日语 - 爱翻译 AI翻译',
    description: '中文翻译成日语，日本旅游订酒店、日企沟通、代购交流都能翻。AI 多模型对比，日语敬语口语按场景匹配。',
    h1: '中文翻译成日语 - 中文说得清，日语翻得对',
    intro: '去日本旅游订酒店、代购回复日本商家、日企和同事发邮件——中文翻译成日语，爱翻译帮你把话说到位。多模型对比，敬语、口语、书面语按场景匹配，不翻出生硬的中式日语。',
    scenes: [
      { name: '日本旅游', desc: '酒店预订邮件、餐厅预约、问路交流，翻出礼貌自然的日语。' },
      { name: '日企工作', desc: '中文邮件、会议要点翻成日语，商务敬语自动匹配，沟通不踩雷。' },
      { name: '代购交流', desc: '与日本商家、买手沟通，商品咨询、物流确认回复不再词穷。' },
    ],
    examples: [
      { src: '请问这家酒店还有空房吗？', dst: 'このホテルに空室はありますか。' },
      { src: '这个产品可以邮寄到中国吗？', dst: 'この商品は中国へ郵送できますか。' },
      { src: '非常感谢您的帮助！', dst: 'ご協力いただき、ありがとうございます！' },
    ],
  },
  {
    slug: 'chinese-to-korean',
    source: 'zh', target: 'ko',
    sourceName: '中文', targetName: '韩语',
    title: '中文翻译成韩语 - 爱翻译 AI翻译',
    description: '中文翻译成韩语，韩国旅游订民宿、代购沟通、追星交流都能翻。AI 多模型对比，韩语表达更地道。',
    h1: '中文翻译成韩语 - 沟通无国界',
    intro: '去韩国旅游订民宿、代购和韩国商家对接、给喜欢的爱豆留言——中文翻译成韩语，爱翻译帮你把心意准确送达。多模型对比，口语敬语随场景切换，不翻出翻译腔。',
    scenes: [
      { name: '韩国旅游', desc: '民宿预订、餐厅点单、问路交流，翻出当地人的说法。' },
      { name: '代购沟通', desc: '与韩国商家沟通商品、物流，往来回复效率翻倍。' },
      { name: '追星交流', desc: '给爱豆留言、翻译应援文案，心意准确传达。' },
    ],
    examples: [
      { src: '请问附近有地铁站吗？', dst: '근처에 지하철역이 있나요?' },
      { src: '这个商品可以打折吗？', dst: '이 상품은 할인 가능한가요?' },
      { src: '谢谢你的帮助！', dst: '도와주셔서 감사합니다!' },
    ],
  },
];

export function getPairBySlug(slug: string): TranslatePair | undefined {
  return TRANSLATE_PAIRS.find((p) => p.slug === slug);
}