const fs = require('fs');
const path = require('path');

// Path to your package.json and manifest.json files
const packagePath = path.join(__dirname, 'package.json');
const manifestPath = path.join(__dirname, 'manifest.json');

// Read package.json to get the current version
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = packageJson.version;

// Read manifest.json
const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update version in manifest.json
manifestJson.version = version;

// Write the updated manifest.json back to file
fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2), 'utf8');

console.log(`Updated manifest version to ${version}`);
