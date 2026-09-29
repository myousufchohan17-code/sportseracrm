const fs = require('fs');
const path = 'C:\\Users\\YOUSUF AB\\Downloads\\flowercrm-main\\server\\index.js';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Show lines 396-401 with character codes
for (let i = 395; i <= 401; i++) {
  const line = lines[i];
  console.log(`Line ${i+1}:`, JSON.stringify(line));
}

console.log('---');

// Show lines 1232-1237
for (let i = 1231; i <= 1237; i++) {
  const line = lines[i];
  console.log(`Line ${i+1}:`, JSON.stringify(line));
}

// Check for the exact substring
const searchStr = 'GROUP BY COALESCE(oi.product_id, oi.product_name)';
const idx = content.indexOf(searchStr);
console.log('\nFirst occurrence at index:', idx);
if (idx >= 0) {
  console.log('Context:', JSON.stringify(content.substring(idx - 50, idx + 100)));
}
