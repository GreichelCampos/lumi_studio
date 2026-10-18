const { app } = require('electron');
const path = require('node:path');
const value = name => process.argv.find(arg => arg.startsWith(name)).slice(name.length);
const desktopRoot = value('--lumi-test-root=');
app.setPath('userData', value('--lumi-test-user-data='));
app.getAppPath = () => desktopRoot;
require(path.join(desktopRoot, 'dist/main.cjs'));
