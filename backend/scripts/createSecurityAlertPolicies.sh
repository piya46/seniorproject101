#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-formcheck}"
POLICY_PREFIX="${POLICY_PREFIX:-Sci Request}"
NOTIFICATION_CHANNELS="${NOTIFICATION_CHANNELS:-}"
NOTIFICATION_EMAILS="${NOTIFICATION_EMAILS:-}"
AUTO_CREATE_NOTIFICATION_CHANNELS="${AUTO_CREATE_NOTIFICATION_CHANNELS:-false}"
ALERT_DURATION_SECONDS="${ALERT_DURATION_SECONDS:-300}"
ALIGNMENT_PERIOD_SECONDS="${ALIGNMENT_PERIOD_SECONDS:-60}"
MONITORED_RESOURCE_TYPE="${MONITORED_RESOURCE_TYPE:-cloud_run_revision}"

PAYLOAD_REPLAY_THRESHOLD="${PAYLOAD_REPLAY_THRESHOLD:-20}"
CSRF_FAILED_THRESHOLD="${CSRF_FAILED_THRESHOLD:-20}"
UNENCRYPTED_REQUEST_THRESHOLD="${UNENCRYPTED_REQUEST_THRESHOLD:-10}"
TEMP_CLEANUP_FAILED_THRESHOLD="${TEMP_CLEANUP_FAILED_THRESHOLD:-3}"
DOCUMENT_INTAKE_CLEANUP_FAILED_THRESHOLD="${DOCUMENT_INTAKE_CLEANUP_FAILED_THRESHOLD:-3}"
DOCUMENT_JOB_QUEUE_INFO_FAILED_THRESHOLD="${DOCUMENT_JOB_QUEUE_INFO_FAILED_THRESHOLD:-2}"

validate_positive_integer() {
    local VALUE=$1
    [[ "$VALUE" =~ ^[1-9][0-9]*$ ]]
}

validate_boolean_string() {
    local VALUE=$1
    [ "$VALUE" = "true" ] || [ "$VALUE" = "false" ]
}

if ! validate_positive_integer "$ALERT_DURATION_SECONDS"; then
    echo "Invalid ALERT_DURATION_SECONDS: $ALERT_DURATION_SECONDS" >&2
    exit 1
fi

if ! validate_positive_integer "$ALIGNMENT_PERIOD_SECONDS"; then
    echo "Invalid ALIGNMENT_PERIOD_SECONDS: $ALIGNMENT_PERIOD_SECONDS" >&2
    exit 1
fi

if [ -z "$MONITORED_RESOURCE_TYPE" ]; then
    echo "MONITORED_RESOURCE_TYPE must not be empty" >&2
    exit 1
fi

if ! validate_boolean_string "$AUTO_CREATE_NOTIFICATION_CHANNELS"; then
    echo "Invalid AUTO_CREATE_NOTIFICATION_CHANNELS: $AUTO_CREATE_NOTIFICATION_CHANNELS" >&2
    exit 1
fi

for threshold in \
    "$PAYLOAD_REPLAY_THRESHOLD" \
    "$CSRF_FAILED_THRESHOLD" \
    "$UNENCRYPTED_REQUEST_THRESHOLD" \
    "$TEMP_CLEANUP_FAILED_THRESHOLD" \
    "$DOCUMENT_INTAKE_CLEANUP_FAILED_THRESHOLD" \
    "$DOCUMENT_JOB_QUEUE_INFO_FAILED_THRESHOLD"; do
    if ! validate_positive_integer "$threshold"; then
        echo "Invalid threshold value: $threshold" >&2
        exit 1
    fi
done

trim_value() {
    local VALUE=$1
    printf '%s' "$VALUE" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

append_csv_value() {
    local CURRENT=$1
    local VALUE=$2

    if [ -z "$VALUE" ]; then
        printf '%s' "$CURRENT"
        return
    fi

    if [ -z "$CURRENT" ]; then
        printf '%s' "$VALUE"
        return
    fi

    case ",$CURRENT," in
        *",$VALUE,"*) printf '%s' "$CURRENT" ;;
        *) printf '%s,%s' "$CURRENT" "$VALUE" ;;
    esac
}

