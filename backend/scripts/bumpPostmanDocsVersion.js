const fs = require('fs');
const path = require('path');

const nextVersion = process.argv[2];

if (!nextVersion || !/^v\d+\.\d+\.\d+$/.test(nextVersion)) {
    console.error('Usage: node scripts/bumpPostmanDocsVersion.js vX.Y.Z');
    process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const postmanDir = path.join(__dirname, '..', 'postman');
const collectionPath = path.join(postmanDir, 'Sci-Request-System.postman_collection.json');
const readmePath = path.join(postmanDir, 'README.md');
const changelogPath = path.join(postmanDir, 'CHANGELOG_POSTMAN_DOCS.md');

const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
collection.info.name = collection.info.name.replace(/\bv\d+\.\d+\.\d+\b/, nextVersion);

const description = collection.info.description?.content || '';
collection.info.description = {
    type: 'text/markdown',
    content: description
        .replace(/\*\*Version:\*\*\s*v\d+\.\d+\.\d+/, `**Version:** ${nextVersion}`)
        .replace(/\*\*Last Updated:\*\*\s*\d{4}-\d{2}-\d{2}/, `**Last Updated:** ${today}`)
};

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2) + '\n');

const updateTextVersion = (filePath, replacements) => {
    let text = fs.readFileSync(filePath, 'utf8');
    for (const [pattern, replacement] of replacements) {
        text = text.replace(pattern, replacement);
    }
    fs.writeFileSync(filePath, text);
};

updateTextVersion(readmePath, [
    [/Version:\s*`v\d+\.\d+\.\d+`/, `Version: \`${nextVersion}\``],
    [/Last updated:\s*`\d{4}-\d{2}-\d{2}`/, `Last updated: \`${today}\``]
]);

let changelog = fs.readFileSync(changelogPath, 'utf8');
changelog = changelog
    .replace(/Current version:\s*`v\d+\.\d+\.\d+`/, `Current version: \`${nextVersion}\``)
    .replace(/Last updated:\s*`\d{4}-\d{2}-\d{2}`/, `Last updated: \`${today}\``);

if (!new RegExp(`^## ${nextVersion}$`, 'm').test(changelog)) {
    const header = `# Changelog Postman Docs\n\nCurrent version: \`${nextVersion}\`\nLast updated: \`${today}\`\n\n`;
    const rest = changelog.replace(/^# Changelog Postman Docs\n\nCurrent version:\s*`v\d+\.\d+\.\d+`\nLast updated:\s*`\d{4}-\d{2}-\d{2}`\n\n/, '');
    const newSection = [
        `## ${nextVersion}`,
        '',
        'สรุปการเปลี่ยนแปลงหลักของชุด Postman docs รอบนี้:',
        '',
        '- อัปเดตสรุปการเปลี่ยนแปลงที่นี่',
        '',
        'Breaking change:',
        '',
        '- ระบุถ้ามี breaking change',
        '',
        'ผลกระทบฝั่งทีม:',
        '',
        '- ระบุสิ่งที่ทีมต้องทำต่อ',
        '',
    ].join('\n');
    changelog = header + newSection + '\n' + rest;
}

fs.writeFileSync(changelogPath, changelog);

require('./syncApiDocumentationFromPostman');

console.log(`Postman docs version bumped to ${nextVersion}`);
