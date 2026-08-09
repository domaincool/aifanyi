// 梗词条批量数据 #004（22 条）— 运营侧产出，2026-08-09（handoff 交接）
// 按分类缺口定向扩充（大笑/表态/方言/流行/感叹/性格/称呼/八卦/社会现象/游戏）
import type { MemeSeed } from './meme-data';

export const memeBatch004: MemeSeed[] = [
  { term: '笑yue了', slug: 'xiao-yue-le', meaning: '笑到呕吐的夸张说法，「笑yue了」=笑到不行。', translation: '"laughing so hard I could throw up"', examples: [{ zh: '这个段子让我笑yue了。', en: 'This meme has me laughing so hard I could throw up.' }], tags: ['大笑'], popularity: 45 },
  { term: '笑出猪叫', slug: 'xiao-chu-zhu-jiao', meaning: '笑得发出奇怪声音，夸张形容太好笑。', translation: '"laughing like a pig"', examples: [{ zh: '看他表情包我直接笑出猪叫。', en: 'His meme made me laugh like a pig.' }], tags: ['大笑'], popularity: 40 },
  { term: '稳了', slug: 'wen-le', meaning: '稳了，表示有把握、没问题。', translation: '"it\'s in the bag" / "locked in"', examples: [{ zh: '这把阵容稳了。', en: 'This lineup\'s got it in the bag.' }], tags: ['表态'], popularity: 50 },
  { term: '没毛病', slug: 'mei-mao-bing', meaning: '没毛病，完全正确、无懈可击。', translation: '"can\'t fault it" / "no complaints"', examples: [{ zh: '你说的没毛病。', en: 'What you said — can\'t fault it.' }], tags: ['表态'], popularity: 55 },
  { term: '安排', slug: 'an-pai', meaning: '「安排上了」的梗化用法，表示搞定、办妥。', translation: '"on it" / "consider it done"', examples: [{ zh: '这事我安排。', en: 'Consider it done — I\'m on it.' }], tags: ['表态'], popularity: 60 },
  { term: '巴适', slug: 'ba-shi', meaning: '四川方言，舒服、安逸、很好。', translation: '"comfy" / "top-notch" (Sichuan dialect)', examples: [{ zh: '这家火锅巴适得很。', en: 'This hotpot joint is proper comfy — Sichuan style.' }], tags: ['方言'], popularity: 55 },
  { term: '得嘞', slug: 'de-lei', meaning: '北京方言，行、好的、没问题。', translation: '"alrighty" / "you got it" (Beijing dialect)', examples: [{ zh: '得嘞，这就去办。', en: 'Alrighty, on it right away.' }], tags: ['方言'], popularity: 45 },
  { term: '咋整', slug: 'za-zheng', meaning: '东北方言，怎么办。', translation: '"what do we do?" (Northeastern dialect)', examples: [{ zh: '这咋整啊，票卖完了。', en: 'What do we do now — tickets are sold out.' }], tags: ['方言'], popularity: 45 },
  { term: '哈基米', slug: 'ha-ji-mi', meaning: '猫咪主题网络梗，源自足球运动员名字，用来喊猫。', translation: '"Hakimi" (the cat meme)', examples: [{ zh: '哈基米哈基米，这猫太可爱了。', en: 'Hakimi hakimi — this cat is too cute.' }], tags: ['流行'], popularity: 45 },
  { term: '吗喽', slug: 'ma-lou', meaning: '两广对猕猴的称呼，网络自嘲「我只是只小吗喽」。', translation: '"just a little macaque" (self-deprecating)', examples: [{ zh: '吗喽的命也是命啊。', en: 'Even a little macaque\'s life matters.' }], tags: ['流行'], popularity: 50 },
  { term: '卡皮巴拉', slug: 'ka-pi-ba-la', meaning: '水豚的谐音，情绪稳定的动物明星，代表「淡淡的佛系」。', translation: '"capybara" (the zen animal)', examples: [{ zh: '卡皮巴拉的精神状态，羡慕了。', en: 'That capybara state of mind — honestly jealous.' }], tags: ['流行'], popularity: 55 },
  { term: '救命啊', slug: 'jiu-ming-a', meaning: '夸张表达「受不了了、太好笑了」。', translation: '"help!" (I can\'t take it)', examples: [{ zh: '救命啊，这也太好笑了。', en: 'Help — this is way too funny.' }], tags: ['感叹'], popularity: 50 },
  { term: 'i人e人', slug: 'i-ren-e-ren', meaning: 'MBTI 网络梗：i人=内向，e人=外向。', translation: '"I-person vs E-person" (introvert vs extrovert)', examples: [{ zh: '我是i人，她是e人，她带我出门。', en: 'I\'m an I-person, she\'s an E-person — she drags me outside.' }], tags: ['性格'], popularity: 60 },
  { term: '高冷', slug: 'gao-leng', meaning: '高冷，高不可攀又冷淡，也指表面冷漠。', translation: '"cold and aloof"', examples: [{ zh: '他表面高冷，其实是个话痨。', en: 'He seems cold and aloof, but he\'s secretly a chatterbox.' }], tags: ['性格'], popularity: 50 },
  { term: '闷骚', slug: 'men-sao', meaning: '外表闷内心骚，暗戳戳的。', translation: '"quietly flirty" / "secretly spicy"', examples: [{ zh: '他平时闷骚，一喝酒就原形毕露。', en: 'He\'s quietly flirty — one drink and the truth comes out.' }], tags: ['性格'], popularity: 45 },
  { term: '宝子', slug: 'bao-zi', meaning: '「宝贝」的昵称化称呼，电商客服/博主常用。', translation: '"babe" / "sweetheart"', examples: [{ zh: '宝子，今天也要开心哦。', en: 'Stay happy today, babe.' }], tags: ['称呼'], popularity: 45 },
  { term: '辟谣', slug: 'pi-yao', meaning: '澄清谣言，八卦圈高频词。', translation: '"debunk" / "set the record straight"', examples: [{ zh: '工作室连夜辟谣。', en: 'The studio debunked it overnight.' }], tags: ['八卦'], popularity: 45 },
  { term: '数字游民', slug: 'shu-zi-you-min', meaning: '边旅行边远程工作的人。', translation: '"digital nomad"', examples: [{ zh: '巴厘岛全是数字游民。', en: 'Bali is full of digital nomads.' }], tags: ['社会现象'], popularity: 55 },
  { term: '空巢青年', slug: 'kong-chao-qing-nian', meaning: '独居在大城市的年轻人。', translation: '"empty-nest youth" (young adults living alone)', examples: [{ zh: '空巢青年的日常：一个人吃饭。', en: 'The empty-nest youth life: eating alone.' }], tags: ['社会现象'], popularity: 50 },
  { term: '开黑', slug: 'kai-hei', meaning: '组队打游戏。', translation: '"squad up" / "play together"', examples: [{ zh: '今晚开黑，五缺一。', en: 'Squad up tonight — need one more for five.' }], tags: ['游戏'], popularity: 55 },
  { term: '五杀', slug: 'wu-sha', meaning: '一局拿下五个人头，游戏高光时刻。', translation: '"pentakill"', examples: [{ zh: '他最后一波五杀翻盘。', en: 'His final pentakill turned the game around.' }], tags: ['游戏'], popularity: 50 },
  { term: '躺赢', slug: 'tang-ying', meaning: '躺着就赢了，靠队友带飞。', translation: '"win by doing nothing" / "carried to victory"', examples: [{ zh: '全程划水，最后躺赢。', en: 'Slacked the whole game, still got carried to victory.' }], tags: ['游戏'], popularity: 50 },
];
