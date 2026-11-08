// acceptance/tools/gen_fixture.js — Agent 验收基准固定数据生成器（Nashorn ES5，确定性、零引擎）
//   产物：acceptance/fixtures/sales/{orders,products,customers,employees,inventory,warehouses}.json
//         + schema.json（逻辑表结构）+ expected.json（真值 oracle）+ manifest.json（逐文件 sha256）
//   纪律：
//     ① 同一 seed/代码 → 同一字节（时间、随机源、文件序都不参与）；哈希口径 = sha256(LF 归一化 UTF-8)，
//        避免 Windows checkout 的 CRLF 转换改变"固定数据"的指纹（README 有说明）。
//     ② 真值 oracle 由本脚本从同一份 fixture 行独立求和得出，不经过报表编译器/引擎；它是"报表算得对不对"的
//        对拍基线，不证明源数据业务正确（README §数据 明确边界）。跨语言抽查见 docs/night-shift-log.md。
//     ③ 边界数据是刻意放的：负利润、零金额、空城市、无数据月份、重复日期；每条在 expected.json 有计数键。
//   运行：java -cp <nashorn.jar> jdk.nashorn.tools.Shell acceptance/tools/gen_fixture.js
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var StandardCharsets = J('java.nio.charset.StandardCharsets');
var MessageDigest = J('java.security.MessageDigest');

var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var OUT = ROOT + '/acceptance/fixtures/sales';
var SEED = 20261108;
var FIXTURE_VERSION = '1.0.0';

function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
function ensureDir(p) { Files.createDirectories(Paths.get(p)); }
function writeText(p, text) { Files.write(Paths.get(p), J('java.lang.String').valueOf(text).getBytes('UTF-8')); }
function jsonText(o) { return JSON.stringify(o, null, 2) + '\n'; }
function hexOf(bytes) {
  var HEX = '0123456789abcdef';
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    out += HEX.charAt((b >> 4) & 0xf) + HEX.charAt(b & 0xf);
  }
  return out;
}
function sha256(text) {
  var md = MessageDigest.getInstance('SHA-256');
  return hexOf(md.digest(J('java.lang.String').valueOf(text).getBytes('UTF-8')));
}
function round4(x) { return Math.round(x * 10000) / 10000; }

// Park-Miller LCG：seed*16807 最大约 3.6e13，在 IEEE-754 安全整数内 → 跨引擎可复现。
var seedState = SEED;
function rnd() {
  seedState = (seedState * 16807) % 2147483647;
  return seedState;
}

