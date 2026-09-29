const fs = require('fs');
const path = 'C:\\Users\\YOUSUF AB\\Downloads\\flowercrm-main\\server\\index.js';
let content = fs.readFileSync(path, 'utf8');

// Check line endings
const hasCRLF = content.includes('\r\n');
console.log('Has CRLF:', hasCRLF);

// Normalize to LF for processing
content = content.replace(/\r\n/g, '\n');

// Fix 1: Dashboard Top Products query
const old1 = "GROUP BY COALESCE(oi.product_id, oi.product_name)\n      ORDER BY sold DESC\n      LIMIT 5";
const new1 = "GROUP BY oi.product_id, oi.product_name, p.image, p.price\n      ORDER BY sold DESC\n      LIMIT 5";
if (content.includes(old1)) {
  content = content.replace(old1, new1);
  console.log('Fix 1 applied');
} else {
  console.log('Fix 1 NOT found');
}

// Fix 2: Reports Products/Performance query
const old2 = "GROUP BY COALESCE(oi.product_id, oi.product_name)\n        ORDER BY sold DESC`, fromIso, toIso)\n    res.json({ items })";
const new2 = "GROUP BY oi.product_id, oi.product_name, p.stock, p.image\n        ORDER BY sold DESC`, fromIso, toIso)\n    res.json({ items })";
if (content.includes(old2)) {
  content = content.replace(old2, new2);
  console.log('Fix 2 applied');
} else {
  console.log('Fix 2 NOT found');
}

// Fix 3: Reports CSV Export Products query
const old3 = "GROUP BY COALESCE(oi.product_id, oi.product_name) ORDER BY sold DESC";
const new3 = "GROUP BY oi.product_id, oi.product_name ORDER BY sold DESC";
if (content.includes(old3)) {
  content = content.replace(old3, new3);
  console.log('Fix 3 applied');
} else {
  console.log('Fix 3 NOT found');
}

// Restore CRLF if original had it
if (hasCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(path, content);
console.log('File saved');

// Verify
const lines = content.split('\n');
console.log('Line 398:', lines[397]);
console.log('Line 1234:', lines[1233]);
