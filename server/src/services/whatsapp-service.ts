/**
 * whatsapp-service.ts
 *
 * Serviço multi-tenant que gerencia conexões WhatsApp via
 * @whiskeysockets/baileys — uma conexão isolada por barId.
 *
 * Recursos:
 *   - Uma conexão Baileys por restaurante (barId)
 *   - Reconexão com backoff exponencial (max 5 tentativas)
 *   - Watchdog que detecta conexões travadas
 *   - Healthcheck por conexão
 *   - Reconnect forçado (limpa sessão e gera novo QR)
 *   - Motivo técnico da desconexão nos logs
 */

import path from "node:path";
import fs from "node:fs";
import { appEnv } from "../env";
import QRCode from "qrcode";

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export type WppStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "QR_READY"
  | "CONNECTED"
  | "AUTH_FAILURE"
  | "RECONNECTING";

export interface WppState {
  status: WppStatus;
  qrDataUrl: string | null;
  phone: string | null;
  connectedAt: string | null;
  retryCount: number;
  lastError: string | null;
  logs: Array<{ ts: string; message: string }>;
}

export type IncomingMessageHandler = (barId: string, phone: string, body: string) => Promise<void>;

// ─── Constantes ──────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;
const BASE_RETRY_MS = 3_000;
const WATCHDOG_INTERVAL_MS = 60_000;
const QR_TIMEOUT_MS = 90_000;
const STALE_CONNECTING_MS = 120_000;

// ─── Estado interno por bar ──────────────────────────────────────────────────

interface BarConnection {
  sock: unknown;
  state: WppState;
  retryTimer: ReturnType<typeof setTimeout> | null;
  qrTimer: ReturnType<typeof setTimeout> | null;
  lastActivity: number;
}

const connections = new Map<string, BarConnection>();
let onMessage: IncomingMessageHandler | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

// Cache do módulo Baileys para não re-importar toda vez
let baileysModule: Record<string, unknown> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOrCreateConn(barId: string): BarConnection {
  let conn = connections.get(barId);
  if (!conn) {
    conn = {
      sock: null,
      state: {
        status: "DISCONNECTED",
        qrDataUrl: null,
        phone: null,
        connectedAt: null,
        retryCount: 0,
        lastError: null,
        logs: [],
      },
      retryTimer: null,
      qrTimer: null,
      lastActivity: Date.now(),
    };
    connections.set(barId, conn);
  }
  return conn;
}

function log(barId: string, message: string) {
  const conn = getOrCreateConn(barId);
  const entry = { ts: new Date().toISOString(), message };
  conn.state.logs = [entry, ...conn.state.logs].slice(0, 200);
  conn.lastActivity = Date.now();
  console.log(`[WhatsApp:${barId}] ${message}`);
}

function authDir(barId: string) {
  const dir = path.join(appEnv.storageDir, "whatsapp-auth", barId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Remove todos os arquivos de autenticação de um bar (força novo QR) */
function clearAuthFiles(barId: string) {
  const dir = authDir(barId);
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {
          // ignora arquivos travados
        }
      }
    }
  } catch {
    // ignora
  }
}

function clearTimers(conn: BarConnection) {
  if (conn.retryTimer) {
    clearTimeout(conn.retryTimer);
    conn.retryTimer = null;
  }
  if (conn.qrTimer) {
    clearTimeout(conn.qrTimer);
    conn.qrTimer = null;
  }
}

function disconnectReasonLabel(code: number | undefined): string {
  const reasons: Record<number, string> = {
    401: "logout pelo usuário",
    408: "timeout de conexão",
    428: "conexão substituída por outro dispositivo",
    440: "sessão expirada",
    500: "erro interno do servidor WhatsApp",
    503: "servidor indisponível",
    515: "restart do servidor WhatsApp",
  };
  if (!code) return "motivo desconhecido";
  return reasons[code] ?? `código ${code}`;
}

/**
 * Cria um logger mínimo compatível com Pino (que é o que o Baileys espera).
 * Precisa ter os métodos de nível + child().
 */
function makeSilentLogger(): unknown {
  const noop = () => {};
  const logger = {
    level: "silent",
    fatal: noop,
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    trace: noop,
    child: () => logger,
  };
  return logger;
}

// ─── Carregamento do Baileys ─────────────────────────────────────────────────

async function loadBaileys(): Promise<Record<string, unknown> | null> {
  if (baileysModule) return baileysModule;

  try {
    baileysModule = await import("@whiskeysockets/baileys");
    return baileysModule;
  } catch (err) {
    console.error("[WhatsApp] Falha ao importar @whiskeysockets/baileys:", err);
    return null;
  }
}

