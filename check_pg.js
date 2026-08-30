const fs = require('fs');
const path = require('path');

// I'll try to read package.json to see if pg is installed.
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
console.log('Dependencies:', pkg.dependencies);
