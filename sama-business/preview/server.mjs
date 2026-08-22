import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, '../src/legacy-v9.html');
const PORT = Number(process.env.PORT || 3000);
const sessions = new Map();

const nowIso = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const token = () => `sama_${crypto.randomBytes(48).toString('base64url')}`;
const clone = (value) => structuredClone(value);
const sendJson = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-samabusiness-preview': 'isolated-mock',
  });
  res.end(JSON.stringify(body));
};
const send = (res, status, contentType, body, extra = {}) => {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'x-samabusiness-preview': 'isolated-mock',
    ...extra,
  });
  res.end(body);
};

const seed = () => {
  const accountId = id();
  const merchantId = id();
  const p1 = id(), p2 = id(), p3 = id();
  const orderId = id();
  const deliveryId = id();
  const today = Date.now();
  return {
    account: {
      id: accountId,
      identifier_type: 'phone',
      display_identifier: '+221770000000',
      is_active: true,
      role: 'merchant',
      access: { role: 'merchant', status: 'active', plan: 'preview', trial_active: true, paid_active: true, suspended: false, can_write: true },
    },
    merchant: {
      id: merchantId,
      account_id: accountId,
      name: 'Boutique Démo Dakar',
      business_type: 'Commerce',
      phone: '+221770000000',
      country_code: 'SN',
      currency: 'XOF',
      locale: 'fr-SN',
      timezone: 'Africa/Dakar',
    },
    products: [
      { id: p1, client_ref: id(), sku: 'TS-001', name: 'T-shirt Sénégal', category: 'Mode', unit: 'pièce', sale_price: 12000, purchase_cost: 6500, stock_quantity: 8, low_stock_threshold: 3, track_stock: true, active: true, image_url: null, notes: null, metadata: {}, created_at: nowIso(), updated_at: nowIso() },
      { id: p2, client_ref: id(), sku: 'ENS-001', name: 'Ensemble Sénégal', category: 'Mode', unit: 'pièce', sale_price: 18000, purchase_cost: 10000, stock_quantity: 2, low_stock_threshold: 3, track_stock: true, active: true, image_url: null, notes: null, metadata: {}, created_at: nowIso(), updated_at: nowIso() },
      { id: p3, client_ref: id(), sku: 'SNK-001', name: 'Sneakers précommande', category: 'Chaussures', unit: 'paire', sale_price: 25000, purchase_cost: 16500, stock_quantity: 0, low_stock_threshold: 1, track_stock: false, active: true, image_url: null, notes: null, metadata: {}, created_at: nowIso(), updated_at: nowIso() },
    ],
    sales: [
      { id: id(), client_ref: id(), customer_name_snapshot: 'Awa Ndiaye', customer_phone_snapshot: '221771112233', description: 'T-shirt Sénégal', total_amount: 12000, paid_amount: 12000, remaining_amount: 0, due_date: null, source: 'manual', notes: null, happened_at: new Date(today - 45 * 60_000).toISOString(), created_at: nowIso(), updated_at: nowIso(), cost_amount: 6500, delivery_cost: 0, payment_method: 'wave', order_id: null, profit_amount: 5500 },
      { id: id(), client_ref: id(), customer_name_snapshot: 'Moussa Fall', customer_phone_snapshot: '221761234567', description: 'Ensemble Sénégal', total_amount: 18000, paid_amount: 10000, remaining_amount: 8000, due_date: null, source: 'whatsapp', notes: null, happened_at: new Date(today - 3 * 60 * 60_000).toISOString(), created_at: nowIso(), updated_at: nowIso(), cost_amount: 10000, delivery_cost: 1500, payment_method: 'cash', order_id: orderId, profit_amount: 6500 },
    ],
    expenses: [
      { id: id(), client_ref: id(), category: 'transport', label: 'Transport marchandises', amount: 2500, payment_method: 'cash', scope: 'business', related_order_id: null, receipt_url: null, notes: null, happened_at: new Date(today - 2 * 60 * 60_000).toISOString(), created_at: nowIso(), updated_at: nowIso() },
    ],
    cashMovements: [],
    orders: [
      { id: orderId, client_ref: id(), order_number: 'CMD-DEMO-001', source: 'whatsapp', status: 'confirmed', payment_status: 'partial', delivery_status: 'pending', customer_name: 'Moussa Fall', customer_phone: '221761234567', customer_whatsapp: '221761234567', delivery_address: 'Parcelles Assainies, Dakar', delivery_area: 'Parcelles Assainies', landmark: null, requested_for: null, subtotal: 18000, delivery_fee: 1500, delivery_cost: 1000, discount_amount: 0, total_amount: 19500, paid_amount: 10000, cost_amount: 10000, payment_method: 'cash', payment_reference: null, raw_message: 'Je veux un ensemble Sénégal taille L, livraison aux Parcelles.', missing_fields: [], sale_id: null, delivery_id: deliveryId, notes: null, metadata: {}, created_at: nowIso(), updated_at: nowIso(), confirmed_at: nowIso(), delivered_at: null, sama_order_items: [{ id: id(), product_id: p2, product_name: 'Ensemble Sénégal', variant: 'L', quantity: 1, unit_price: 18000, unit_cost: 10000, line_total: 18000, line_cost: 10000, notes: null }] },
    ],
    deliveries: [
      { id: deliveryId, delivery_number: 'LIV-DEMO-001', source_type: 'sama_business_order', source_reference: orderId, recipient_name: 'Moussa Fall', recipient_phone: '221761234567', delivery_address: 'Parcelles Assainies, Dakar', delivery_area: 'Parcelles Assainies', amount_to_collect: 9500, payment_received: 0, amount_remaining: 9500, delivery_fee: 1500, payment_status: 'unpaid', status: 'unassigned', assigned_driver_id: null, scheduled_for: null, created_at: nowIso(), updated_at: nowIso(), public_token: 'preview' },
    ],
    subscriptionPayments: [],
  };
};