// ─── Watchdog ────────────────────────────────────────────────────────────────

function startWatchdog() {
  if (watchdogTimer) return;

  watchdogTimer = setInterval(() => {
    const now = Date.now();

    for (const [barId, conn] of connections) {
      if (
        conn.state.status === "CONNECTING" &&
        now - conn.lastActivity > STALE_CONNECTING_MS
      ) {
        log(barId, "Watchdog: conexão travada em CONNECTING. Reiniciando...");
        forceDisconnectSock(conn);
        conn.state.status = "DISCONNECTED";
        clearTimers(conn);
        scheduleRetry(barId);
      }

      if (
        conn.state.status === "QR_READY" &&
        now - conn.lastActivity > QR_TIMEOUT_MS + 30_000
      ) {
        log(barId, "Watchdog: QR expirado sem leitura. Reiniciando conexão...");
        forceDisconnectSock(conn);
        conn.state.status = "DISCONNECTED";
        conn.state.qrDataUrl = null;
        scheduleRetry(barId);
      }
    }
  }, WATCHDOG_INTERVAL_MS);
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

// ─── Retry com backoff exponencial ───────────────────────────────────────────

function scheduleRetry(barId: string) {
  const conn = getOrCreateConn(barId);

  if (conn.state.retryCount >= MAX_RETRIES) {
    log(barId, `Limite de reconexões atingido (${MAX_RETRIES}). Reconecte manualmente.`);
    conn.state.status = "DISCONNECTED";
    conn.state.lastError = "Limite de reconexões atingido";
    return;
  }

  const delay = BASE_RETRY_MS * Math.pow(2, conn.state.retryCount);
  conn.state.retryCount++;
  conn.state.status = "RECONNECTING";

  log(barId, `Tentativa ${conn.state.retryCount}/${MAX_RETRIES} em ${Math.round(delay / 1000)}s...`);

  conn.retryTimer = setTimeout(() => {
    conn.retryTimer = null;
    initWpp(barId);
  }, delay);
}

// ─── Force disconnect ────────────────────────────────────────────────────────

function forceDisconnectSock(conn: BarConnection) {
  if (conn.sock) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = conn.sock as any;
      if (typeof s.end === "function") s.end(undefined);
      else if (typeof s.ws?.close === "function") s.ws.close();
    } catch {
      // ignora
    }
    conn.sock = null;
  }
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function getWppState(barId: string): WppState {
  const conn = connections.get(barId);
  if (!conn) {
    return {
      status: "DISCONNECTED",
      qrDataUrl: null,
      phone: null,
      connectedAt: null,
      retryCount: 0,
      lastError: null,
      logs: [],
    };
  }
  return { ...conn.state, logs: conn.state.logs.slice(0, 50) };
}

export function setMessageHandler(handler: IncomingMessageHandler) {
  onMessage = handler;
}

export async function sendWppMessage(barId: string, to: string, text: string): Promise<void> {
  const conn = connections.get(barId);
  if (!conn || conn.state.status !== "CONNECTED" || !conn.sock) {
    throw new Error("WhatsApp não está conectado para este restaurante.");
  }

  const jid = to.includes("@") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (conn.sock as any).sendMessage(jid, { text });
  log(barId, `Mensagem enviada para ${jid}`);
}

export async function disconnectWpp(barId: string): Promise<void> {
  const conn = connections.get(barId);
  if (!conn) return;

  clearTimers(conn);

  if (conn.sock) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (conn.sock as any).logout();
    } catch {
      // ignora
    }
    conn.sock = null;
  }

  conn.state.status = "DISCONNECTED";
  conn.state.qrDataUrl = null;
  conn.state.phone = null;
  conn.state.connectedAt = null;
  conn.state.retryCount = 0;
  conn.state.lastError = null;
  log(barId, "Sessão encerrada.");

  const hasActive = [...connections.values()].some(
    (c) => c.state.status !== "DISCONNECTED"
  );
  if (!hasActive) stopWatchdog();
}

/**
 * Reconexão forçada: limpa sessão antiga, limpa auth, e inicia nova conexão.
 * Isso garante que um novo QR Code será gerado.
 */