// ---- 维度数据（手工定值：业务名字/省份全名/部门/仓库，保证地图与分组可复现）----
var products = [
  { id: 'P01', name: '典藏威士忌', category: '威士忌', price: 880, cost: 620 },
  { id: 'P02', name: '特调威士忌707', category: '威士忌', price: 1280, cost: 940 },
  { id: 'P03', name: '金标轩尼诗', category: '威士忌', price: 1580, cost: 1260 },
  { id: 'P04', name: '人头马X.O', category: '威士忌', price: 2280, cost: 1890 },
  { id: 'P05', name: '茅台1935', category: '白酒', price: 1180, cost: 980 },
  { id: 'P06', name: '五粮液普五', category: '白酒', price: 1099, cost: 860 },
  { id: 'P07', name: '国窖1573', category: '白酒', price: 980, cost: 760 },
  { id: 'P08', name: '拉菲传奇红', category: '葡萄酒', price: 399, cost: 260 },
  { id: 'P09', name: '奔富BIN389', category: '葡萄酒', price: 568, cost: 420 },
  { id: 'P10', name: '精酿白啤', category: '啤酒', price: 36, cost: 28 },
  { id: 'P11', name: '气泡水', category: '软饮', price: 8, cost: 9 },
  { id: 'P12', name: '品鉴礼盒', category: '礼盒', price: 199, cost: 240 }
];
var customers = [
  { id: 'C01', name: '上海云商贸易', province: '上海市', city: '上海市', region: '华东' },
  { id: 'C02', name: '南京金穗商贸', province: '江苏省', city: '南京市', region: '华东' },
  { id: 'C03', name: '杭州西湖名品', province: '浙江省', city: '杭州市', region: '华东' },
  { id: 'C04', name: '苏州观前酒行', province: '江苏省', city: '苏州市', region: '华东' },
  { id: 'C05', name: '北京华贸酒业', province: '北京市', city: '北京市', region: '华北' },
  { id: 'C06', name: '石家庄燕赵商行', province: '河北省', city: '石家庄市', region: '华北' },
  { id: 'C07', name: '广州珠江贸易', province: '广东省', city: '广州市', region: '华南' },
  { id: 'C08', name: '深圳前海优品', province: '广东省', city: '深圳市', region: '华南' },
  { id: 'C09', name: '福州闽江商贸', province: '福建省', city: '福州市', region: '华南' },
  { id: 'C10', name: '成都天府酒业', province: '四川省', city: '成都市', region: '西南' },
  { id: 'C11', name: '重庆山城商贸', province: '重庆市', city: '重庆市', region: '西南' },
  { id: 'C12', name: '西安丝路商行', province: '陕西省', city: '西安市', region: '西北' },
  { id: 'C13', name: '兰州黄河商贸', province: '甘肃省', city: '兰州市', region: '西北' },
  { id: 'C14', name: '昆明滇池名品', province: '云南省', city: '', region: '西南' }
];
var employees = [
  { id: 'E01', name: '霍华德', dept: '销售一部', region: '华东' },
  { id: 'E02', name: '马歇尔', dept: '销售一部', region: '华北' },
  { id: 'E03', name: '安杰利斯卡', dept: '销售二部', region: '华南' },
  { id: 'E04', name: '谢航', dept: '销售二部', region: '华北' },
  { id: 'E05', name: '邵平', dept: '渠道部', region: '华南' },
  { id: 'E06', name: '含枫', dept: '渠道部', region: '华东' },
  { id: 'E07', name: '李慕白', dept: '销售一部', region: '西南' },
  { id: 'E08', name: '陈数', dept: '销售二部', region: '西南' },
  { id: 'E09', name: '赵敏', dept: '渠道部', region: '西北' }
];
var warehouses = [
  { id: 'W01', name: '上海中心仓', province: '上海市', city: '上海市' },
  { id: 'W02', name: '北京北方仓', province: '北京市', city: '北京市' },
  { id: 'W03', name: '广州华南仓', province: '广东省', city: '广州市' },
  { id: 'W04', name: '成都西南仓', province: '四川省', city: '成都市' }
];

// ---- 时间轴：2024-07 .. 2026-06（24 个月，去掉 2025-02 = 无数据期间）----
var months = [];
(function () {
  var y = 2024, m = 7;
  while (y < 2026 || (y === 2026 && m <= 6)) {
    if (!(y === 2025 && m === 2)) months.push({ y: y, m: m, label: y + '-' + pad(m, 2) });
    m++;
    if (m > 12) { m = 1; y++; }
  }
})();

// ---- 订单：每月 8 行，客户/产品/员工用确定性轮转保证每个维度都被覆盖 ----
var orders = [];
for (var mi = 0; mi < months.length; mi++) {
  var mo = months[mi];
  for (var oi = 0; oi < 8; oi++) {
    var cust = customers[(mi * 3 + oi * 5) % customers.length];
    var prod = products[(mi * 7 + oi * 3) % products.length];
    var emp = employees[(mi * 2 + oi * 4) % employees.length];
    var qty = ((mi * 13 + oi * 7) % 25) + 1;
    if (mi === 0 && oi === 0) qty = 0;                     // 零值边界：金额 0
    var day = ((mi * 5 + oi * 11) % 27) + 1;
    var amount = qty * prod.price;
    var cost = qty * prod.cost;
    orders.push({
      orderId: 'SO' + mo.y + pad(mo.m, 2) + '-' + pad(oi + 1, 3),
      orderDate: mo.y + '-' + pad(mo.m, 2) + '-' + pad(day, 2),
      customerId: cust.id,
      productId: prod.id,
      employeeId: emp.id,
      region: cust.region,                                  // 反规范化列（报表直取；源头=客户表）
      qty: qty,
      unitPrice: prod.price,
      amount: amount,
      cost: cost,
      profit: amount - cost
    });
  }
}

