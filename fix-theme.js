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
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
         results.push(file);
      }
    }
  });
  return results;
}

const files = walk('c:\\Users\\kadum\\Desktop\\MES-CLAUDE\\app');

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  const orig = content;
  
  content = content.replace(/text-slate-900/g, 'text-slate-100');
  content = content.replace(/text-slate-800/g, 'text-slate-200');
  content = content.replace(/text-slate-600/g, 'text-slate-400');
  content = content.replace(/text-slate-700/g, 'text-slate-300');
  content = content.replace(/hover:bg-slate-50/g, 'hover:bg-[#2C3645]');
  content = content.replace(/bg-slate-50/g, 'bg-[#1A222C]');
  content = content.replace(/bg-white/g, 'bg-[#1A222C]');
  content = content.replace(/border-slate-200/g, 'border-white/5');
  content = content.replace(/border-slate-300/g, 'border-white/5');
  content = content.replace(/divide-slate-100/g, 'divide-white/5');
  content = content.replace(/divide-slate-200/g, 'divide-white/5');

  if (orig !== content) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Updated:', f);
  }
});
console.log('Done');
