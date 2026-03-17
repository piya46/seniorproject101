import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ApiClientError,
  type FormDetail,
  type JsonObject,
  SciRequestApiClient,
} from "./api-client";

type UseSciRequestApiOptions = {
  baseUrl: string;
};

export function useSciRequestApi(options: UseSciRequestApiOptions) {
  return useMemo(
    () => new SciRequestApiClient({ baseUrl: options.baseUrl }),
    [options.baseUrl]
  );
}

export function useApiBootstrap(baseUrl: string) {
  const api = useSciRequestApi({ baseUrl });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      api
        .prepare()
        .then(() => {
          if (!cancelled) {
            setReady(true);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setReady(false);
            setError(formatApiError(err));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [api]);

  return { api, ready, error, isPending };
}

export function FormsExample({ baseUrl }: { baseUrl: string }) {
  const { api, ready, error, isPending } = useApiBootstrap(baseUrl);
  const [forms, setForms] = useState<JsonObject[]>([]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    api
      .listForms({ degreeLevel: "bachelor" })
      .then((data) => {
        if (!cancelled) {
          setForms(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("listForms failed", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, ready]);

  if (isPending) {
    return <p>Preparing secure session...</p>;
  }

  if (error) {
    return <p>Bootstrap failed: {error}</p>;
  }

  return (
    <section>
      <h2>Forms</h2>
      <ul>
        {forms.map((form, index) => (
          <li key={String(form.form_code ?? index)}>
            {String(form.form_code ?? "unknown")} - {String(form.name_th ?? "")}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FormDetailExample({
  baseUrl,
  formCode,
}: {
  baseUrl: string;
  formCode: string;
}) {
  const { api, ready } = useApiBootstrap(baseUrl);
  const [detail, setDetail] = useState<FormDetail | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    api
      .getFormDetail(formCode, { degreeLevel: "bachelor", subType: null })
      .then(setDetail)
      .catch((err) => {
        console.error("getFormDetail failed", err);
      });
  }, [api, formCode, ready]);

  if (!detail) {
    return <p>Loading form detail...</p>;
  }

  return (
    <article>
      <h2>{String(detail.name_th ?? formCode)}</h2>
      <pre>{JSON.stringify(detail, null, 2)}</pre>
    </article>
  );
}

export function UploadExample({ baseUrl, file }: { baseUrl: string; file: File }) {
  const { api, ready } = useApiBootstrap(baseUrl);
  const [result, setResult] = useState<JsonObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    try {
      const response = await api.uploadEncryptedFile({
        file,
        fileKey: "main_form",
        formCode: "JT44",
      });
      setResult(response);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <section>
      <button type="button" disabled={!ready} onClick={handleUpload}>
        Upload encrypted file
      </button>
      {error ? <p>Upload failed: {error}</p> : null}
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
}

export function ValidationExample({ baseUrl }: { baseUrl: string }) {
  const { api, ready } = useApiBootstrap(baseUrl);
  const [result, setResult] = useState<JsonObject | null>(null);

  async function handleValidate() {
    try {
      const response = await api.checkCompleteness({
        formCode: "JT44",
        degreeLevel: "graduate",
        subType: null,
        caseKey: null,
      });
      setResult(response);
    } catch (err) {
      console.error("validation failed", err);
    }
  }

  return (
    <section>
      <button type="button" disabled={!ready} onClick={handleValidate}>
        Validate documents
      </button>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
}

export function ChatExample({ baseUrl }: { baseUrl: string }) {
  const { api, ready } = useApiBootstrap(baseUrl);
  const [reply, setReply] = useState<JsonObject | null>(null);

  async function askRecommendation() {
    try {
      const response = await api.recommendForm({
        message: "ต้องการลาพักการเรียนเพราะป่วย",
        degreeLevel: "bachelor",
      });
      setReply(response);
    } catch (err) {
      console.error("recommendation failed", err);
    }
  }

  return (
    <section>
      <button type="button" disabled={!ready} onClick={askRecommendation}>
        Ask AI for a form recommendation
      </button>
      {reply ? <pre>{JSON.stringify(reply, null, 2)}</pre> : null}
    </section>
  );
}

function formatApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (typeof error.body === "object" && error.body && "message" in error.body) {
      return String((error.body as Record<string, unknown>).message);
    }

    if (typeof error.body === "object" && error.body && "error" in error.body) {
      return String((error.body as Record<string, unknown>).error);
    }

    return `API error ${error.status}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