const sessionFor = (req) => {
  const raw = String(req.headers['x-sama-session'] || '');
  return raw && sessions.get(raw) ? { token: raw, data: sessions.get(raw) } : null;
};

const summary = (db) => {
  const salesTotal = db.sales.reduce((s, x) => s + Number(x.total_amount || 0), 0);
  const collected = db.sales.reduce((s, x) => s + Number(x.paid_amount || 0), 0);
  const outstanding = db.sales.reduce((s, x) => s + Number(x.remaining_amount || 0), 0);
  const cogs = db.sales.reduce((s, x) => s + Number(x.cost_amount || 0), 0);
  const deliveryCosts = db.sales.reduce((s, x) => s + Number(x.delivery_cost || 0), 0);
  const businessExpenses = db.expenses.filter(x => x.scope !== 'personal').reduce((s, x) => s + Number(x.amount || 0), 0);
  const personalExpenses = db.expenses.filter(x => x.scope === 'personal').reduce((s, x) => s + Number(x.amount || 0), 0);
  const withdrawals = db.cashMovements.filter(x => x.movement_type === 'owner_withdrawal').reduce((s, x) => s + Number(x.amount || 0), 0);
  const deposits = db.cashMovements.filter(x => x.movement_type === 'owner_deposit').reduce((s, x) => s + Number(x.amount || 0), 0);
  const realProfit = salesTotal - cogs - deliveryCosts - businessExpenses;
  return {
    merchant_id: db.merchant.id,
    business_date: new Date().toISOString().slice(0, 10),
    sales_total: salesTotal,
    collected_total: collected,
    outstanding_total: outstanding,
    cogs_total: cogs,
    delivery_cost_total: deliveryCosts,
    business_expenses: businessExpenses,
    personal_expenses: personalExpenses,
    owner_withdrawals: withdrawals,
    owner_deposits: deposits,
    sales_count: db.sales.length,
    real_profit: realProfit,
    withdrawable_amount: Math.max(0, collected - businessExpenses - withdrawals + deposits),
  };
};

const bootstrap = (db) => ({
  ok: true,
  version: 'preview-isolated-1.0.0',
  preview: true,
  account: db.account,
  merchant: db.merchant,
  access: db.account.access,
  summary: summary(db),
  sales: db.sales,
  products: db.products,
  expenses: db.expenses,
  cashMovements: db.cashMovements,
  orders: db.orders,
  deliveries: db.deliveries,
  subscriptionPayments: db.subscriptionPayments,
  alerts: {
    lowStock: db.products.filter(p => p.track_stock && Number(p.stock_quantity) <= Number(p.low_stock_threshold)),
    missingCosts: db.sales.filter(s => Number(s.cost_amount) === 0).slice(0, 20),
    unpaidOrders: db.orders.filter(o => o.payment_status !== 'paid' && !['cancelled', 'failed'].includes(o.status)).slice(0, 20),
  },
});

