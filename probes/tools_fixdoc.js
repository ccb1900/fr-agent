const fs = require('fs');
const p = 'D:/fineagent/GENERATOR_DESIGN.md';
let s = fs.readFileSync(p, 'utf8');
const bt = String.fromCharCode(96);
const dbl = 'extendParameters="true"' + bt + bt + '）';
if (s.indexOf(dbl) >= 0) {
  s = s.replace(dbl, 'extendParameters="true"' + bt + '）');
  fs.writeFileSync(p, s);
  console.log('deduped');
} else console.log('no double found');
const i = s.indexOf('序列化实证');
console.log(JSON.stringify(s.substr(i, 130)));
const lines = s.split(/\r?\n/);
lines.forEach((l, k) => {
  const n = (l.split(bt).length - 1);
  if (n % 2 === 1) console.log('ODD-BACKTICK line ' + (k + 1) + ' (' + n + '): ' + l.slice(0, 90));
});
