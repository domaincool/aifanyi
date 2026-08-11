const fs = require('fs');

const entries = [
  // 大笑 3
  { term: '谢谢有被笑到', slug: 'xiexie-you-bei-xiao-dao', meaning: '用反讽语气表示"笑死我了"，常见于评论区。', translation: '"Thanks, I\'ve been sufficiently amused." / "Thanks for the laugh" (sarcastic)', examples: [{ zh: '这个视频太好笑了，谢谢有被笑到。', en: 'This video is hilarious — thanks, I\'ve been sufficiently amused.' }], tags: ['大笑', '反讽'], popularity: 45 },
  { term: '笑到打鸣', slug: 'xiao-dao-da-ming', meaning: '形容笑得像鸡叫一样夸张，根本停不下来。', translation: '"Laughing so hard I sound like a rooster" / cackling uncontrollably', examples: [{ zh: '你讲的段子让我笑到打鸣。', en: 'Your joke had me cackling like a rooster.' }], tags: ['大笑', '夸张'], popularity: 50 },
  { term: '笑拉了', slug: 'xiao-la-le', meaning: '笑得太厉害的夸张说法，"拉"表程度之深。', translation: '"Dying of laughter" / "LOL so hard"', examples: [{ zh: '看到他的表情包我直接笑拉了。', en: 'I saw his meme and literally died laughing.' }], tags: ['大笑', '网络'], popularity: 55 },
  // 方言 3
  { term: '那旮沓', slug: 'na-ga-da', meaning: '东北方言：那里、那个地方。', translation: '"Over there" / "that place" (Northeastern dialect)', examples: [{ zh: '咱那旮沓冬天老冷了。', en: 'It gets freezing cold over there in our neck of the woods.' }], tags: ['方言', '东北'], popularity: 45 },
  { term: '雄起', slug: 'xiong-qi', meaning: '四川方言：加油、振作、顶住，常用于比赛助威。', translation: '"Come on!" / "Rise up!" / "Hold strong!" (Sichuan dialect)', examples: [{ zh: '全场球迷齐喊：雄起！雄起！', en: 'The whole crowd chanted: "Rise up! Rise up!"' }], tags: ['方言', '四川', '加油'], popularity: 55 },
  { term: '饮茶先啦', slug: 'yin-cha-xian-la', meaning: '粤语网络梗：先喝杯茶吧，劝人放松别太拼。', translation: '"Let\'s have some tea first" (Cantonese meme — take it easy, don\'t work too hard)', examples: [{ zh: '打工而已，饮茶先啦！', en: 'It\'s just a job — let\'s have some tea first!' }], tags: ['方言', '粤语', '梗'], popularity: 50 },
  // 表态 2
  { term: '我站', slug: 'wo-zhan', meaning: '表示支持某一方观点或人物，"我站XX"=我支持XX。', translation: '"I\'m on XX\'s side" / "I\'m Team XX" / "I\'m with XX"', examples: [{ zh: '这次我站甲方，方案确实有问题。', en: 'This time I\'m on the client\'s side — the proposal really has issues.' }], tags: ['表态', '网络'], popularity: 45 },
  { term: '后排吃瓜', slug: 'hou-pai-chi-gua', meaning: '在讨论中不站队、围观看热闹。', translation: '"Watching from the back row with popcorn" / "just here for the drama"', examples: [{ zh: '前排别吵，我后排吃瓜。', en: 'Stop arguing up front — I\'m just watching from the back with popcorn.' }], tags: ['表态', '吃瓜'], popularity: 50 },
  // 感叹 2
  { term: '太真实了', slug: 'tai-zhen-shi-le', meaning: '强烈共鸣：说的就是我、太对了。', translation: '"So true" / "Too real" / "This hits home"', examples: [{ zh: '这段吐槽太真实了，简直是我本人。', en: 'This roast is too real — it\'s literally me.' }], tags: ['感叹', '共鸣'], popularity: 55 },
  { term: '绝了', slug: 'jue-le', meaning: '极度惊叹，可褒可贬（太绝了=太厉害了/太离谱了）。', translation: '"Unreal" / "Absolutely insane" / "Beyond words"', examples: [{ zh: '这操作绝了，我服了。', en: 'That move is absolutely insane — I bow to you.' }], tags: ['感叹', '网络'], popularity: 60 },
  // 称呼 2
  { term: '义父', slug: 'yi-fu', meaning: '网络梗：对帮助自己的人的最高敬意称呼（源自三国吕布）。', translation: '"Godfather" / "patron saint" (internet slang for someone who helps you big-time)', examples: [{ zh: '谢谢大佬带飞，从今天起你是我义父！', en: 'Thanks for carrying me, boss — from today you\'re my godfather!' }], tags: ['称呼', '梗'], popularity: 55 },
  { term: '姐妹', slug: 'jie-mei', meaning: '女性间的亲密称呼，现也泛化为平辈间亲切称呼。', translation: '"Sis" / "Bestie" / "Girl" (gender-neutral in internet usage)', examples: [{ zh: '姐妹，这件衣服也太好看了吧！', en: 'Sis, this outfit is way too cute!' }], tags: ['称呼', '网络'], popularity: 65 },
  // 流行 2
  { term: '活久见', slug: 'huo-jiu-jian', meaning: '"活久了什么都能见到"，表示罕见、离谱、大开眼界。', translation: '"You see everything if you live long enough" / "Now I\'ve seen it all"', examples: [{ zh: '两个顶流居然同台了，真是活久见。', en: 'Two top stars on the same stage — now I\'ve seen it all.' }], tags: ['流行', '感叹'], popularity: 55 },
  { term: '灵魂拷问', slug: 'ling-hun-kao-wen', meaning: '直击本质的尖锐问题，让人无法回避。', translation: '"Soul-searching question" / "a question that hits home hard"', examples: [{ zh: '面试官的灵魂拷问让我当场沉默。', en: 'The interviewer\'s soul-searching question left me speechless.' }], tags: ['流行', '职场'], popularity: 50 },
  // 八卦 2
  { term: '官宣', slug: 'guan-xuan', meaning: '官方宣布，最常用于明星公开恋情/婚讯。', translation: '"Official announcement" (often for celebrity relationships)', examples: [{ zh: '他俩终于官宣了，热搜直接爆了。', en: 'They finally made it official — the trending list exploded.' }], tags: ['八卦', '追星'], popularity: 60 },
  { term: '站姐', slug: 'zhan-jie', meaning: '专门跟拍特定明星并分享高质量饭拍图的粉丝站主。', translation: '"Fansite master" / "dedicated fan photographer"', examples: [{ zh: '这位站姐的图比官方还高清。', en: 'This fansite master\'s photos are sharper than the official ones.' }], tags: ['八卦', '追星'], popularity: 45 },
  // 社会现象 2
  { term: '全职儿女', slug: 'quan-zhi-er-nv', meaning: '放弃求职回家照顾父母，由父母支付"工资"的年轻人。', translation: '"Full-time son/daughter" — young adults who quit job hunting to care for parents and receive an "allowance" in return', examples: [{ zh: '他暂时做全职儿女，顺便准备考公。', en: 'He\'s a full-time son for now while prepping for the civil service exam.' }], tags: ['社会现象', '职场'], popularity: 50 },
  { term: '斜杠青年', slug: 'xie-gang-qing-nian', meaning: '同时拥有多个职业身份的自由工作者。', translation: '"Slash youth" / "multi-hyphenate" (someone juggling multiple careers)', examples: [{ zh: '她是设计师/博主/咖啡师，标准斜杠青年。', en: 'Designer/blogger/barista — a true multi-hyphenate.' }], tags: ['社会现象', '职场'], popularity: 55 },
  // 游戏 2
  { term: '上分', slug: 'shang-fen', meaning: '在竞技游戏中提升段位/排名。', translation: '"Rank up" / "climb the ladder" (gaming)', examples: [{ zh: '周末组队上分，目标王者。', en: 'Squad up this weekend to rank up — aiming for King rank.' }], tags: ['游戏', '竞技'], popularity: 60 },
  { term: '毒圈', slug: 'du-quan', meaning: '吃鸡类游戏中的缩圈区域，也泛指困境逼近。', translation: '"The zone" / "the circle" (battle royale) — also metaphor for impending trouble', examples: [{ zh: '毒圈来了，快往安全区跑！', en: 'The zone is closing — run for the safe area!' }], tags: ['游戏', '吃鸡'], popularity: 50 },
];

const output = `// 梗词条批量数据 #005（20 条）— 运营侧产出，2026-08-11
// 定向补最薄弱分类：大笑3/方言3/表态2/感叹2/称呼2/流行2/八卦2/社会现象2/游戏2
// 查重：运营线上验证 slug 404 零冲突；工程师入库闸门复查 term + 双 slug 风格
import type { MemeSeed } from './meme-data';

export const memeBatch005: MemeSeed[] = ${JSON.stringify(entries, null, 2)};
`;

fs.writeFileSync('prisma/meme-batch-005.ts', output, 'utf-8');
console.log('meme-batch-005.ts written, entries:', entries.length);
// 同时输出 JSON 供查重
fs.writeFileSync('scripts/meme-batch-005-data.json', JSON.stringify(entries), 'utf-8');
console.log('JSON data written');
