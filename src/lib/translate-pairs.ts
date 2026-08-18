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
{
    slug: 'thai-to-chinese',
    source: 'th', target: 'zh',
    sourceName: '泰语', targetName: '中文',
    title: '泰语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线泰语翻译成中文，泰国旅行问路点菜、泰餐厅菜单、泰剧字幕都能翻。爱翻译多模型 AI 对比，哪个译文更地道一目了然，长文口语都支持。',
    h1: '泰语翻译成中文 - 免费在线泰译中',
    intro: '曼谷夜市砍价、泰餐厅的冬阴功菜单、清迈寺庙的泰文告示——泰语翻译成中文，爱翻译帮你随手搞定。多模型对比，哪个 AI 译文更贴切一目了然，自由行全程不慌。',
    scenes: [
      { name: '泰国自由行', desc: '曼谷夜市砍价、寺庙告示、交通指引，泰语随手翻成中文。' },
      { name: '泰餐厅点菜', desc: '冬阴功、咖喱蟹菜单拿不准？辣度口味问明白再下单。' },
      { name: '追剧娱乐', desc: '泰剧、泰腐剧台词实时翻译，追更不等字幕组。' },
    ],
    examples: [
      { src: 'ขอถามหน่อยครับ ไปพระบรมมหาราชวังยังไงครับ', dst: '请问去大皇宫怎么走？' },
      { src: 'ขอต้มยำกุ้งไม่เผ็ดมากครับ', dst: '冬阴功汤请不要太辣。' },
      { src: 'ลดหน่อยได้ไหมครับ ผมงบจำกัด', dst: '能便宜一点吗？我预算有限。' },
    ],
  },
  {
    slug: 'vietnamese-to-chinese',
    source: 'vi', target: 'zh',
    sourceName: '越南语', targetName: '中文',
    title: '越南语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线越南语翻译成中文，越南工厂报价单、Shopee 买家消息、外贸邮件都能翻。爱翻译多模型 AI 对比，关键条款翻译不将就。',
    h1: '越南语翻译成中文 - 免费在线越译中',
    intro: '越南工厂的报价单、Shopee 越南站的买家消息、河内供应商的聊天记录——越南语翻译成中文是外贸人的日常。爱翻译多模型对比，报价条款、质检要求一字不差。',
    scenes: [
      { name: '外贸工厂', desc: '越南供应商报价单、质检报告翻成中文，条款看得明明白白。' },
      { name: '跨境电商', desc: 'Shopee 越南站买家消息、售后差评，客服回复效率翻倍。' },
      { name: '越南旅行', desc: '胡志明市、下龙湾的交通餐饮，出行处处用得上。' },
    ],
    examples: [
      { src: 'Đơn hàng của anh đã được xác nhận, chúng tôi sẽ giao hàng trong 3 ngày.', dst: '您的订单已确认，我们将在 3 天内发货。' },
      { src: 'Lô hàng này có 5% sản phẩm lỗi, đề nghị kiểm tra lại chất lượng.', dst: '这批货有 5% 的次品，请重新检查质量。' },
      { src: 'Cảm ơn anh đã hợp tác, hy vọng chúng ta hợp tác lâu dài.', dst: '感谢您的合作，希望我们长期合作。' },
    ],
  },
  {
    slug: 'turkish-to-chinese',
    source: 'tr', target: 'zh',
    sourceName: '土耳其语', targetName: '中文',
    title: '土耳其语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线土耳其语翻译成中文，伊斯坦布尔旅行、酒店邮件、大巴扎砍价都能翻。爱翻译多模型 AI 对比，译文准确自然，自由行不踩坑。',
    h1: '土耳其语翻译成中文 - 免费在线土译中',
    intro: '伊斯坦布尔的酒店确认邮件、大巴扎商户的报价、卡帕多奇亚热气球的预订说明——土耳其语翻译成中文，自由行一路畅通。爱翻译多模型对比，翻得准才敢下单。',
    scenes: [
      { name: '伊斯坦布尔自由行', desc: '酒店邮件、景点门票、电车指引，旅行不迷路。' },
      { name: '大巴扎购物', desc: '商户报价、砍价对话翻成中文，买得明明白白。' },
      { name: '卡帕多奇亚', desc: '热气球预订、洞穴酒店确认，重要行程翻译准确。' },
    ],
    examples: [
      { src: 'Odanız bugün saat 14:00\'ten itibaren hazır olacak.', dst: '您的房间从今天 14:00 起可以入住。' },
      { src: 'Bu fiyata biraz indirim yapabilir misiniz?', dst: '这个价格能便宜一点吗？' },
      { src: 'Sultanahmet Meydanı\'na gitmek istiyorum, taksi ücreti ne kadar?', dst: '我想去苏丹艾哈迈德广场，打车多少钱？' },
    ],
  },
  {
    slug: 'indonesian-to-chinese',
    source: 'id', target: 'zh',
    sourceName: '印尼语', targetName: '中文',
    title: '印尼语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线印尼语翻译成中文，东南亚电商客服、Lazada 产品描述、巴厘岛旅行都能翻。爱翻译多模型 AI 对比，跨境沟通零障碍。',
    h1: '印尼语翻译成中文 - 免费在线印尼译中',
    intro: '东南亚电商的印尼买家消息、Lazada 店铺差评、巴厘岛民宿的入住说明——印尼语翻译成中文，跨境卖家刚需。爱翻译多模型对比，客服回复不再靠猜。',
    scenes: [
      { name: '东南亚电商', desc: '印尼买家消息、订单纠纷翻成中文，客服不掉链子。' },
      { name: '外贸开发', desc: '印尼经销商往来邮件，东南亚市场开拓更顺畅。' },
      { name: '巴厘岛度假', desc: '民宿入住说明、出海活动确认，度假省心省力。' },
    ],
    examples: [
      { src: 'Pesanan Anda sudah kami kirim, nomor resi akan kami berikan lewat WhatsApp.', dst: '您的订单已发出，运单号会通过 WhatsApp 发给您。' },
      { src: 'Ukuran M sudah habis, yang tersisa hanya ukuran L dan XL.', dst: 'M 码已售罄，只剩 L 和 XL 码了。' },
      { src: 'Terima kasih atas pembelian Anda, semoga harimu menyenangkan.', dst: '感谢您的购买，祝您愉快。' },
    ],
  },
  {
    slug: 'italian-to-chinese',
    source: 'it', target: 'zh',
    sourceName: '意大利语', targetName: '中文',
    title: '意大利语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线意大利语翻译成中文，奢侈品邮件、意餐菜单、设计资料都能翻。爱翻译多模型 AI 对比，时尚语境翻得地道专业。',
    h1: '意大利语翻译成中文 - 免费在线意译中',
    intro: '奢侈品专柜的邮件、意大利餐厅的手写菜单、米兰设计周的资料——意大利语翻译成中文，爱翻译帮你拿捏时尚与专业。多模型对比，语境翻得地道。',
    scenes: [
      { name: '时尚购物', desc: '奢侈品专柜邮件、官网商品描述，潮流资讯看得懂。' },
      { name: '美食餐厅', desc: '意餐菜单、酒单翻成中文，点餐不踩雷。' },
      { name: '设计学习', desc: '米兰设计周资料、意文设计文档，专业表达准确翻译。' },
    ],
    examples: [
      { src: 'Il suo ordine è stato spedito e arriverà entro 5 giorni lavorativi.', dst: '您的订单已发货，将在 5 个工作日内送达。' },
      { src: 'Vorrei prenotare un tavolo per due persone per stasera.', dst: '我想预订一张今晚两人的餐桌。' },
      { src: 'Questo vino si abbina perfettamente ai piatti di pesce.', dst: '这款酒和海鲜菜肴非常搭。' },
    ],
  },
  {
    slug: 'greek-to-chinese',
    source: 'el', target: 'zh',
    sourceName: '希腊语', targetName: '中文',
    title: '希腊语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线希腊语翻译成中文，圣托里尼酒店预订、雅典景点说明、希腊菜单都能翻。爱翻译多模型 AI 对比，度假旅行更从容。',
    h1: '希腊语翻译成中文 - 免费在线希译中',
    intro: '圣托里尼的酒店预订、雅典卫城的门票说明、希腊餐厅的特色菜推荐——希腊语翻译成中文，度假攻略畅通无阻。爱翻译多模型对比，旅途信息翻得明白。',
    scenes: [
      { name: '圣托里尼度假', desc: '酒店预订确认、日落餐厅预约，浪漫旅程安排好。' },
      { name: '古迹参观', desc: '雅典卫城、德尔斐景点说明，历史背景看得懂。' },
      { name: '希腊美食', desc: '手写菜单、当地推荐菜，点餐不再靠猜。' },
    ],
    examples: [
      { src: 'Τι ώρα ανοίγει το μουσείο αύριο;', dst: '博物馆明天几点开门？' },
      { src: 'Θα ήθελα να κλείσω ένα δωμάτιο με θέα στο ηλιοβασίλεμα.', dst: '我想订一间能看日落的房间。' },
      { src: 'Μπορώ να δω το μενού, παρακαλώ;', dst: '请给我看一下菜单好吗？' },
    ],
  },
  {
    slug: 'dutch-to-chinese',
    source: 'nl', target: 'zh',
    sourceName: '荷兰语', targetName: '中文',
    title: '荷兰语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线荷兰语翻译成中文，鹿特丹物流单证、欧洲总部邮件、留学文件都能翻。爱翻译多模型 AI 对比，商务条款不马虎。',
    h1: '荷兰语翻译成中文 - 免费在线荷译中',
    intro: '鹿特丹港的物流单证、欧洲总部的商务邮件、荷兰留学的租房合同——荷兰语翻译成中文，跨境业务与留学生活都离不开。爱翻译多模型对比，条款细节不含糊。',
    scenes: [
      { name: '欧洲物流', desc: '鹿特丹港到港通知、清关单据，货物状态实时掌握。' },
      { name: '欧洲总部沟通', desc: '荷兰母公司邮件、会议纪要，商务表达准确得体。' },
      { name: '荷兰留学', desc: '学校邮件、租房合同、市政厅文件，留学生活更顺利。' },
    ],
    examples: [
      { src: 'De zending is aangekomen in de haven van Rotterdam en wacht op de douanecontrole.', dst: '货物已抵达鹿特丹港，正在等待海关查验。' },
      { src: 'Kunt u de factuur naar ons e-mailadres sturen?', dst: '您能把发票发到我们的邮箱吗？' },
      { src: 'We hebben uw offerte ontvangen en komen er volgende week op terug.', dst: '我们已收到您的报价，下周给您回复。' },
    ],
  },
  {
    slug: 'hindi-to-chinese',
    source: 'hi', target: 'zh',
    sourceName: '印地语', targetName: '中文',
    title: '印地语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线印地语翻译成中文，印度客户询盘、外包团队周报、电商评价都能翻。爱翻译多模型 AI 对比，开拓印度市场的好帮手。',
    h1: '印地语翻译成中文 - 免费在线印译中',
    intro: '印度客户的询盘、班加罗尔外包团队的项目周报、Flipkart 上的产品评价——印地语翻译成中文，开拓印度市场的第一步。爱翻译多模型对比，商务沟通更靠谱。',
    scenes: [
      { name: '印度市场开发', desc: '询盘、合同条款翻成中文，谈判心中有数。' },
      { name: 'IT 外包协作', desc: '班加罗尔团队周报、需求文档，项目沟通无障碍。' },
      { name: '电商运营', desc: 'Flipkart 产品评价、客服对话，印度店铺运营更顺手。' },
    ],
    examples: [
      { src: 'क्या आप हमें कल तक अपडेट भेज सकते हैं?', dst: '您能在明天之前给我们发更新吗？' },
      { src: 'हमारी टीम आपके प्रोजेक्ट पर काम कर रही है और शुक्रवार तक पूरा करेगी।', dst: '我们的团队正在做您的项目，周五前完成。' },
      { src: 'धन्यवाद, हम जल्द ही आपसे संपर्क करेंगे।', dst: '谢谢，我们会尽快联系您。' },
    ],
  },
  {
    slug: 'polish-to-chinese',
    source: 'pl', target: 'zh',
    sourceName: '波兰语', targetName: '中文',
    title: '波兰语翻译成中文 - 爱翻译 AI翻译',
    description: '免费在线波兰语翻译成中文，中欧贸易订单、Allegro 评价、物流通关文件都能翻。爱翻译多模型 AI 对比，生意往来更顺畅。',
    h1: '波兰语翻译成中文 - 免费在线波译中',
    intro: '波兰客户的订单邮件、Allegro 平台的产品评价、华沙物流园的通关文件——波兰语翻译成中文，做中欧贸易的必修课。爱翻译多模型对比，关键信息零误差。',
    scenes: [
      { name: '中欧贸易', desc: '波兰客户订单、付款条件邮件，生意往来更放心。' },
      { name: '跨境电商', desc: 'Allegro 平台评价、买家消息，波兰市场照单全收。' },
      { name: '物流通关', desc: '华沙清关文件、运输单据，流程进展心里有底。' },
    ],
    examples: [
      { src: 'Potwierdzamy zamówienie i przystępujemy do realizacji.', dst: '我们确认订单，开始安排生产。' },
      { src: 'Przesyłka została nadana i jest już w drodze do Polski.', dst: '包裹已寄出，正在发往波兰途中。' },
      { src: 'Prosimy o przesłanie dokumentów przewozowych przed odprawą celną.', dst: '请清关前发送运输单据。' },
    ],
  },
  {
    slug: 'chinese-to-thai',
    source: 'zh', target: 'th',
    sourceName: '中文', targetName: '泰语',
    title: '中文翻译成泰语 - 爱翻译 AI翻译',
    description: '免费在线中文翻译成泰语，泰国旅行点菜打车、酒店沟通、外贸往来都能翻。爱翻译多模型 AI 对比，泰语表达更地道自然。',
    h1: '中文翻译成泰语 - 泰国点单砍价不求人',
    intro: '去泰国自由行点菜、打车、砍价，只会中文也能玩转曼谷清迈——中文翻译成泰语，爱翻译帮你把话说到当地人心里。多模型对比，口语敬语按场景匹配，不翻出中式泰语腔。',
    scenes: [
      { name: '泰国自由行', desc: '点菜、打车、砍价，中文说出口，泰语翻到位。' },
      { name: '酒店沟通', desc: '提前入住、加床加被，礼貌泰语让服务更周到。' },
      { name: '外贸往来', desc: '给泰国客户发邮件、确认订单，商务用语得体。' },
    ],
    examples: [
      { src: '请问去大皇宫怎么走？', dst: 'ขอถามหน่อยครับ ไปพระบรมมหาราชวังยังไงครับ' },
      { src: '冬阴功汤请不要太辣。', dst: 'ต้มยำกุ้งขอไม่เผ็ดมากครับ' },
      { src: '能便宜一点吗？我第一次来泰国。', dst: 'ลดหน่อยได้ไหมครับ ผมมาประเทศไทยครั้งแรก' },
    ],
  },
  {
    slug: 'chinese-to-vietnamese',
    source: 'zh', target: 'vi',
    sourceName: '中文', targetName: '越南语',
    title: '中文翻译成越南语 - 爱翻译 AI翻译',
    description: '免费在线中文翻译成越南语，越南工厂沟通、给客户发报价、出差订酒店都能翻。爱翻译多模型 AI 对比，商务口语更得体。',
    h1: '中文翻译成越南语 - 越南工厂客户沟通无障碍',
    intro: '和越南工厂的每日沟通、给越南客户发报价、胡志明市出差订酒店——中文翻译成越南语，爱翻译帮你把每句话说到位。多模型对比，商务口语随场景切换。',
    scenes: [
      { name: '越南工厂沟通', desc: '生产进度、质检要求，指令传达准确无歧义。' },
      { name: '客户报价', desc: '中文报价单翻成越南语，商务邮件专业得体。' },
      { name: '越南出差', desc: '订酒店、打车、餐厅点单，日常交流顺畅。' },
    ],
    examples: [
      { src: '这款产品的最低起订量是多少？', dst: 'Số lượng đặt hàng tối thiểu của sản phẩm này là bao nhiêu ạ?' },
      { src: '货已发出，预计三天后到胡志明市。', dst: 'Hàng đã được gửi đi, dự kiến 3 ngày nữa sẽ đến Thành phố Hồ Chí Minh.' },
      { src: '感谢您的合作，希望我们长期合作。', dst: 'Cảm ơn anh đã hợp tác, hy vọng chúng ta hợp tác lâu dài.' },
    ],
  },
  {
    slug: 'chinese-to-turkish',
    source: 'zh', target: 'tr',
    sourceName: '中文', targetName: '土耳其语',
    title: '中文翻译成土耳其语 - 爱翻译 AI翻译',
    description: '免费在线中文翻译成土耳其语，土耳其旅行订酒店、和采购商谈价、跨境电商都能翻。爱翻译多模型 AI 对比，说出地道土耳其语。',
    h1: '中文翻译成土耳其语 - 土耳其旅行购物说地道',
    intro: '给伊斯坦布尔的房东发消息、和土耳其采购商谈价格、在格雷梅订热气球——中文翻译成土耳其语，爱翻译帮你用当地人的方式表达。多模型对比，生意旅行两不误。',
    scenes: [
      { name: '土耳其旅行', desc: '酒店沟通、景点问路、餐厅点餐，说一口地道土语。' },
      { name: '采购谈价', desc: '和大巴扎商户、工厂砍价谈条件，生意说得清楚。' },
      { name: '跨境电商', desc: '土耳其买家消息回复，客服沟通无障碍。' },
    ],
    examples: [
      { src: '请问去大巴扎怎么走？', dst: 'Kapalı Çarşı\'ya nasıl gidebilirim?' },
      { src: '这个商品可以寄到土耳其吗？', dst: 'Bu ürünü Türkiye\'ye gönderebilir misiniz?' },
      { src: '谢谢您的耐心解答。', dst: 'Sabrınız için teşekkür ederim.' },
    ],
  },
];

export function getPairBySlug(slug: string): TranslatePair | undefined {
  return TRANSLATE_PAIRS.find((p) => p.slug === slug);
}