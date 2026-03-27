import { useMemo } from "react";
import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import {
  ApiClientError,
  type FormDetail,
  type JsonObject,
  SciRequestApiClient,
} from "./api-client";

export type UseSciRequestQueryClientOptions = {
  baseUrl: string;
};

export function useSciRequestQueryClient(options: UseSciRequestQueryClientOptions) {
  return useMemo(
    () => new SciRequestApiClient({ baseUrl: options.baseUrl, fetchImpl: fetch }),
    [options.baseUrl]
  );
}

export function useBootstrapQuery(
  baseUrl: string
): UseQueryResult<{ ready: true }, Error> {
  const api = useSciRequestQueryClient({ baseUrl });

  return useQuery({
    queryKey: ["sci-request", "bootstrap", baseUrl],
    queryFn: async () => {
      await api.prepare();
      return { ready: true as const };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useFormsQuery(baseUrl: string, degreeLevel = "bachelor") {
  const api = useSciRequestQueryClient({ baseUrl });

  return useQuery({
    queryKey: ["sci-request", "forms", baseUrl, degreeLevel],
    queryFn: async () => {
      await api.prepare();
      return api.listForms({ degreeLevel });
    },
  });
}

export function useFormDetailQuery(
  baseUrl: string,
  formCode: string,
  degreeLevel = "bachelor",
  subType: string | null = null
): UseQueryResult<FormDetail, Error> {
  const api = useSciRequestQueryClient({ baseUrl });

  return useQuery({
    queryKey: ["sci-request", "form-detail", baseUrl, formCode, degreeLevel, subType],
    queryFn: async () => {
      await api.prepare();
      return api.getFormDetail(formCode, { degreeLevel, subType });
    },
    enabled: Boolean(formCode),
  });
}

export function useUploadMutation(
  baseUrl: string
): UseMutationResult<
  JsonObject,
  Error,
  { file: File; fileKey: string; formCode?: string }
> {
  const api = useSciRequestQueryClient({ baseUrl });

  return useMutation({
    mutationFn: async ({ file, fileKey, formCode }) => {
      await api.prepare();
      return api.uploadEncryptedFile({ file, fileKey, formCode });
    },
  });
}

export function useValidationMutation(
  baseUrl: string
): UseMutationResult<
  JsonObject,
  Error,
  { formCode: string; degreeLevel: string; subType?: string | null; caseKey?: string | null }
> {
  const api = useSciRequestQueryClient({ baseUrl });

  return useMutation({
    mutationFn: async ({ formCode, degreeLevel, subType, caseKey }) => {
      await api.prepare();
      return api.checkCompleteness({ formCode, degreeLevel, subType, caseKey });
    },
  });
}

export function useMergeMutation(
  baseUrl: string
): UseMutationResult<
  JsonObject,
  Error,
  { formCode: string; degreeLevel: string; subType?: string | null }
> {
  const api = useSciRequestQueryClient({ baseUrl });

  return useMutation({
    mutationFn: async ({ formCode, degreeLevel, subType }) => {
      await api.prepare();
      return api.mergeDocuments({ formCode, degreeLevel, subType });
    },
  });
}

export function useRecommendMutation(
  baseUrl: string
): UseMutationResult<
  JsonObject,
  Error,
  { message: string; degreeLevel: string }
> {
  const api = useSciRequestQueryClient({ baseUrl });

  return useMutation({
    mutationFn: async ({ message, degreeLevel }) => {
      await api.prepare();
      return api.recommendForm({ message, degreeLevel });
    },
  });
}

// If a team prefers axios for non-encrypted endpoints or custom adapters,
// this helper shows the shape to keep credentials enabled in React apps.
export function createBrowserAxios(baseUrl: string) {
  return axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    headers: {
      Accept: "application/json",
    },
  });
}

export function formatReactQueryApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (typeof error.body === "object" && error.body && "message" in error.body) {
      return String((error.body as Record<string, unknown>).message);
    }

    if (typeof error.body === "object" && error.body && "error" in error.body) {
      return String((error.body as Record<string, unknown>).error);
    }

    return `API error ${error.status}`;
  }

  if (axios.isAxiosError(error)) {
    const responseData = (error as AxiosError<Record<string, unknown>>).response?.data;
    if (responseData?.message) {
      return String(responseData.message);
    }
    if (responseData?.error) {
      return String(responseData.error);
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
