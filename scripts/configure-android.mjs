import {execFileSync} from 'node:child_process';
import {setting} from '../server/config.mjs';
// Installs the app's endpoint and device token. Provider/admin keys stay server-side.
try {
 const production=process.argv.includes('--production');
 const token=setting('TRIPPIE_DEVICE_TOKEN'); if(!token)throw new Error('Set TRIPPIE_DEVICE_TOKEN in .env.local first.');
 const devices=execFileSync('adb',['devices'],{encoding:'utf8'}).split('\n').map(line=>line.match(/^(\S+)\s+device$/)?.[1]).filter(Boolean);
 if(devices.length!==1)throw new Error('Connect exactly one authorized Android device.');
 const args=['-s',devices[0]];
 if(!production)execFileSync('adb',[...args,'reverse','tcp:3015','tcp:3015'],{stdio:'pipe'});
 execFileSync('adb',[...args,'shell','run-as','com.trippie.robot','tee','files/sync-config.json'],{input:JSON.stringify({endpoint:production?'https://www.fixitplano.com':'http://127.0.0.1:3015',token}),stdio:['pipe','pipe','pipe']});
 console.log(production?'Configured cloud endpoint; USB is no longer required for app networking. Restart Trippie.':'Configured local development endpoint over USB. Restart Trippie.');
} catch(error) {console.error(error instanceof Error && !('stdout' in error)?error.message:'Android configuration failed. Check adb and install/open the debug app first.');process.exitCode=1;}
