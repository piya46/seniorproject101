const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, '..', 'postman', 'Sci-Request-System.postman_collection.json');
const apiDocPath = path.join(__dirname, '..', 'API_DOCUMENTATION.md');

function extractMetadataFromCollection(collection) {
  const name = collection.info?.name || '';
  const description = collection.info?.description?.content || '';

  const version = name.match(/\b(v\d+\.\d+\.\d+)\b/)?.[1];
  const lastUpdated = description.match(/\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1];

  if (!version) {
    throw new Error('Version not found in Postman collection name.');
  }

  if (!lastUpdated) {
    throw new Error('Last Updated not found in Postman collection description.');
  }

  return { version, lastUpdated };
}

function syncApiDocumentation(version, lastUpdated) {
  let text = fs.readFileSync(apiDocPath, 'utf8');

  text = text
    .replace(/Version:\s*`v\d+\.\d+\.\d+`/, `Version: \`${version}\``)
    .replace(/Last updated:\s*`\d{4}-\d{2}-\d{2}`/, `Last updated: \`${lastUpdated}\``);

  fs.writeFileSync(apiDocPath, text);
}

try {
  const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  const { version, lastUpdated } = extractMetadataFromCollection(collection);
  syncApiDocumentation(version, lastUpdated);
  console.log(`API_DOCUMENTATION.md synced to ${version} (${lastUpdated})`);
} catch (error) {
  console.error('Failed to sync API_DOCUMENTATION.md from Postman docs');
  console.error(error.message);
  process.exit(1);
}
