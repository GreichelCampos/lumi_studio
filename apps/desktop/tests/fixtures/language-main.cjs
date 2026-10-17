const childProcess = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const originalSpawn = childProcess.spawn;
global.lumiObservedResponses = [];
childProcess.spawn = function (...args) {
  const child = Reflect.apply(originalSpawn, this, args);
  if (Array.isArray(args[1]) && args[1].includes('services.worker')) {
    let pending = '';
    const decoder = new StringDecoder('utf8');
    child.stdout.on('data', chunk => {
      pending += decoder.write(chunk);
      let newline;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const frame = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        global.lumiObservedResponses.push(JSON.parse(frame));
      }
    });
  }
  return child;
};
require('./workspace-main.cjs');
