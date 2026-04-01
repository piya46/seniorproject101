const crypto = require('crypto');
const {
  getAiUsageForToday,
  recordAiUsageForToday
} = require('./dbUtils');

const DEFAULT_AI_DAILY_TOKEN_LIMIT = 100000;
const AI_USAGE_SCOPES = Object.freeze({
  DEFAULT: 'default',
  CHAT_RECOMMEND: 'chat_recommend',
  VALIDATION_CHECK_COMPLETENESS: 'validation_check_completeness'
});

const normalizeAiIdentity = (user = {}) => {
  const email = String(user.email || '').trim().toLowerCase();

  if (email) {
    return {
      type: 'email',
      value: email
    };
  }

  return {
    type: 'session',
    value: String(user.session_id || '').trim()
  };
};

const normalizeAiUsageScope = (scope) => {
  if (scope === AI_USAGE_SCOPES.CHAT_RECOMMEND) {
    return AI_USAGE_SCOPES.CHAT_RECOMMEND;
  }

  if (scope === AI_USAGE_SCOPES.VALIDATION_CHECK_COMPLETENESS) {
    return AI_USAGE_SCOPES.VALIDATION_CHECK_COMPLETENESS;
  }

  return AI_USAGE_SCOPES.DEFAULT;
};

const buildAiUsageKey = (identity, scope = AI_USAGE_SCOPES.DEFAULT) =>
  crypto
    .createHash('sha256')
    .update(`${identity.type}:${identity.value}:${normalizeAiUsageScope(scope)}`)
    .digest('hex');

const getAiDailyTokenLimit = (scope = AI_USAGE_SCOPES.DEFAULT) => {
  const normalizedScope = normalizeAiUsageScope(scope);
  let configuredLimit = process.env.AI_DAILY_TOKEN_LIMIT;

  if (normalizedScope === AI_USAGE_SCOPES.CHAT_RECOMMEND) {
    configuredLimit = process.env.AI_CHAT_DAILY_TOKEN_LIMIT || configuredLimit;
  } else if (normalizedScope === AI_USAGE_SCOPES.VALIDATION_CHECK_COMPLETENESS) {
    configuredLimit = process.env.AI_VALIDATION_DAILY_TOKEN_LIMIT || configuredLimit;
  }

  const raw = Number.parseInt(String(configuredLimit || DEFAULT_AI_DAILY_TOKEN_LIMIT), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AI_DAILY_TOKEN_LIMIT;
};

const normalizeUsageMetadata = (usageMetadata = {}) => ({
  prompt_tokens: Number(usageMetadata.promptTokenCount || usageMetadata.prompt_token_count || 0),
  candidate_tokens: Number(usageMetadata.candidatesTokenCount || usageMetadata.candidates_token_count || 0),
  total_tokens: Number(usageMetadata.totalTokenCount || usageMetadata.total_token_count || 0)
});

const buildAiUsageSummary = (usage = {}, dailyLimit = getAiDailyTokenLimit()) => {
  const usedTokens = Math.max(0, Number(usage.total_tokens || usage.used_tokens || 0));
  const limit = Math.max(1, Number(dailyLimit) || DEFAULT_AI_DAILY_TOKEN_LIMIT);
  const remainingTokens = Math.max(0, limit - usedTokens);
  const usedPercent = Math.min(100, Math.max(0, Math.round((usedTokens / limit) * 100)));

  return {
    daily_limit: limit,
    used_tokens: usedTokens,
    remaining_tokens: remainingTokens,
    used_percent: usedPercent
  };
};

const getAiUsageSummaryForUser = async (user = {}, options = {}) => {
  const identity = normalizeAiIdentity(user);
  const scope = normalizeAiUsageScope(options.scope);
  const dailyLimit = getAiDailyTokenLimit(scope);
  const usage = await getAiUsageForToday(buildAiUsageKey(identity, scope));

  return {
    scope,
    usage: buildAiUsageSummary(usage, dailyLimit)
  };
};

const assertAiWithinDailyLimit = async (user = {}, options = {}) => {
  const identity = normalizeAiIdentity(user);
  const scope = normalizeAiUsageScope(options.scope);
  const dailyLimit = getAiDailyTokenLimit(scope);
  const usage = await getAiUsageForToday(buildAiUsageKey(identity, scope));

  if ((usage.total_tokens || 0) >= dailyLimit) {
    const error = new Error('Daily AI token limit exceeded.');
    error.statusCode = 429;
    error.payload = {
      error: 'AI daily token limit exceeded',
      message: 'You have reached the daily AI usage limit for this account.',
      data: {
        ai_scope: scope,
        daily_limit: dailyLimit,
        used_tokens: usage.total_tokens || 0
      }
    };
    throw error;
  }

  return {
    scope,
    dailyLimit,
    identity,
    usage
  };
};

const recordAiUsage = async ({
  user = {},
  scope = AI_USAGE_SCOPES.DEFAULT,
  route,
  model,
  usageMetadata,
  degreeLevel = null,
  formCode = null,
  subType = null,
  caseKey = null,
  success = true,
  failureReason = null
}) => {
  const identity = normalizeAiIdentity(user);
  const normalizedScope = normalizeAiUsageScope(scope);
  const usage = normalizeUsageMetadata(usageMetadata);

  return recordAiUsageForToday({
    usageKey: buildAiUsageKey(identity, normalizedScope),
    aiScope: normalizedScope,
    identityType: identity.type,
    identityValue: identity.value,
    sessionId: user.session_id || null,
    email: user.email || null,
    route,
    model,
    degreeLevel,
    formCode,
    subType,
    caseKey,
    success,
    failureReason,
    ...usage
  });
};

module.exports = {
  AI_USAGE_SCOPES,
  assertAiWithinDailyLimit,
  buildAiUsageSummary,
  getAiUsageSummaryForUser,
  getAiDailyTokenLimit,
  normalizeAiUsageScope,
  normalizeUsageMetadata,
  recordAiUsage
};
