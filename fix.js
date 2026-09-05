const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (content.includes('|| "provider-1"')) {
        content = content.replace(/\|\|\s*"provider-1"/g, '|| (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "provider-1" : "")');
        changed = true;
    }
    if (content.includes('|| "customer-1"')) {
        content = content.replace(/\|\|\s*"customer-1"/g, '|| (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "customer-1" : "")');
        changed = true;
    }
    
    // Server-side process.env fallback logic
    if (content.includes('? "provider-1" : null)')) {
        // Already ok
    }

    if (changed) {
        fs.writeFileSync(file, content);
        console.log('Fixed', file);
    }
});
