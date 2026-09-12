import { memeData } from '../prisma/meme-data';
import { memeBatch001 } from '../prisma/meme-batch-001';
import { memeBatch002 } from '../prisma/meme-batch-002';
import { memeBatch003 } from '../prisma/meme-batch-003';
import { memeBatch004 } from '../prisma/meme-batch-004';
import { memeBatch005 } from '../prisma/meme-batch-005';

const all: any[] = [...(memeData as any[]), ...memeBatch001 as any[], ...memeBatch002 as any[], ...memeBatch003 as any[], ...memeBatch004 as any[], ...memeBatch005 as any[]];
const want = 'dagongren shechu moyu 996 007 banzhuan huashui luosiding gongjuren beiguo shuaiguo huabing zhichang-pua 35suiweiji titongpaolu ban-wei tianxuan-dagongren niu-ma gao-qian sishiwudu-rensheng juan-wang jing-shen-li-zhi ling-hun-kao-wen xie-gang-qing-nian neijuan tangping shesi pyq gangjing shekong sheniu galiao shekongfuyin sheniuzheng xianyan-bao zuo-ti qingxu-jiazhi yidu-luanhui yidu-buhui wu-xiao-shejiao da-zi tie-zi shuang-biao laotie jie-mei xiong-di-meng lao-deng za-zheng lvcha haiwang zhongyangkongtiao tiangou beitai yangyu guanxuan xiuenai sagouliang mutai-solo wanglian benxian jianguangsi lian-ainao dashan zha-nan xiao-nai-gou ghosting situationship breadcrumbing soft-launch hard-launch talking-stage delulu rizz love-bombing slow-fade orbiting stashing pocketing cushioning textlationship cuffing-season thirst-trap sneaky-link zombieing simp xswl yyds dbq zqsg u1s1 nsdd awsl gkd kswl fomo tl-dr 886 yinyangguaiqi jiarenmen'.split(/\s+/);
const byslug = new Map(all.map((m) => [m.slug, m]));
for (const s of want) {
  const m = byslug.get(s);
  if (!m) { console.log('NODATA ' + s); continue; }
  const ex = Array.isArray(m.examples) && m.examples[0] ? ` [ex] ${m.examples[0].en} / ${m.examples[0].zh}` : '';
  console.log(`${s} || ${m.term} || ${m.meaning} || ${m.translation}${ex}`);
}
