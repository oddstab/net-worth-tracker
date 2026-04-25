const fs = require('fs');
const content = fs.readFileSync('./js/ui/modal.js', 'utf8');

try {
  new Function(content.replace(/^import .+$/mg, '').replace(/^export /mg, ''));
  fs.writeFileSync('./result.txt', 'No syntax errors\n');
} catch(e) {
  fs.writeFileSync('./result.txt', 'Error: ' + e.message + '\n');
}
