const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let newContent = content.replace(/\.docs\.map\(doc =>/g, '.docs.map((doc: any) =>');
      newContent = newContent.replace(/\.docs\.map\(d =>/g, '.docs.map((d: any) =>');
      newContent = newContent.replace(/\.docs\.map\(async doc =>/g, '.docs.map(async (doc: any) =>');
      newContent = newContent.replace(/\.docs\.forEach\(doc =>/g, '.docs.forEach((doc: any) =>');
      newContent = newContent.replace(/\.docs\.forEach\(d =>/g, '.docs.forEach((d: any) =>');
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir('c:/WebApp/TaradMooBann/src');
