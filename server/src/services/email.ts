import nodemailer from "nodemailer";
import { getStoredSetting } from "./system-settings";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
};

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const config = await getStoredSetting<SmtpConfig | null>("smtp_config", null);
  if (!config || !config.host || !config.user || !config.pass) return null;
  return config;
}

export async function isEmailConfigured(): Promise<boolean> {
  const config = await getSmtpConfig();
  return config !== null;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const config = await getSmtpConfig();
  if (!config) throw new Error("E-mail não configurado. Acesse Configurações → E-mail e SMTP.");

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass }
  });

  await transporter.sendMail({
    from: `"${config.fromName || "RTPG Gestão"}" <${config.user}>`,
    to: params.to,
    subject: params.subject,
    html: params.html
  });
}

export async function sendLeadWelcomeEmail(params: {
  to: string;
  nome: string;
  restaurante: string;
}): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10)">

    <div style="background:linear-gradient(135deg,#1c1007,#7a4f18);padding:36px 32px;text-align:center">
      <p style="color:#e8c97a;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 8px">RTPG Gestão</p>
      <h1 style="color:#ffffff;font-size:26px;margin:0;font-weight:700">Solicitação recebida!</h1>
    </div>

    <div style="padding:32px">
      <p style="font-size:16px;color:#2b1808;margin:0 0 16px">Olá, <strong>${params.nome}</strong>!</p>

      <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px">
        Recebemos sua solicitação de acesso para o <strong>${params.restaurante}</strong>.
        Nossa equipe vai entrar em contato em breve pelo WhatsApp para configurar o seu acesso e apresentar o sistema.
      </p>

      <div style="background:#f9f5ef;border-radius:14px;padding:20px;margin:0 0 24px">
        <p style="font-size:13px;color:#7a4f18;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 10px">O que você vai ter acesso</p>
        <ul style="margin:0;padding:0 0 0 18px;color:#555;font-size:14px;line-height:1.8">
          <li>Mesas e comandas digitais com fechamento via Pix</li>
          <li>Cardápio, estoque e ficha técnica</li>
          <li>DRE em tempo real por produto e geral</li>
          <li>Financeiro integrado à operação</li>
        </ul>
      </div>

      <p style="font-size:14px;color:#888;margin:0">
        Qualquer dúvida, responda este e-mail ou nos chame no WhatsApp.<br>
        Até breve!
      </p>

      <p style="font-size:14px;color:#2b1808;font-weight:700;margin:16px 0 0">— Equipe RTPG Gestão</p>
    </div>

    <div style="background:#f5f0e8;padding:16px 32px;text-align:center">
      <p style="font-size:12px;color:#999;margin:0">
        Você recebeu este e-mail porque solicitou acesso ao RTPG Gestão.<br>
        Se não foi você, ignore esta mensagem.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await sendEmail({
    to: params.to,
    subject: `Solicitação recebida — RTPG Gestão`,
    html
  });
}

export async function sendAccessCredentialsEmail(params: {
  to: string;
  nome: string;
  restaurante: string;
  login: string;
  senha: string;
  planName: string;
}): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10)">

    <div style="background:linear-gradient(135deg,#1c1007,#7a4f18);padding:36px 32px;text-align:center">
      <p style="color:#e8c97a;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 8px">RTPG Gestão</p>
      <h1 style="color:#ffffff;font-size:26px;margin:0;font-weight:700">Seu acesso está pronto!</h1>
    </div>

    <div style="padding:32px">
      <p style="font-size:16px;color:#2b1808;margin:0 0 16px">Olá, <strong>${params.nome}</strong>!</p>

      <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px">
        O acesso do <strong>${params.restaurante}</strong> foi configurado.
        Use os dados abaixo para entrar no sistema.
      </p>

      <div style="background:#1c1007;border-radius:14px;padding:24px;margin:0 0 24px">
        <p style="color:#e8c97a;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 16px">Seus dados de acesso</p>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="color:#aaa;font-size:13px;padding:4px 0;width:80px">Plano</td>
            <td style="color:#ffffff;font-size:14px;font-weight:700">${params.planName}</td>
          </tr>
          <tr>
            <td style="color:#aaa;font-size:13px;padding:4px 0">Login</td>
            <td style="color:#ffffff;font-size:16px;font-weight:700;font-family:monospace">${params.login}</td>
          </tr>
          <tr>
            <td style="color:#aaa;font-size:13px;padding:4px 0">Senha</td>
            <td style="color:#ffffff;font-size:16px;font-weight:700;font-family:monospace">${params.senha}</td>
          </tr>
        </table>
      </div>

      <p style="font-size:14px;color:#555;margin:0 0 16px">
        Recomendamos que você <strong>troque a senha</strong> no primeiro acesso em
        Configurações → Segurança.
      </p>

      <p style="font-size:14px;color:#888;margin:0">Qualquer dúvida, responda este e-mail ou nos chame no WhatsApp.</p>
      <p style="font-size:14px;color:#2b1808;font-weight:700;margin:16px 0 0">— Equipe RTPG Gestão</p>
    </div>

    <div style="background:#f5f0e8;padding:16px 32px;text-align:center">
      <p style="font-size:12px;color:#999;margin:0">RTPG Gestão — sistema para bares e restaurantes.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await sendEmail({
    to: params.to,
    subject: `Seu acesso ao RTPG Gestão está pronto — ${params.restaurante}`,
    html
  });
}
