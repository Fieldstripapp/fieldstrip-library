/* check_served.js — the Do-not gate, run on what is SERVED (Darren 2026-11-14 11:45: "for every served guide, not a
   sample"). run_gates.js judges the payload before it is written; this fetches every guide file from the live library
   and holds it to the app's own emitted block the same way (tools/lib/noblock.js): count, sentence, citation, and the
   block as the app's own fsNoHtml draws it. It also checks each served file against the digest the served index states.
   Reads only. Exit 0 clean, 1 a difference, 3 it could not run.
     node tools/check_served.js [--base https://library.fieldstripapp.com] */
'use strict';
const https = require('https'), http = require('http'), crypto = require('crypto');
const app = require('./lib/appsrc');
const noblock = require('./lib/noblock');
const i = process.argv.indexOf('--base');
const BASE = i >= 0 ? process.argv[i + 1] : 'https://library.fieldstripapp.com';
const get = (p, n) => new Promise((res, rej) => {
  (BASE.indexOf('https:') === 0 ? https : http).get(BASE + '/' + p + '?cb=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } }, r => {
    if (r.statusCode !== 200) { r.resume(); return (n || 0) < 3 ? setTimeout(() => get(p, (n || 0) + 1).then(res, rej), 1500) : rej(new Error(p + ' answered ' + r.statusCode)); }
    const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
  }).on('error', e => ((n || 0) < 3 ? setTimeout(() => get(p, (n || 0) + 1).then(res, rej), 1500) : rej(e)));
});
(async () => {
  const idx = JSON.parse((await get('index.json')).toString('utf8'));
  const want = new Map();
  idx.rows.forEach(r => { if (r.guide && r.guideId && r.guideSha256) want.set(r.guideId, r.guideSha256); });
  if (!want.size) throw new Error('the served index names no guide');
  const served = new Map(), digestBad = [], q = [...want.keys()];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (q.length) {
      const id = q.shift(), bytes = await get('guides/' + id + '.json');
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== want.get(id)) digestBad.push(id);
      served.set(id, JSON.parse(bytes.toString('utf8')));
    }
  }));
  const block = noblock.evalBlock(app.show('scratchpad/clean-rebuild/shelf_block.js'));
  const render = noblock.noRenderer(app.show('www/index.html'));
  const r = noblock.compare(served, block, render);
  const absent = [...block.keys()].filter(k => !served.has(k));
  const withBlocks = [...served.values()].filter(g => [].concat(g.steps || [], g.deepSteps || []).some(st => st.no && st.no.q)).length;
  console.log('served v' + idx.version + ' from ' + BASE + ' (app ' + String(idx.appCommit).slice(0, 8) + '); app block read at ' + app.head().slice(0, 8));
  console.log('guides fetched: ' + served.size + ' · files that do not match the index digest: ' + digestBad.length + (digestBad.length ? ' (' + digestBad.slice(0, 5).join(', ') + ')' : ''));
  console.log('red Do-not blocks: the app draws ' + r.appBlocks + ', the served guides carry ' + r.shelfBlocks + ', in ' + withBlocks + ' guide(s)');
  console.log('steps where the block differs in count, sentence, citation or as drawn: ' + r.bad.length);
  r.bad.slice(0, 12).forEach(b => console.log('   ' + b));
  console.log('on passage steps (carried, not drawn from a download until the app changes): ' + r.passage.length + (r.passage.length ? ' — ' + r.passage.join('; ') : ''));
  if (absent.length) console.log('in the app\'s block and not served (held or withheld rows): ' + absent.length + ' — ' + absent.slice(0, 6).join(', '));
  const ok = !r.bad.length && !digestBad.length && r.appBlocks === r.shelfBlocks && r.guides === served.size;
  console.log(ok ? 'SERVED DO-NOT BLOCKS MATCH THE APP\'S, EVERY GUIDE' : 'SERVED CHECK FAILED');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('could not run: ' + (e && e.message ? e.message : e)); process.exit(3); });
