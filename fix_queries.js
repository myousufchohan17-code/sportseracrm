const fs = require('fs');
const path = 'C:\\Users\\YOUSUF AB\\Downloads\\flowercrm-main\\server\\index.js';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: Dashboard Top Products query (line 398)
content = content.replace(
  "GROUP BY COALESCE(oi.product_id, oi.product_name)\n      ORDER BY sold DESC\n      LIMIT 5",
  "GROUP BY oi.product_id, oi.product_name, p.image, p.price\n      ORDER BY sold DESC\n      LIMIT 5"
);

// Fix 2: Reports Products/Performance query (line 1234)
content = content.replace(
  "GROUP BY COALESCE(oi.product_id, oi.product_name)\n        ORDER BY sold DESC`, fromIso, toIso)\n    res.json({ items })",
  "GROUP BY oi.product_id, oi.product_name, p.stock, p.image\n        ORDER BY sold DESC`, fromIso, toIso)\n    res.json({ items })"
);

fs.writeFileSync(path, content);
console.log('Fixes applied successfully');

// Verify the changes
const lines = content.split('\n');
console.log('Line 398:', lines[397]);
console.log('Line 1234:', lines[1233]);
