const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { extractDomain, getAllowedDomains, isHostedDomainRequired } = require('../utils/oidcUtils');
const { profileDetailsSchema } = require('../validators/schemas');

const router = express.Router();

function deriveAccountType(email, hostedDomain) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedHostedDomain = String(hostedDomain || '').trim().toLowerCase();
  const emailDomain = extractDomain(normalizedEmail);

  if (normalizedHostedDomain === 'student.chula.ac.th' || emailDomain === 'student.chula.ac.th') {
    return 'student';
  }

  if (normalizedHostedDomain === 'chula.ac.th' || emailDomain === 'chula.ac.th') {
    return 'staff';
  }

  if (normalizedEmail) {
    return 'external';
  }

  return 'unknown';
}

function deriveStudentId(email, accountType) {
  if (accountType !== 'student') {
    return null;
  }

  const localPart = String(email || '').trim().split('@')[0] || '';
  return /^\d+$/.test(localPart) ? localPart : null;
}

function buildSafeProfile(user) {
  const email = String(user?.email || '').trim().toLowerCase() || null;
  const hostedDomain = String(user?.hosted_domain || '').trim().toLowerCase() || null;
  const allowedDomains = getAllowedDomains();
  const emailDomain = extractDomain(email);
  const accountType = deriveAccountType(email, hostedDomain);
  const domainVerified = allowedDomains.length === 0
    ? Boolean(email)
    : allowedDomains.includes(emailDomain) && (
        !isHostedDomainRequired() || allowedDomains.includes(hostedDomain)
      );
  const name = String(user?.name || '').trim() || null;
  const picture = String(user?.picture || '').trim() || null;

  return {
    authenticated: true,
    email,
    hosted_domain: hostedDomain,
    name,
    picture,
    auth_provider: String(user?.auth_provider || '').trim() || null,
    display_name: name || (email ? email.split('@')[0] : null),
    display_email: email,
    avatar_url: picture,
    account_type: accountType,
    domain_verified: domainVerified,
    allowed_domains: allowedDomains,
    auth_mode: String(process.env.CLOUD_RUN_AUTH_MODE || 'public').trim().toLowerCase() || 'public',
    role: 'user',
    student_id: deriveStudentId(email, accountType),
    faculty: null,
    department: null,
    degree_level: null,
    phone: null,
    profile_completed: false
  };
}

function buildProfileDetails(user, options = {}) {
  const safeProfile = buildSafeProfile(user);
  const includeSensitivePersonalData = options.include_sensitive_personal_data !== false;

  return {
    ...safeProfile,
    personal_data: includeSensitivePersonalData ? {
      legal_name: safeProfile.name,
      display_name: safeProfile.display_name,
      email: safeProfile.email,
      hosted_domain: safeProfile.hosted_domain,
      picture: safeProfile.picture,
      student_id: safeProfile.student_id,
      faculty: safeProfile.faculty,
      department: safeProfile.department,
      degree_level: safeProfile.degree_level,
      phone: safeProfile.phone
    } : null,
    privacy: {
      classification: 'personal_data',
      transport: 'secure_json',
      encrypted: true
    }
  };
}

router.get('/me', authMiddleware, (req, res) => {
  return res.json(buildSafeProfile(req.user));
});

router.post('/details', authMiddleware, validate(profileDetailsSchema), (req, res) => {
  return res.json(buildProfileDetails(req.user, req.body));
});

module.exports = router;