export async function reconnectWpp(barId: string): Promise<void> {
  const conn = connections.get(barId);

  // Para tudo que está em andamento
  if (conn) {
    clearTimers(conn);
    forceDisconnectSock(conn);
    conn.state.status = "DISCONNECTED";
    conn.state.qrDataUrl = null;
    conn.state.phone = null;
    conn.state.connectedAt = null;
    conn.state.retryCount = 0;
    conn.state.lastError = null;
  }

  // Limpa arquivos de autenticação para forçar novo QR
  clearAuthFiles(barId);
  log(barId, "Sessão anterior limpa. Gerando nova conexão...");

  // Inicia conexão limpa
  await initWpp(barId);
}

export async function initWpp(barId: string): Promise<void> {
  const conn = getOrCreateConn(barId);

  if (conn.state.status === "CONNECTING" || conn.state.status === "CONNECTED") {
    log(barId, "Já existe uma sessão em andamento. Use desconectar primeiro.");
    return;
  }

  // Limpa socket anterior se existir
  if (conn.sock) {
    forceDisconnectSock(conn);
  }

  conn.state.status = "CONNECTING";
  conn.state.qrDataUrl = null;
  conn.state.phone = null;
  conn.state.lastError = null;
  conn.lastActivity = Date.now();
  log(barId, "Iniciando conexão com WhatsApp...");

  startWatchdog();

  try {
    const baileys = await loadBaileys();

    if (!baileys) {
      conn.state.status = "DISCONNECTED";
      conn.state.lastError = "Biblioteca Baileys não encontrada. Execute: npm install";
      log(barId, "ERRO: @whiskeysockets/baileys não encontrada. Execute: npm install");
      return;
    }

    // Extrai funções — Baileys exporta de formas diferentes dependendo da versão
    const makeWASocket = (baileys.default ?? baileys.makeWASocket ?? baileys) as Function;
    const useMultiFileAuthState = baileys.useMultiFileAuthState as Function;
    const DisconnectReason = baileys.DisconnectReason as Record<string, number>;
    const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion as Function | undefined;

    if (!useMultiFileAuthState || typeof makeWASocket !== "function") {
      conn.state.status = "DISCONNECTED";
      conn.state.lastError = "Versão incompatível do Baileys";
      log(barId, "ERRO: Baileys importado mas sem funções esperadas. Versão incompatível?");
      return;
    }

    const dir = authDir(barId);
    const { state: authState, saveCreds } = await useMultiFileAuthState(dir);

    // Tenta buscar a versão mais recente; se falhar, usa fallback
    let version: number[] | undefined;
    if (fetchLatestBaileysVersion) {
      try {
        const fetched = await Promise.race([
          fetchLatestBaileysVersion(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
        ]) as { version: number[] };
        version = fetched.version;
        log(barId, `Versão WA Web: ${version.join(".")}`);
      } catch (err) {
        log(barId, `Aviso: não obteve versão WA (${String(err)}). Usando padrão do Baileys.`);
        // Sem definir version — Baileys usa a versão embutida
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const socketOptions: any = {
      auth: authState,
      printQRInTerminal: false,
      logger: makeSilentLogger(),
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      retryRequestDelayMs: 250,
    };

    // Só passa version se conseguiu buscar
    if (version) {
      socketOptions.version = version;
    }

    // Baileys aceita browser como Browsers.ubuntu() ou array ['name', 'browser', 'version']
    // Usar o padrão do Baileys é mais seguro
    // socketOptions.browser = Browsers.ubuntu("RTPG");

    const socket = makeWASocket(socketOptions);
    conn.sock = socket;

    // ── QR Code & Connection events ──────────────────────────────────────

    socket.ev.on(
      "connection.update",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        conn.lastActivity = Date.now();

        // Novo QR code gerado
        if (qr) {
          try {
            conn.state.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 256 });
            conn.state.status = "QR_READY";
            log(barId, "QR Code gerado. Escaneie com o WhatsApp do celular.");

            if (conn.qrTimer) clearTimeout(conn.qrTimer);
            conn.qrTimer = setTimeout(() => {
              if (conn.state.status === "QR_READY") {
                log(barId, "QR Code pode ter expirado. Aguardando novo QR...");
              }
            }, QR_TIMEOUT_MS);
          } catch (qrErr) {
            log(barId, `Erro ao gerar QR Code: ${String(qrErr)}`);
          }
        }

        // Conexão aberta com sucesso
        if (connection === "open") {
          conn.state.status = "CONNECTED";
          conn.state.qrDataUrl = null;
          conn.state.connectedAt = new Date().toISOString();
          conn.state.retryCount = 0;
          conn.state.lastError = null;

          try {
            conn.state.phone = socket.user?.id?.split(":")[0] ?? null;
          } catch {
            conn.state.phone = null;
          }

          log(barId, `Conectado! Número: ${conn.state.phone ?? "desconhecido"}`);

          if (conn.qrTimer) {
            clearTimeout(conn.qrTimer);
            conn.qrTimer = null;
          }
        }

        // Conexão fechada
        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const reason = disconnectReasonLabel(statusCode);
          const loggedOut = statusCode === DisconnectReason?.loggedOut;

          conn.sock = null;
          conn.state.qrDataUrl = null;

          if (conn.qrTimer) {
            clearTimeout(conn.qrTimer);
            conn.qrTimer = null;
          }

          if (loggedOut || statusCode === 401) {
            // Logout explícito — limpa tudo
            conn.state.status = "DISCONNECTED";
            conn.state.phone = null;
            conn.state.connectedAt = null;
            conn.state.retryCount = 0;
            conn.state.lastError = null;
            clearAuthFiles(barId);
            log(barId, `Sessão encerrada (${reason}). Use "Reconectar" para gerar novo QR.`);
          } else if (statusCode === 440 || statusCode === 428) {
            // Sessão inválida
            conn.state.status = "AUTH_FAILURE";
            conn.state.phone = null;
            conn.state.connectedAt = null;
            conn.state.retryCount = 0;
            conn.state.lastError = reason;
            clearAuthFiles(barId);
            log(barId, `Sessão inválida (${reason}). Use "Reconectar" para gerar novo QR.`);
          } else {
            // Desconexão temporária — tenta reconectar
            conn.state.lastError = reason;
            log(barId, `Conexão perdida (${reason}). Agendando reconexão...`);
            scheduleRetry(barId);
          }
        }
      }
    );

    // ── Persistência de credenciais ──────────────────────────────────────
    socket.ev.on("creds.update", saveCreds);

    // ── Mensagens recebidas ──────────────────────────────────────────────
    socket.ev.on(
      "messages.upsert",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (upsert: any) => {
        const { messages, type } = upsert;
        if (type !== "notify") return;

        for (const msg of messages) {
          if (msg.key?.fromMe) continue;
          const from = msg.key?.remoteJid ?? "";
          if (!from || from.endsWith("@g.us") || from === "status@broadcast") continue;

          const body =
            msg.message?.conversation ??
            msg.message?.extendedTextMessage?.text ??
            "";

          if (!body.trim()) continue;

          log(barId, `Msg de ${from}: ${body.slice(0, 80)}`);
          conn.lastActivity = Date.now();

          if (onMessage) {
            try {
              await onMessage(barId, from, body);
            } catch (err) {
              log(barId, `Erro ao processar mensagem: ${String(err)}`);
            }
          }
        }
      }
    );

    log(barId, "Socket criado. Aguardando eventos de conexão...");
  } catch (err) {
    conn.state.status = "DISCONNECTED";
    conn.state.lastError = String(err);
    log(barId, `Erro ao iniciar WhatsApp: ${String(err)}`);
  }
}

