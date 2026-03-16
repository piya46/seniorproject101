export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type ApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export type HttpMethod = "POST" | "PUT" | "PATCH";

export type EncryptedPayload = {
  encKey: string;
  iv: string;
  tag: string;
  payload: string;
};

export type EncryptedResponse = {
  iv: string;
  tag: string;
  payload: string;
};

export type RequestContext = {
  aesKey: CryptoKey;
  nonce: string;
  transportBody: EncryptedPayload;
};

export type UploadEncryptedFileParams = {
  file: File;
  fileKey: string;
  formCode?: string;
};

export type InitSessionResponse = {
  message: string;
  session_id: string;
};

export class SciRequestApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private publicKey: CryptoKey | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchPublicKey(forceRefresh = false): Promise<CryptoKey> {
    if (this.publicKey && !forceRefresh) {
      return this.publicKey;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/auth/public-key`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    const data = (await response.json()) as { publicKey?: string };
    if (!data.publicKey) {
      throw new Error("Backend did not return publicKey");
    }

    this.publicKey = await importRsaPublicKey(data.publicKey);
    return this.publicKey;
  }

  async initSession(): Promise<InitSessionResponse> {
    return this.postEncrypted<InitSessionResponse>("/session/init", {});
  }

  async prepare(): Promise<void> {
    await this.fetchPublicKey();
    await this.initSession();
  }

  async get<T = JsonObject>(endpoint: string, query?: QueryParams): Promise<T> {
    const url = buildUrl(`${this.baseUrl}${endpoint}`, query);
    const response = await this.fetchImpl(url, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    return (await safeParseJson(response)) as T;
  }

  async postEncrypted<T = JsonObject>(endpoint: string, body: JsonObject): Promise<T> {
    return this.sendEncrypted<T>("POST", endpoint, body);
  }

  async putEncrypted<T = JsonObject>(endpoint: string, body: JsonObject): Promise<T> {
    return this.sendEncrypted<T>("PUT", endpoint, body);
  }

  async patchEncrypted<T = JsonObject>(endpoint: string, body: JsonObject): Promise<T> {
    return this.sendEncrypted<T>("PATCH", endpoint, body);
  }

  async listForms(params?: {
    degreeLevel?: string;
    departmentId?: string;
    category?: string;
  }): Promise<JsonObject[]> {
    return this.get<JsonObject[]>("/forms", {
      degree_level: params?.degreeLevel,
      department_id: params?.departmentId,
      category: params?.category,
    });
  }

  async getFormDetail(
    formCode: string,
    params?: { degreeLevel?: string; subType?: string | null }
  ): Promise<JsonObject> {
    return this.get<JsonObject>(`/forms/${encodeURIComponent(formCode)}`, {
      degree_level: params?.degreeLevel,
      sub_type: params?.subType ?? undefined,
    });
  }

  async checkCompleteness(params: {
    formCode: string;
    degreeLevel: string;
    subType?: string | null;
  }): Promise<JsonObject> {
    return this.postEncrypted<JsonObject>("/validation/check-completeness", {
      form_code: params.formCode,
      degree_level: params.degreeLevel,
      sub_type: params.subType ?? null,
    });
  }

  async mergeDocuments(params: {
    formCode: string;
    degreeLevel: string;
    subType?: string | null;
  }): Promise<JsonObject> {
    return this.postEncrypted<JsonObject>("/documents/merge", {
      form_code: params.formCode,
      degree_level: params.degreeLevel,
      sub_type: params.subType ?? null,
    });
  }

  async recommendForm(params: {
    message: string;
    degreeLevel: string;
  }): Promise<JsonObject> {
    return this.postEncrypted<JsonObject>("/chat/recommend", {
      message: params.message,
      degree_level: params.degreeLevel,
    });
  }

  async uploadEncryptedFile(params: UploadEncryptedFileParams): Promise<JsonObject> {
    const publicKey = await this.ensurePublicKey();
    const fileBuffer = await params.file.arrayBuffer();
    const encryptedFile = await encryptBinaryPayload(new Uint8Array(fileBuffer), publicKey);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([encryptedFile.ciphertext], { type: "application/octet-stream" }),
      params.file.name
    );
    formData.append("file_key", params.fileKey);

    if (params.formCode) {
      formData.append("form_code", params.formCode);
    }

    formData.append("encKey", encryptedFile.transport.encKey);
    formData.append("iv", encryptedFile.transport.iv);
    formData.append("tag", encryptedFile.transport.tag);

    const response = await this.fetchImpl(`${this.baseUrl}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    return (await safeParseJson(response)) as JsonObject;
  }

