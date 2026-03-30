const { FieldPath } = require('@google-cloud/firestore');
const {
    firestore,
    COLLECTION_NAME,
    SUB_COLLECTION_NAME,
    getCurrentDbKeyVersion,
    getSessionFileMigrationPlan,
    reencryptSessionFileRecord,
    normalizeDbKeyVersion
} = require('../utils/dbUtils');

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_DOCS = Number.POSITIVE_INFINITY;

const parseArgs = (argv) => {
    const options = {
        dryRun: true,
        batchSize: DEFAULT_BATCH_SIZE,
        maxDocs: DEFAULT_MAX_DOCS,
        targetVersion: getCurrentDbKeyVersion(),
        sessionId: null,
        startAfterPath: null
    };

    for (const arg of argv) {
        if (arg === '--write') {
            options.dryRun = false;
            continue;
        }

        if (arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }

        if (arg.startsWith('--batch-size=')) {
            const value = Number.parseInt(arg.split('=')[1], 10);
            if (Number.isFinite(value) && value > 0 && value <= 400) {
                options.batchSize = value;
            }
            continue;
        }

        if (arg.startsWith('--max-docs=')) {
            const raw = arg.split('=')[1];
            const value = raw === 'all' ? DEFAULT_MAX_DOCS : Number.parseInt(raw, 10);
            if (value === DEFAULT_MAX_DOCS || (Number.isFinite(value) && value > 0)) {
                options.maxDocs = value;
            }
            continue;
        }

        if (arg.startsWith('--target-version=')) {
            options.targetVersion = normalizeDbKeyVersion(arg.split('=')[1]);
            continue;
        }

        if (arg.startsWith('--session-id=')) {
            options.sessionId = String(arg.split('=')[1] || '').trim() || null;
            continue;
        }

        if (arg.startsWith('--start-after-path=')) {
            options.startAfterPath = String(arg.split('=')[1] || '').trim() || null;
        }
    }

    return options;
};

const formatLimit = (value) => (value === DEFAULT_MAX_DOCS ? 'all' : String(value));

const buildBaseQuery = (options) => {
    if (options.sessionId) {
        return firestore
            .collection(COLLECTION_NAME)
            .doc(options.sessionId)
            .collection(SUB_COLLECTION_NAME)
            .orderBy(FieldPath.documentId());
    }

    return firestore
        .collectionGroup(SUB_COLLECTION_NAME)
        .orderBy(FieldPath.documentId());
};

const resolveStartAfterSnapshot = async (options) => {
    if (!options.startAfterPath) {
        return null;
    }

    const snapshot = await firestore.doc(options.startAfterPath).get();
    if (!snapshot.exists) {
        throw new Error(`Start-after document not found: ${options.startAfterPath}`);
    }

    return snapshot;
};

const buildScopedQuery = async (options) => {
    const baseQuery = buildBaseQuery(options);
    const startAfterSnapshot = await resolveStartAfterSnapshot(options);
    return startAfterSnapshot ? baseQuery.startAfter(startAfterSnapshot) : baseQuery;
};

const run = async () => {
    const options = parseArgs(process.argv.slice(2));
    let query = await buildScopedQuery(options);

    console.log('DB encryption migration scan starting...');
    console.log(`  Mode            : ${options.dryRun ? 'dry-run' : 'write'}`);
    console.log(`  Target version  : ${options.targetVersion}`);
    console.log(`  Batch size      : ${options.batchSize}`);
    console.log(`  Max docs        : ${formatLimit(options.maxDocs)}`);
    console.log(`  Session scope   : ${options.sessionId || 'all sessions'}`);
    if (options.startAfterPath) {
        console.log(`  Start after     : ${options.startAfterPath}`);
    }

    let processed = 0;
    let migrated = 0;
    let lastProcessedPath = null;
    let lastMigratedPath = null;
    const skipped = [];
    const versionCounts = {};

    while (processed < options.maxDocs) {
        const remaining = options.maxDocs === DEFAULT_MAX_DOCS
            ? options.batchSize
            : Math.min(options.batchSize, options.maxDocs - processed);

        const snapshot = await query.limit(remaining).get();
        if (snapshot.empty) {
            break;
        }

        let batch = options.dryRun ? null : firestore.batch();
        let batchOps = 0;

        for (const doc of snapshot.docs) {
            processed += 1;
            lastProcessedPath = doc.ref.path;

            const data = doc.data() || {};
            const plan = getSessionFileMigrationPlan(data, options.targetVersion);

            for (const state of Object.values(plan.fieldStates)) {
                if (!state.isEncrypted) {
                    continue;
                }

                const versionKey = state.keyVersion || 'unknown';
                versionCounts[versionKey] = Number(versionCounts[versionKey] || 0) + 1;
            }

            if (!plan.needsMigration) {
                if (processed >= options.maxDocs) {
                    break;
                }
                continue;
            }

            try {
                const nextData = reencryptSessionFileRecord(data, {
                    targetVersion: options.targetVersion
                });

                if (!options.dryRun) {
                    batch.update(doc.ref, nextData);
                    batchOps += 1;
                }

                migrated += 1;
                lastMigratedPath = doc.ref.path;
            } catch (error) {
                skipped.push({
                    path: doc.ref.path,
                    reason: error.message
                });
            }

            if (!options.dryRun && batchOps >= 400) {
                await batch.commit();
                batch = firestore.batch();
                batchOps = 0;
            }

            if (processed >= options.maxDocs) {
                break;
            }
        }

        if (!options.dryRun && batchOps > 0) {
            await batch.commit();
        }

        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        query = query.startAfter(lastDoc);

        if (snapshot.size < remaining) {
            break;
        }
    }

    console.log('DB encryption migration scan finished.');
    console.log(`  Processed docs  : ${processed}`);
    console.log(`  Migrated docs   : ${migrated}`);
    console.log(`  Last processed  : ${lastProcessedPath || 'none'}`);
    console.log(`  Last migrated   : ${lastMigratedPath || 'none'}`);
    console.log(`  Seen versions   : ${JSON.stringify(versionCounts)}`);

    if (skipped.length > 0) {
        console.warn(`  Skipped docs    : ${skipped.length}`);
        skipped.slice(0, 10).forEach((entry) => {
            console.warn(`    - ${entry.path}: ${entry.reason}`);
        });
    }

    if (options.dryRun) {
        console.log('Dry-run only. No Firestore writes were committed.');
    } else {
        console.log('Write mode completed. Verify legacy backlog is zero before flipping DB_ENCRYPTION_KEY_VERSION.');
    }
};

run().catch((error) => {
    console.error('DB encryption migration failed:', error);
    process.exit(1);
});