function parseWhatsapp(text = '') {
  const raw = String(text).slice(0, 6000);
  const phone = (raw.match(/(?:\+?221)?(7[05678]\d{7})/) || [])[1] || '';
  const amount = Number(((raw.match(/(\d[\d\s.]{2,})\s*(?:f\s*cfa|fcfa|cfa|f)\b/i) || [])[1] || '0').replace(/\D/g, ''));
  const size = (raw.match(/\b(XXL|XL|XS|S|M|L|2XL|3XL)\b/i) || [])[1] || '';
  const lower = raw.toLowerCase();
  const area = lower.includes('parcelles') ? 'Parcelles Assainies' : lower.includes('pikine') ? 'Pikine' : lower.includes('guediawaye') ? 'Guédiawaye' : lower.includes('yoff') ? 'Yoff' : '';
  return {
    raw_message: raw,
    customer_name: '',
    customer_phone: phone ? `221${phone}`.replace(/^221221/, '221') : '',
    product_text: raw.split(/\n|\./)[0].slice(0, 140) || 'Produit démo',
    quantity: 1,
    sizes: size ? [size.toUpperCase()] : [],
    colors: ['noir', 'blanc', 'vert', 'rouge', 'jaune', 'bleu'].filter(c => lower.includes(c)),
    delivery_area: area,
    delivery_address: area,
    payment_method: lower.includes('wave') ? 'wave' : lower.includes('orange') ? 'orange_money' : 'cash',
    detected_amount: amount,
    missing_fields: [phone ? null : 'téléphone', area ? null : 'adresse'].filter(Boolean),
    confidence: 0.82,
  };
}

