const fs = require('fs');
const path = require('path');

const COLLECTION_FILE = path.join(__dirname, '..', 'postman', 'Sci-Request-System.postman_collection.json');

const {
    POSTMAN_API_KEY,
    POSTMAN_COLLECTION_UID,
    POSTMAN_WORKSPACE_ID,
    POSTMAN_API_BASE_URL = 'https://api.getpostman.com'
} = process.env;

const fail = (message) => {
    console.error(message);
    process.exit(1);
};

const ensureConfig = () => {
    if (!POSTMAN_API_KEY) {
        fail('Missing POSTMAN_API_KEY.');
    }

    if (!POSTMAN_COLLECTION_UID && !POSTMAN_WORKSPACE_ID) {
        fail('Provide POSTMAN_COLLECTION_UID to update an existing collection or POSTMAN_WORKSPACE_ID to create one.');
    }
};

const publish = async () => {
    ensureConfig();

    const collection = JSON.parse(fs.readFileSync(COLLECTION_FILE, 'utf8'));
    const payload = JSON.stringify({ collection });

    const isUpdate = Boolean(POSTMAN_COLLECTION_UID);
    const url = isUpdate
        ? `${POSTMAN_API_BASE_URL}/collections/${POSTMAN_COLLECTION_UID}`
        : `${POSTMAN_API_BASE_URL}/collections?workspace=${POSTMAN_WORKSPACE_ID}`;
    const method = isUpdate ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': POSTMAN_API_KEY
        },
        body: payload
    });

    const responseText = await response.text();
    let responseJson = {};

    try {
        responseJson = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        responseJson = { raw: responseText };
    }

    if (!response.ok) {
        fail(`Postman publish failed (${response.status}): ${JSON.stringify(responseJson)}`);
    }

    const publishedUid = responseJson?.collection?.uid || POSTMAN_COLLECTION_UID;
    console.log(`${isUpdate ? 'Updated' : 'Created'} Postman collection successfully.`);
    if (publishedUid) {
        console.log(`Collection UID: ${publishedUid}`);
    }
};

publish().catch((error) => fail(`Unexpected Postman publish error: ${error.message}`));
