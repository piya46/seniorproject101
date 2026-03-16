const fs = require('fs');
const path = require('path');
const vm = require('vm');

const POSTMAN_DIR = path.join(__dirname, '..', 'postman');
const COLLECTION_FILE = path.join(POSTMAN_DIR, 'Sci-Request-System.postman_collection.json');
const ENV_FILES = [
    path.join(POSTMAN_DIR, 'Sci-Request-System.local.postman_environment.json'),
    path.join(POSTMAN_DIR, 'Sci-Request-System.staging.postman_environment.json'),
    path.join(POSTMAN_DIR, 'Sci-Request-System.production.postman_environment.json')
];
const README_FILE = path.join(POSTMAN_DIR, 'README.md');
const CHANGELOG_FILE = path.join(POSTMAN_DIR, 'CHANGELOG_POSTMAN_DOCS.md');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const extractVersion = (label, text, regex) => {
    const match = text.match(regex);
    if (!match) {
        throw new Error(`Could not find ${label} version.`);
    }
    return match[1];
};

const collectScripts = (collection) => {
    const scripts = [];

    for (const event of collection.event || []) {
        if (event.script?.exec) scripts.push(event.script.exec.join('\n'));
    }

    const walk = (items) => {
        for (const item of items || []) {
            for (const event of item.event || []) {
                if (event.script?.exec) scripts.push(event.script.exec.join('\n'));
            }
            walk(item.item);
        }
    };

    walk(collection.item);
    return scripts;
};

const ensureMarkdownDescriptions = (collection) => {
    const badDescriptions = [];

    const inspectItem = (item, itemPath) => {
        if (item.description && item.description.type !== 'text/markdown') {
            badDescriptions.push(`${itemPath} description`);
        }
        if (item.request?.description && item.request.description.type !== 'text/markdown') {
            badDescriptions.push(`${itemPath} request.description`);
        }
        for (const child of item.item || []) {
            inspectItem(child, `${itemPath} > ${child.name}`);
        }
    };

    if (collection.info.description?.type !== 'text/markdown') {
        badDescriptions.push('collection info.description');
    }

    for (const item of collection.item || []) {
        inspectItem(item, item.name);
    }

    if (badDescriptions.length > 0) {
        throw new Error(`Descriptions must be text/markdown:\n- ${badDescriptions.join('\n- ')}`);
    }
};

const main = () => {
    const collection = readJson(COLLECTION_FILE);
    ENV_FILES.forEach(readJson);

    const readme = readText(README_FILE);
    const changelog = readText(CHANGELOG_FILE);

    const collectionVersion = extractVersion(
        'collection',
        collection.info.name,
        /\b(v\d+\.\d+\.\d+)\b/
    );
    const readmeVersion = extractVersion(
        'README',
        readme,
        /Version:\s*`(v\d+\.\d+\.\d+)`/
    );
    const changelogVersion = extractVersion(
        'CHANGELOG',
        changelog,
        /Current version:\s*`(v\d+\.\d+\.\d+)`/
    );

    if (new Set([collectionVersion, readmeVersion, changelogVersion]).size !== 1) {
        throw new Error(
            `Version mismatch detected: collection=${collectionVersion}, README=${readmeVersion}, CHANGELOG=${changelogVersion}`
        );
    }

    const collectionDescription = collection.info.description?.content || '';
    if (!collectionDescription.includes(`**Version:** ${collectionVersion}`)) {
        throw new Error('Collection description does not include the current version banner.');
    }

    ensureMarkdownDescriptions(collection);

    const scripts = collectScripts(collection);
    scripts.forEach((script, index) => {
        new vm.Script(script, { filename: `postman-script-${index}.js` });
    });

    console.log('Postman docs validation passed.');
    console.log(`Version: ${collectionVersion}`);
    console.log(`Collection scripts checked: ${scripts.length}`);
    console.log(`Environments checked: ${ENV_FILES.length}`);
};

try {
    main();
} catch (error) {
    console.error('Postman docs validation failed.');
    console.error(error.message);
    process.exit(1);
}