// ─── Healthcheck ─────────────────────────────────────────────────────────────

export interface WppHealthcheck {
  barId: string;
  status: WppStatus;
  phone: string | null;
  connectedAt: string | null;
  retryCount: number;
  lastError: string | null;
  lastActivityAgo: number;
}

export function getHealthcheck(barId: string): WppHealthcheck {
  const conn = connections.get(barId);
  if (!conn) {
    return {
      barId,
      status: "DISCONNECTED",
      phone: null,
      connectedAt: null,
      retryCount: 0,
      lastError: null,
      lastActivityAgo: -1,
    };
  }
  return {
    barId,
    status: conn.state.status,
    phone: conn.state.phone,
    connectedAt: conn.state.connectedAt,
    retryCount: conn.state.retryCount,
    lastError: conn.state.lastError,
    lastActivityAgo: Math.round((Date.now() - conn.lastActivity) / 1000),
  };
}

export function getAllHealthchecks(): WppHealthcheck[] {
  return [...connections.keys()].map(getHealthcheck);
}

// ─── Utilitários de administração ────────────────────────────────────────────

export function getActiveBarIds(): string[] {
  return [...connections.entries()]
    .filter(([, c]) => c.state.status === "CONNECTED")
    .map(([id]) => id);
}

export function resetRetries(barId: string): void {
  const conn = connections.get(barId);
  if (conn) {
    conn.state.retryCount = 0;
    conn.state.lastError = null;
    log(barId, "Contador de reconexões resetado manualmente.");
  }
}
