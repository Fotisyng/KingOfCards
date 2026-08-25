import { afterEach, describe, expect, it } from "vitest";
import { assertEmailConfig } from "./email.js";

const SMTP_KEYS = [
  "EMAIL_ENABLED",
  "EMAIL_TRANSPORT",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "RESEND_API_KEY",
] as const;

afterEach(() => {
  for (const key of SMTP_KEYS) delete process.env[key];
});

describe("assertEmailConfig", () => {
  it("doesn't throw when EMAIL_ENABLED is unset, even with no SMTP_* configured", () => {
    expect(() => assertEmailConfig()).not.toThrow();
  });

  it("doesn't throw when EMAIL_ENABLED is 'false'", () => {
    process.env.EMAIL_ENABLED = "false";
    expect(() => assertEmailConfig()).not.toThrow();
  });

  it("doesn't throw when EMAIL_ENABLED is 'true', EMAIL_TRANSPORT is unset, and every SMTP_* var is set", () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "resend";
    process.env.SMTP_PASS = "re_test_key";
    expect(() => assertEmailConfig()).not.toThrow();
  });

  const MISSING_VAR_CASES = [
    { missing: "SMTP_HOST", vars: { SMTP_USER: "resend", SMTP_PASS: "re_test_key" } },
    { missing: "SMTP_USER", vars: { SMTP_HOST: "smtp.example.com", SMTP_PASS: "re_test_key" } },
    { missing: "SMTP_PASS", vars: { SMTP_HOST: "smtp.example.com", SMTP_USER: "resend" } },
  ];

  it.each(MISSING_VAR_CASES)("throws when EMAIL_ENABLED is 'true' but $missing is missing", ({ missing, vars }) => {
    process.env.EMAIL_ENABLED = "true";
    Object.assign(process.env, vars);
    expect(() => assertEmailConfig()).toThrow(missing);
  });

  it("doesn't throw when EMAIL_TRANSPORT is 'resend_api' and RESEND_API_KEY is set", () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.EMAIL_TRANSPORT = "resend_api";
    process.env.RESEND_API_KEY = "re_test_key";
    expect(() => assertEmailConfig()).not.toThrow();
  });

  it("throws when EMAIL_TRANSPORT is 'resend_api' but RESEND_API_KEY is missing", () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.EMAIL_TRANSPORT = "resend_api";
    expect(() => assertEmailConfig()).toThrow("RESEND_API_KEY");
  });
});
