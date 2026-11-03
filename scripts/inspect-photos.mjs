import sharp from 'sharp';
import exifr from 'exifr';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const folder = path.resolve('private/pixel-2026-11-03');
const files = (await readdir(folder)).filter(x=>/^PXL_.*\.jpg$/i.test(x)).sort();
const cells=[], manifest=[];
for (const [index,file] of files.entries()) {
  const input=path.join(folder,file);
  const metadata=await exifr.parse(input,{gps:true});
  const photo=await sharp(input).rotate().resize(230,180,{fit:'inside'}).jpeg().toBuffer({resolveWithObject:true});
  const label=Buffer.from(`<svg width="250" height="30"><text x="5" y="17" font-size="11" fill="#263d2a">${file.slice(4,23)}</text></svg>`);
  const left=(index%4)*250,top=Math.floor(index/4)*220;
  cells.push({input:photo.data,left:left+Math.floor((240-photo.info.width)/2),top},{input:label,left,top:top+185});
  manifest.push({file,width:metadata?.ExifImageWidth,height:metadata?.ExifImageHeight,capturedAt:metadata?.DateTimeOriginal,latitude:metadata?.latitude,longitude:metadata?.longitude,gpsAccuracy:metadata?.GPSHPositioningError,orientation:metadata?.Orientation});
}
await sharp({create:{width:1000,height:Math.ceil(files.length/4)*220,channels:3,background:'#eff1e9'}}).composite(cells).jpeg().toFile(path.join(folder,'contact-sheet.jpg'));
await writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({photos:files.length,gpsPhotos:manifest.filter(x=>Number.isFinite(x.latitude)).length,contactSheet:path.join(folder,'contact-sheet.jpg')}));
