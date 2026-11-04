import {createHash} from 'node:crypto';
const mediaPath = /^\/api\/media\/([a-f0-9-]{36})$/;
function checkImage(url, assets, identity, label, sourceUrl, sourceHashes) {
  const match = typeof url === 'string' && mediaPath.exec(url);
  if (!match) throw new Error(`${label}: cloud image reference missing`);
  const asset = assets.get(match[1]);
  if (!asset || asset.mode !== identity.mode || asset.generation !== identity.generation || !asset.approved || !['image/jpeg','image/png','image/webp'].includes(asset.mime))
    throw new Error(`${label}: approved workspace image unavailable`);
  if(sourceUrl && (!sourceHashes?.has(sourceUrl) || sourceHashes.get(sourceUrl)!==asset.sha256))
    throw new Error(`${label}: image does not match the expected source`);
}
function checkPair(source, migrated, assets, identity, label, sourceHashes) {
  if (!migrated) throw new Error(`${label}: evidence missing`);
  checkImage(migrated.image, assets, identity, label + ' original',source.image,sourceHashes);
  if (source.samImage && !migrated.samImage) throw new Error(`${label}: SAM image missing`);
  if (migrated.samImage) checkImage(migrated.samImage, assets, identity, label + ' SAM',source.samImage,sourceHashes);
}
export function verifyMigratedObservation(source, record, assets, sourceHashes) {
  if (!record?.observation || record.mode !== 'live' || record.generation !== 0 || record.observation.id !== source.id)
    throw new Error(`${source.id}: migrated observation identity mismatch`);
  const migrated = record.observation;
  checkPair(source, migrated, assets, record, source.id,sourceHashes);
  if (source.submission || migrated.submission) checkImage(migrated.submission?.photo, assets, record, source.id + ' submission',source.submission?.photo,sourceHashes);
  const evidence = migrated.caseEvidence || [];
  if (new Set(evidence.map(e => e.id)).size !== evidence.length) throw new Error(`${source.id}: duplicate case evidence`);
  for (const expected of source.caseEvidence || []) {
    checkPair(expected, evidence.find(e => e.id === expected.id), assets, record, source.id + '/' + expected.id,sourceHashes);
  }
  // Validate additional evidence retained from later cloud edits as well.
  for (const actual of evidence) checkPair({}, actual, assets, record, source.id + '/' + actual.id,sourceHashes);
}
export function verifyMigratedCase(source, record, assets, sourceHashes) {
  if (!record || record.caseId !== source.caseId || record.mode !== 'live' || record.generation !== 0)
    throw new Error(`${source.caseId}: migrated case identity mismatch`);
  checkImage(record.submission?.photo, assets, record, source.caseId + ' attachment',source.submission?.photo,sourceHashes);
}

export async function verifyImportedEvidence(feed,{assets,sourceHashes,loadRecord,readBytes}) {
  let cases=0;const checked=new Set();
  for(const source of feed){
    const record=await loadRecord('observation','live:'+source.id);
    verifyMigratedObservation(source,record,assets,sourceHashes);
    const observation=record.observation;
    const urls=[observation.image,observation.samImage,observation.submission?.photo,...(observation.caseEvidence||[]).flatMap(e=>[e.image,e.samImage])].filter(Boolean);
    if(source.caseRepresentative&&source.submission){
      const cityCase=await loadRecord('case','live:'+source.caseId);
      verifyMigratedCase(source,cityCase,assets,sourceHashes);
      urls.push(cityCase.submission.photo);cases++;
    }
    for(const url of urls){
      const id=mediaPath.exec(url)?.[1];if(checked.has(id))continue;
      const asset=assets.get(id);const bytes=await readBytes(asset);
      if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error('Referenced cloud evidence hash mismatch');
      checked.add(id);
    }
  }
  return {observations:feed.length,cases,verifiedImages:checked.size};
}
