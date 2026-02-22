var fs = require('fs'),
  p = require('path'),
  r = p.resolve('../..');
function l(s, d) {
  if (!fs.existsSync(d)) fs.symlinkSync(s, d, 'junction');
}
l(p.join(r, 'node_modules'), 'node_modules');
l(p.join(r, 'apps/cockpit/node_modules'), 'apps/cockpit/node_modules');
console.log('done');