async function handleApi(req, res) {
  let body = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Corps JSON invalide.' });
  }
  const action = String(body.action || '');

  if (action === 'login' || action === 'register') {
    const db = seed();
    db.account.identifier_type = body.identifierType === 'email' ? 'email' : 'phone';
    db.account.display_identifier = String(body.identifier || 'preview@demo.local');
    if (action === 'register' && String(body.businessName || '').trim()) db.merchant.name = String(body.businessName).trim().slice(0, 120);
    const t = token();
    sessions.set(t, db);
    return sendJson(res, 200, { ok: true, preview: true, token: t, expiresAt: new Date(Date.now() + 6 * 60 * 60_000).toISOString(), account: db.account, merchant: db.merchant, access: db.account.access });
  }

  const ctx = sessionFor(req);
  if (!ctx) return sendJson(res, 401, { ok: false, error: 'Session Preview requise.' });
  const db = ctx.data;

  if (action === 'logout') {
    sessions.delete(ctx.token);
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'business_bootstrap' || action === 'bootstrap') return sendJson(res, 200, bootstrap(db));
  if (action === 'sync_sales' || action === 'sync_operations') return sendJson(res, 200, { ok: true, preview: true });
  if (action === 'parse_whatsapp_order') return sendJson(res, 200, { ok: true, parsed: parseWhatsapp(body.text) });

  if (action === 'save_product') {
    const existing = body.id ? db.products.find(p => p.id === body.id) : null;
    const product = existing || { id: id(), client_ref: body.clientRef || id(), active: true, image_url: null, notes: null, metadata: {}, created_at: nowIso() };
    Object.assign(product, {
      sku: body.sku || null, name: String(body.name || 'Produit démo').slice(0, 160), category: body.category || null,
      unit: body.unit || 'pièce', sale_price: Number(body.salePrice || 0), purchase_cost: Number(body.purchaseCost || 0),
      stock_quantity: Number(body.stockQuantity || 0), low_stock_threshold: Number(body.lowStockThreshold || 3), track_stock: body.trackStock !== false, updated_at: nowIso(),
    });
    if (!existing) db.products.unshift(product);
    return sendJson(res, 200, { ok: true, product });
  }

  if (action === 'stock_movement') {
    const product = db.products.find(p => p.id === body.productId);
    if (!product) return sendJson(res, 404, { ok: false, error: 'Produit démo introuvable.' });
    let delta = Number(body.quantityDelta || 0);
    if (['loss', 'damage', 'return_out'].includes(body.movementType) && delta > 0) delta = -delta;
    if (['opening', 'purchase', 'return_in'].includes(body.movementType) && delta < 0) delta = Math.abs(delta);
    product.stock_quantity = Math.max(0, Number(product.stock_quantity || 0) + delta);
    if (body.movementType === 'purchase' && Number(body.unitCost) > 0) product.purchase_cost = Number(body.unitCost);
    product.updated_at = nowIso();
    return sendJson(res, 200, { ok: true, product, movement: { id: id(), product_id: product.id, movement_type: body.movementType, quantity_delta: delta, unit_cost: Number(body.unitCost || 0), happened_at: body.happenedAt || nowIso() } });
  }

  if (action === 'record_expense') {
    const expense = { id: id(), client_ref: body.clientRef || id(), category: body.category || 'autre', label: String(body.label || 'Dépense démo'), amount: Number(body.amount || 0), payment_method: body.paymentMethod || 'cash', scope: body.scope === 'personal' ? 'personal' : 'business', related_order_id: body.orderId || null, receipt_url: null, notes: body.notes || null, happened_at: body.happenedAt || nowIso(), created_at: nowIso(), updated_at: nowIso() };
    db.expenses.unshift(expense);
    return sendJson(res, 200, { ok: true, expense });
  }

  if (action === 'record_cash_movement') {
    const movement = { id: id(), client_ref: body.clientRef || id(), movement_type: body.movementType || 'owner_withdrawal', amount: Number(body.amount || 0), payment_method: body.paymentMethod || 'cash', reason: body.reason || null, happened_at: body.happenedAt || nowIso(), created_at: nowIso() };
    db.cashMovements.unshift(movement);
    return sendJson(res, 200, { ok: true, movement });
  }

  if (action === 'create_business_sale' || action === 'create_sale') {
    const items = Array.isArray(body.items) ? body.items : [];
    const total = items.reduce((s, i) => s + Number(i.quantity || 1) * Number(i.unitPrice || 0), 0);
    const cost = items.reduce((s, i) => s + Number(i.quantity || 1) * Number(i.unitCost || 0), 0);
    const paid = Math.min(Number(body.paidAmount || 0), total);
    const sale = { id: id(), client_ref: body.clientRef || id(), customer_name_snapshot: body.customerName || 'Client démo', customer_phone_snapshot: body.customerPhone || null, description: body.description || items.map(i => i.productName).join(', ') || 'Vente démo', total_amount: total, paid_amount: paid, remaining_amount: Math.max(0, total - paid), due_date: null, source: body.source || 'manual', notes: null, happened_at: body.happenedAt || nowIso(), created_at: nowIso(), updated_at: nowIso(), cost_amount: cost, delivery_cost: Number(body.deliveryCost || 0), payment_method: body.paymentMethod || 'cash', order_id: body.orderId || null, profit_amount: total - cost - Number(body.deliveryCost || 0) };
    db.sales.unshift(sale);
    for (const item of items) {
      if (!item.productId) continue;
      const product = db.products.find(p => p.id === item.productId);
      if (product?.track_stock) product.stock_quantity = Math.max(0, Number(product.stock_quantity || 0) - Number(item.quantity || 1));
    }
    if (body.orderId) {
      const order = db.orders.find(o => o.id === body.orderId);
      if (order) order.sale_id = sale.id;
    }
    return sendJson(res, 200, { ok: true, sale });
  }

  if (action === 'save_order') {
    const order = {
      id: body.id || id(), client_ref: body.clientRef || id(), order_number: body.orderNumber || `CMD-DEMO-${String(db.orders.length + 1).padStart(3, '0')}`,
      source: body.source || 'manual', status: body.status || 'draft', payment_status: Number(body.paidAmount || 0) > 0 ? 'partial' : 'unpaid', delivery_status: 'pending',
      customer_name: body.customerName || null, customer_phone: body.customerPhone || null, customer_whatsapp: body.customerPhone || null,
      delivery_address: body.deliveryAddress || null, delivery_area: body.deliveryArea || null, landmark: body.landmark || null, requested_for: null,
      subtotal: (body.items || []).reduce((s, i) => s + Number(i.quantity || 1) * Number(i.unitPrice || 0), 0), delivery_fee: Number(body.deliveryFee || 0), delivery_cost: Number(body.deliveryCost || 0), discount_amount: 0,
      total_amount: 0, paid_amount: Number(body.paidAmount || 0), cost_amount: (body.items || []).reduce((s, i) => s + Number(i.quantity || 1) * Number(i.unitCost || 0), 0),
      payment_method: body.paymentMethod || 'cash', payment_reference: null, raw_message: body.rawMessage || null, missing_fields: body.missingFields || [], sale_id: null, delivery_id: null, notes: null, metadata: { preview: true }, created_at: nowIso(), updated_at: nowIso(), confirmed_at: body.status === 'confirmed' ? nowIso() : null, delivered_at: null,
      sama_order_items: (body.items || []).map(i => ({ id: id(), product_id: i.productId || null, product_name: i.productName || 'Article', variant: i.variant || null, quantity: Number(i.quantity || 1), unit_price: Number(i.unitPrice || 0), unit_cost: Number(i.unitCost || 0), line_total: Number(i.quantity || 1) * Number(i.unitPrice || 0), line_cost: Number(i.quantity || 1) * Number(i.unitCost || 0), notes: null })),
    };
    order.total_amount = order.subtotal + order.delivery_fee;
    const idx = db.orders.findIndex(o => o.id === order.id);
    if (idx >= 0) db.orders[idx] = order; else db.orders.unshift(order);
    return sendJson(res, 200, { ok: true, order });
  }

  if (action === 'create_delivery') {
    const delivery = { id: id(), delivery_number: `LIV-DEMO-${String(db.deliveries.length + 1).padStart(3, '0')}`, source_type: body.orderId ? 'sama_business_order' : 'manual', source_reference: body.orderId || null, recipient_name: body.recipientName || 'Client démo', recipient_phone: body.recipientPhone || '', delivery_address: body.deliveryAddress || '', delivery_area: body.deliveryArea || '', amount_to_collect: Number(body.amountToCollect || 0), payment_received: 0, amount_remaining: Number(body.amountToCollect || 0), delivery_fee: Number(body.deliveryFee || 0), payment_status: Number(body.amountToCollect || 0) > 0 ? 'unpaid' : 'paid', status: 'unassigned', assigned_driver_id: null, scheduled_for: null, created_at: nowIso(), updated_at: nowIso(), public_token: 'preview' };
    db.deliveries.unshift(delivery);
    if (body.orderId) {
      const order = db.orders.find(o => o.id === body.orderId);
      if (order) { order.delivery_id = delivery.id; order.delivery_status = 'pending'; }
    }
    return sendJson(res, 200, { ok: true, delivery });
  }

  if (action === 'update_order_status') {
    const order = db.orders.find(o => o.id === body.orderId);
    if (!order) return sendJson(res, 404, { ok: false, error: 'Commande démo introuvable.' });
    order.status = body.status || order.status;
    order.updated_at = nowIso();
    return sendJson(res, 200, { ok: true, order });
  }

  return sendJson(res, 404, { ok: false, error: `Action Preview inconnue: ${action}` });
}