find_email_notification_channel() {
    local EMAIL=$1

    gcloud beta monitoring channels list \
        --project "$PROJECT_ID" \
        --format="value(name,labels.email_address,type)" |
    awk -F '\t' -v target="$EMAIL" '$2 == target && $3 == "email" { print $1; exit }'
}

create_email_notification_channel() {
    local EMAIL=$1
    local DISPLAY_NAME="${POLICY_PREFIX} Alerts (${EMAIL})"
    local CREATE_OUTPUT=""

    if ! CREATE_OUTPUT="$(
        gcloud beta monitoring channels create \
            --project "$PROJECT_ID" \
            --display-name="$DISPLAY_NAME" \
            --description="Security alerts for ${POLICY_PREFIX}" \
            --type="email" \
            --channel-labels="email_address=${EMAIL}" 2>&1
    )"; then
        printf '%s\n' "$CREATE_OUTPUT" >&2
        return 1
    fi

    [ -n "$CREATE_OUTPUT" ] && printf '%s\n' "$CREATE_OUTPUT" >&2

    find_email_notification_channel "$EMAIL"
}

ensure_notification_channels() {
    local CHANNELS="$NOTIFICATION_CHANNELS"
    local EMAIL=""
    local CHANNEL_NAME=""

    if [ "$AUTO_CREATE_NOTIFICATION_CHANNELS" != "true" ] || [ -z "$NOTIFICATION_EMAILS" ]; then
        printf '%s' "$CHANNELS"
        return
    fi

    while IFS= read -r EMAIL; do
        EMAIL="$(trim_value "$EMAIL")"
        [ -z "$EMAIL" ] && continue

        CHANNEL_NAME="$(find_email_notification_channel "$EMAIL" || true)"
        if [ -z "$CHANNEL_NAME" ]; then
            echo "Creating notification channel for ${EMAIL}" >&2
            CHANNEL_NAME="$(create_email_notification_channel "$EMAIL" || true)"
        else
            echo "Reusing notification channel for ${EMAIL}: ${CHANNEL_NAME}" >&2
        fi

        if [ -z "$CHANNEL_NAME" ]; then
            echo "Unable to create or resolve notification channel for ${EMAIL}. Email channels may require additional permissions or verification." >&2
            continue
        fi

        CHANNELS="$(append_csv_value "$CHANNELS" "$CHANNEL_NAME")"
    done < <(printf '%s' "$NOTIFICATION_EMAILS" | tr ',' '\n')

    printf '%s' "$CHANNELS"
}

NOTIFICATION_CHANNELS="$(ensure_notification_channels)"

if [ "$AUTO_CREATE_NOTIFICATION_CHANNELS" = "true" ] && [ -n "$NOTIFICATION_EMAILS" ] && [ -z "$NOTIFICATION_CHANNELS" ]; then
    echo "Failed to resolve or create any notification channels from NOTIFICATION_EMAILS=$NOTIFICATION_EMAILS" >&2
    exit 1
fi

if [ -n "$NOTIFICATION_CHANNELS" ]; then
    echo "Using notification channels: $NOTIFICATION_CHANNELS" >&2
else
    echo "No notification channels configured. Alert policies will be created without notifications." >&2
fi

build_notification_channels_yaml() {
    if [ -z "$NOTIFICATION_CHANNELS" ]; then
        printf 'notificationChannels: []'
        return
    fi

    printf 'notificationChannels:\n'
    local CHANNEL=""
    while IFS= read -r CHANNEL; do
        [ -z "$CHANNEL" ] && continue
        printf '  - "%s"\n' "$CHANNEL"
    done < <(printf '%s' "$NOTIFICATION_CHANNELS" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed '/^$/d')
}

NOTIFICATION_CHANNELS_YAML="$(build_notification_channels_yaml)"