// ---- 库存：产品 × 仓库（48 行），期末 = 期初 + 入库 - 出库 ----
var inventory = [];
for (var pi = 0; pi < products.length; pi++) {
  for (var wi = 0; wi < warehouses.length; wi++) {
    var opening = 40 + ((pi * 7 + wi * 11) % 160);
    var inbound = (pi * 13 + wi * 5) % 80;
    var outbound = (pi * 3 + wi * 17) % 70;
    if (outbound > opening + inbound) outbound = opening + inbound;
    inventory.push({
      productId: products[pi].id,
      warehouseId: warehouses[wi].id,
      opening: opening,
      inbound: inbound,
      outbound: outbound,
      closing: opening + inbound - outbound
    });
  }
}

// ---- 真值 oracle（独立于报表编译器：直接遍历 fixture 行）----
function newMap() { return Object.create(null); }
function add(map, key, v) { map[key] = (map[key] || 0) + v; }
function keysOf(map) { return Object.keys(map).sort(); }

var orderById = newMap();
var prodById = newMap();
var custById = newMap();
var empById = newMap();
products.forEach(function (p) { prodById[p.id] = p; });
customers.forEach(function (c) { custById[c.id] = c; });
employees.forEach(function (e) { empById[e.id] = e; });
orders.forEach(function (o) { orderById[o.orderId] = o; });

var totalQty = 0, totalAmount = 0, totalProfit = 0, negRows = 0, zeroRows = 0, emptyCityRows = 0;
var regionAmount = newMap(), regionOrders = newMap(), regionCust = newMap();
var provinceAmount = newMap();
var monthAmount = newMap();
var productAmount = newMap();
var deptAmount = newMap();
var empAmount = newMap();
var categoryAmount = newMap();
var custSetByRegion = newMap();
var allCust = newMap(), allProd = newMap(), allEmp = newMap();

orders.forEach(function (o) {
  var c = custById[o.customerId];
  var e = empById[o.employeeId];
  var p = prodById[o.productId];
  totalQty += o.qty; totalAmount += o.amount; totalProfit += o.profit;
  if (o.profit < 0) negRows++;
  if (o.amount === 0) zeroRows++;
  if (c.city === '') emptyCityRows++;
  add(regionAmount, c.region, o.amount);
  add(regionOrders, c.region, 1);
  if (!custSetByRegion[c.region]) custSetByRegion[c.region] = Object.create(null);
  custSetByRegion[c.region][c.id] = 1;
  add(provinceAmount, c.province, o.amount);
  add(monthAmount, o.orderDate.substring(0, 7), o.amount);
  add(productAmount, p.name, o.amount);
  add(deptAmount, e.dept, o.amount);
  add(empAmount, e.name, o.amount);
  add(categoryAmount, p.category, o.amount);
  allCust[o.customerId] = 1; allProd[o.productId] = 1; allEmp[o.employeeId] = 1;
});

var regions = ['华东', '华北', '华南', '西南', '西北'];
regions.forEach(function (r) {
  var set = custSetByRegion[r] || {};
  regionCust[r] = Object.keys(set).length;
});

var months12 = [];
for (var my = 2025, mmn = 7; my < 2026 || (my === 2026 && mmn <= 6); mmn++) {
  months12.push(my + '-' + pad(mmn, 2));
  if (mmn === 12) { mmn = 0; my++; }
}
var month12Amount = newMap();
months12.forEach(function (k) { month12Amount[k] = monthAmount[k] || 0; });

