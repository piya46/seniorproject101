const express = require('express');
const multer = require('multer');
const net = require('net');

const app = express();

const DEFAULT_MAX_SCAN_BYTES = 10 * 1024 * 1024;
const DEFAULT_CLAMAV_PORT = 3310;
const DEFAULT_CLAMAV_TIMEOUT_MS = 30000;
const EICAR_SIGNATURE =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

const getMaxScanBytes = () => {
  const parsed = Number.parseInt(String(process.env.DOCUMENT_AV_SCANNER_MAX_BYTES || DEFAULT_MAX_SCAN_BYTES), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_SCAN_BYTES;
};

const getClamAvHost = () => String(process.env.CLAMAV_HOST || '').trim();

const getClamAvPort = () => {
  const parsed = Number.parseInt(String(process.env.CLAMAV_PORT || DEFAULT_CLAMAV_PORT), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CLAMAV_PORT;
};

const getClamAvTimeoutMs = () => {
  const parsed = Number.parseInt(String(process.env.CLAMAV_TIMEOUT_MS || DEFAULT_CLAMAV_TIMEOUT_MS), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CLAMAV_TIMEOUT_MS;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: getMaxScanBytes(),
    files: 1
  }
});

const containsEicarSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  return buffer.includes(Buffer.from(EICAR_SIGNATURE, 'ascii'));
};

const scanWithClamAv = (buffer) =>
  new Promise((resolve, reject) => {
    const client = net.createConnection({
      host: getClamAvHost(),
      port: getClamAvPort()
    });

    let response = '';
    let settled = false;

    const finalize = (callback) => (value) => {
      if (settled) {
        return;
      }
      settled = true;
      callback(value);
    };

    const resolveOnce = finalize(resolve);
    const rejectOnce = finalize(reject);

    client.setTimeout(getClamAvTimeoutMs(), () => {
      client.destroy();
      const error = new Error('ClamAV scan timed out.');
      error.code = 'clamav_timeout';
      rejectOnce(error);
    });

    client.on('error', (error) => {
      rejectOnce(error);
    });

    client.on('data', (chunk) => {
      response += chunk.toString('utf8');
    });

    client.on('end', () => {
      const normalized = response.replace(/\0/g, '').trim();
      if (/FOUND$/i.test(normalized)) {
        const threatMatch = normalized.match(/stream:\s(.+)\sFOUND$/i);
        resolveOnce({
          clean: false,
          engine: 'clamav',
          threat_name: threatMatch ? threatMatch[1] : 'clamav-detected-threat'
        });
        return;
      }

      if (/OK$/i.test(normalized)) {
        resolveOnce({
          clean: true,
          engine: 'clamav',
          threat_name: null
        });
        return;
      }

      const error = new Error(`Unexpected ClamAV response: ${normalized || 'empty response'}`);
      error.code = 'clamav_unexpected_response';
      rejectOnce(error);
    });

    client.on('connect', () => {
      client.write('zINSTREAM\0');

      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, offset + chunkSize);
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length, 0);
        client.write(length);
        client.write(chunk);
      }

      const terminator = Buffer.alloc(4);
      terminator.writeUInt32BE(0, 0);
      client.write(terminator);
      client.end();
    });
  });

const performScan = async (buffer) => {
  if (containsEicarSignature(buffer)) {
    return {
      clean: false,
      engine: 'eicar-fallback',
      threat_name: 'EICAR-Test-Signature'
    };
  }

  const clamAvHost = getClamAvHost();
  if (!clamAvHost) {
    return {
      clean: true,
      engine: 'eicar-fallback',
      threat_name: null,
      warning: 'CLAMAV_HOST is not configured; only EICAR fallback scanning is active.'
    };
  }

  return scanWithClamAv(buffer);
};

app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    engine: getClamAvHost() ? 'clamav' : 'eicar-fallback'
  });
});

app.post('/scan', upload.single('file'), async (req, res) => {
  if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
    return res.status(400).json({
      clean: false,
      verdict: 'error',
      message: 'No file uploaded.'
    });
  }

  try {
    const verdict = await performScan(req.file.buffer);
    if (!verdict.clean) {
      return res.status(422).json({
        clean: false,
        verdict: 'infected',
        engine: verdict.engine,
        threat_name: verdict.threat_name || 'unknown-threat',
        message: 'Malware detected.'
      });
    }

    return res.status(200).json({
      clean: true,
      verdict: 'clean',
      engine: verdict.engine,
      threat_name: null,
      warning: verdict.warning || null
    });
  } catch (error) {
    return res.status(503).json({
      clean: false,
      verdict: 'scanner_unavailable',
      message: error.message
    });
  }
});

app.use((_req, res) => {
  res.status(405).json({ error: 'Method Not Allowed' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Document AV scanner listening on ${port}`);
});