  private async sendEncrypted<T>(
    method: HttpMethod,
    endpoint: string,
    businessBody: JsonObject
  ): Promise<T> {
    const publicKey = await this.ensurePublicKey();
    const requestContext = await encryptJsonPayload(businessBody, publicKey);

    const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestContext.transportBody),
      credentials: "include",
    });

    const parsedBody = await safeParseJson(response);

    if (!response.ok) {
      throw new ApiClientError(response.status, parsedBody, requestContext.nonce);
    }

    if (isEncryptedResponse(parsedBody)) {
      return (await decryptJsonResponse(parsedBody, requestContext.aesKey)) as T;
    }

    return parsedBody as T;
  }

  private async ensurePublicKey(): Promise<CryptoKey> {
    if (this.publicKey) {
      return this.publicKey;
    }
    return this.fetchPublicKey();
  }

  private async toApiError(response: Response): Promise<ApiClientError> {
    const data = await safeParseJson(response);
    return new ApiClientError(response.status, data);
  }
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly nonce?: string;

  constructor(status: number, data: unknown, nonce?: string) {
    const message =
      typeof data === "object" && data && "message" in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).message)
        : `API request failed with status ${status}`;

    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.data = data;
    this.nonce = nonce;
  }
}

export async function encryptJsonPayload(
  businessBody: JsonObject,
  publicKey: CryptoKey
): Promise<RequestContext> {
  const nonce = createNonce();
  const plaintextBody = {
    ...businessBody,
    _ts: Date.now(),
    nonce,
  };

  const plaintextBytes = new TextEncoder().encode(JSON.stringify(plaintextBody));
  const encrypted = await encryptBinaryPayload(plaintextBytes, publicKey);

  return {
    aesKey: encrypted.aesKey,
    nonce,
    transportBody: encrypted.transport,
  };
}

export async function decryptJsonResponse(
  response: EncryptedResponse,
  aesKey: CryptoKey
): Promise<JsonObject> {
  const iv = fromBase64(response.iv);
  const ciphertext = fromBase64(response.payload);
  const tag = fromBase64(response.tag);
  const encryptedBytes = concatUint8Arrays(ciphertext, tag);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedBytes
  );

  const jsonText = new TextDecoder().decode(new Uint8Array(decryptedBuffer));
  return JSON.parse(jsonText) as JsonObject;
}

export async function encryptBinaryPayload(
  input: Uint8Array,
  publicKey: CryptoKey
): Promise<{
  aesKey: CryptoKey;
  ciphertext: Uint8Array;
  transport: EncryptedPayload;
}> {
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, input)
  );
  const { ciphertext, tag } = splitCiphertextAndTag(encryptedBuffer);

  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  const encryptedKeyBuffer = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawAesKey
  );

  return {
    aesKey,
    ciphertext,
    transport: {
      encKey: toBase64(new Uint8Array(encryptedKeyBuffer)),
      iv: toBase64(iv),
      tag: toBase64(tag),
      payload: toBase64(ciphertext),
    },
  };
}

export async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
  const normalizedPem = pem
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

export async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function isEncryptedResponse(value: unknown): value is EncryptedResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.iv === "string" &&
    typeof candidate.tag === "string" &&
    typeof candidate.payload === "string"
  );
}

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `req-${Date.now()}-${toBase64Url(bytes)}`;
}

export function buildUrl(input: string, query?: QueryParams): string {
  const url = new URL(input);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function splitCiphertextAndTag(encrypted: Uint8Array): {
  ciphertext: Uint8Array;
  tag: Uint8Array;
} {
  const tagLength = 16;
  if (encrypted.length < tagLength) {
    throw new Error("Encrypted payload is too short to contain a GCM tag");
  }

  return {
    ciphertext: encrypted.slice(0, encrypted.length - tagLength),
    tag: encrypted.slice(encrypted.length - tagLength),
  };
}

export function concatUint8Arrays(left: Uint8Array, right: Uint8Array): Uint8Array {
  const output = new Uint8Array(left.length + right.length);
  output.set(left, 0);
  output.set(right, left.length);
  return output;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * ตัวอย่างการใช้งานในหน้า frontend จริง
 */
export async function exampleUsage(): Promise<void> {
  const client = new SciRequestApiClient({
    baseUrl: "http://localhost:8080/api/v1",
  });

  await client.prepare();

  const forms = await client.listForms({ degreeLevel: "bachelor" });
  console.log("forms", forms);

  const formDetail = await client.getFormDetail("JT41", {
    degreeLevel: "bachelor",
    subType: "late_reg",
  });
  console.log("form detail", formDetail);

  const validationResult = await client.checkCompleteness({
    formCode: "JT41",
    degreeLevel: "bachelor",
    subType: "late_reg",
  });
  console.log("validation", validationResult);

  const mergeResult = await client.mergeDocuments({
    formCode: "JT41",
    degreeLevel: "bachelor",
    subType: "late_reg",
  });
  console.log("merge", mergeResult);

  const chatResult = await client.recommendForm({
    message: "ต้องการลงทะเบียนช้าควรใช้คำร้องอะไร",
    degreeLevel: "bachelor",
  });
  console.log("chat", chatResult);

  // ตัวอย่าง upload:
  // const fileInput = document.querySelector<HTMLInputElement>("#file");
  // const file = fileInput?.files?.[0];
  // if (file) {
  //   const uploadResult = await client.uploadEncryptedFile({
  //     file,
  //     fileKey: "main_form",
  //     formCode: "JT41",
  //   });
  //   console.log("upload", uploadResult);
  // }
}