var prodRows = products.map(function (p) { return { id: p.id, name: p.name, amount: productAmount[p.name] || 0 }; });
prodRows.sort(function (a, b) { return (b.amount - a.amount) || (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)); });
var prodAmountRows = products.map(function (p) { return { id: p.id, name: p.name, amount: productAmount[p.name] || 0 }; });
prodAmountRows.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
var prodAmountById = newMap();
prodAmountRows.forEach(function (r) { prodAmountById[r.id] = r; });

var empRows = employees.map(function (e) { return { id: e.id, name: e.name, dept: e.dept, amount: empAmount[e.name] || 0 }; });
var empRank = empRows.slice(0);
empRank.sort(function (a, b) { return (b.amount - a.amount) || (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)); });

var first = orderById['SO202407-001'];
var invByKey = newMap();
inventory.forEach(function (r) { invByKey[r.productId + '.' + r.warehouseId] = r; });
function inv(k) { return invByKey[k]; }
function invSum(field) {
  var n = 0;
  inventory.forEach(function (r) { n += r[field]; });
  return n;
}

var currentAmount = 0, previousAmount = 0;
orders.forEach(function (o) {
  var ym = o.orderDate.substring(0, 7);
  if (ym >= '2025-07' && ym <= '2026-06') currentAmount += o.amount;
  if (ym >= '2024-07' && ym <= '2025-06') previousAmount += o.amount;
});
var lastMonthAmount = monthAmount['2026-06'] || 0;
var prevMonthAmount = monthAmount['2026-05'] || 0;

var K = {
  'orders.count': orders.length,
  'orders.qty': totalQty,
  'orders.amount': totalAmount,
  'orders.profit': totalProfit,
  'orders.customers': Object.keys(allCust).length,
  'orders.products': Object.keys(allProd).length,
  'orders.employees': Object.keys(allEmp).length,
  'orders.negativeProfitRows': negRows,
  'orders.zeroAmountRows': zeroRows,
  'orders.emptyCityRows': emptyCityRows,
  'orders.first.orderId': first.orderId,
  'orders.first.qty': first.qty,
  'orders.first.unitPrice': first.unitPrice,
  'orders.first.amount': first.amount,
  'orders.row2.orderId': orderById['SO202407-002'].orderId,
  'orders.row2.qty': orderById['SO202407-002'].qty,
  'orders.row2.unitPrice': orderById['SO202407-002'].unitPrice,
  'orders.row2.amount': orderById['SO202407-002'].amount,
  'months.noData': ['2025-02'],
  'months.12': months12,
  'totals.profitRate': round4(totalProfit / totalAmount)
};
regions.forEach(function (r) {
  K['region.' + r + '.amount'] = regionAmount[r] || 0;
  K['region.' + r + '.orders'] = regionOrders[r] || 0;
  K['region.' + r + '.customers'] = regionCust[r] || 0;
});
months12.forEach(function (k) { K['month.' + k + '.amount'] = month12Amount[k]; });
K['month.2025-02.amount'] = 0;   // 无数据期间：聚合键存在且为 0（防"缺月"被当成有数据）
products.forEach(function (p) {
  var row = prodAmountById[p.id];
  K['product.' + p.id + '.amount'] = row.amount;
  K['product.' + p.id + '.name'] = p.name;
  K['category.' + p.category + '.amount'] = categoryAmount[p.category] || 0;
});
K['product.top10'] = prodRows.slice(0, 10).map(function (r) { return r.name; });
K['product.top10.ids'] = prodRows.slice(0, 10).map(function (r) { return r.id; });
K['product.top10.amounts'] = prodRows.slice(0, 10).map(function (r) { return r.amount; });
['销售一部', '销售二部', '渠道部'].forEach(function (d) { K['dept.' + d + '.amount'] = deptAmount[d] || 0; });
employees.forEach(function (e) { K['employee.' + e.id + '.amount'] = empAmount[e.name] || 0; });
K['employee.rank'] = empRank.map(function (r) { return r.name; });
K['employee.rank.amounts'] = empRank.map(function (r) { return r.amount; });
keysOf(provinceAmount).forEach(function (p) { K['province.' + p + '.amount'] = provinceAmount[p]; });
K['province.count'] = keysOf(provinceAmount).length;
K['inventory.rows'] = inventory.length;
K['inventory.opening.total'] = invSum('opening');
K['inventory.inbound.total'] = invSum('inbound');
K['inventory.outbound.total'] = invSum('outbound');
K['inventory.closing.total'] = invSum('closing');
['P01.W01', 'P05.W02', 'P12.W04'].forEach(function (k) {
  var r = inv(k);
  K['inventory.' + k + '.closing'] = r.closing;
  K['inventory.' + k + '.opening'] = r.opening;
  K['inventory.' + k + '.inbound'] = r.inbound;
  K['inventory.' + k + '.outbound'] = r.outbound;
});
K['analysis.mom.lastAmount'] = lastMonthAmount;
K['analysis.mom.prevAmount'] = prevMonthAmount;
K['analysis.mom.rate'] = (prevMonthAmount === 0) ? null : round4((lastMonthAmount - prevMonthAmount) / prevMonthAmount);
K['analysis.yoy.currentAmount'] = currentAmount;
K['analysis.yoy.previousAmount'] = previousAmount;
K['analysis.yoy.rate'] = (previousAmount === 0) ? null : round4((currentAmount - previousAmount) / previousAmount);
K['filter.region.华东.amount'] = regionAmount['华东'] || 0;
K['filter.region.华东.rows'] = regionOrders['华东'] || 0;

