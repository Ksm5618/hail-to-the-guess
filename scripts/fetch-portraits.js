#!/usr/bin/env node
// Downloads each president's lead portrait from Wikipedia (public-domain official
// portraits for most) into ./portraits. Re-run any time; existing files are skipped
// unless you pass --force.

const fs = require('fs');
const path = require('path');
const presidents = require('../data/presidents');

const OUT = path.join(__dirname, '..', 'portraits');
const FORCE = process.argv.includes('--force');
const UA = 'PresidentQuizGame/1.0 (local hobby project)';
const WIDTH = 500; // Wikimedia only serves standard thumbnail widths (250/330/500/960...)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch with backoff on 429 / 5xx
async function get(url, accept) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...(accept ? { Accept: accept } : {}) } });
    if (res.status !== 429 && res.status < 500) return res;
    const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * 2 ** attempt;
    await sleep(Math.min(wait, 30000));
  }
  throw new Error('rate limited, try again later');
}

async function fetchJson(url) {
  const res = await get(url, 'application/json');
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function sizedThumb(summary) {
  const t = summary.thumbnail && summary.thumbnail.source;
  const o = summary.originalimage && summary.originalimage.source;
  // Thumbnail URLs look like .../thumb/a/ab/File.jpg/330px-File.jpg — bump the width.
  if (t && /\/\d+px-/.test(t)) return t.replace(/\/\d+px-/, `/${WIDTH}px-`);
  return o || t;
}

async function download(p) {
  const file = path.join(OUT, `${p.id}.jpg`);
  if (!FORCE && fs.existsSync(file)) return 'skip';
  const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.wiki)}`);
  const url = sizedThumb(summary);
  if (!url) throw new Error('no image on page');
  const res = await get(url);
  if (!res.ok) throw new Error(`image ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return 'ok';
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let failed = 0;
  for (const p of presidents) {
    try {
      const r = await download(p);
      console.log(`${r === 'ok' ? '✔' : '·'} ${p.name}`);
    } catch (e) {
      failed++;
      console.log(`✘ ${p.name}: ${e.message}`);
    }
    await sleep(1200); // be polite to Wikipedia
  }
  console.log(failed ? `\n${failed} failed — re-run to retry.` : '\nAll portraits ready.');
  process.exit(failed ? 1 : 0);
})();
