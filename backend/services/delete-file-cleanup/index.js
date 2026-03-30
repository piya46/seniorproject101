const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const express = require('express');

const app = express();

const storage = new Storage();
const firestore = new Firestore({
  databaseId: process.env.FIRESTORE_DATABASE_ID || 'ai-formcheck',
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const SESSION_COLLECTION = process.env.FIRESTORE_COLLECTION_NAME || 'SESSION';
const FILES_SUBCOLLECTION = process.env.FIRESTORE_FILES_SUBCOLLECTION || 'files';

async function deleteBucketObjects(bucketName) {
  const bucket = storage.bucket(bucketName);
  let deleted = 0;
  let pageToken;

  do {
    const [files, nextQuery] = await bucket.getFiles({
      autoPaginate: false,
      pageToken,
      maxResults: 1000,
    });

    for (const file of files) {
      await file.delete({ ignoreNotFound: true });
      deleted += 1;
    }

    pageToken = nextQuery?.pageToken;
  } while (pageToken);

  return deleted;
}

async function deleteSessionFileRecords() {
  const sessionsSnapshot = await firestore.collection(SESSION_COLLECTION).get();
  let deleted = 0;

  for (const sessionDoc of sessionsSnapshot.docs) {
    while (true) {
      const filesSnapshot = await sessionDoc.ref
        .collection(FILES_SUBCOLLECTION)
        .limit(500)
        .get();

      if (filesSnapshot.empty) {
        break;
      }

      const batch = firestore.batch();
      filesSnapshot.docs.forEach((fileDoc) => {
        batch.delete(fileDoc.ref);
        deleted += 1;
      });
      await batch.commit();
    }
  }

  return deleted;
}

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/', async (_req, res) => {
  if (!BUCKET_NAME) {
    return res.status(500).json({ error: 'GCS_BUCKET_NAME is missing.' });
  }

  try {
    const [deletedObjects, deletedRecords] = await Promise.all([
      deleteBucketObjects(BUCKET_NAME),
      deleteSessionFileRecords(),
    ]);

    return res.status(200).json({
      status: 'success',
      bucket: BUCKET_NAME,
      deleted_objects: deletedObjects,
      deleted_file_records: deletedRecords,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Delete file cleanup failed:', error);
    return res.status(500).json({
      error: 'Cleanup failed.',
      message: error.message,
    });
  }
});

app.use((_req, res) => {
  res.status(405).json({ error: 'Method Not Allowed' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Delete file cleanup service listening on ${port}`);
});