// ---- schema.json（逻辑结构；orders.region 为反规范化便利列，源头=客户表）----
var schema = {
  fixtureVersion: FIXTURE_VERSION,
  source: 'acceptance/tools/gen_fixture.js（seed=' + SEED + '）',
  dialect: 'logical（与 FineReport 数据集无关；rows 路=JSON 行，SQL 路需建同构表）',
  tables: {
    orders: {
      rowCount: orders.length,
      primaryKey: ['orderId'],
      foreignKeys: { customerId: 'customers.id', productId: 'products.id', employeeId: 'employees.id' },
      columns: [
        { name: 'orderId', type: 'text', nullable: false },
        { name: 'orderDate', type: 'date', nullable: false },
        { name: 'customerId', type: 'text', nullable: false },
        { name: 'productId', type: 'text', nullable: false },
        { name: 'employeeId', type: 'text', nullable: false },
        { name: 'region', type: 'text', nullable: false, note: 'denormalized from customers.region' },
        { name: 'qty', type: 'integer', nullable: false },
        { name: 'unitPrice', type: 'integer', nullable: false, note: 'CNY per unit' },
        { name: 'amount', type: 'integer', nullable: false, note: 'qty * unitPrice' },
        { name: 'cost', type: 'integer', nullable: false },
        { name: 'profit', type: 'integer', nullable: false, note: 'amount - cost; negative rows exist on purpose' }
      ]
    },
    products: {
      rowCount: products.length, primaryKey: ['id'],
      columns: [
        { name: 'id', type: 'text', nullable: false }, { name: 'name', type: 'text', nullable: false },
        { name: 'category', type: 'text', nullable: false }, { name: 'price', type: 'integer', nullable: false },
        { name: 'cost', type: 'integer', nullable: false, note: 'standard cost per unit' }
      ]
    },
    customers: {
      rowCount: customers.length, primaryKey: ['id'],
      columns: [
        { name: 'id', type: 'text', nullable: false }, { name: 'name', type: 'text', nullable: false },
        { name: 'province', type: 'text', nullable: false }, { name: 'city', type: 'text', nullable: true, note: 'one row with empty city (edge case)' },
        { name: 'region', type: 'text', nullable: false }
      ]
    },
    employees: {
      rowCount: employees.length, primaryKey: ['id'],
      columns: [
        { name: 'id', type: 'text', nullable: false }, { name: 'name', type: 'text', nullable: false },
        { name: 'dept', type: 'text', nullable: false }, { name: 'region', type: 'text', nullable: false }
      ]
    },
    inventory: {
      rowCount: inventory.length, primaryKey: ['productId', 'warehouseId'],
      foreignKeys: { productId: 'products.id', warehouseId: 'warehouses.id' },
      columns: [
        { name: 'productId', type: 'text', nullable: false }, { name: 'warehouseId', type: 'text', nullable: false },
        { name: 'opening', type: 'integer', nullable: false }, { name: 'inbound', type: 'integer', nullable: false },
        { name: 'outbound', type: 'integer', nullable: false }, { name: 'closing', type: 'integer', nullable: false, note: 'opening + inbound - outbound' }
      ]
    },
    warehouses: {
      rowCount: warehouses.length, primaryKey: ['id'],
      columns: [
        { name: 'id', type: 'text', nullable: false }, { name: 'name', type: 'text', nullable: false },
        { name: 'province', type: 'text', nullable: false }, { name: 'city', type: 'text', nullable: false }
      ]
    }
  },
  edgeCases: {
    noDataMonths: ['2025-02'],
    negativeProfitRows: negRows,
    zeroAmountRows: zeroRows,
    emptyCityRows: emptyCityRows,
    duplicateDates: 'every month has 8 orders sharing a small set of dates'
  }
};

