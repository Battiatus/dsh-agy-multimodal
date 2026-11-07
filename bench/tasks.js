// Tâches du banc d'essai : code (tests cachés) et raisonnement (réponse exacte).
// Écrites pour ce projet ; chaque test de code est une suite d'assertions sur la fonction demandée.

export const CODE = [
  {
    id: 'interval-merge',
    prompt: 'Write `mergeIntervals(intervals)`: given an array of [start, end] integer pairs (unsorted, may touch or overlap), return the merged intervals sorted by start. Touching intervals like [1,2] and [2,3] merge. Do not mutate the input.',
    fn: 'mergeIntervals',
    tests: `
eq(mergeIntervals([]), []);
eq(mergeIntervals([[5,6],[1,3],[2,4]]), [[1,4],[5,6]]);
eq(mergeIntervals([[1,2],[2,3]]), [[1,3]]);
eq(mergeIntervals([[1,10],[2,3],[4,5]]), [[1,10]]);
const input = [[3,4],[1,2]]; mergeIntervals(input); eq(input, [[3,4],[1,2]]);`,
  },
  {
    id: 'roman',
    prompt: 'Write `toRoman(n)` for integers 1..3999 (standard subtractive notation) and `fromRoman(s)` that converts back; `fromRoman` must throw on invalid numerals such as "IIII", "VX", "IC" or "".',
    fn: 'toRoman',
    tests: `
eq(toRoman(1994), 'MCMXCIV'); eq(toRoman(3999), 'MMMCMXCIX'); eq(toRoman(4), 'IV');
eq(fromRoman('MCMXCIV'), 1994); eq(fromRoman('XLII'), 42);
for (const bad of ['IIII', 'VX', 'IC', '', 'MMMM']) throws(() => fromRoman(bad));
for (let i = 1; i < 4000; i += 37) eq(fromRoman(toRoman(i)), i);`,
  },
  {
    id: 'lru',
    prompt: 'Write a class `LRUCache` with `constructor(capacity)`, `get(key)` (returns undefined when missing, marks as recently used) and `put(key, value)` (updates or inserts, evicting the least recently used entry when over capacity). Both operations must be O(1) on average.',
    fn: 'LRUCache',
    tests: `
const c = new LRUCache(2); c.put('a', 1); c.put('b', 2); eq(c.get('a'), 1);
c.put('c', 3); eq(c.get('b'), undefined); eq(c.get('a'), 1); eq(c.get('c'), 3);
c.put('a', 10); c.put('d', 4); eq(c.get('c'), undefined); eq(c.get('a'), 10);
const big = new LRUCache(1000); const t = Date.now(); for (let i = 0; i < 200000; i++) { big.put(i % 1500, i); big.get((i * 7) % 1500); } ok(Date.now() - t < 1500);`,
  },
  {
    id: 'expr-eval',
    prompt: 'Write `evaluate(expr)` that computes an arithmetic expression string with integers, decimals, + - * /, unary minus, parentheses and spaces, respecting precedence and left associativity. Do not use eval, Function or similar. Throw on malformed input such as "2 +", "(1" or "1 2".',
    fn: 'evaluate',
    tests: `
eq(evaluate('1 + 2 * 3'), 7); eq(evaluate('(1 + 2) * 3'), 9); eq(evaluate('10 - 4 - 3'), 3);
eq(evaluate('8 / 4 / 2'), 1); eq(evaluate('-3 * -(2 + 1)'), 9); eq(evaluate('2.5 * 4'), 10);
eq(evaluate(' 7 '), 7); eq(evaluate('-(-(-1))'), -1);
for (const bad of ['2 +', '(1', '1 2', '', '*3', '1 + (2']) throws(() => evaluate(bad));`,
  },
  {
    id: 'topo-sort',
    prompt: 'Write `buildOrder(tasks)`: `tasks` maps a task name to an array of task names it depends on (dependencies may also appear only as dependencies). Return an array with every task after all of its dependencies; among tasks that are ready at the same time, pick the alphabetically smallest first. Throw an Error whose message contains "cycle" when there is a cycle.',
    fn: 'buildOrder',
    tests: `
eq(buildOrder({}), []);
eq(buildOrder({ b: ['a'], c: ['a'], d: ['b', 'c'] }), ['a', 'b', 'c', 'd']);
eq(buildOrder({ x: [], y: [], a: ['y'] }), ['x', 'y', 'a']);
eq(buildOrder({ app: ['lib', 'ui'], ui: ['lib'] }), ['lib', 'ui', 'app']);
throws(() => buildOrder({ a: ['b'], b: ['c'], c: ['a'] }), /cycle/);`,
  },
  {
    id: 'csv-parse',
    prompt: 'Write `parseCSV(text)` returning an array of rows (arrays of strings). Support RFC 4180 quoting: fields in double quotes may contain commas, newlines and doubled quotes (""). Rows end with \\n or \\r\\n; a trailing newline does not create an empty row. An empty string returns [].',
    fn: 'parseCSV',
    tests: `
eq(parseCSV(''), []);
eq(parseCSV('a,b\\n1,2\\n'), [['a','b'],['1','2']]);
eq(parseCSV('x,"y, z",w'), [['x','y, z','w']]);
eq(parseCSV('"he said ""hi""",2\\r\\n3,4'), [['he said "hi"','2'],['3','4']]);
eq(parseCSV('"line1\\nline2",b'), [['line1\\nline2','b']]);
eq(parseCSV('a,,c\\n,,'), [['a','','c'],['','','']]);`,
  },
  {
    id: 'debounce-promise',
    prompt: 'Write `debounceAsync(fn, ms)`: returns a function that, when called repeatedly, waits until `ms` milliseconds pass without a new call, then calls `fn` once with the latest arguments. Every call returns a promise that resolves (or rejects) with the result of that single eventual `fn` call.',
    fn: 'debounceAsync',
    async: true,
    tests: `
let calls = 0; const f = debounceAsync(async (x) => { calls++; return x * 2; }, 30);
const r = await Promise.all([f(1), f(2), f(3)]); eq(r, [6, 6, 6]); eq(calls, 1);
eq(await f(5), 10); eq(calls, 2);
const g = debounceAsync(async () => { throw new Error('boom'); }, 10);
await rejects(Promise.all([g(), g()]), /boom/);`,
  },
  {
    id: 'deep-equal',
    prompt: 'Write `deepEqual(a, b)` returning true when two values are structurally equal: primitives by SameValueZero (NaN equals NaN, 0 equals -0), arrays by element, plain objects by own enumerable keys regardless of order, Date by time, Map and Set by contents (Set membership by deepEqual), and it must handle circular references without overflowing.',
    fn: 'deepEqual',
    tests: `
ok(deepEqual(NaN, NaN)); ok(deepEqual(0, -0)); ok(!deepEqual(1, '1'));
ok(deepEqual({ a: [1, { b: 2 }], c: 3 }, { c: 3, a: [1, { b: 2 }] })); ok(!deepEqual({ a: 1 }, { a: 1, b: undefined }));
ok(deepEqual(new Date(5), new Date(5))); ok(!deepEqual(new Date(5), new Date(6)));
ok(deepEqual(new Map([[1, { x: 1 }]]), new Map([[1, { x: 1 }]]))); ok(deepEqual(new Set([{ a: 1 }, 2]), new Set([2, { a: 1 }])));
ok(!deepEqual([1, 2], { 0: 1, 1: 2 }));
const x = { n: 1 }; x.self = x; const y = { n: 1 }; y.self = y; ok(deepEqual(x, y));`,
  },
  {
    id: 'kth-path',
    prompt: 'Write `shortestPath(grid)`: `grid` is an array of strings made of "." (open), "#" (wall), "S" (start) and "E" (end). Moving up, down, left or right costs 1, and you may break through at most one wall along the way. Return the length of the shortest path from S to E, or -1 when impossible.',
    fn: 'shortestPath',
    tests: `
eq(shortestPath(['S.E']), 2);
eq(shortestPath(['S#E']), 2);
eq(shortestPath(['S##E']), -1);
eq(shortestPath(['S.#', '##.', '..E']), 4);
eq(shortestPath(['S#.', '.#.', '.#E']), 4);
eq(shortestPath(['S']), -1);`,
  },
  {
    id: 'semver',
    prompt: 'Write `satisfies(version, range)` for semantic versions "MAJOR.MINOR.PATCH" (no pre-release). `range` is one or more space-separated comparators that must all match, each one of: exact "1.2.3", ">=1.2.3", ">1.2.3", "<=1.2.3", "<1.2.3", caret "^1.2.3" (same major, or same minor when major is 0, or same patch when major and minor are 0) and tilde "~1.2.3" (same major and minor).',
    fn: 'satisfies',
    tests: `
ok(satisfies('1.4.0', '^1.2.3')); ok(!satisfies('2.0.0', '^1.2.3')); ok(!satisfies('1.2.2', '^1.2.3'));
ok(satisfies('0.2.9', '^0.2.3')); ok(!satisfies('0.3.0', '^0.2.3')); ok(!satisfies('0.0.4', '^0.0.3'));
ok(satisfies('1.2.9', '~1.2.3')); ok(!satisfies('1.3.0', '~1.2.3'));
ok(satisfies('1.5.0', '>=1.2.0 <2.0.0')); ok(!satisfies('2.0.0', '>=1.2.0 <2.0.0'));
ok(satisfies('1.10.0', '>1.9.9')); ok(satisfies('1.2.3', '1.2.3'));`,
  },
  {
    id: 'rate-limiter',
    prompt: 'Write a class `TokenBucket` with `constructor(capacity, refillPerSecond, now = () => Date.now())` and `take(count = 1)` returning true and consuming tokens when enough are available, false otherwise. The bucket starts full, refills continuously (fractional tokens allowed) and never exceeds capacity. Use the injected `now` for time.',
    fn: 'TokenBucket',
    tests: `
let t = 0; const b = new TokenBucket(3, 2, () => t);
ok(b.take()); ok(b.take(2)); ok(!b.take());
t = 250; ok(!b.take()); t = 500; ok(b.take()); ok(!b.take());
t = 10000; ok(b.take(3)); ok(!b.take(1));
t = 10750; ok(b.take(1)); ok(!b.take(1)); ok(!b.take(4));`,
  },
  {
    id: 'json-path',
    prompt: 'Write `getPath(obj, path)` supporting dotted keys and bracket indexes, e.g. "a.b[0].c", "items[2]", "[1].name", and quoted keys in brackets like \'a["x.y"].z\'. Return undefined when any step is missing. Do not use eval.',
    fn: 'getPath',
    tests: `
const o = { a: { b: [{ c: 7 }] }, items: [1, 2, 3], 'x.y': { z: 9 }, a2: { 'x.y': { z: 5 } } };
eq(getPath(o, 'a.b[0].c'), 7); eq(getPath(o, 'items[2]'), 3); eq(getPath(o, 'a.b[3].c'), undefined);
eq(getPath(o, 'a2["x.y"].z'), 5); eq(getPath(o, '["x.y"].z'), 9); eq(getPath([{ name: 'n' }, { name: 'm' }], '[1].name'), 'm');
eq(getPath(o, 'nope.deeper'), undefined);`,
  },
];

