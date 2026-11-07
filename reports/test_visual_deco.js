// reports/test_visual_deco.js — §5步4 视觉验证专项：seriesImage(vbar) + legacy axisX(bar)
//   每项独立 PNG 目检：① seriesImage 图片是否真的画在柱上；② legacy axisX 公共键(fontPt)是否落 ValueAxis/CategoryAxis。
//   fixture 自给：若 logs/_visual_fixture.png 不存在，用本 spec 头部 JS 生成一个最小 PNG（1x1 纯色），
//   不再依赖管线历史产物 logs/_r4m9_off.png（外部审查 P2：换机器/清 logs 后不可复现）。
// 注意：make_api.js 有全局 J(n) 工厂，本载体不得再用 var J 覆盖（曾致 line273 TypeError）。
var JF = (function () { try { return Java.type('java.nio.file.Files'); } catch (e) { return null; } })();
if (JF) {
  // root honors FR_AGENT_HOME (portability; external review P2), default preserved
  var SYSV = Java.type('java.lang.System');
  var ROOTV = SYSV.getenv('FR_AGENT_HOME') || 'D:/fineagent';
  // 棋盘格 fixture（品红/白）：纯色会与默认柱色同色、无法判定 seriesImage 是否真生效
  var F = new (Java.type('java.io.File'))(ROOTV + '/logs/_visual_fixture.png');
  (function () {
    var AWT = Java.type('java.awt.image.BufferedImage');
    var img = new AWT(16, 16, AWT.TYPE_INT_RGB);
    var g = img.createGraphics();
    for (var yy = 0; yy < 16; yy++) for (var xx = 0; xx < 16; xx++) {
      g.setColor(new (Java.type('java.awt.Color'))((((xx >> 1) + (yy >> 1)) % 2) ? 0xFF00FF : 0xFFFFFF));
      g.fillRect(xx, yy, 1, 1);
    }
    g.dispose();
    Java.type('javax.imageio.ImageIO').write(img, 'png', F);
  })();
}
var SPEC = {
  outName: '能力自检_视觉装饰',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [700],
      blocks: [
        { type: 'cells', heightPt: 30, items: [{ c: 0, span: 1, text: 'P1 visual: seriesImage + legacy axisX' }] },
        { type: 'chart', kind: 'vbar', dataset: 'ds', category: '机型', values: ['产量'], heightPt: 320,
          seriesImage: { image: 'logs/_visual_fixture.png', layout: 1 } },
        { type: 'chart', kind: 'bar', dataset: 'ds', category: '机型', values: ['产量'], title: '', heightPt: 320,
          axisX: { fontPt: 14 }, axisY: { fontPt: 14 } }
      ]
    }],
    datasets: [{
      name: 'ds',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }],
      rows: [['A线', 120], ['B线', 200], ['C线', 160]]
    }]
  }
};