const htmlSource = await readFile(sourcePath, 'utf8');
const previewBanner = `<div style="position:sticky;top:0;z-index:9999;background:#7a3e00;color:#fff;padding:9px 14px;text-align:center;font:800 12px/1.2 system-ui">PREVIEW ISOLÉE — DONNÉES FICTIVES — AUCUNE ACTION SUR LA PRODUCTION</div>`;
const previewHtml = htmlSource
  .replace("const API_URL='https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1/sama-business-api';", "const API_URL='/api';")
  .replace('<body>', `<body>${previewBanner}`)
  .replace("const APP_VERSION='9.0.0';", "const APP_VERSION='9.0.0-preview';");

const manifest = JSON.stringify({
  name: 'SAMA BUSINESS — Preview isolée', short_name: 'SAMA Preview', start_url: '/', scope: '/', display: 'standalone', background_color: '#f8faf8', theme_color: '#123c2f',
  icons: [{ src: '/?mode=icon&size=192', sizes: '192x192', type: 'image/svg+xml' }, { src: '/?mode=icon&size=512', sizes: '512x512', type: 'image/svg+xml' }],
});
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#123c2f"/><text x="256" y="310" text-anchor="middle" fill="white" font-size="180" font-family="Arial,sans-serif" font-weight="900">SB</text></svg>`;
const sw = `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',()=>{});`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://preview.local');
  if (req.method === 'POST' && url.pathname === '/api') return handleApi(req, res);
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Méthode non autorisée.' });
  if (url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'samabusiness-preview-isolated', production_access: false, sessions: sessions.size });
  if (url.searchParams.get('mode') === 'manifest') return send(res, 200, 'application/manifest+json; charset=utf-8', manifest);
  if (url.searchParams.get('mode') === 'icon') return send(res, 200, 'image/svg+xml; charset=utf-8', iconSvg);
  if (url.searchParams.get('mode') === 'sw') return send(res, 200, 'application/javascript; charset=utf-8', sw, { 'service-worker-allowed': '/' });
  return send(res, 200, 'text/html; charset=utf-8', previewHtml, {
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SAMABUSINESS isolated preview listening on ${PORT}`);
});
