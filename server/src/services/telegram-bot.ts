import {
  createSaasClient,
  getSaasClients,
  getSaasOverview,
  updateSaasClient,
  registerSaasPayment
} from "./platform";
import { createSaasClientCharge, isAsaasConfigured } from "./asaas";
import { getStoredSetting } from "./system-settings";
import { formatMoney } from "../lib/format";

const TELEGRAM_API = "https://api.telegram.org";

let botToken: string | null = null;
let adminChatId: string | null = null;
let polling = false;
let lastUpdateId = 0;

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}
function getAdminChatId() {
  return process.env.TELEGRAM_ADMIN_CHAT_ID ?? null;
}

async function tgFetch(method: string, body?: Record<string, unknown>) {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  return res.json();
}

async function sendMessage(chatId: string | number, text: string, extra?: Record<string, unknown>) {
  return tgFetch("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

function isAdmin(chatId: string | number) {
  const id = getAdminChatId();
  if (!id) return false;
  return String(chatId) === String(id);
}

async function handleCommand(chatId: number, text: string) {
  if (!isAdmin(chatId)) {
    await sendMessage(chatId, "⛔ Acesso não autorizado.");
    return;
  }

  const [cmd, ...args] = text.trim().split(/\s+/);
  const arg = args.join(" ").trim();

  switch (cmd.toLowerCase()) {

    case "/ajuda":
    case "/start":
      await sendMessage(chatId, [
        "<b>RTPG Gestão — Painel via Telegram</b>",
        "",
        "/status — Resumo da carteira",
        "/clientes — Lista todos os clientes",
        "/leads — Novos pedidos de acesso",
        "/info <i>login</i> — Detalhes de um cliente",
        "/cobrar <i>login</i> — Gera Pix da mensalidade",
        "/bloquear <i>login</i> — Bloqueia acesso",
        "/liberar <i>login</i> — Libera acesso",
        "/atrasados — Clientes em atraso",
        "/ajuda — Esta mensagem"
      ].join("\n"));
      break;

    case "/status": {
      const overview = await getSaasOverview();
      const s = overview.summary;
      await sendMessage(chatId, [
        "<b>📊 Resumo da carteira</b>",
        "",
        `💰 MRR: <b>${formatMoney(s.mrr)}</b>`,
        `📈 Receita total: <b>${formatMoney(s.totalRevenue)}</b>`,
        `✅ Ativos: <b>${s.activeCount}</b>`,
        `⚠️ Atrasados: <b>${s.overdueCount}</b>`,
        `🔴 Bloqueados: <b>${s.blockedCount}</b>`
      ].join("\n"));
      break;
    }

    case "/clientes": {
      const clients = await getSaasClients();
      if (!clients.length) {
        await sendMessage(chatId, "Nenhum cliente cadastrado ainda.");
        break;
      }
      const lines = clients.map((c) => {
        const icon = c.status === "ATIVO" ? "✅" : c.status === "TRIAL" ? "🔵" : c.status === "ATRASADO" ? "⚠️" : "🔴";
        return `${icon} <b>${c.businessName || c.accessLogin}</b> — ${formatMoney(c.monthlyFee)} — <code>${c.accessLogin}</code>`;
      });
      await sendMessage(chatId, `<b>Clientes (${clients.length})</b>\n\n${lines.join("\n")}`);
      break;
    }

    case "/atrasados": {
      const clients = await getSaasClients();
      const overdue = clients.filter((c) => c.status === "ATRASADO" || c.status === "SUSPENSO");
      if (!overdue.length) {
        await sendMessage(chatId, "✅ Nenhum cliente em atraso.");
        break;
      }
      const lines = overdue.map((c) =>
        `⚠️ <b>${c.businessName || c.accessLogin}</b>\n   login: <code>${c.accessLogin}</code> · vence: ${c.nextDueDate || "?"} · ${formatMoney(c.monthlyFee)}`
      );
      await sendMessage(chatId, `<b>Clientes em atraso (${overdue.length})</b>\n\n${lines.join("\n\n")}`);
      break;
    }

    case "/leads": {
      const leads = await getStoredSetting<Array<{ nome: string; restaurante: string; telefone: string; email?: string; createdAt: string }>>("saas_leads", []);
      const list = Array.isArray(leads) ? leads : [];
      if (!list.length) {
        await sendMessage(chatId, "Nenhum lead recebido ainda.");
        break;
      }
      const lines = list.slice(-10).reverse().map((l) =>
        `👤 <b>${l.nome}</b> — ${l.restaurante}\n   📱 ${l.telefone}${l.email ? ` · ${l.email}` : ""}\n   🕐 ${new Date(l.createdAt).toLocaleString("pt-BR")}`
      );
      await sendMessage(chatId, `<b>Últimos leads (${list.length} total)</b>\n\n${lines.join("\n\n")}`);
      break;
    }

    case "/info": {
      if (!arg) { await sendMessage(chatId, "Use: /info <code>login</code>"); break; }
      const clients = await getSaasClients();
      const client = clients.find((c) => c.accessLogin.toLowerCase() === arg.toLowerCase());
      if (!client) { await sendMessage(chatId, `Cliente <code>${arg}</code> não encontrado.`); break; }
      await sendMessage(chatId, [
        `<b>${client.businessName || client.accessLogin}</b>`,
        `Responsável: ${client.contactName || "—"}`,
        `Login: <code>${client.accessLogin}</code>`,
        `Plano: ${client.planName} · ${formatMoney(client.monthlyFee)}/mês`,
        `Status: ${client.status} · Acesso: ${client.accessStatus}`,
        `Vencimento: ${client.nextDueDate || "—"}`,
        `E-mail: ${client.email || "—"} · Tel: ${client.phone || "—"}`,
        `Pagamentos: ${client.payments.length} registrado(s)`,
        client.notes ? `Obs: ${client.notes}` : ""
      ].filter(Boolean).join("\n"));
      break;
    }

    case "/cobrar": {
      if (!arg) { await sendMessage(chatId, "Use: /cobrar <code>login</code>"); break; }
      const clients = await getSaasClients();
      const client = clients.find((c) => c.accessLogin.toLowerCase() === arg.toLowerCase());
      if (!client) { await sendMessage(chatId, `Cliente <code>${arg}</code> não encontrado.`); break; }
      if (!client.monthlyFee) { await sendMessage(chatId, "Mensalidade não definida para este cliente."); break; }

      const configured = await isAsaasConfigured();
      if (!configured) { await sendMessage(chatId, "⚠️ Asaas não configurado. Acesse as configurações."); break; }

      await sendMessage(chatId, `⏳ Gerando Pix de ${formatMoney(client.monthlyFee)} para ${client.businessName || client.accessLogin}...`);
      try {
        const charge = await createSaasClientCharge({
          clientName: client.contactName || client.businessName || "Cliente",
          email: client.email || undefined,
          phone: client.phone || undefined,
          amount: client.monthlyFee,
          description: `Mensalidade ${client.planName} — ${client.businessName || client.accessLogin}`,
          dueDays: 3
        });
        await sendMessage(chatId, [
          `💰 <b>Pix gerado — ${formatMoney(client.monthlyFee)}</b>`,
          `Cliente: ${client.businessName || client.accessLogin}`,
          `Vence: ${charge.dueDate}`,
          "",
          "<b>Copia e cola:</b>",
          `<code>${charge.pixCode}</code>`
        ].join("\n"));
      } catch (err) {
        await sendMessage(chatId, `❌ Erro: ${err instanceof Error ? err.message : "Falha ao gerar cobrança."}`);
      }
      break;
    }

    case "/bloquear": {
      if (!arg) { await sendMessage(chatId, "Use: /bloquear <code>login</code>"); break; }
      const clients = await getSaasClients();
      const client = clients.find((c) => c.accessLogin.toLowerCase() === arg.toLowerCase());
      if (!client) { await sendMessage(chatId, `Cliente <code>${arg}</code> não encontrado.`); break; }
      await updateSaasClient(client.id, { accessStatus: "BLOQUEADO", status: "SUSPENSO" });
      await sendMessage(chatId, `🔴 Acesso de <b>${client.businessName || client.accessLogin}</b> bloqueado.`);
      break;
    }

    case "/liberar": {
      if (!arg) { await sendMessage(chatId, "Use: /liberar <code>login</code>"); break; }
      const clients = await getSaasClients();
      const client = clients.find((c) => c.accessLogin.toLowerCase() === arg.toLowerCase());
      if (!client) { await sendMessage(chatId, `Cliente <code>${arg}</code> não encontrado.`); break; }
      await updateSaasClient(client.id, { accessStatus: "LIBERADO", status: "ATIVO" });
      await sendMessage(chatId, `✅ Acesso de <b>${client.businessName || client.accessLogin}</b> liberado.`);
      break;
    }

    default:
      await sendMessage(chatId, `Comando não reconhecido. Digite /ajuda para ver os comandos disponíveis.`);
  }
}

async function pollOnce() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(
      `${TELEGRAM_API}/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=25&allowed_updates=["message"]`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) return;
    const data = await res.json() as { ok: boolean; result: Array<{ update_id: number; message?: { chat: { id: number }; text?: string } }> };
    if (!data.ok || !data.result.length) return;

    for (const update of data.result) {
      lastUpdateId = update.update_id;
      const msg = update.message;
      if (!msg?.text) continue;
      handleCommand(msg.chat.id, msg.text).catch(() => {});
    }
  } catch {
    // ignore timeout/network errors — polling will retry
  }
}

export function startTelegramBot() {
  const token = getToken();
  if (!token) {
    console.log("[Telegram] TELEGRAM_BOT_TOKEN não definido — bot desativado.");
    return;
  }
  if (!getAdminChatId()) {
    console.log("[Telegram] TELEGRAM_ADMIN_CHAT_ID não definido — bot desativado.");
    return;
  }
  if (polling) return;
  polling = true;
  console.log("[Telegram] Bot iniciado.");

  async function loop() {
    while (polling) {
      await pollOnce();
    }
  }
  loop().catch(() => {});
}

export async function notifyAdmin(text: string) {
  const id = getAdminChatId();
  if (!id) return;
  return sendMessage(id, text);
}
