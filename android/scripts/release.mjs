import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {appendFileSync,copyFileSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
const repository='Hopesy/Rethos';
const directory='release/android-assets';
const hash=file=>createHash('sha256').update(readFileSync(`${directory}/${file}`)).digest('hex');
const run=(command,args)=>execFileSync(command,args,{encoding:'utf8'}).trim();
const gh=args=>run('gh',args);
if(process.argv[2]==='prepare') {
  const gradle=readFileSync('android/app/build.gradle.kts','utf8');
  const version=gradle.match(/versionName = "([\d.]+)"/)?.[1];
  const versionCode=Number(gradle.match(/versionCode = (\d+)/)?.[1]);
  assert(version&&versionCode);
  const name=`Rethos-Android-${version}.apk`;
  copyFileSync('android/app/build/outputs/apk/release/app-release.apk',`${directory}/${name}`);
  const signature=readFileSync(`${directory}/SIGNATURE.txt`,'utf8');
  const fingerprint=signature.match(/certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1];
  assert(fingerprint);
  const info={product:'Rethos',platform:'android',version,versionCode,applicationId:'cc.hopesy.rethos',commit:run('git',['rev-parse','HEAD']),certificateSha256:fingerprint,files:{[name]:hash(name),'SIGNATURE.txt':hash('SIGNATURE.txt')}};
  writeFileSync(`${directory}/BUILD-INFO-android.json`,JSON.stringify(info,null,2)+'\n');
  writeFileSync(`${directory}/SHA256SUMS-android.txt`,Object.entries({...info.files,'BUILD-INFO-android.json':hash('BUILD-INFO-android.json')}).map(([name,digest])=>`${digest}  ${name}`).join('\n')+'\n');
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`version=${version}\n`);
} else if(process.argv[2]==='publish') {
  const info=JSON.parse(readFileSync(`${directory}/BUILD-INFO-android.json`,'utf8'));
  assert.equal(info.commit,process.env.RELEASE_SHA);
  const names=[`Rethos-Android-${info.version}.apk`,'SIGNATURE.txt','BUILD-INFO-android.json','SHA256SUMS-android.txt'];
  assert.deepEqual(readdirSync(directory).sort(),[...names].sort());
  for(const [name,digest] of Object.entries(info.files))assert.equal(hash(name),digest);
  const tag=`android-v${info.version}`;
  const view=()=>JSON.parse(gh(['release','view',tag,'--repo',repository,'--json','isDraft,targetCommitish,assets,url']));
  const probe=spawnSync('gh',['release','view',tag,'--repo',repository],{encoding:'utf8'});
  if(probe.status===0){const existing=view();assert(existing.isDraft,'Published Android versions must be incremented');assert.equal(existing.targetCommitish,info.commit);}
  else {assert(/release not found|HTTP 404/i.test(probe.stderr));gh(['release','create',tag,'--repo',repository,'--target',info.commit,'--draft','--title',`Rethos Android ${info.version}`,'--notes-file',`docs/releases/android-v${info.version}.md`]);}
  gh(['release','upload',tag,...names.map(name=>`${directory}/${name}`),'--repo',repository,'--clobber']);
  const release=view();assert.equal(release.assets.length,names.length);
  for(const asset of release.assets)assert.equal(asset.digest,`sha256:${hash(asset.name)}`);
  gh(['release','edit',tag,'--repo',repository,'--draft=false','--latest=false']);
  assert.equal(view().isDraft,false);
  assert.equal(gh(['api',`repos/${repository}/commits/${tag}`,'--jq','.sha']),info.commit);
  console.log(view().url);
} else throw Error('Use prepare or publish');
