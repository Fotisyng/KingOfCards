import nodemailer, { type Transporter } from "nodemailer";

interface MailParams {
  to: string;
  subject: string;
  html: string;
}

// Explicit switch, not just "is SMTP_HOST set": lets SMTP_* sit fully configured in `.env`
// (e.g. ready ahead of time, or mid-testing) while still deciding, in one place, whether sending
// is actually turned on. Read fresh each call, not cached at module load, so tests can flip it.
function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true";
}

let transporter: Transporter | undefined;

/**
 * Fails fast at boot if `EMAIL_ENABLED=true` but the SMTP_* vars it needs aren't set.
 *
 * Call once, at process startup (`index.ts`): a misconfiguration here should be a visible crash
 * on deploy, not a silent fallback to console-logged links the first time someone signs up.
 *
 * @throws {@link Error} if enabled without `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` all set.
 */
export function assertEmailConfig(): void {
  if (!isEmailEnabled()) return;

  const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`EMAIL_ENABLED=true but missing ${missing.join(", ")} — set them, or unset EMAIL_ENABLED.`);
  }
}

/**
 * Builds (and caches) the SMTP transporter, or `null` if email delivery is disabled.
 *
 * The enabled check runs on every call, not just the first: only the expensive `Transporter`
 * object itself is memoized. Caching the whole `null`-or-`Transporter` result on first call would
 * freeze whatever `EMAIL_ENABLED` happened to be at that moment for the rest of the process.
 */
function getTransporter(): Transporter | null {
  if (!isEmailEnabled()) return null;

  if (transporter === undefined) {
    // assertEmailConfig() already guaranteed these are set, if it ran at startup.
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Sends an email, or logs it to the console if email delivery is disabled.
 *
 * Keeps verification/reset links usable without a real mail provider: for local dev, or for a
 * deployment that isn't ready to send real email yet (`EMAIL_ENABLED` unset or `false`).
 */
export async function sendMail(params: MailParams): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] to=${params.to} subject="${params.subject}"\n${params.html}`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "KingOfCards <no-reply@kingofcards.local>",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
