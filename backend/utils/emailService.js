import nodemailer from 'nodemailer';
import { resolve4 } from 'dns/promises';

// ─── Brevo HTTPS API ──────────────────────────────────────────────────────────
// Render free tier blocks all outbound SMTP ports (25/465/587).
// Brevo's REST API runs over HTTPS (port 443) and is never blocked.
// Requires: BREVO_API_KEY + EMAIL_FROM env vars.
const sendViaBrevo = async (to, subject, html, text) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key':      process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender:      { name: 'ResQAI Emergency Platform', email: process.env.EMAIL_FROM },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Brevo ${res.status}: ${body.message || 'send failed'}`);
  }
};

// ─── SMTP (local dev fallback) ────────────────────────────────────────────────
// Used only when BREVO_API_KEY is not set (i.e. localhost).
const createSMTPTransporter = async () => {
  const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) return null;

  const hostname = EMAIL_HOST || 'smtp.gmail.com';
  let host = hostname;
  try {
    const [ip] = await resolve4(hostname);
    host = ip;
  } catch { /* fall back to hostname */ }

  return nodemailer.createTransport({
    host,
    port:              parseInt(EMAIL_PORT || '587'),
    secure:            EMAIL_SECURE === 'true',
    auth:              { user: EMAIL_USER, pass: EMAIL_PASS },
    tls:               { servername: hostname },
    connectionTimeout: 10_000,
    greetingTimeout:   8_000,
    socketTimeout:     15_000,
  });
};

// ─── Dispatcher ───────────────────────────────────────────────────────────────
const dispatch = async (to, subject, html, text) => {
  if (process.env.BREVO_API_KEY && process.env.EMAIL_FROM) {
    await sendViaBrevo(to, subject, html, text);
    return true;
  }

  const transporter = await createSMTPTransporter();
  if (!transporter) return false;

  await transporter.sendMail({
    from: `"ResQAI Emergency Platform" <${process.env.EMAIL_USER}>`,
    to, subject, html, text,
  });
  return true;
};

// ─── Public exports ───────────────────────────────────────────────────────────

export const sendPasswordResetEmail = async (to, name, resetUrl) => {
  const firstName = name?.split(' ')[0] || 'there';
  const sent = await dispatch(
    to,
    'Reset your ResQAI password',
    buildResetHTML(firstName, resetUrl),
    `Hi ${firstName},\n\nClick the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email — your password won't change.`,
  );
  if (!sent) {
    console.log(`\n  [ResQAI Email] ⚠ Email not configured — password reset link for ${to} : ${resetUrl}\n`);
  }
};

export const sendOTPEmail = async (to, name, otp) => {
  const sent = await dispatch(
    to,
    `${otp} — Your ResQAI Verification Code`,
    buildOTPEmailHTML(name, otp),
    `Your ResQAI verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't create an account, ignore this email.`,
  );
  if (!sent) {
    console.log(`\n  [ResQAI Email] ⚠ Email not configured — OTP for ${to} : ${otp}\n`);
  }
};

export const sendInviteEmail = async (to, inviteUrl, expiresAt) => {
  const expiry = new Date(expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });
  const sent = await dispatch(
    to,
    'You\'ve been invited to join ResQAI as an Administrator',
    buildInviteHTML(to, inviteUrl, expiry),
    `You've been invited to join ResQAI as an Administrator.\n\nClick the link below to create your account. It expires on ${expiry}.\n\n${inviteUrl}\n\nIf you didn't expect this invitation, you can ignore this email.`,
  );
  if (!sent) {
    console.log(`\n  [ResQAI Email] ⚠ Email not configured — invite link for ${to} : ${inviteUrl}\n`);
  }
};

// ─── HTML builders ────────────────────────────────────────────────────────────

