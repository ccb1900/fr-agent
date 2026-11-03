// verify_br_grid.js — 数据浏览器逐格验收：FR 算完的栅格 vs 独立手写 SQL 真值
//
// 真值：db_br_truth.txt（probe_br_truth.js 直查，谓词/排序/OFFSET 全部字面量手写，不走 lib/browser.js）
// 栅格：RESULT_DUMP 产物（make_api.js 4.5 段）
// 核三件事：① 明细每一格（含分页取到的行）② 工具条 total/cur_page/total_pages/page_size
//          ③ 页与页不重复（p1 与 p2 首行必须不同）
var fs = require('fs');

var truth = {};
var seg = null;
fs.readFileSync('D:/fineagent/data/db_br_truth.txt', 'utf8').trim().split(/\r?\n/).forEach(function (l) {
  if (!l) return;
  if (l.indexOf('## ') === 0) {
    var a = l.substring(3).split('|');
    if (a.length < 2 || a[1].indexOf('total=') !== 0) { seg = null; return; } // ## KEY_UNIQUE 之类的说明段不参与对拍
    seg = { key: a[0], total: +a[1].substring(6), rows: [] };
    truth[seg.key] = seg;
  } else if (seg) seg.rows.push(l.split('|'));
});

function gridRows(p) {
  // 明细行特征：行号|file_key|row_number|日期（biz_date 是 nvarchar，库里混写 '2026-9-13' 与 '2026/9/13'，两种都要认）
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(function (l) {
    return /^\d+\|\d+\|\d+\|2026[-\/]/.test(l);
  }).map(function (l) { return l.split('|'); });
}
function gridBar(p) {
  // 工具条现在是"按目标宽度贪心吃列"的排布，格序会随列宽变 → 按标签取后一个非空格，不写死下标
  var a = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(function (x) { return x.indexOf('共|') === 0; })[0].split('|');
  function after(lbl) {
    var i = a.indexOf(lbl);
    for (var k = i + 1; k < a.length; k++) if (a[k] !== '') return { v: a[k], i: k };
    return { v: '', i: -1 };
  }
  var t = after('共'), c = after('条 第'), pg = after('页 / 共'), s = after('页 每页');
  var L = function (i) { return String.fromCharCode(65 + i); };  // 栅格列下标 → A/B/C…（模板列数 < 26）
  return {
    total: t.v, cur: c.v, pages: pg.v, size: s.v,
    curAddr: L(c.i) + '2', pagesAddr: L(pg.i) + '2'
  };
}

var checks = 0, fails = 0;
function eq(a, b, tag) {
  checks++;
  if (a !== b) { fails++; if (fails <= 20) console.log('FAIL ' + tag + ': grid=[' + a + '] truth=[' + b + ']'); }
}

// [栅格文件, 真值段, 页码, 每页行数]
var CASES = [
  ['_br_aaa_grid.txt', 'aaa_p1_size50', 1, 50],
  ['_br_aaa_p2_grid.txt', 'aaa_p2_size50', 2, 50],
  ['_br_aaa_stageL_grid.txt', 'aaa_p1_size10_stageL', 1, 10],
  ['_br_aaa_d13_grid.txt', 'aaa_p1_size20_d13', 1, 20],
  ['_br_gosa_grid.txt', 'gosa_p1_size50', 1, 50],
  ['_br_pwr_grid.txt', 'pwr_p1_size20', 1, 20]
];

CASES.forEach(function (c) {
  var path = 'D:/fineagent/logs/' + c[0], t = truth[c[1]], page = c[2], size = c[3];
  var rows = gridRows(path), bar = gridBar(path);
  eq(rows.length, t.rows.length, c[0] + ' detail rowcount');
  // 行集（不看序）先单列一项：分页正确性 = 行集对；行序 = 展示层。分开才不会一错全糊
  // 栅格首列是行号（_ord），真值段不含它 → 栅格切片从第 2 格起
  var w = t.rows[0].length;
  var gset = rows.map(function (r) { return r.slice(1, w + 1).join('|'); }).sort().join('\n');
  var tset = t.rows.map(function (r) { return r.join('|'); }).sort().join('\n');
  eq(gset === tset, true, c[0] + ' row SET equality (paging membership)');
  t.rows.forEach(function (tr, i) {
    var gr = (rows[i] || []).slice(1);
    eq(rows[i] && rows[i][0], String((page - 1) * size + i + 1), c[0] + ' r' + (i + 1) + ' _ord 行号');
    for (var k = 0; k < tr.length; k++) eq(gr[k], tr[k], c[0] + ' r' + (i + 1) + ' ' + tr[0] + ':' + tr[1] + ' col' + k);
  });
  var pages = Math.ceil(t.total / size);
  eq(bar.total, String(t.total), c[0] + ' total_cnt');
  eq(bar.cur, String(page), c[0] + ' cur_page');
  eq(bar.pages, String(pages), c[0] + ' total_pages');
  eq(bar.size, String(size), c[0] + ' page_size');
});

