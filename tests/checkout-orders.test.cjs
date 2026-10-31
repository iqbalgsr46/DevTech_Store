const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
require.extensions['.css'] = (mod) => { mod.exports = {}; };
const file = path.resolve(__dirname, '../src/lib/server/orders.ts');
const key = () => require('node:crypto').randomUUID();
const input = () => ({productId:'chatgpt-plus-private-1m', idempotencyKey:key()});
test('persistent quota bounds concurrent creation and permits replay at capacity', async () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'orders-quota-'));
  process.env.ORDERS_MAX_RECORDS = '2';
  try {
    const original = input();
    const order = await require(file).createOrder(original, dir);
    const results = await Promise.allSettled(Array.from({length:8}, () => require(file).createOrder(input(), dir)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(fs.readdirSync(dir).filter(n => /^[a-f0-9]{64}\.json$/.test(n)).length, 2);
    assert.deepEqual(await require(file).createOrder(original, dir), order);
    assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.name === 'OrderCapacityError'));
  } finally { delete process.env.ORDERS_MAX_RECORDS; fs.rmSync(dir, {recursive:true, force:true}); }
});
test('API enforces rate limit independent of spoofed IP and fails closed on bad config', async () => {
  const route = path.resolve(__dirname, '../src/app/api/orders/route.ts');
  const { POST } = require(route);
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'orders-rl-'));
  process.env.ORDERS_DATA_DIR = dir;
  process.env.ORDERS_RATE_LIMIT_PER_MINUTE = '2';
  const send = (ip) => POST(new Request('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': ip,
      'x-real-ip': ip,
    },
    body: JSON.stringify(input()),
  }));
  try {
    const res1 = await send('1.1.1.1');
    assert.equal(res1.status, 201);
    const res2 = await send('2.2.2.2');
    assert.equal(res2.status, 201);
    const res3 = await send('3.3.3.3');
    assert.equal(res3.status, 429);
    assert.deepEqual(await res3.json(), { error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' });
    assert.equal(res3.headers.get('cache-control'), 'no-store');

    // Bad rate limit configuration fails closed with 503 sanitized
    process.env.ORDERS_RATE_LIMIT_PER_MINUTE = 'invalid';
    const resBad = await send('4.4.4.4');
    assert.equal(resBad.status, 503);
    assert.deepEqual(await resBad.json(), { error: 'Pesanan belum dapat disimpan. Silakan coba lagi.' });
  } finally {
    delete process.env.ORDERS_DATA_DIR;
    delete process.env.ORDERS_RATE_LIMIT_PER_MINUTE;
    fs.rmSync(dir, {recursive:true, force:true});
  }
});
test('API returns 503 at persistent quota and preserves idempotent replay', async () => {
  const route = path.resolve(__dirname, '../src/app/api/orders/route.ts');
  const { POST } = require(route);
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'orders-api-quota-'));
  process.env.ORDERS_DATA_DIR = dir;
  process.env.ORDERS_MAX_RECORDS = '1';
  const send = (body) => POST(new Request('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  }));
  try {
    const original = input();
    const res1 = await send(original);
    assert.equal(res1.status, 201);
    const data1 = await res1.json();

    // Exceed quota with a new order
    const res2 = await send(input());
    assert.equal(res2.status, 503);
    assert.deepEqual(await res2.json(), { error: 'Pesanan belum dapat disimpan. Silakan coba lagi.' });

    // Idempotent retry of original order succeeds at quota
    const resReplay = await send(original);
    assert.equal(resReplay.status, 201);
    const dataReplay = await resReplay.json();
    assert.equal(dataReplay.order.id, data1.order.id);

    // Concurrent idempotent replays at quota all succeed
    const replayResults = await Promise.all(Array.from({length: 6}, () => send(original)));
    assert.ok(replayResults.every(r => r.status === 201));
    const count = fs.readdirSync(dir).filter(f => /^[a-f0-9]{64}\.json$/.test(f)).length;
    assert.equal(count, 1);
  } finally {
    delete process.env.ORDERS_DATA_DIR;
    delete process.env.ORDERS_MAX_RECORDS;
    fs.rmSync(dir, {recursive:true, force:true});
  }
});
test('cross-process concurrency respects storage quota strictly', async () => {
  const { spawn } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'orders-cproc-'));
  const childCode = `
    const { createOrder } = require(${JSON.stringify(file)});
    const dir = process.argv[1];
    process.env.ORDERS_MAX_RECORDS = '3';
    async function run() {
      const results = [];
      for (let i = 0; i < 4; i++) {
        try {
          await createOrder({ productId: 'chatgpt-plus-private-1m', idempotencyKey: require('node:crypto').randomUUID() }, dir);
          results.push('ok');
        } catch (e) {
          results.push(e.name);
        }
      }
      process.stdout.write(JSON.stringify(results));
    }
    run();
  `;
  try {
    const runChild = () => new Promise((resolve, reject) => {
      const cp = spawn(process.execPath, ['-e', childCode, dir]);
      let stdout = '';
      cp.stdout.on('data', d => { stdout += d.toString(); });
      cp.on('exit', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error('child exited ' + code)));
    });
    const [res1, res2] = await Promise.all([runChild(), runChild()]);
    const totalOk = [...res1, ...res2].filter(r => r === 'ok').length;
    const totalCapacityErrors = [...res1, ...res2].filter(r => r === 'OrderCapacityError').length;
    assert.equal(totalOk, 3);
    assert.equal(totalCapacityErrors, 5);
    const persisted = fs.readdirSync(dir).filter(f => /^[a-f0-9]{64}\.json$/.test(f)).length;
    assert.equal(persisted, 3);
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
  }
});
test('order creation fails closed in production without absolute ORDERS_DATA_DIR or on invalid quota', async () => {
  const { createOrder } = require(file);
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ORDERS_DATA_DIR;
    await assert.rejects(() => createOrder(input()), { name: 'OrderConfigError' });

    process.env.ORDERS_DATA_DIR = './relative/path';
    await assert.rejects(() => createOrder(input()), { name: 'OrderConfigError' });

    const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'orders-bad-quota-'));
    try {
      process.env.ORDERS_DATA_DIR = dir;
      process.env.ORDERS_MAX_RECORDS = '-5';
      await assert.rejects(() => createOrder(input(), dir), { name: 'OrderConfigError' });
      process.env.ORDERS_MAX_RECORDS = 'abc';
      await assert.rejects(() => createOrder(input(), dir), { name: 'OrderConfigError' });
    } finally {
      delete process.env.ORDERS_MAX_RECORDS;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    process.env.NODE_ENV = prevEnv;
    delete process.env.ORDERS_DATA_DIR;
  }
});
test('checkout renders an order-creation button, not a premature WhatsApp link', () => {
  const component = path.resolve(__dirname, '../src/components/ServerCheckout.tsx');
  assert.ok(fs.existsSync(component), 'persisted checkout component must exist');
  const React = require('react');
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(require(component).default, {className:'checkout'}));
  assert.match(html, /<button/);
  assert.match(html, /Checkout via WhatsApp/);
  assert.doesNotMatch(html, /wa.me/);
});
test('receipt renders persisted canonical details without PII or paid claims', async () => {
  const component = path.resolve(__dirname, '../src/app/orders/[token]/page.tsx');
  assert.ok(fs.existsSync(component), 'canonical receipt page must exist');
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'receipt-test-'));
  process.env.ORDERS_DATA_DIR = dir;
  try {
    const order = await require(file).createOrder({productId:'chatgpt-plus-private-1m', idempotencyKey:key()});
    const tree = await require(component).default({params:Promise.resolve({token:order.receiptToken})});
    const html = require('react-dom/server').renderToStaticMarkup(tree);
    assert.ok(html.includes(order.id));
    assert.match(html, /75\.000/);
    assert.match(html, /Belum dibayar/);
    assert.match(html, /ChatGPT Plus Private 1 Bulan/);
    assert.doesNotMatch(html, /email|phone|passcode/);
  } finally { delete process.env.ORDERS_DATA_DIR; fs.rmSync(dir, {recursive:true, force:true}); }
});
test('rejects tampered prices, unknown products, invalid keys and PII without writing', async () => {
  const { createOrder, readOrder } = require(file);
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'orders-invalid-'));
  try {
    for (const input of [null, [], {}, {productId:'other', idempotencyKey:key()}, {productId:'chatgpt-plus-private-1m', idempotencyKey:'../x'}, {productId:'chatgpt-plus-private-1m', idempotencyKey:key(), amount:1}, {productId:'chatgpt-plus-private-1m', idempotencyKey:key(), email:'x@y.com'}]) {
      await assert.rejects(() => createOrder(input, dir), /Invalid order/);
    }
    assert.deepEqual(fs.readdirSync(dir), []);
    assert.equal(await readOrder('../secret', dir), null);
    assert.equal(await readOrder('a'.repeat(64), dir), null);
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
});
test('API creates receipt, blocks foreign origin, malformed JSON, oversized and tampered requests', async () => {
  const route = path.resolve(__dirname, '../src/app/api/orders/route.ts');
  assert.ok(fs.existsSync(route), 'order API must exist');
  const { POST } = require(route);
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'orders-api-'));
  process.env.ORDERS_DATA_DIR = dir;
  const send = (body, origin = 'http://localhost:3000') => POST(new Request('http://localhost:3000/api/orders', {method:'POST', headers:{'content-type':'application/json', origin}, body}));
  try {
    assert.equal((await send('{}', 'https://evil.test')).status, 403);
    assert.equal((await send('{')).status, 400);
    assert.equal((await send('x'.repeat(2049))).status, 413);
    assert.equal((await send(JSON.stringify({productId:'chatgpt-plus-private-1m', idempotencyKey:key(), amount:1}))).status, 400);
    const response = await send(JSON.stringify({productId:'chatgpt-plus-private-1m', idempotencyKey:key()}));
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.equal(data.order.amount, 75000);
    assert.equal(data.receiptPath, `/orders/${data.order.receiptToken}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally { delete process.env.ORDERS_DATA_DIR; fs.rmSync(dir, {recursive:true, force:true}); }
});
test('checkout persists canonical unpaid order and replay returns the same unique record', async () => {
  assert.ok(fs.existsSync(file), 'server order store must exist');
  const { createOrder, readOrder } = require(file);
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'orders-test-'));
  try {
    const input = { productId: 'chatgpt-plus-private-1m', idempotencyKey: key() };
    const orders = await Promise.all(Array.from({length: 8}, () => createOrder(input, dir)));
    assert.equal(new Set(orders.map(o => o.id)).size, 1);
    assert.equal(orders[0].amount, 75000);
    assert.equal(orders[0].status, 'pending_confirmation');
    assert.equal(orders[0].durationMonths, 1);
    assert.deepEqual(await readOrder(orders[0].receiptToken, dir), orders[0]);
    delete require.cache[file];
    assert.deepEqual(await require(file).readOrder(orders[0].receiptToken, dir), orders[0]);
    const other = await createOrder({...input, idempotencyKey: key()}, dir);
    assert.notEqual(other.id, orders[0].id);
    assert.notEqual(other.receiptToken, orders[0].receiptToken);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
