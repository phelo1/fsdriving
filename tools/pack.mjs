// Packs dist/ into a single Pages advanced-mode _worker.js and writes deploy/deploy-mcp.js
// (an async arrow function for the Cloudflare MCP "execute" tool). Run: node tools/pack.mjs
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root,'dist'); const out = path.join(root,'deploy'); fs.mkdirSync(out,{recursive:true});
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.ico':'image/x-icon'};
const files = {};
(function walk(d){ for(const f of fs.readdirSync(d)){ const p=path.join(d,f); if(fs.statSync(p).isDirectory()) walk(p); else {
  const rel='/'+path.relative(dist,p).split(path.sep).join('/'); const ext=path.extname(p); const t=types[ext]||'application/octet-stream';
  const text = /^(text|application\/(javascript|xml))|svg/.test(t);
  files[rel] = {t, b: text?0:1, d: text? fs.readFileSync(p,'utf8') : fs.readFileSync(p).toString('base64')}; }}})(dist);
const worker = `const F=${JSON.stringify(files)};
const cache={};function body(k){const f=F[k];if(!f.b)return f.d;if(!cache[k]){const s=atob(f.d);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);cache[k]=u}return cache[k]}
function resp(k,status){const f=F[k];const h={'content-type':f.t,'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
h['cache-control']=(f.t.startsWith('text/html')||k==='/data.json')?'public, max-age=300':k.endsWith('.svg')?'public, max-age=604800':'public, max-age=3600';
return new Response(body(k),{status:status||200,headers:h})}
export default{async fetch(req){const url=new URL(req.url);

let p=decodeURIComponent(url.pathname);
if(F[p])return resp(p);
if(F[p.replace(/\\/?$/,'/')+'index.html']){if(!p.endsWith('/')){url.pathname=p+'/';return Response.redirect(url.toString(),301)}return resp(p+'index.html')}
return resp('/404.html',404)}};`;
fs.writeFileSync(path.join(out,'_worker.js'), worker);
const mcp = `async () => {
  const worker = ${JSON.stringify(worker)};
  const form = new FormData();
  form.append('manifest', '{}');
  form.append('branch', 'main');
  form.append('_worker.js', new Blob([worker], {type: 'application/javascript+module'}), '_worker.js');
  const r = await cloudflare.request({method: 'POST', path: \`/accounts/\${accountId}/pages/projects/robotaxi-hiring/deployments\`, body: form});
  return {id: r.result.id, url: r.result.url, stage: r.result.latest_stage && r.result.latest_stage.name};
}`;
fs.writeFileSync(path.join(out,'deploy-mcp.js'), mcp);
import zlib from 'node:zlib';
const gz=zlib.gzipSync(worker).length; if(gz>2.8e6){console.error('Worker is '+gz+' bytes gzipped, over the ~3MB free-plan limit. Run tools/shrink_archive.py or see REFRESH.md.');process.exit(1)}
console.log('gzip bytes', gz, 'worker bytes', Buffer.byteLength(worker), 'files', Object.keys(files).length);
