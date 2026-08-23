interface EmailTemplateParams {
  preheader: string;
  heading: string;
  introHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  expiryHours: number;
}

/**
 * Renders a branded transactional email as one self-contained HTML document.
 *
 * Table-based layout with every style inlined, not a `<style>` block or external stylesheet:
 * most mail clients (Gmail, Outlook) strip or ignore both unpredictably, so nothing here relies
 * on either. Colors are the app's warm-cream/royal-violet/gold palette
 * (`apps/web/src/index.css`) as plain hex, since mail clients don't resolve CSS custom properties
 * or `oklch()`.
 */
function renderEmail({ preheader, heading, introHtml, ctaLabel, ctaUrl, expiryHours }: EmailTemplateParams): string {
  const sansStack = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const serifStack = "Georgia,'Times New Roman',serif";
  const expiryNote = `This link expires in ${expiryHours} hour${expiryHours === 1 ? "" : "s"}.`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdfaf5;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdfaf5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:16px; border:1px solid #e8ddc9;">
            <tr>
              <td style="padding:32px 36px 4px; text-align:center;">
                <span style="font-family:${serifStack}; font-size:15px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#5b2e8c;">
                  <span style="color:#c9963f;">&#9824;</span>&nbsp;KingOfCards
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 36px 0; text-align:center;">
                <h1 style="margin:0; font-family:${serifStack}; font-size:24px; font-weight:600; color:#2b1a40;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 0; font-family:${sansStack}; font-size:15px; line-height:1.6; color:#4a4438; text-align:center;">
                ${introHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 36px 4px; text-align:center;">
                <a href="${ctaUrl}" style="display:inline-block; background-color:#5b2e8c; color:#fdfaf5; font-family:${sansStack}; font-size:15px; font-weight:600; text-decoration:none; padding:13px 30px; border-radius:999px;">${ctaLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 0; text-align:center;">
                <p style="margin:0; font-family:${sansStack}; font-size:12px; line-height:1.5; color:#948d80; word-break:break-all;">
                  Or paste this link into your browser:<br />
                  <a href="${ctaUrl}" style="color:#5b2e8c;">${ctaUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 36px 32px; text-align:center; border-top:1px solid #f1ebda; margin-top:24px;">
                <p style="margin:20px 0 0; font-family:${sansStack}; font-size:12px; line-height:1.5; color:#948d80;">
                  ${expiryNote} If you didn't request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Renders the "verify your email" template for a given verification link and its TTL, in hours. */
export function verificationEmailHtml(link: string, expiryHours: number): string {
  return renderEmail({
    preheader: "Verify your email to start using KingOfCards.",
    heading: "Verify your email",
    introHtml: "Click the button below to confirm this is your email address and finish setting up your account.",
    ctaLabel: "Verify email",
    ctaUrl: link,
    expiryHours,
  });
}

/** Renders the "reset your password" template for a given reset link and its TTL, in hours. */
export function passwordResetEmailHtml(link: string, expiryHours: number): string {
  return renderEmail({
    preheader: "Reset your KingOfCards password.",
    heading: "Reset your password",
    introHtml: "Click the button below to choose a new password for your account.",
    ctaLabel: "Reset password",
    ctaUrl: link,
    expiryHours,
  });
}