var expected = {
  fixtureVersion: FIXTURE_VERSION,
  fixture: 'sales',
  seed: SEED,
  oracle: 'computed by acceptance/tools/gen_fixture.js from the fixture rows; independent of lib/spec_compiler + FineReport engine',
  rounding: 'amounts are integers; rates are rounded to 4 decimals; null rate means denominator is 0',
  keys: K
};

// ---- 写盘 + 逐文件哈希（先清掉旧产物里本脚本不产的文件？不：只覆盖已知文件，manifest 只列产物）----
ensureDir(OUT);
var payload = {
  'orders.json': jsonText(orders),
  'products.json': jsonText(products),
  'customers.json': jsonText(customers),
  'employees.json': jsonText(employees),
  'inventory.json': jsonText(inventory),
  'warehouses.json': jsonText(warehouses),
  'schema.json': jsonText(schema),
  'expected.json': jsonText(expected)
};
var fileNames = Object.keys(payload).sort();
fileNames.forEach(function (name) { writeText(OUT + '/' + name, payload[name]); });

var files = {};
var totalBytes = 0;
fileNames.forEach(function (name) {
  var bytes = J('java.lang.String').valueOf(payload[name]).getBytes('UTF-8');
  totalBytes += bytes.length;
  files[name] = { bytes: bytes.length, sha256: sha256(payload[name]) };
});
var manifest = {
  fixtureVersion: FIXTURE_VERSION,
  fixture: 'sales',
  seed: SEED,
  generatedBy: 'acceptance/tools/gen_fixture.js',
  hashAlgorithm: 'sha256 over LF-normalized UTF-8 text',
  rows: { orders: orders.length, products: products.length, customers: customers.length, employees: employees.length, inventory: inventory.length, warehouses: warehouses.length },
  files: files,
  totalBytes: totalBytes
};
writeText(OUT + '/manifest.json', jsonText(manifest));

// 自检：清单里的哈希必须等于磁盘内容（防写盘编码差异）
var recheckOk = true;
fileNames.forEach(function (name) {
  var text = String(new (J('java.lang.String'))(Files.readAllBytes(Paths.get(OUT + '/' + name)), 'UTF-8'));
  if (sha256(text) !== files[name].sha256) recheckOk = false;
});
print(JSON.stringify({
  ok: recheckOk,
  fixture: 'sales',
  version: FIXTURE_VERSION,
  seed: SEED,
  orders: orders.length,
  months: months.length,
  oracleKeys: Object.keys(K).length,
  out: 'acceptance/fixtures/sales',
  manifestSha256: sha256(jsonText(manifest))
}));
System.exit(recheckOk ? 0 : 1);
