import fs from 'fs';
const locs = JSON.parse(fs.readFileSync('.tmp-workerD/urls.json', 'utf8')).map((u) => u.replace('https://aifanyi.com', ''));
const candidates = [
  '/meme/xswl', '/meme/zqsg', '/meme/yyds', '/meme/dbq', '/meme/u1s1', '/meme/nsdd', '/meme/awsl', '/meme/gkd', '/meme/yysy', '/meme/bhs',
  '/meme/laotie', '/meme/tie-zi', '/meme/da-zi', '/meme/jie-mei', '/meme/xiong-di-meng', '/meme/lao-deng', '/meme/xiao-nai-gou', '/meme/za-zheng',
  '/untranslatable/elalem', '/untranslatable/atithi-devo-bhava', '/untranslatable/didi', '/untranslatable/omotenashi', '/untranslatable/honne-tatemae',
  '/meme/yidu-buhui', '/meme/yidu-luanhui', '/meme/wen-le', '/meme/dong-de-dou-dong', '/meme/yueguangzu', '/meme/chi-bao-liu-yi-jian',
  '/meme/tangping', '/meme/tang-ping', '/meme/neijuan', '/meme/na-ga-da', '/meme/xswl', '/meme/yygq', '/meme/yin-hun', '/meme/men-sao',
  '/meme/dagongren', '/meme/shechu', '/meme/moyu', '/meme/996', '/meme/007', '/meme/banzhuan', '/meme/huashui', '/meme/luosiding', '/meme/gongjuren',
  '/meme/beiguo', '/meme/shuaiguo', '/meme/huabing', '/meme/zhichang-pua', '/meme/35suiweiji', '/meme/titongpaolu', '/meme/ban-wei', '/meme/tianxuan-dagongren',
  '/meme/niu-ma', '/meme/gao-qian', '/meme/sishiwudu-rensheng', '/meme/juan-wang', '/meme/jing-shen-li-zhi', '/meme/ling-hun-kao-wen', '/meme/xie-gang-qing-nian',
  '/meme/shesi', '/meme/pyq', '/meme/gangjing', '/meme/shekong', '/meme/sheniu', '/meme/galiao', '/meme/shekongfuyin', '/meme/sheniuzheng', '/meme/xianyan-bao',
  '/meme/zuo-ti', '/meme/qingxu-jiazhi', '/meme/yidu-buhui', '/meme/wu-xiao-shejiao', '/meme/da-zi', '/meme/tie-zi', '/meme/shuang-biao',
  '/meme/lvcha', '/meme/haiwang', '/meme/zhongyangkongtiao', '/meme/tiangou', '/meme/beitai', '/meme/yangyu', '/meme/guanxuan', '/meme/xiuenai',
  '/meme/sagouliang', '/meme/mutai-solo', '/meme/wanglian', '/meme/benxian', '/meme/jianguangsi', '/meme/lian-ainao', '/meme/dashan', '/meme/zha-nan', '/meme/xiao-nai-gou',
  '/untranslatable/jiayou', '/untranslatable/social-death', '/untranslatable/nei-juan', '/untranslatable/tang-ping', '/untranslatable/zi-lai-shu',
];
const set = new Set(locs);
for (const c of candidates) console.log((set.has(c) ? 'OK  ' : 'MISS') + ' ' + c);
