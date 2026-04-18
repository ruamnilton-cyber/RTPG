import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/mesa/:token", async (req, res) => {
  const table = await prisma.restaurantTable.findUnique({ where: { qrCodeToken: req.params.token } });
  if (!table) {
    return res.status(404).send("<html><body style='font-family:Arial;padding:24px'><h1>Mesa não encontrada</h1></body></html>");
  }

  return res.send(`
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RTPG Gestão | Mesa ${table.number}</title>
        <style>
          body{font-family:Arial,sans-serif;background:#f6f1e7;color:#2b1808;padding:24px}
          .card{max-width:420px;margin:40px auto;background:#fff;padding:24px;border-radius:18px;box-shadow:0 10px 24px rgba(0,0,0,.12)}
          button{width:100%;padding:16px;border:0;border-radius:12px;background:#8f611d;color:#fff;font-size:16px;font-weight:700;cursor:pointer}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Mesa ${table.number}</h1>
          <p>Toque no botão abaixo para chamar o garçom.</p>
          <form method="post" action="/public/mesa/${table.qrCodeToken}/chamar">
            <button type="submit">Chamar garçom</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

router.post("/mesa/:token/chamar", async (req, res) => {
  const table = await prisma.restaurantTable.findUnique({ where: { qrCodeToken: req.params.token } });
  if (!table) {
    return res.status(404).send("Mesa não encontrada.");
  }

  await prisma.waiterCall.create({
    data: { tableId: table.id, message: "Cliente solicitou atendimento via QR Code." }
  });

  return res.send(`
    <html><body style="font-family:Arial;background:#f6f1e7;padding:24px">
      <div style="max-width:420px;margin:40px auto;background:#fff;padding:24px;border-radius:18px">
        <h1>Chamado enviado</h1>
        <p>O garçom foi avisado para a mesa ${table.number}.</p>
      </div>
    </body></html>
  `);
});

export default router;
