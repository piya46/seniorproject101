const crypto = require('crypto');
const {
  getAiUsageForToday,
  recordAiUsageForToday
} = require('./dbUtils');

const DEFAULT_AI_DAILY_TOKEN_LIMIT = 50000;

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

const buildAiUsageKey = (identity) =>
  crypto.createHash('sha256').update(`${identity.type}:${identity.value}`).digest('hex');

const getAiDailyTokenLimit = () => {
  const raw = Number.parseInt(String(process.env.AI_DAILY_TOKEN_LIMIT || DEFAULT_AI_DAILY_TOKEN_LIMIT), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AI_DAILY_TOKEN_LIMIT;
};

const normalizeUsageMetadata = (usageMetadata = {}) => ({
  prompt_tokens: Number(usageMetadata.promptTokenCount || usageMetadata.prompt_token_count || 0),
  candidate_tokens: Number(usageMetadata.candidatesTokenCount || usageMetadata.candidates_token_count || 0),
  total_tokens: Number(usageMetadata.totalTokenCount || usageMetadata.total_token_count || 0)
});

const assertAiWithinDailyLimit = async (user = {}) => {
  const identity = normalizeAiIdentity(user);
  const dailyLimit = getAiDailyTokenLimit();
  const usage = await getAiUsageForToday(buildAiUsageKey(identity));

  if ((usage.total_tokens || 0) >= dailyLimit) {
    const error = new Error('Daily AI token limit exceeded.');
    error.statusCode = 429;
    error.payload = {
      error: 'AI daily token limit exceeded',
      message: 'You have reached the daily AI usage limit for this account.',
      data: {
        daily_limit: dailyLimit,
        used_tokens: usage.total_tokens || 0
      }
    };
    throw error;
  }

  return {
    dailyLimit,
    identity,
    usage
  };
};

const recordAiUsage = async ({
  user = {},
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
  const usage = normalizeUsageMetadata(usageMetadata);

  return recordAiUsageForToday({
    usageKey: buildAiUsageKey(identity),
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
  assertAiWithinDailyLimit,
  getAiDailyTokenLimit,
  normalizeUsageMetadata,
  recordAiUsage
};