upsert_policy() {
    local DISPLAY_NAME=$1
    local METRIC_NAME=$2
    local THRESHOLD=$3
    local DOC_TEXT=$4

    local FILTER="metric.type=\"logging.googleapis.com/user/${METRIC_NAME}\" AND resource.type=\"${MONITORED_RESOURCE_TYPE}\""
    local TEMP_FILE
    TEMP_FILE=$(mktemp /tmp/sci-request-alert-policy.XXXXXX)

    cat >"$TEMP_FILE" <<EOF
displayName: "${DISPLAY_NAME}"
combiner: OR
enabled: true
documentation:
  content: "${DOC_TEXT}"
  mimeType: text/markdown
${NOTIFICATION_CHANNELS_YAML}
conditions:
  - displayName: "${DISPLAY_NAME} threshold"
    conditionThreshold:
      filter: '${FILTER}'
      comparison: COMPARISON_GT
      thresholdValue: ${THRESHOLD}
      duration: "${ALERT_DURATION_SECONDS}s"
      aggregations:
        - alignmentPeriod: "${ALIGNMENT_PERIOD_SECONDS}s"
          perSeriesAligner: ALIGN_SUM
      trigger:
        count: 1
EOF

    local EXISTING_NAME
    EXISTING_NAME=$(
        gcloud monitoring policies list \
            --project "$PROJECT_ID" \
            --format="value(name,displayName)" |
        awk -F '\t' -v target="$DISPLAY_NAME" '$2 == target { print $1; exit }'
    )

    if [ -n "$EXISTING_NAME" ]; then
        echo "Updating alert policy: $DISPLAY_NAME"
        gcloud monitoring policies update "$EXISTING_NAME" \
            --project "$PROJECT_ID" \
            --policy-from-file="$TEMP_FILE"
    else
        echo "Creating alert policy: $DISPLAY_NAME"
        gcloud monitoring policies create \
            --project "$PROJECT_ID" \
            --policy-from-file="$TEMP_FILE"
    fi

    rm -f "$TEMP_FILE"
}

upsert_policy \
    "${POLICY_PREFIX} Payload Replay Blocked" \
    "payload_replay_blocked_count" \
    "$PAYLOAD_REPLAY_THRESHOLD" \
    "Replay protection events exceeded the expected baseline. Review nonce/timestamp abuse patterns and recent client traffic."

upsert_policy \
    "${POLICY_PREFIX} CSRF Validation Failed" \
    "csrf_validation_failed_count" \
    "$CSRF_FAILED_THRESHOLD" \
    "CSRF validation failures exceeded the expected baseline. Review frontend session flow, proxy headers, and possible abuse spikes."

upsert_policy \
    "${POLICY_PREFIX} Unencrypted Request Blocked" \
    "unencrypted_request_blocked_count" \
    "$UNENCRYPTED_REQUEST_THRESHOLD" \
    "Plaintext requests were rejected by the secure transport middleware. Review client compatibility or suspicious probes."

upsert_policy \
    "${POLICY_PREFIX} Temp Cleanup Failed" \
    "temp_cleanup_failed_count" \
    "$TEMP_CLEANUP_FAILED_THRESHOLD" \
    "Temporary file cleanup failed multiple times. Review worker disk usage, TMPDIR, and cleanup logs."

upsert_policy \
    "${POLICY_PREFIX} Document Intake Cleanup Failed" \
    "document_intake_cleanup_failed_count" \
    "$DOCUMENT_INTAKE_CLEANUP_FAILED_THRESHOLD" \
    "Encrypted/raw document intake cleanup failed. Review GCS permissions and cleanup drift before storage pressure increases."

upsert_policy \
    "${POLICY_PREFIX} Document Queue Info Failed" \
    "document_job_queue_info_failed_count" \
    "$DOCUMENT_JOB_QUEUE_INFO_FAILED_THRESHOLD" \
    "Queue info enrichment failed, commonly due to Firestore index drift or query/runtime issues. Review backend logs and index status."

echo "Done. Alert policies are now created or updated."