// 翻页必须换行：p1 首行 ≠ p2 首行，且 p2 首行 = 全序第 51 行（栅格首列是行号，比对时去掉）
var p1 = gridRows('D:/fineagent/logs/_br_aaa_grid.txt'), p2 = gridRows('D:/fineagent/logs/_br_aaa_p2_grid.txt');
eq(p1[0].slice(1).join('|') === p2[0].slice(1).join('|'), false, 'page1/page2 first row must differ');
eq(p2[0].slice(1).join('|'), truth['aaa_p2_size50'].rows[0].join('|'), 'page2 first row = ordered row 51');
// 筛选必须换集合：stage=L 的 total 小于全量，且首行 stage 列 = L
var sl = gridRows('D:/fineagent/logs/_br_aaa_stageL_grid.txt');
eq(sl[0][5], 'L', 'stage filter row1 stage col');
eq(+truth['aaa_p1_size10_stageL'].total < +truth['aaa_p1_size50'].total, true, 'stage=L subset smaller');

// 翻页按钮的页码算式必须引用工具条上真正的页码格/总页数格（地址随列宽变，这里按栅格实测地址回查 cpt）
var DEPLOY = 'D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/';
var OUT = DEPLOY;
[['激光数据浏览器_评分流水_api.cpt', gridBar('D:/fineagent/logs/_br_aaa_grid.txt')],
 ['激光数据浏览器_GOSA误差_api.cpt', gridBar('D:/fineagent/logs/_br_gosa_grid.txt')],
 ['激光数据浏览器_功率计_api.cpt', gridBar('D:/fineagent/logs/_br_pwr_grid.txt')]].forEach(function (x) {
  var xml = fs.readFileSync(DEPLOY + x[0], 'utf8'), b = x[1];
  var want = ['=1', '=' + b.pagesAddr, '=MAX(1,' + b.curAddr + '-1)', '=MIN(' + b.pagesAddr + ',' + b.curAddr + '+1)'];
  want.forEach(function (f) {
    eq(xml.indexOf('<![CDATA[' + f + ']]>') >= 0, true, x[0] + ' 翻页公式 ' + f + '（cur=' + b.curAddr + ' pages=' + b.pagesAddr + '）');
  });
});

// 一页一 SQL 页：纸高（cpt 里的 PaperSize，EMU）× 导出比例 2/3 px/pt 必须 ≈ PNG 实际像素高，
//   否则说明渲染被拆成多页（行高被 FR 按字号放大过，纸高算小了），分页语义就废了
function pngH(p) {
  var b = fs.readFileSync(p);
  return b.readUInt32BE(20);            // IHDR 高
}
[['激光数据浏览器_评分流水_api', 'D:/fineagent/logs/_br_aaa_grid.txt'],
 ['激光数据浏览器_GOSA误差_api', 'D:/fineagent/logs/_br_gosa_grid.txt'],
 ['激光数据浏览器_功率计_api', 'D:/fineagent/logs/_br_pwr_grid.txt']].forEach(function (x) {
  var xml = fs.readFileSync(DEPLOY + x[0] + '.cpt', 'utf8');
  var hpt = +(/PaperSize[^>]*height="(\d+)"/.exec(xml)[1]) / 12700;
  var want = Math.round(hpt * 2 / 3);
  var got = pngH(OUT + x[0] + '.png');
  eq(Math.abs(got - want) <= want * 0.03, true, x[0] + ' 渲染页数=1（纸高 ' + hpt + 'pt → ' + want + 'px，实得 ' + got + 'px）');
});

