import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url); const ts=require('typescript');
const root=fileURLToPath(new URL('../../../../',import.meta.url)); const records=[];
function scan(directory) {
  for(const entry of readdirSync(directory,{withFileTypes:true})) {
    const file=join(directory,entry.name);
    if(entry.isDirectory()) scan(file);
    else if(file.endsWith('.tsx')) {
      const text=readFileSync(file,'utf8'); const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      function visit(node) {
        if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&['button','input','select','textarea'].includes(node.tagName.getText(source))) {
          const attributes={}; for(const attribute of node.attributes.properties) if(ts.isJsxAttribute(attribute)) attributes[attribute.name.getText(source)]=attribute.initializer?.getText(source)??'true';
          const position=source.getLineAndCharacterOfPosition(node.getStart(source));
          records.push({file:file.slice(root.length).replaceAll('\\','/'),line:position.line+1,element:node.tagName.getText(source),
            id:attributes.id??'',title:attributes.title??'',label:attributes['aria-label']??'',action:attributes.onClick??attributes.onChange??'',
            disabled:attributes.disabled??'',verification:'source inventory; runtime verification listed separately in report'});
        }
        ts.forEachChild(node,visit);
      }
      visit(source);
    }
  }
}
scan(join(root,'apps/desktop/renderer/src/components'));
writeFileSync(join(root,'docs/audits/phase10a/controls.json'),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify({sourceControls:records.length,files:new Set(records.map(record=>record.file)).size}));
