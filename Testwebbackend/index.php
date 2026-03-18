<?php
declare(strict_types=1);

$defaultBackend = getenv('TESTWEBBACKEND_BASE_URL') ?: 'https://api.pstpyst.com';
$selfPath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$basePath = $selfPath === '' ? '' : $selfPath;
$currentHost = $_SERVER['HTTP_HOST'] ?? '127.0.0.1:8088';
$currentScheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$currentBaseUrl = $currentScheme . '://' . $currentHost . ($basePath ?: '');
$iapDone = isset($_GET['iap']) && $_GET['iap'] === 'done';
$iapLoginHelper = $basePath . '/php/iap-login.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Testwebbackend QA Dashboard</title>
  <style>
    :root {
      --bg: #07111d;
      --panel: rgba(15, 24, 44, 0.94);
      --panel-2: #0d1830;
      --line: #25446b;
      --text: #ecf4ff;
      --muted: #9db0cf;
      --mint: #7ef0c2;
      --sky: #79d8ff;
      --amber: #f6c768;
      --red: #ff8f8f;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--text);
      font-family: Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(121, 216, 255, 0.18), transparent 26%),
        radial-gradient(circle at top right, rgba(126, 240, 194, 0.18), transparent 24%),
        linear-gradient(180deg, #050c16, var(--bg));
      min-height: 100vh;
    }

    .wrap {
      width: min(1320px, calc(100% - 28px));
      margin: 22px auto 36px;
    }

    .hero,
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
    }

    .hero {
      padding: 24px;
      margin-bottom: 18px;
    }

    .panel {
      padding: 18px;
    }

    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 30px; margin-bottom: 10px; }
    h2 { font-size: 18px; margin-bottom: 12px; }
    h3 { font-size: 15px; margin-bottom: 10px; }
    p { color: var(--muted); line-height: 1.55; }

    .topline {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }

    .badge {
      padding: 10px 12px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid var(--line);
      background: #0a1428;
      color: var(--text);
    }

    .ok { color: var(--mint); }
    .warn { color: var(--amber); }
    .bad { color: var(--red); }

    .hero-grid,
    .main-grid,
    .meta-grid,
    .action-grid,
    .field-grid {
      display: grid;
      gap: 12px;
    }

    .hero-grid {
      grid-template-columns: 1.3fr auto;
      margin-top: 16px;
      align-items: start;
    }

    .main-grid {
      grid-template-columns: 1.15fr 0.85fr;
      align-items: start;
    }

    .left-stack,
    .right-stack {
      display: grid;
      gap: 16px;
    }

    .meta-grid,
    .field-grid {
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    }

    .action-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .meta-card {
      background: #091426;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
    }

    .meta-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 8px;
    }

    .meta-value {
      font-size: 14px;
      word-break: break-word;
    }

    .note {
      margin-top: 12px;
      font-size: 13px;
    }

    label {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    input,
    select,
    textarea,
    button {
      width: 100%;
      border-radius: 14px;
      border: 1px solid var(--line);
      font-size: 14px;
    }

    input,
    select,
    textarea {
      background: #06111f;
      color: var(--text);
      padding: 12px 14px;
    }

    textarea {
      min-height: 110px;
      resize: vertical;
    }

    button {
      background: linear-gradient(135deg, var(--sky), var(--mint));
      color: #06101b;
      padding: 12px 14px;
      cursor: pointer;
      font-weight: bold;
    }

    button.secondary {
      background: var(--panel-2);
      color: var(--text);
    }

    button.warn-btn {
      background: linear-gradient(135deg, #ffd58a, #f5b661);
    }

    .inline-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
    }

    .status-box,
    pre {
      background: #06101d;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
    }

    .status-box {
      min-height: 72px;
      color: var(--text);
    }

    pre {
      min-height: 260px;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      color: #d7e7ff;
      font-size: 13px;
      line-height: 1.55;
      overflow: auto;
    }

    ul {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.55;
    }

    .section-list {
      display: grid;
      gap: 8px;
    }

    @media (max-width: 1080px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .hero-grid,
      .inline-row {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="topline">
        <div>
          <h1>Testwebbackend QA Dashboard</h1>
          <p>PHP serves this page, while the browser exercises the real backend contract directly. It covers secure JSON, auth-required GET requests, encrypted upload, validation, merge, chat, support email, and IAP redirect testing.</p>
          <div class="badge-row">
            <div class="badge">Backend default: <strong><?= htmlspecialchars($defaultBackend, ENT_QUOTES, 'UTF-8') ?></strong></div>
            <div class="badge">Current host: <strong><?= htmlspecialchars($currentBaseUrl, ENT_QUOTES, 'UTF-8') ?></strong></div>
            <div class="badge <?= $iapDone ? 'ok' : 'warn' ?>">IAP return: <strong><?= $iapDone ? 'detected' : 'waiting' ?></strong></div>
          </div>
        </div>
      </div>

      <div class="hero-grid">
        <div>
          <label for="backendUrl">Backend URL</label>
          <input id="backendUrl" type="url" value="<?= htmlspecialchars($defaultBackend, ENT_QUOTES, 'UTF-8') ?>" placeholder="https://api.pstpyst.com">
          <p class="note">If this page runs on localhost, your deploy must include that host in `FRONTEND_EXTRA_URLS` or browser requests may fail due to CORS/origin/IAP return allowlists.</p>
        </div>
        <div class="action-grid">
          <button id="saveBackendBtn" type="button">Save Backend</button>
          <button id="smokeTestBtn" class="secondary" type="button">Run Smoke Test</button>
          <button id="iapLoginBtn" class="secondary" type="button">Open IAP Login</button>
        </div>
      </div>
    </section>

    <div class="main-grid">
      <div class="left-stack">
        <section class="panel">
          <h2>Session And Metadata</h2>
          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-label">Current backend</div>
              <div class="meta-value" id="metaBackend">-</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Health endpoint</div>
              <div class="meta-value" id="metaHealth">-</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Public key endpoint</div>
              <div class="meta-value" id="metaPublicKey">-</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Session status</div>
              <div class="meta-value" id="metaSession">Not initialized</div>
            </div>
          </div>
          <div class="action-grid" style="margin-top:12px;">
            <button id="healthBtn" type="button">GET /healthz</button>
            <button id="publicKeyBtn" class="secondary" type="button">GET /auth/public-key</button>
            <button id="initSessionBtn" class="secondary" type="button">POST /session/init</button>
            <button id="departmentsBtn" class="secondary" type="button">GET /departments</button>
            <button id="formsBtn" class="secondary" type="button">GET /forms</button>
            <button id="formDetailBtn" class="secondary" type="button">GET /forms/:form_code</button>
          </div>
        </section>

        <section class="panel">
          <h2>Form Context</h2>
          <div class="field-grid">
            <div>
              <label for="degreeLevel">Degree Level</label>
              <select id="degreeLevel">
                <option value="bachelor">bachelor</option>
                <option value="graduate">graduate</option>
              </select>
            </div>
            <div>
              <label for="formCode">Form Code</label>
              <input id="formCode" type="text" value="JT44" placeholder="JT44">
            </div>
            <div>
              <label for="subType">Sub Type</label>
              <input id="subType" type="text" placeholder="optional">
            </div>
            <div>
              <label for="caseKey">Case Key</label>
              <input id="caseKey" type="text" placeholder="optional">
            </div>
          </div>
        </section>

        <section class="panel">
          <h2>Upload, Validation, Merge</h2>
          <div class="field-grid">
            <div>
              <label for="uploadFileKey">File Key</label>
              <input id="uploadFileKey" type="text" value="medical_cert" placeholder="medical_cert">
            </div>
            <div>
              <label for="uploadFormCode">Upload Form Code</label>
              <input id="uploadFormCode" type="text" value="JT44" placeholder="JT44">
            </div>
            <div>
              <label for="uploadFile">File</label>
              <input id="uploadFile" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf">
            </div>
          </div>
          <div class="action-grid" style="margin-top:12px;">
            <button id="uploadBtn" type="button">POST /upload</button>
            <button id="validateBtn" class="secondary" type="button">POST /validation/check-completeness</button>
            <button id="mergeBtn" class="secondary" type="button">POST /documents/merge</button>
          </div>
        </section>

        <section class="panel">
          <h2>Chat Recommend</h2>
          <label for="chatMessage">Message</label>
          <textarea id="chatMessage" placeholder="อยากยื่นคำร้องลาป่วยช่วงสอบ ต้องใช้ฟอร์มอะไร"></textarea>
          <div class="action-grid" style="margin-top:12px;">
            <button id="chatBtn" type="button">POST /chat/recommend</button>
          </div>
        </section>

        <section class="panel">
          <h2>Support Email Test</h2>
          <div class="field-grid">
            <div>
              <label for="supportReporter">Reporter Email</label>
              <input id="supportReporter" type="email" placeholder="student@chula.ac.th">
            </div>
            <div>
              <label for="supportIssueType">Issue Type</label>
              <input id="supportIssueType" type="text" value="qa test" placeholder="qa test">
            </div>
            <div>
              <label for="supportSubject">Subject</label>
              <input id="supportSubject" type="text" value="QA support test" placeholder="QA support test">
            </div>
            <div>
              <label for="supportAttachment">Attachment</label>
              <input id="supportAttachment" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf">
            </div>
          </div>
          <label for="supportDescription" style="margin-top:12px;">Description</label>
          <textarea id="supportDescription" placeholder="Describe the issue you want to send to the support endpoint."></textarea>
          <div class="action-grid" style="margin-top:12px;">
            <button id="supportBtn" class="warn-btn" type="button">POST /support/technical-email</button>
          </div>
        </section>
      </div>

      <div class="right-stack">
        <section class="panel">
          <h2>Status</h2>
          <div id="statusBox" class="status-box">Ready.</div>
        </section>

        <section class="panel">
          <h2>Latest Response</h2>
          <pre id="responseBox">Choose an action to start testing.</pre>
        </section>

        <section class="panel">
          <h2>What This Tests</h2>
          <div class="section-list">
            <ul>
              <li>`GET /healthz` and `GET /api/v1/auth/public-key`</li>
              <li>`POST /api/v1/session/init` with secure JSON and encrypted response handling</li>
              <li>cookie-backed auth requests such as `departments`, `forms`, and `form detail`</li>
              <li>encrypted file upload to `POST /api/v1/upload`</li>
              <li>AI validation, merge, chat recommendation, and support email flows</li>
              <li>`GET /api/v1/iap/complete` through the PHP helper for backend-first login completion</li>
            </ul>
          </div>
        </section>

        <section class="panel">
          <h2>Important Notes</h2>
          <ul>
            <li>Browser-based auth flows need your current page origin to be allowed in backend `FRONTEND_URL`.</li>
            <li>The backend session cookie is `HttpOnly`, so the dashboard infers session health from successful authenticated requests.</li>
            <li>Support email tests send real email through the configured backend target.</li>
            <li>Merge needs the required files for the selected form to be uploaded first.</li>
          </ul>
        </section>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var defaultBackend = <?= json_encode($defaultBackend, JSON_UNESCAPED_SLASHES) ?>;
      var iapLoginHelper = <?= json_encode($iapLoginHelper, JSON_UNESCAPED_SLASHES) ?>;
      var backendInput = document.getElementById("backendUrl");
      var responseBox = document.getElementById("responseBox");
      var statusBox = document.getElementById("statusBox");
      var metaBackend = document.getElementById("metaBackend");
      var metaHealth = document.getElementById("metaHealth");
      var metaPublicKey = document.getElementById("metaPublicKey");
      var metaSession = document.getElementById("metaSession");

      function getBackend() {
        return backendInput.value.trim().replace(/\/+$/, "");
      }

      function setStatus(text, className) {
        statusBox.textContent = text;
        statusBox.className = "status-box " + (className || "");
      }

      function showResponse(label, data) {
        responseBox.textContent = label + "\n\n" + JSON.stringify(data, null, 2);
      }

      function showError(label, error) {
        var output = {
          name: error && error.name ? error.name : "Error",
          message: error && error.message ? error.message : String(error)
        };

        if (error && typeof error.status !== "undefined") {
          output.status = error.status;
        }

        if (error && typeof error.data !== "undefined") {
          output.data = error.data;
        }

        showResponse(label, output);
      }

      function updateMeta() {
        var backend = getBackend();
        metaBackend.textContent = backend || "-";
        metaHealth.textContent = backend ? backend + "/healthz" : "-";
        metaPublicKey.textContent = backend ? backend + "/api/v1/auth/public-key" : "-";
      }

      function buildUrl(input, query) {
        var url = new URL(input);
        Object.keys(query || {}).forEach(function (key) {
          var value = query[key];
          if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
          }
        });
        return url.toString();
      }

      function toBase64(bytes) {
        var binary = "";
        for (var i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }

      function fromBase64(base64) {
        var binary = atob(base64);
        var output = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) {
          output[i] = binary.charCodeAt(i);
        }
        return output;
      }

      function toBase64Url(bytes) {
        return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      }

      function concatUint8Arrays(left, right) {
        var output = new Uint8Array(left.length + right.length);
        output.set(left, 0);
        output.set(right, left.length);
        return output;
      }

      function splitCiphertextAndTag(encrypted) {
        var tagLength = 16;
        if (encrypted.length < tagLength) {
          throw new Error("Encrypted payload is too short to contain a GCM tag");
        }

        return {
          ciphertext: encrypted.slice(0, encrypted.length - tagLength),
          tag: encrypted.slice(encrypted.length - tagLength)
        };
      }

      function isEncryptedResponse(value) {
        return !!value &&
          typeof value === "object" &&
          typeof value.iv === "string" &&
          typeof value.tag === "string" &&
          typeof value.payload === "string";
      }

      function createNonce() {
        var bytes = crypto.getRandomValues(new Uint8Array(12));
        return "req-" + Date.now() + "-" + toBase64Url(bytes);
      }

      async function safeParseJson(response) {
        var text = await response.text();
        if (!text) {
          return null;
        }

        try {
          return JSON.parse(text);
        } catch (_error) {
          return text;
        }
      }

      async function importRsaPublicKey(pem) {
        var normalizedPem = pem
          .replace("-----BEGIN PUBLIC KEY-----", "")
          .replace("-----END PUBLIC KEY-----", "")
          .replace(/\s+/g, "");

        return crypto.subtle.importKey(
          "spki",
          fromBase64(normalizedPem).buffer,
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["encrypt"]
        );
      }

      async function encryptBinaryPayload(input, publicKey) {
        var aesKey = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
        var iv = crypto.getRandomValues(new Uint8Array(12));
        var encryptedBuffer = new Uint8Array(
          await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, input)
        );
        var parts = splitCiphertextAndTag(encryptedBuffer);
        var rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
        var encryptedKeyBuffer = await crypto.subtle.encrypt(
          { name: "RSA-OAEP" },
          publicKey,
          rawAesKey
        );

        return {
          aesKey: aesKey,
          ciphertext: parts.ciphertext,
          transport: {
            encKey: toBase64(new Uint8Array(encryptedKeyBuffer)),
            iv: toBase64(iv),
            tag: toBase64(parts.tag),
            payload: toBase64(parts.ciphertext)
          }
        };
      }

      async function encryptJsonPayload(body, publicKey) {
        var nonce = createNonce();
        var plaintext = Object.assign({}, body, {
          _ts: Date.now(),
          nonce: nonce
        });
        var bytes = new TextEncoder().encode(JSON.stringify(plaintext));
        var encrypted = await encryptBinaryPayload(bytes, publicKey);

        return {
          aesKey: encrypted.aesKey,
          nonce: nonce,
          transportBody: encrypted.transport
        };
      }

      async function decryptJsonResponse(response, aesKey) {
        var iv = fromBase64(response.iv);
        var ciphertext = fromBase64(response.payload);
        var tag = fromBase64(response.tag);
        var encryptedBytes = concatUint8Arrays(ciphertext, tag);
        var decryptedBuffer = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          aesKey,
          encryptedBytes
        );
        var jsonText = new TextDecoder().decode(new Uint8Array(decryptedBuffer));
        return JSON.parse(jsonText);
      }

      function ApiClientError(status, data, nonce) {
        var message = "API request failed with status " + status;
        if (data && typeof data === "object" && typeof data.message === "string") {
          message = data.message;
        }
        this.name = "ApiClientError";
        this.message = message;
        this.status = status;
        this.data = data;
        this.nonce = nonce;
      }
      ApiClientError.prototype = Object.create(Error.prototype);
      ApiClientError.prototype.constructor = ApiClientError;

      function QaClient() {
        this.publicKey = null;
      }

      QaClient.prototype.baseUrl = function () {
        return getBackend() + "/api/v1";
      };

      QaClient.prototype.fetchPublicKey = async function (forceRefresh) {
        if (this.publicKey && !forceRefresh) {
          return this.publicKey;
        }

        var response = await fetch(this.baseUrl() + "/auth/public-key", {
          method: "GET",
          credentials: "include"
        });

        var data = await safeParseJson(response);
        if (!response.ok) {
          throw new ApiClientError(response.status, data);
        }

        if (!data || !data.publicKey) {
          throw new Error("Backend did not return publicKey");
        }

        this.publicKey = await importRsaPublicKey(data.publicKey);
        return this.publicKey;
      };

      QaClient.prototype.ensurePublicKey = async function () {
        if (this.publicKey) {
          return this.publicKey;
        }
        return this.fetchPublicKey(false);
      };

      QaClient.prototype.get = async function (endpoint, query) {
        var response = await fetch(buildUrl(this.baseUrl() + endpoint, query), {
          method: "GET",
          credentials: "include"
        });
        var data = await safeParseJson(response);
        if (!response.ok) {
          throw new ApiClientError(response.status, data);
        }
        return data;
      };

      QaClient.prototype.postEncrypted = async function (endpoint, body) {
        var publicKey = await this.ensurePublicKey();
        var requestContext = await encryptJsonPayload(body, publicKey);

        var response = await fetch(this.baseUrl() + endpoint, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestContext.transportBody)
        });

        var parsedBody = await safeParseJson(response);
        if (!response.ok) {
          throw new ApiClientError(response.status, parsedBody, requestContext.nonce);
        }

        if (isEncryptedResponse(parsedBody)) {
          return decryptJsonResponse(parsedBody, requestContext.aesKey);
        }

        return parsedBody;
      };

      QaClient.prototype.initSession = async function () {
        return this.postEncrypted("/session/init", {});
      };

      QaClient.prototype.uploadEncryptedFile = async function (file, fileKey, formCode) {
        var publicKey = await this.ensurePublicKey();
        var fileBuffer = await file.arrayBuffer();
        var encryptedFile = await encryptBinaryPayload(new Uint8Array(fileBuffer), publicKey);
        var formData = new FormData();
        formData.append("file", new Blob([encryptedFile.ciphertext], { type: "application/octet-stream" }), file.name);
        formData.append("file_key", fileKey);
        if (formCode) {
          formData.append("form_code", formCode);
        }
        formData.append("encKey", encryptedFile.transport.encKey);
        formData.append("iv", encryptedFile.transport.iv);
        formData.append("tag", encryptedFile.transport.tag);

        var response = await fetch(this.baseUrl() + "/upload", {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        var data = await safeParseJson(response);
        if (!response.ok) {
          throw new ApiClientError(response.status, data);
        }

        return data;
      };

      QaClient.prototype.sendSupportEmail = async function (payload) {
        var formData = new FormData();
        formData.append("reporter_email", payload.reporter_email);
        formData.append("issue_type", payload.issue_type);
        formData.append("subject", payload.subject);
        formData.append("description", payload.description);
        if (payload.attachment) {
          formData.append("attachment", payload.attachment, payload.attachment.name);
        }

        var response = await fetch(this.baseUrl() + "/support/technical-email", {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        var data = await safeParseJson(response);
        if (!response.ok) {
          throw new ApiClientError(response.status, data);
        }

        return data;
      };

      var client = new QaClient();

      function getDegreeLevel() {
        return document.getElementById("degreeLevel").value;
      }

      function getFormCode() {
        return document.getElementById("formCode").value.trim();
      }

      function getSubType() {
        return document.getElementById("subType").value.trim();
      }

      function getCaseKey() {
        return document.getElementById("caseKey").value.trim();
      }

      async function run(label, fn, successLabel) {
        setStatus("Running " + label + "...", "warn");
        try {
          var result = await fn();
          if (label.indexOf("session") !== -1 || label.indexOf("Smoke Test") !== -1) {
            metaSession.textContent = "Initialized or verified by authenticated request";
          }
          setStatus(successLabel || (label + " completed"), "ok");
          showResponse(label, result);
          return result;
        } catch (error) {
          setStatus(label + " failed", "bad");
          showError(label, error);
          throw error;
        }
      }

      async function runSmokeTest() {
        var smoke = {};
        smoke.health = await fetch(buildUrl(getBackend() + "/healthz", {}), {
          method: "GET",
          credentials: "include"
        }).then(async function (response) {
          return { status: response.status, body: await safeParseJson(response) };
        });

        smoke.publicKey = await client.get("/auth/public-key");
        smoke.session = await client.initSession();
        smoke.departments = await client.get("/departments");
        smoke.forms = await client.get("/forms", { degree_level: getDegreeLevel() });

        var forms = smoke.forms && smoke.forms.data ? smoke.forms.data : [];
        if (forms.length > 0) {
          smoke.firstFormDetail = await client.get("/forms/" + encodeURIComponent(forms[0].form_code), {
            degree_level: getDegreeLevel()
          });
        }

        return smoke;
      }

      document.getElementById("saveBackendBtn").addEventListener("click", function () {
        localStorage.setItem("testwebbackend.baseUrl", getBackend());
        client.publicKey = null;
        updateMeta();
        setStatus("Backend saved.", "ok");
      });

      document.getElementById("smokeTestBtn").addEventListener("click", function () {
        run("Smoke Test", runSmokeTest, "Smoke test completed");
      });

      document.getElementById("iapLoginBtn").addEventListener("click", function () {
        window.location.href = iapLoginHelper + "?backend=" + encodeURIComponent(getBackend());
      });

      document.getElementById("healthBtn").addEventListener("click", function () {
        run("GET /healthz", async function () {
          var response = await fetch(getBackend() + "/healthz", {
            method: "GET",
            credentials: "include"
          });
          return {
            status: response.status,
            body: await safeParseJson(response)
          };
        });
      });

      document.getElementById("publicKeyBtn").addEventListener("click", function () {
        run("GET /auth/public-key", function () {
          return client.get("/auth/public-key");
        });
      });

      document.getElementById("initSessionBtn").addEventListener("click", function () {
        run("POST /session/init", function () {
          return client.initSession();
        }, "Session initialized");
      });

      document.getElementById("departmentsBtn").addEventListener("click", function () {
        run("GET /departments", function () {
          return client.get("/departments");
        }, "Departments loaded");
      });

      document.getElementById("formsBtn").addEventListener("click", function () {
        run("GET /forms", function () {
          return client.get("/forms", {
            degree_level: getDegreeLevel()
          });
        }, "Forms loaded");
      });

      document.getElementById("formDetailBtn").addEventListener("click", function () {
        run("GET /forms/:form_code", function () {
          return client.get("/forms/" + encodeURIComponent(getFormCode()), {
            degree_level: getDegreeLevel(),
            sub_type: getSubType() || undefined
          });
        }, "Form detail loaded");
      });

      document.getElementById("uploadBtn").addEventListener("click", function () {
        run("POST /upload", async function () {
          var fileInput = document.getElementById("uploadFile");
          var file = fileInput.files && fileInput.files[0];
          var fileKey = document.getElementById("uploadFileKey").value.trim();
          var formCode = document.getElementById("uploadFormCode").value.trim();

          if (!file) {
            throw new Error("Please choose a file first.");
          }
          if (!fileKey) {
            throw new Error("file_key is required.");
          }

          return client.uploadEncryptedFile(file, fileKey, formCode);
        }, "Upload completed");
      });

      document.getElementById("validateBtn").addEventListener("click", function () {
        run("POST /validation/check-completeness", function () {
          return client.postEncrypted("/validation/check-completeness", {
            form_code: getFormCode(),
            degree_level: getDegreeLevel(),
            sub_type: getSubType() || null,
            case_key: getCaseKey() || null
          });
        }, "Validation completed");
      });

      document.getElementById("mergeBtn").addEventListener("click", function () {
        run("POST /documents/merge", function () {
          return client.postEncrypted("/documents/merge", {
            form_code: getFormCode(),
            degree_level: getDegreeLevel(),
            sub_type: getSubType() || null
          });
        }, "Merge completed");
      });

      document.getElementById("chatBtn").addEventListener("click", function () {
        run("POST /chat/recommend", function () {
          return client.postEncrypted("/chat/recommend", {
            message: document.getElementById("chatMessage").value.trim(),
            degree_level: getDegreeLevel()
          });
        }, "Chat request completed");
      });

      document.getElementById("supportBtn").addEventListener("click", function () {
        run("POST /support/technical-email", function () {
          var attachmentInput = document.getElementById("supportAttachment");
          var attachment = attachmentInput.files && attachmentInput.files[0] ? attachmentInput.files[0] : null;

          return client.sendSupportEmail({
            reporter_email: document.getElementById("supportReporter").value.trim(),
            issue_type: document.getElementById("supportIssueType").value.trim(),
            subject: document.getElementById("supportSubject").value.trim(),
            description: document.getElementById("supportDescription").value.trim(),
            attachment: attachment
          });
        }, "Support email request completed");
      });

      var savedBackend = localStorage.getItem("testwebbackend.baseUrl");
      var query = new URLSearchParams(window.location.search);
      if (query.get("backend")) {
        backendInput.value = query.get("backend");
      } else if (savedBackend) {
        backendInput.value = savedBackend;
      } else {
        backendInput.value = defaultBackend;
      }

      updateMeta();
      responseBox.textContent = "Choose an action to begin.\n\nRecommended order:\n1. Run Smoke Test\n2. Upload a file\n3. Run Validation or Merge\n4. Test Chat and Support";
    }());
  </script>
</body>
</html>
