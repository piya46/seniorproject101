const fs = require('fs');
const path = require('path');

const defaultPath = path.join(__dirname, '..', 'postman', 'Sci-Request-System.postman_collection.json');
const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

try {
    const collection = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const version = collection.info?.name?.match(/\b(v\d+\.\d+\.\d+)\b/)?.[1];

    if (!version) {
        throw new Error('Version not found in collection name.');
    }

    console.log(version);
} catch (error) {
    console.error(`Failed to read Postman docs version from ${targetPath}`);
    console.error(error.message);
    process.exit(1);
}