// Tâches difficiles : beaucoup de cas limites, là où les modèles se trompent
export const HARD = [
  {
    id: 'glob',
    prompt: 'Write `globMatch(pattern, path)` for "/"-separated paths. Support: `?` (one char except "/"), `*` (any run of chars except "/"), `**` as a whole path segment (zero or more segments, so "a/**/b" matches "a/b" and "a/x/y/b"), `[abc]`, `[a-z]`, `[!a-z]` (one char except "/"), and `{x,y,z}` alternatives (may contain other wildcards, not nested). The whole path must match.',
    fn: 'globMatch',
    tests: `
ok(globMatch('*.js', 'app.js')); ok(!globMatch('*.js', 'src/app.js'));
ok(globMatch('src/**/*.js', 'src/app.js')); ok(globMatch('src/**/*.js', 'src/a/b/app.js')); ok(!globMatch('src/**/*.js', 'lib/app.js'));
ok(globMatch('**', 'a/b/c')); ok(globMatch('a/**', 'a')); ok(globMatch('a/**/b', 'a/b')); ok(globMatch('a/**/b', 'a/x/y/b')); ok(!globMatch('a/**/b', 'a/xb'));
ok(globMatch('file?.txt', 'file1.txt')); ok(!globMatch('file?.txt', 'file10.txt')); ok(!globMatch('a?b', 'a/b'));
ok(globMatch('[a-c]x', 'bx')); ok(!globMatch('[a-c]x', 'dx')); ok(globMatch('[!a-c]x', 'dx')); ok(!globMatch('[!a-c]x', 'ax'));
ok(globMatch('*.{js,ts}', 'm.ts')); ok(!globMatch('*.{js,ts}', 'm.css')); ok(globMatch('{src,lib}/*.{js,ts}', 'lib/x.js'));
ok(globMatch('a.b', 'a.b')); ok(!globMatch('a.b', 'axb')); ok(globMatch('(x)+', '(x)+'));`,
  },
  {
    id: 'cron-next',
    prompt: 'Write `cronNext(expr, from)`: `expr` is a 5-field cron expression "minute hour day-of-month month day-of-week" (day-of-week 0-6, Sunday = 0, 7 also means Sunday). Each field supports `*`, numbers, lists "1,5", ranges "1-5", and steps "*/15" or "10-30/5". When both day-of-month and day-of-week are restricted (neither is `*`), a day matches if EITHER matches (standard cron rule). `from` is a Date; return the first Date strictly after `from`, at second 0, evaluating all fields in UTC.',
    fn: 'cronNext',
    tests: `
const at = (iso) => new Date(iso); const iso = (d) => d.toISOString();
eq(iso(cronNext('*/15 * * * *', at('2026-01-01T10:07:30Z'))), '2026-01-01T10:15:00.000Z');
eq(iso(cronNext('0 9 * * 1-5', at('2026-01-02T09:00:00Z'))), '2026-01-05T09:00:00.000Z');
eq(iso(cronNext('30 2 1 * *', at('2026-01-31T12:00:00Z'))), '2026-02-01T02:30:00.000Z');
eq(iso(cronNext('0 0 29 2 *', at('2026-03-01T00:00:00Z'))), '2028-02-29T00:00:00.000Z');
eq(iso(cronNext('0 12 13 * 5', at('2026-01-01T00:00:00Z'))), '2026-01-02T12:00:00.000Z');
eq(iso(cronNext('10-30/10 8 * * 7', at('2026-01-04T08:20:00Z'))), '2026-01-04T08:30:00.000Z');
eq(iso(cronNext('0 0 * * *', at('2026-12-31T23:59:59Z'))), '2027-01-01T00:00:00.000Z');
eq(iso(cronNext('5,55 23 31 12 *', at('2026-12-31T23:05:00Z'))), '2026-12-31T23:55:00.000Z');`,
  },
  {
    id: 'justify',
    prompt: 'Write `justify(words, width)`: pack the array of words into lines of exactly `width` characters, greedily (as many words as fit per line, one space minimum between words). Distribute extra spaces as evenly as possible between words; when uneven, the leftmost gaps get more. A line with a single word, and the last line, are left-justified with single spaces and padded with trailing spaces to `width`. Return the array of lines. Words never exceed `width`.',
    fn: 'justify',
    tests: `
eq(justify(['This','is','an','example','of','text','justification.'], 16), ['This    is    an','example  of text','justification.  ']);
eq(justify(['What','must','be','acknowledgment','shall','be'], 16), ['What   must   be','acknowledgment  ','shall be        ']);
eq(justify(['a'], 3), ['a  ']);
eq(justify(['a','b','c','d','e'], 3), ['a b','c d','e  ']);
eq(justify(['Science','is','what','we','understand','well','enough','to','explain','to','a','computer.'], 20), ['Science  is  what we','understand      well','enough to explain to','a computer.         ']);`,
  },
  {
    id: 'big-multiply',
    prompt: 'Write `multiply(a, b)` for decimal number strings that may be very long, may start with "-", and may have a fractional part ("-12.5", "0.001", "123456789012345678901234567890"). Return the exact product as a string with no leading zeros (except a single "0" before the point), no trailing zeros after the point, no point if the result is whole, and "0" (never "-0") for zero. Do not use BigInt or any library.',
    fn: 'multiply',
    tests: `
eq(multiply('2', '3'), '6'); eq(multiply('-12.5', '4'), '-50'); eq(multiply('0.1', '0.2'), '0.02'); eq(multiply('-0.5', '-0.5'), '0.25');
eq(multiply('0', '-123.45'), '0'); eq(multiply('1.000', '2.50'), '2.5'); eq(multiply('-0.001', '1000'), '-1');
eq(multiply('123456789012345678901234567890', '987654321098765432109876543210'), '121932631137021795226185032733622923332237463801111263526900');
eq(multiply('99999999999999999999.99', '0.01'), '999999999999999999.9999');`,
  },
  {
    id: 'regex-engine',
    prompt: 'Write `regexMatch(text, pattern)` returning whether the WHOLE text matches the pattern, without using RegExp. Pattern syntax: literal characters, `.` (any single char), postfix `*` (zero or more), `+` (one or more), `?` (zero or one) applied to the previous literal, `.` or bracket class, bracket classes `[abc]`, `[a-z0-9]`, `[^x]`, and `\\` escaping the next character (e.g. `\\.` or `\\*`). Must run fast on adversarial inputs like text "aaaaaaaaaaaaaaaaaaaaaaaaaaaaab" with pattern "a*a*a*a*a*a*a*a*a*c".',
    fn: 'regexMatch',
    tests: `
ok(regexMatch('aab', 'c*a*b')); ok(!regexMatch('mississippi', 'mis*is*p*.')); ok(regexMatch('mississippi', 'mis*is*ip*.'));
ok(regexMatch('', 'a*b?')); ok(!regexMatch('', 'a+')); ok(regexMatch('aaa', 'a+')); ok(regexMatch('ab', '.?b'));
ok(regexMatch('x9', '[a-z][0-9]')); ok(!regexMatch('X9', '[a-z][0-9]')); ok(regexMatch('q', '[^abc]')); ok(!regexMatch('a', '[^abc]'));
ok(regexMatch('a.b', 'a\\\\.b')); ok(!regexMatch('axb', 'a\\\\.b')); ok(regexMatch('2*3', '2\\\\*3')); ok(regexMatch('abcabc', '[abc]+'));
const t = Date.now(); ok(!regexMatch('aaaaaaaaaaaaaaaaaaaaaaaaaaaaab', 'a*a*a*a*a*a*a*a*a*c')); ok(Date.now() - t < 1000);`,
  },
  {
    id: 'business-days',
    prompt: 'Write `addBusinessDays(date, n, holidays = [])`: `date` and holidays are "YYYY-MM-DD" strings; business days are Monday to Friday and not in `holidays`. Return the "YYYY-MM-DD" date that is `n` business days after `date` (before it when `n` is negative). If `n` is 0, return `date` itself when it is a business day, otherwise the next business day. Work in calendar dates only (no time zones).',
    fn: 'addBusinessDays',
    tests: `
eq(addBusinessDays('2026-01-02', 1), '2026-01-05');
eq(addBusinessDays('2026-01-05', 5), '2026-01-12');
eq(addBusinessDays('2026-01-05', -1), '2026-01-02');
eq(addBusinessDays('2026-01-03', 0), '2026-01-05');
eq(addBusinessDays('2026-01-06', 0), '2026-01-06');
eq(addBusinessDays('2026-12-24', 1, ['2026-12-25']), '2026-12-28');
eq(addBusinessDays('2026-02-27', 1), '2026-03-02');
eq(addBusinessDays('2028-02-28', 1), '2028-02-29');
eq(addBusinessDays('2026-01-10', -1), '2026-01-09');
eq(addBusinessDays('2026-03-30', 260), '2027-03-29');`,
  },
  {
    id: 'sudoku',
    prompt: 'Write `solveSudoku(grid)`: `grid` is an array of 9 strings of 9 characters, digits 1-9 or "." for empty. Return the solved grid in the same format, or null when the puzzle has no solution (including when the givens already conflict). Do not mutate the input. Must solve hard puzzles in well under a second.',
    fn: 'solveSudoku',
    tests: `
const p = ['53..7....','6..195...','.98....6.','8...6...3','4..8.3..1','7...2...6','.6....28.','...419..5','....8..79'];
eq(solveSudoku(p), ['534678912','672195348','198342567','859761423','426853791','713924856','961537284','287419635','345286179']);
const hard = ['8........','..36.....','.7..9.2..','.5...7...','....457..','...1...3.','..1....68','..85...1.','.9....4..'];
const t = Date.now(); const s = solveSudoku(hard); ok(Date.now() - t < 3000);
eq(s, ['812753649','943682175','675491283','154237896','369845721','287169534','521974368','438526917','796318452']);
eq(solveSudoku(['55.......', ...Array(8).fill('.........')]), null);
const copy = p.slice(); solveSudoku(p); eq(p, copy);`,
  },
];

