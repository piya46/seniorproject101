const nodemailer = require('nodemailer');

const sanitizeEnv = (value) => (typeof value === 'string' ? value.trim() : '');
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isLikelyValidHostname = (value) => {
  if (!value || value.startsWith('-') || /\s/.test(value)) {
    return false;
  }

  return /^[a-zA-Z0-9.-]+$/.test(value);
};

const getSmtpConfig = () => {
  const SMTP_HOST = sanitizeEnv(process.env.SMTP_HOST);
  const SMTP_PORT = sanitizeEnv(process.env.SMTP_PORT);
  const SMTP_USER = sanitizeEnv(process.env.SMTP_USER);
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_SECURE = sanitizeEnv(process.env.SMTP_SECURE);
  const SMTP_FROM_EMAIL = sanitizeEnv(process.env.SMTP_FROM_EMAIL);
  const SMTP_FROM_NAME = sanitizeEnv(process.env.SMTP_FROM_NAME);

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
    throw new Error(
      'Missing SMTP configuration. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL'
    );
  }

  if (!isLikelyValidHostname(SMTP_HOST)) {
    throw new Error(`Invalid SMTP_HOST configuration: "${SMTP_HOST}"`);
  }

  const parsedPort = Number(SMTP_PORT);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    throw new Error(`Invalid SMTP_PORT configuration: "${SMTP_PORT}"`);
  }

  if (!isValidEmail(SMTP_USER)) {
    throw new Error(`Invalid SMTP_USER configuration: "${SMTP_USER}"`);
  }

  if (!isValidEmail(SMTP_FROM_EMAIL)) {
    throw new Error(`Invalid SMTP_FROM_EMAIL configuration: "${SMTP_FROM_EMAIL}"`);
  }

  return {
    host: SMTP_HOST,
    port: parsedPort,
    secure: SMTP_SECURE === 'true' || parsedPort === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    from: SMTP_FROM_NAME
      ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
      : SMTP_FROM_EMAIL
  };
};

let transporter;

const getTransporter = () => {
  if (!transporter) {
    const smtpConfig = getSmtpConfig();
    transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth
    });
  }

  return transporter;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildTechnicalSupportMail = ({
  reporterEmail,
  issueType,
  subject,
  description,
  attachment
}) => {
  const lines = [
    'Technical Support Request',
    '',
    `Reporter Email: ${reporterEmail}`,
    `Issue Type: ${issueType}`,
    `Subject: ${subject}`,
    '',
    'Description:',
    description
  ];

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 16px;">Technical Support Request</h2>
      <table style="border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: 700;">Reporter Email</td>
          <td style="padding: 6px 0;">${escapeHtml(reporterEmail)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: 700;">Issue Type</td>
          <td style="padding: 6px 0;">${escapeHtml(issueType)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: 700;">Subject</td>
          <td style="padding: 6px 0;">${escapeHtml(subject)}</td>
        </tr>
      </table>
      <div style="margin-top: 16px;">
        <div style="font-weight: 700; margin-bottom: 8px;">Description</div>
        <div style="white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">${escapeHtml(description)}</div>
      </div>
      ${
        attachment
          ? `<p style="margin-top: 16px; color: #4b5563;">Attachment included: ${escapeHtml(attachment.filename)}</p>`
          : ''
      }
    </div>
  `;

  return {
    text: lines.join('\n'),
    html
  };
};

const sendTechnicalSupportEmail = async ({
  targetEmail,
  reporterEmail,
  issueType,
  subject,
  description,
  attachment
}) => {
  const smtpConfig = getSmtpConfig();
  const mailContent = buildTechnicalSupportMail({
    reporterEmail,
    issueType,
    subject,
    description,
    attachment
  });

  const info = await getTransporter().sendMail({
    from: smtpConfig.from,
    to: targetEmail,
    replyTo: reporterEmail,
    subject: `แจ้งปัญหา: ${issueType}`,
    text: mailContent.text,
    html: mailContent.html,
    attachments: attachment
      ? [
          {
            filename: attachment.originalname,
            ...(attachment.path ? { path: attachment.path } : { content: attachment.buffer }),
            contentType: attachment.mimetype
          }
        ]
      : []
  });

  return info;
};

module.exports = {
  sendTechnicalSupportEmail
};
