import fs from "node:fs/promises"; import path from "node:path"; import sharp from "sharp";
const svgPath = path.resolve("public/icons/icon-maskable.svg");
const outDir = path.resolve("public/icons"); const sizes = [192,512];
const ensure = async p => fs.mkdir(p,{recursive:true}).catch(()=>{});
const run = async () => { await ensure(outDir); const svg = await fs.readFile(svgPath);
  await Promise.all(sizes.map(async s => { const png = path.join(outDir,`icon-${s}.png`);
    const buf = await sharp(svg).resize(s,s,{fit:"cover"}).png().toBuffer(); await fs.writeFile(png,buf); console.log("Generated",png); }));
}; run().catch(e=>{console.error(e);process.exit(1);});