// Raisonnement : une seule réponse, comparée après normalisation
export const REASONING = [
  { id: 'clock', prompt: 'A clock gains 3 minutes every hour. It is set right at 12:00 noon. What time does it show when the real time is 8:00 pm the same day? Answer as H:MM.', answer: '8:24' },
  { id: 'handshakes', prompt: 'At a party every guest shook hands once with every other guest, except that the two hosts did not shake hands with each other. There were 104 handshakes in total. How many people (guests and hosts) were at the party? Answer with a number.', answer: '15' },
  { id: 'dice', prompt: 'Two fair six-sided dice are rolled. What is the probability that the product is a multiple of 6? Answer as a reduced fraction a/b.', answer: '5/12' },
  { id: 'trains', prompt: 'Train A leaves at 9:00 at 80 km/h. Train B leaves the same station on the same track in the same direction at 9:30 at 120 km/h. At what time does B catch A? Answer as H:MM.', answer: '10:30' },
  { id: 'digits', prompt: 'How many integers from 1 to 1000 inclusive contain the digit 7 at least once? Answer with a number.', answer: '271' },
  { id: 'liars', prompt: 'Three people each say one sentence. Ana: "Exactly one of us lies." Ben: "Exactly two of us lie." Cal: "All three of us lie." Each person either always tells the truth or always lies. How many of them are liars? Answer with a number.', answer: '2' },
  { id: 'mod', prompt: 'What is the remainder when 7^2026 is divided by 13? Answer with a number.', answer: '4' },
  { id: 'stairs', prompt: 'You climb a staircase of 12 steps taking 1, 2 or 3 steps at a time. How many different ways are there to reach the top? Answer with a number.', answer: '927' },
];