// 像素级门：负号必须"真的落墨"。一手实证（probe_minus2.js 像素图）：SimHei 8pt 的 '-' 只占位不描墨，
//   "-47.5" 首墨出现在第 7px，负号整格空白；9/10/10.5pt 与 8pt 雅黑/宋体/Arial 正常。
//   栅格 dump 读的是算完的格值（有 '-'），PNG 才反映笔尖，所以这道门只能量像素。
//   判据不依赖字号模型：同一列里挑"纯整数、位数相同、一负一正"的两行比墨迹跨度，负号那条必须明显更宽。
(function () {
  var PS = require('D:/fineagent/probes/tools_pngscan.js');
  var img = PS.decode(OUT + '激光数据浏览器_评分流水_api.png');
  var dark = function (x, y) { var i = y * img.w * img.ch + x * img.ch; return img.data[i] < 90; };
  var fracY = function (y, x0, x1) { var k = 0; for (var x = x0; x <= x1; x++) if (dark(x, y)) k++; return k / (x1 - x0 + 1); };
  var fracX = function (x, y0, y1) { var k = 0; for (var y = y0; y <= y1; y++) if (dark(x, y)) k++; return k / (y1 - y0 + 1); };
  // ① 横贯整幅的横线 → 明细带是"等间距最长的一段"（50 行 → 51 条线，别的带只有 2~3 条）
  //    注意：导出比例 2/3 下每条格线占 2px，先按连续段合并成中心线，否则间距序列全是 1/19 交替
  var hl = PS.runs(function (y) { return fracY(y, 4, img.w - 5) > 0.6; }, img.h)
    .map(function (r) { return Math.round((r[0] + r[1]) / 2); });
  var best = null, cur = [hl[0]];
  for (var i = 1; i < hl.length; i++) {
    var d0 = hl[i] - hl[i - 1], d1 = cur.length > 1 ? cur[cur.length - 1] - cur[cur.length - 2] : d0;
    if (Math.abs(d0 - d1) <= Math.max(2, d1 * 0.15)) cur.push(hl[i]);
    // 断链时新链必须从"上一条线"起头（断点那条间距正是新节拍的开始），否则整链少一条线 → 行号错位
    else { if (!best || cur.length > best.length) best = cur; cur = [hl[i - 1], hl[i]]; }
  }
  if (!best || cur.length > best.length) best = cur;
  // 明细带 = 最长等距链的末尾 51 条线（链头可能把"两行高"的表头也并进来，明细始终贴在链尾）
  var band = best.slice(Math.max(0, best.length - 51));
  eq(band.length >= 51, true, '明细带找到 51 条等距横线（实测 ' + band.length + '）');
  // ② 竖线（列边界）在明细带内取样
  var vl = PS.runs(function (x) { return fracX(x, band[0] + 3, band[band.length - 1] - 3) > 0.6; }, img.w)
    .map(function (r) { return Math.round((r[0] + r[1]) / 2); });
  eq(vl.length, 21, '明细带列边界数 = 20 列 + 右边框（实测 ' + vl.length + '）');
  // ③ 找一列：同一列里存在"纯整数、位数相同、一负一正"的两行
  var rows = gridRows('D:/fineagent/logs/_br_aaa_grid.txt');
  var picked = null;
  for (var c = 1; c < rows[0].length && !picked; c++) {
    var byLen = {};
    rows.forEach(function (r, ri) {
      var v = r[c];
      if (!/^-?\d+$/.test(v)) return;
      var k = v.replace('-', '').length;
      if (v.charAt(0) === '-') (byLen['n' + k] = byLen['n' + k] || []).push(ri);
      else (byLen['p' + k] = byLen['p' + k] || []).push(ri);
    });
    Object.keys(byLen).forEach(function (k) {
      if (k.charAt(0) !== 'n' || !byLen['p' + k.substring(1)] || !byLen[k].length) return;
      picked = { c: c, neg: byLen[k][0], pos: byLen['p' + k.substring(1)][0], digits: +k.substring(1) };
    });
  }
  eq(!!picked, true, '找到可对比的同位数一负一正样本');
  if (picked && band.length > picked.neg + 1 && band.length > picked.pos + 1 && vl.length > picked.c + 1) {
    var x0 = vl[picked.c] + 2, x1 = vl[picked.c + 1] - 2;
    var sn = PS.inkSpan(img, x0, x1, band[picked.neg] + 2, band[picked.neg + 1] - 2);
    var sp = PS.inkSpan(img, x0, x1, band[picked.pos] + 2, band[picked.pos + 1] - 2);
    eq(sn > sp * 1.2, true, '负号落墨：col' + picked.c + ' 值 ' + rows[picked.neg][picked.c] + ' 墨宽 ' + sn + 'px > ' +
      rows[picked.pos][picked.c] + ' 墨宽 ' + sp + 'px ×1.2（' + picked.digits + ' 位数同）');
  }
})();

console.log((fails ? 'FAIL' : 'PASS') + ' checks=' + checks + ' fails=' + fails);
