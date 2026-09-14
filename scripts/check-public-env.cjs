const fs=require('node:fs'),path=require('node:path');
const names=new Set(Object.keys(process.env));
for(const name of fs.readdirSync(process.cwd()).filter(n=>/^\.env(?:\..+)?$/.test(n))){
 const file=path.join(process.cwd(),name);
 if(!fs.statSync(file).isFile())continue;
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const match=line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/);
  if(match)names.add(match[1]);
 }
}
const forbidden=[...names].filter(n=>/^(NEXT_PUBLIC_|EXPO_PUBLIC_)/.test(n)&&/SECRET|CERT|PRIVATE|SERVICE_ROLE|PAYMOB_API_KEY|PASSWORD/.test(n));
if(forbidden.length){console.error('Use server-only environment names for private credentials: '+forbidden.join(', '));process.exitCode=1;}
else console.log('No private credential names exposed through public environment variables.');
