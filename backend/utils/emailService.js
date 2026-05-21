import nodemailer from 'nodemailer';

const createTransporter = () => {
  const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) return null;

  return nodemailer.createTransport({
    host:   EMAIL_HOST  || 'smtp.gmail.com',
    port:   parseInt(EMAIL_PORT || '587'),
    secure: EMAIL_SECURE === 'true',
    auth:   { user: EMAIL_USER, pass: EMAIL_PASS },
    tls:    { rejectUnauthorized: false },
  });
};

export const sendOTPEmail = async (to, name, otp) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`\n  [ResQAI Email] ⚠ Email not configured — OTP for ${to} : ${otp}\n`);
    return;
  }

  await transporter.sendMail({
    from:    `"ResQAI Emergency Platform" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${otp} — Your ResQAI Verification Code`,
    html:    buildOTPEmailHTML(name, otp),
    text:    `Your ResQAI verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't create an account, ignore this email.`,
  });
};

function buildOTPEmailHTML(name, otp) {
  const firstName = name?.split(' ')[0] || name || 'there';
  const digits    = otp.split('');

  const digitBoxes = digits
    .map(
      d =>
        `<td style="padding:0 4px;">
           <div style="width:44px;height:56px;background:#18181b;border:2px solid #3f3f46;border-radius:10px;font-size:26px;font-weight:800;color:#f4f4f5;line-height:56px;text-align:center;font-family:monospace;">${d}</div>
         </td>`
    )
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

          <!-- Header -->
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

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.3;">Verify your email address</h1>
              <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 28px;">
                Hi ${firstName},<br>
                Use the code below to verify your email and complete your ResQAI registration. It expires in <strong style="color:#fbbf24;">10 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <div style="background:#09090b;border:1px solid #3f3f46;border-radius:12px;padding:24px 20px;text-align:center;margin:0 0 28px;">
                <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 18px;font-weight:600;">Verification Code</p>
                <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>${digitBoxes}</tr>
                </table>
              </div>

              <!-- Security Note -->
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

          <!-- Footer -->
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
