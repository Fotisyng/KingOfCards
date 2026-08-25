import nodemailer, { type Transporter } from "nodemailer";

interface MailParams {
  to: string;
  subject: string;
  html: string;
}

type EmailTransport = "smtp" | "resend_api";

// Explicit switch, not just "is SMTP_HOST set": lets SMTP_* sit fully configured in `.env`
// (e.g. ready ahead of time, or mid-testing) while still deciding, in one place, whether sending
// is actually turned on. Read fresh each call, not cached at module load, so tests can flip it.
function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true";
}

// Defaults to "smtp" so existing SMTP_*-only deployments don't need to set this. "resend_api"
// exists because Render's free web services block outbound SMTP ports (25/465/587) entirely, so
// a plain HTTPS call to Resend's REST API is the only way to send real email without upgrading
// off the free plan.
function getTransport(): EmailTransport {
  return process.env.EMAIL_TRANSPORT === "resend_api" ? "resend_api" : "smtp";
}

function getFromAddress(): string {
  return process.env.SMTP_FROM ?? "KingOfCards <no-reply@kingofcards.local>";
}

let transporter: Transporter | undefined;

/**
 * Fails fast at boot if `EMAIL_ENABLED=true` but the active `EMAIL_TRANSPORT`'s required vars
 * aren't set.
 *
 * Call once, at process startup (`index.ts`): a misconfiguration here should be a visible crash
 * on deploy, not a silent fallback to console-logged links the first time someone signs up.
 *
 * @throws {@link Error} if enabled without the active transport's required vars all set.
 */
export function assertEmailConfig(): void {
  if (!isEmailEnabled()) return;

  if (getTransport() === "resend_api") {
    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "EMAIL_ENABLED=true with EMAIL_TRANSPORT=resend_api but RESEND_API_KEY is missing — set it, or switch EMAIL_TRANSPORT back to smtp.",
      );
    }
    return;
  }

  const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`EMAIL_ENABLED=true but missing ${missing.join(", ")} — set them, or unset EMAIL_ENABLED.`);
  }
}

/**
 * Builds (and caches) the SMTP transporter.
 *
 * Only the expensive `Transporter` object itself is memoized; callers are responsible for
 * deciding whether SMTP is the active transport before calling this.
 */
function getSmtpTransporter(): Transporter {
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
 * Sends one email over SMTP.
 */
async function sendViaSmtp(params: MailParams): Promise<void> {
  await getSmtpTransporter().sendMail({
    from: getFromAddress(),
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

/**
 * Sends one email through Resend's HTTPS REST API, bypassing SMTP entirely.
 *
 * Exists because Render's free web services block outbound traffic to SMTP ports, so this is the
 * only transport that can deliver real email without a paid Render plan; plain `fetch` is enough,
 * no SDK needed for a single POST.
 *
 * @throws {@link Error} if Resend's API responds with a non-2xx status.
 */
async function sendViaResendApi(params: MailParams): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend API request failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Sends an email, or logs it to the console if email delivery is disabled.
 *
 * Keeps verification/reset links usable without a real mail provider: for local dev, or for a
 * deployment that isn't ready to send real email yet (`EMAIL_ENABLED` unset or `false`). When
 * enabled, dispatches to SMTP or Resend's HTTP API depending on `EMAIL_TRANSPORT`.
 */
export async function sendMail(params: MailParams): Promise<void> {
  if (!isEmailEnabled()) {
    console.log(`[email] to=${params.to} subject="${params.subject}"\n${params.html}`);
    return;
  }

  if (getTransport() === "resend_api") {
    await sendViaResendApi(params);
  } else {
    await sendViaSmtp(params);
  }
}