function buildResetHTML(firstName, resetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reset your ResQAI password</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:28px 36px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px;">ResQAI</div>
              <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px;">Emergency Coordination Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0 0 12px;">Reset your password</h1>
              <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 28px;">
                Hi ${firstName},<br>
                We received a request to reset your ResQAI password. Click the button below — this link expires in <strong style="color:#fbbf24;">1 hour</strong>.
              </p>
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${resetUrl}" style="display:inline-block;background:#dc2626;color:white;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">Reset Password</a>
              </div>
              <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 16px;margin:0 0 24px;">
                <p style="color:#a8a29e;font-size:12px;margin:0;line-height:1.6;">
                  🔒 <strong style="color:#d6d3d1;">Didn't request this?</strong> You can safely ignore this email. Your password will not change.
                </p>
              </div>
              <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <span style="color:#71717a;word-break:break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#09090b;padding:18px 36px;border-top:1px solid #27272a;text-align:center;">
              <p style="color:#3f3f46;font-size:11px;margin:0;">© 2025 ResQAI Emergency Platform · All rights reserved</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOTPEmailHTML(name, otp) {
  const firstName = name?.split(' ')[0] || name || 'there';
  const digits    = otp.split('');

  const digitBoxes = digits
    .map(d => `<td style="padding:0 4px;">
           <div style="width:44px;height:56px;background:#18181b;border:2px solid #3f3f46;border-radius:10px;font-size:26px;font-weight:800;color:#f4f4f5;line-height:56px;text-align:center;font-family:monospace;">${d}</div>
         </td>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your ResQAI Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;font-size:20px;font-weight:900;color:white;text-align:center;line-height:40px;">R</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:10px;">
                    <span style="font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px;">ResQAI</span>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px;">Emergency Coordination Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.3;">Verify your email address</h1>
              <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 28px;">
                Hi ${firstName},<br>
                Use the code below to verify your email and complete your ResQAI registration. It expires in <strong style="color:#fbbf24;">10 minutes</strong>.
              </p>
              <div style="background:#09090b;border:1px solid #3f3f46;border-radius:12px;padding:24px 20px;text-align:center;margin:0 0 28px;">
                <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 18px;font-weight:600;">Verification Code</p>
                <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>${digitBoxes}</tr>
                </table>
              </div>
              <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 16px;margin:0 0 24px;">
                <p style="color:#a8a29e;font-size:12px;margin:0;line-height:1.6;">
                  🔒 <strong style="color:#d6d3d1;">Security tip:</strong> ResQAI will never ask for your verification code over phone or email. Never share this code with anyone.
                </p>
              </div>
              <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;">
                Didn't create a ResQAI account? You can safely ignore this email — the code will expire automatically.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#09090b;padding:18px 36px;border-top:1px solid #27272a;text-align:center;">
              <p style="color:#3f3f46;font-size:11px;margin:0;">© 2025 ResQAI Emergency Platform · All rights reserved</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildInviteHTML(email, inviteUrl, expiry) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>You're invited to ResQAI</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:28px 36px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px;">ResQAI</div>
              <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px;">Emergency Coordination Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0 0 12px;">You've been invited!</h1>
              <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 8px;">
                Hi <strong style="color:#e4e4e7;">${email}</strong>,
              </p>
              <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 28px;">
                An administrator has invited you to join <strong style="color:#f4f4f5;">ResQAI</strong> as an <strong style="color:#f87171;">Administrator</strong>. Click the button below to create your account. This link expires on <strong style="color:#fbbf24;">${expiry}</strong>.
              </p>
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${inviteUrl}" style="display:inline-block;background:#dc2626;color:white;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">Accept Invitation</a>
              </div>
              <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 16px;margin:0 0 24px;">
                <p style="color:#a8a29e;font-size:12px;margin:0;line-height:1.6;">
                  🔒 <strong style="color:#d6d3d1;">Security note:</strong> This link can only be used once and is locked to this email address. It expires on <strong style="color:#d6d3d1;">${expiry}</strong>.
                </p>
              </div>
              <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;">
                If the button doesn't work, copy and paste this link:<br>
                <span style="color:#71717a;word-break:break-all;">${inviteUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#09090b;padding:18px 36px;border-top:1px solid #27272a;text-align:center;">
              <p style="color:#3f3f46;font-size:11px;margin:0;">© 2025 ResQAI Emergency Platform · All rights reserved</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
