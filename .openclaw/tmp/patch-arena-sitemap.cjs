const fs = require("fs");
const p = "src/app/sitemaps/[group]/route.ts";
let s = fs.readFileSync(p, "utf8");
if (s.includes("/arena/")) { console.log("arena SKIP"); }
else {
  const anchor = "    // meme tag 聚合页（52 个）";
  const add = "    // 盲测擂台详情页（Arena，蓝图补缺项 ④）\n"
    + "    const blindtests = await prisma.blindtest.findMany({ where: { status: 'published' }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' } });\n"
    + "    for (const b of blindtests) entries.push({ loc: `${SITE_URL}/arena/${b.id}`, lastmod: b.createdAt });\n\n"
    + anchor;
  if (s.includes(anchor)) { fs.writeFileSync(p, s.replace(anchor, add), "utf8"); console.log("arena PATCHED"); }
  else console.log("arena MISS");
}
