import nodemailer from "nodemailer";
import { appEnv } from "../env";

export type WelcomeEmailInput = {
  name: string;
  email: string;
  password?: string;
  login?: string;
  businessName?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSesConfigured() {
  return Boolean(appEnv.ses.host && appEnv.ses.port && appEnv.ses.user && appEnv.ses.pass && appEnv.ses.fromEmail);
}

function getTransporter() {
  if (!isSesConfigured()) {
    throw new Error("SES SMTP nao configurado. Preencha SES_SMTP_USER, SES_SMTP_PASS e SES_FROM_EMAIL.");
  }

  return nodemailer.createTransport({
    host: appEnv.ses.host,
    port: appEnv.ses.port,
    secure: appEnv.ses.port === 465,
    auth: {
      user: appEnv.ses.user,
      pass: appEnv.ses.pass
    }
  });
}

function buildWelcomeHtml(input: WelcomeEmailInput) {
  const name = escapeHtml(input.name || "cliente");
  const toEmail = escapeHtml(input.email);
  const login = escapeHtml(input.login || input.email);
  const password = input.password ? escapeHtml(input.password) : "";
  const businessName = input.businessName ? escapeHtml(input.businessName) : "";
  const appUrl = escapeHtml(appEnv.appBaseUrl);
  const fromName = escapeHtml(appEnv.ses.fromName || "RTPG App");

  const passwordRow = password
    ? `
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:14px;">Senha temporaria</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;font-size:14px;font-weight:700;">${password}</td>
      </tr>`
    : "";

  const businessRow = businessName
    ? `
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:14px;">Restaurante</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;font-size:14px;font-weight:700;">${businessName}</td>
      </tr>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bem-vindo ao RTPG App</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e7e5e4;">
            <tr>
              <td style="background:#111827;padding:32px 36px;text-align:left;">
                <p style="margin:0;color:#f59e0b;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${fromName}</p>
                <h1 style="margin:12px 0 0;color:#ffffff;font-size:30px;line-height:38px;">Ola, ${name}!</h1>
                <p style="margin:14px 0 0;color:#d1d5db;font-size:16px;line-height:24px;">Seu acesso ao RTPG App foi criado com sucesso.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 36px 12px;">
                <p style="margin:0;color:#44403c;font-size:16px;line-height:26px;">
                  Bem-vindo ao sistema de gestao para restaurantes. Voce ja pode acessar o painel para configurar cardapio, mesas, pedidos, estoque e operacao.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px 22px;">
                  ${businessRow}
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-size:14px;">Email de contato</td>
                    <td style="padding:10px 0;text-align:right;color:#0f172a;font-size:14px;font-weight:700;">${toEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748b;font-size:14px;">Login de acesso</td>
                    <td style="padding:10px 0;text-align:right;color:#0f172a;font-size:14px;font-weight:700;">${login}</td>
                  </tr>
                  ${passwordRow}
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 36px 34px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="#f59e0b" style="border-radius:999px;">
                      <a href="${appUrl}" style="display:inline-block;padding:14px 26px;color:#111827;text-decoration:none;font-size:15px;font-weight:700;">Acessar o sistema</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;color:#78716c;font-size:13px;line-height:20px;">
                  Se voce nao solicitou este acesso, ignore este email ou entre em contato com o suporte do RTPG App.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;padding:20px 36px;text-align:center;border-top:1px solid #e7e5e4;">
                <p style="margin:0;color:#78716c;font-size:12px;line-height:18px;">RTPG App - este e um email automatico, por favor nao responda.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildWelcomeText(input: WelcomeEmailInput) {
  const lines = [
    `Ola, ${input.name || "cliente"}!`,
    "",
    "Seu acesso ao RTPG App foi criado com sucesso.",
    input.businessName ? `Restaurante: ${input.businessName}` : "",
    `Email de contato: ${input.email}`,
    `Login de acesso: ${input.login || input.email}`,
    input.password ? `Senha temporaria: ${input.password}` : "",
    "",
    `Acesse: ${appEnv.appBaseUrl}`,
    "",
    "RTPG App - email automatico."
  ];

  return lines.filter(Boolean).join("\n");
}

export const emailService = {
  isConfigured: isSesConfigured,

  async sendWelcomeEmail(input: WelcomeEmailInput) {
    const transporter = getTransporter();
    const fromName = appEnv.ses.fromName || "RTPG App";

    await transporter.sendMail({
      from: `"${fromName.replace(/"/g, "'")}" <${appEnv.ses.fromEmail}>`,
      to: input.email,
      subject: "Bem-vindo ao RTPG App",
      html: buildWelcomeHtml(input),
      text: buildWelcomeText(input)
    });
  }
};
