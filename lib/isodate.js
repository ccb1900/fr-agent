// lib/isodate.js — I5.1 日期有效性单点（P4 一处真相；纯函数零依赖，仿 lib/ir.js 可离线单测）
//   spec_validator（I1）与 semantic/query/sqlbuilder（I5）此前各写各的日期判断，松紧不一（单边 dateRange、
//   '2026-99-99' 都放过）。本件唯一权威：格式 yyyy-MM-dd + 日历真实存在（月 1-12、日按大小月+闰年 2 月）。
var IsoDate = (function () {
  function isStr(v) { return typeof v === 'string'; }
  function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  var MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // 返回 null=合法，或人读错误串（调用方包成结构化错）
  function validate(s) {
    if (!isStr(s) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'date must be literal yyyy-MM-dd, got: ' + s;
    var y = +s.slice(0, 4), mo = +s.slice(5, 7), d = +s.slice(8, 10);
    if (mo < 1 || mo > 12) return 'month out of range (1-12): ' + s;
    var max = MDAYS[mo - 1] + (mo === 2 && leap(y) ? 1 : 0);
    if (d < 1 || d > max) return 'day ' + d + ' out of range for ' + y + '-' + mo + ' (1-' + max + ')';
    return null;
  }

  // dateRange 语义（用户拍板：严格双边）：from 与 to 必须同时提供且各自合法，且 from<=to。
  // 返回 {ok:true} 或 {ok:false, errors:[{code,path,message}]}
  function range(r) {
    var errs = [];
    function E(code, path, msg) { errs.push({ code: code, path: path, message: msg }); }
    if (!r || typeof r !== 'object') { E('INVALID_TYPE', 'dateRange', 'dateRange must be an object {from,to}'); return { ok: false, errors: errs }; }
    var hasF = r.from != null, hasT = r.to != null;
    if (!hasF || !hasT) { E('REQUIRED', 'dateRange', 'dateRange 必须同时提供 from 与 to（严格双边）'); return { ok: false, errors: errs }; }
    var ef = validate(r.from), et = validate(r.to);
    if (ef) E('INVALID_TYPE', 'dateRange.from', ef);
    if (et) E('INVALID_TYPE', 'dateRange.to', et);
    if (!ef && !et && String(r.from) > String(r.to)) E('INVALID_SHAPE', 'dateRange', 'dateRange.from 不得晚于 to: ' + r.from + '>' + r.to);
    return { ok: errs.length === 0, errors: errs };
  }

  return { validate: validate, range: range, leap: leap };
})();
