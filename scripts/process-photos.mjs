// Local intake adapter. Android will invoke the same stages through authenticated ingestion.
import {spawnSync} from 'node:child_process';
const reuse=process.argv.includes('--reuse-models');
const stages=[...(!reuse?['analyze-photos']:[]),'resolve-locations',...(!reuse?['group-cases','segment-findings']:[]),'publish-photo-feed'];
for(const stage of stages){console.log('Photo workflow: '+stage);const child=spawnSync(process.execPath,['scripts/'+stage+'.mjs'],{stdio:'inherit'});if(child.status!==0)process.exit(child.status||1);}
console.log('Photo workflow complete. No city submission or robot movement is performed.');
