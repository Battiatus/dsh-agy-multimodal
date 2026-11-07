// Solutions de référence des tâches difficiles : elles valident les tests (node bench/check.js), jamais montrées aux modèles.
export const REFERENCE = {
  glob: String.raw`
function globMatch(pattern, path) {
  const expand = (p) => { const m = /\{([^{}]*)\}/.exec(p); return m ? m[1].split(',').flatMap((alt) => expand(p.slice(0, m.index) + alt + p.slice(m.index + m[0].length))) : [p]; };
  const seg = (pat, s) => {
    const rec = (i, j) => {
      if (i === pat.length) return j === s.length;
      const c = pat[i];
      if (c === '*') { for (let k = j; k <= s.length; k++) if (rec(i + 1, k)) return true; return false; }
      if (j === s.length) return false;
      if (c === '?') return rec(i + 1, j + 1);
      if (c === '[') {
        const end = pat.indexOf(']', i + 2); let body = pat.slice(i + 1, end); const neg = body[0] === '!'; if (neg) body = body.slice(1);
        let hit = false; for (let k = 0; k < body.length; k++) { if (body[k + 1] === '-' && k + 2 < body.length) { if (s[j] >= body[k] && s[j] <= body[k + 2]) hit = true; k += 2; } else if (body[k] === s[j]) hit = true; }
        return hit !== neg && rec(end + 1, j + 1);
      }
      return c === s[j] && rec(i + 1, j + 1);
    };
    return rec(0, 0);
  };
  const match = (ps, ss) => {
    if (ps.length === 0) return ss.length === 0;
    if (ps[0] === '**') { for (let k = 0; k <= ss.length; k++) if (match(ps.slice(1), ss.slice(k))) return true; return false; }
    return ss.length > 0 && seg(ps[0], ss[0]) && match(ps.slice(1), ss.slice(1));
  };
  return expand(pattern).some((p) => match(p.split('/'), path.split('/')));
}`,
  'cron-next': String.raw`
function cronNext(expr, from) {
  const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  const parse = (field, [lo, hi]) => { const set = new Set(); for (const part of field.split(',')) { const [r, st] = part.split('/'); const step = st ? Number(st) : 1; let [a, b] = r === '*' ? [lo, hi] : r.split('-').map(Number); if (b === undefined) b = st ? hi : a; for (let v = a; v <= b; v += step) set.add(v); } return set; };
  const f = expr.trim().split(/\s+/); const [mi, ho, dom, mo, dow] = f.map((x, i) => parse(x, ranges[i]));
  if (dow.has(7)) dow.add(0);
  const domStar = f[2] === '*', dowStar = f[4] === '*';
  const dayOk = (d) => { const a = dom.has(d.getUTCDate()), b = dow.has(d.getUTCDay()); return domStar && dowStar ? true : domStar ? b : dowStar ? a : a || b; };
  const d = new Date(Math.floor(from.getTime() / 60000) * 60000 + 60000);
  for (let i = 0; i < 6e6; i++) {
    if (!mo.has(d.getUTCMonth() + 1)) { d.setUTCMonth(d.getUTCMonth() + 1, 1); d.setUTCHours(0, 0, 0, 0); continue; }
    if (!dayOk(d)) { d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); continue; }
    if (!ho.has(d.getUTCHours())) { d.setUTCHours(d.getUTCHours() + 1, 0, 0, 0); continue; }
    if (!mi.has(d.getUTCMinutes())) { d.setUTCMinutes(d.getUTCMinutes() + 1, 0, 0); continue; }
    return d;
  }
  return null;
}`,
  justify: String.raw`
function justify(words, width) {
  const lines = []; let i = 0;
  while (i < words.length) {
    let j = i, len = 0; while (j < words.length && len + words[j].length + (j - i) <= width) len += words[j++].length;
    const gaps = j - i - 1; let line;
    if (j === words.length || gaps === 0) line = words.slice(i, j).join(' ').padEnd(width);
    else { const spaces = width - len; line = ''; for (let k = i; k < j - 1; k++) line += words[k] + ' '.repeat(Math.floor(spaces / gaps) + (k - i < spaces % gaps ? 1 : 0)); line += words[j - 1]; }
    lines.push(line); i = j;
  }
  return lines;
}`,
  'big-multiply': String.raw`
function multiply(a, b) {
  const split = (x) => { const neg = x[0] === '-'; x = x.replace(/^[-+]/, ''); const [i, f = ''] = x.split('.'); return { neg, digits: (i + f).replace(/^0+(?=\d)/, ''), scale: f.length }; };
  const A = split(a), B = split(b);
  const r = new Array(A.digits.length + B.digits.length).fill(0);
  for (let i = A.digits.length - 1; i >= 0; i--) for (let j = B.digits.length - 1; j >= 0; j--) { const p = (A.digits.charCodeAt(i) - 48) * (B.digits.charCodeAt(j) - 48) + r[i + j + 1]; r[i + j + 1] = p % 10; r[i + j] += Math.floor(p / 10); }
  let s = r.join(''); const scale = A.scale + B.scale;
  s = s.padStart(scale + 1, '0'); let int = s.slice(0, s.length - scale).replace(/^0+(?=\d)/, ''); let frac = s.slice(s.length - scale).replace(/0+$/, '');
  const out = frac ? int + '.' + frac : int;
  return out === '0' ? '0' : (A.neg !== B.neg ? '-' : '') + out;
}`,
  'regex-engine': String.raw`
function regexMatch(text, pattern) {
  const toks = []; let i = 0;
  while (i < pattern.length) {
    let t;
    if (pattern[i] === '\\') { t = { lit: pattern[i + 1] }; i += 2; }
    else if (pattern[i] === '.') { t = { any: true }; i++; }
    else if (pattern[i] === '[') { const end = pattern.indexOf(']', i + 1); let body = pattern.slice(i + 1, end); const neg = body[0] === '^'; if (neg) body = body.slice(1); t = { cls: body, neg }; i = end + 1; }
    else { t = { lit: pattern[i] }; i++; }
    if ('*+?'.includes(pattern[i]) && i < pattern.length) { t.q = pattern[i]; i++; }
    toks.push(t);
  }
  const hit = (t, c) => { if (c === undefined) return false; if (t.any) return true; if (t.lit !== undefined) return t.lit === c; let h = false; for (let k = 0; k < t.cls.length; k++) { if (t.cls[k + 1] === '-' && k + 2 < t.cls.length) { if (c >= t.cls[k] && c <= t.cls[k + 2]) h = true; k += 2; } else if (t.cls[k] === c) h = true; } return h !== t.neg; };
  const memo = new Map();
  const m = (ti, si) => {
    const key = ti * (text.length + 1) + si; if (memo.has(key)) return memo.get(key);
    let r;
    if (ti === toks.length) r = si === text.length;
    else { const t = toks[ti];
      if (t.q === '*') r = m(ti + 1, si) || (hit(t, text[si]) && m(ti, si + 1));
      else if (t.q === '+') r = hit(t, text[si]) && (m(ti + 1, si + 1) || m(ti, si + 1));
      else if (t.q === '?') r = m(ti + 1, si) || (hit(t, text[si]) && m(ti + 1, si + 1));
      else r = hit(t, text[si]) && m(ti + 1, si + 1); }
    memo.set(key, r); return r;
  };
  return m(0, 0);
}`,
  'business-days': String.raw`
function addBusinessDays(date, n, holidays = []) {
  const off = new Set(holidays); const d = new Date(date + 'T00:00:00Z');
  const fmt = () => d.toISOString().slice(0, 10); const ok = () => d.getUTCDay() % 6 !== 0 && !off.has(fmt());
  if (n === 0) { while (!ok()) d.setUTCDate(d.getUTCDate() + 1); return fmt(); }
  const step = Math.sign(n); let left = Math.abs(n);
  while (left > 0) { d.setUTCDate(d.getUTCDate() + step); if (ok()) left--; }
  return fmt();
}`,
  sudoku: String.raw`
function solveSudoku(grid) {
  const g = grid.join('').split('').map((c) => (c === '.' ? 0 : Number(c)));
  const ok = (i, v) => { const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) { if (g[r * 9 + k] === v && r * 9 + k !== i) return false; if (g[k * 9 + c] === v && k * 9 + c !== i) return false; const bi = (br + Math.floor(k / 3)) * 9 + bc + k % 3; if (g[bi] === v && bi !== i) return false; } return true; };
  for (let i = 0; i < 81; i++) if (g[i] && !ok(i, g[i])) return null;
  const solve = () => { let best = -1, opts; for (let i = 0; i < 81; i++) if (!g[i]) { const o = []; for (let v = 1; v <= 9; v++) if (ok(i, v)) o.push(v); if (o.length === 0) return false; if (best < 0 || o.length < opts.length) { best = i; opts = o; } } if (best < 0) return true; for (const v of opts) { g[best] = v; if (solve()) return true; } g[best] = 0; return false; };
  if (!solve()) return null;
  return Array.from({ length: 9 }, (_, r) => g.slice(r * 9, r * 9 + 9).join(''));
}`,
};
