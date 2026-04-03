#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-formcheck}"
BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-ai-formcheck-backend}"

upsert_counter_metric() {
    local METRIC_NAME=$1
    local DESCRIPTION=$2
    local FILTER=$3

    if gcloud logging metrics describe "$METRIC_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
        echo "Updating logging metric: $METRIC_NAME"
        gcloud logging metrics update "$METRIC_NAME" \
            --project "$PROJECT_ID" \
            --description "$DESCRIPTION" \
            --log-filter "$FILTER"
        return
    fi

    echo "Creating logging metric: $METRIC_NAME"
    gcloud logging metrics create "$METRIC_NAME" \
        --project "$PROJECT_ID" \
        --description "$DESCRIPTION" \
        --log-filter "$FILTER"
}

BASE_FILTER="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${BACKEND_SERVICE_NAME}\""

upsert_counter_metric \
    "payload_replay_blocked_count" \
    "Count of replay attempts blocked by nonce/timestamp verification." \
    "${BASE_FILTER} AND jsonPayload.event=\"payload_replay_blocked\""

upsert_counter_metric \
    "csrf_validation_failed_count" \
    "Count of CSRF validation failures on protected routes." \
    "${BASE_FILTER} AND jsonPayload.event=\"csrf_validation_failed\""

upsert_counter_metric \
    "unencrypted_request_blocked_count" \
    "Count of plaintext requests rejected by the secure transport middleware." \
    "${BASE_FILTER} AND jsonPayload.event=\"unencrypted_request_blocked\""

upsert_counter_metric \
    "temp_cleanup_failed_count" \
    "Count of temp file cleanup failures across upload, support, and worker flows." \
    "${BASE_FILTER} AND jsonPayload.event=\"temp_cleanup_failed\""

upsert_counter_metric \
    "document_intake_cleanup_failed_count" \
    "Count of encrypted intake/raw object cleanup failures in document processing." \
    "${BASE_FILTER} AND jsonPayload.event=\"document_intake_cleanup_failed\""

upsert_counter_metric \
    "document_job_queue_info_failed_count" \
    "Count of queue info enrichment failures, usually indicating Firestore index/query drift." \
    "${BASE_FILTER} AND textPayload:\"document_job_queue_info_failed\""

echo "Done. Next step: create Cloud Monitoring alerting policies from these log-based metrics."
