import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { branchSchema } from "../contracts/platform";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { getOrganizationSetting, saveOrganizationSetting } from "../services/platform";

const router = Router();
router.use(requireAuth, requireBar);

router.get("/", async (req, res) => {
  const organization = await getOrganizationSetting(req.barId!);
  res.json(organization);
});

router.put("/", requireRole("ADMIN", "GERENTE"), async (req, res) => {
  const payload = z.object({
    companyName: z.string().min(2),
    tradeName: z.string().min(2),
    cnpj: z.string().default(""),
    operationModel: z.enum(["MONOUNIDADE", "MULTIUNIDADE_PREPARADO"]).default("MONOUNIDADE"),
    primaryFocus: z.enum(["HIBRIDO", "SALAO", "DELIVERY", "BAR", "RESTAURANTE"]).default("HIBRIDO"),
    channelsEnabled: z.array(z.enum(["SALAO", "BALCAO", "DELIVERY", "WHATSAPP", "QR"])).default(["SALAO", "BALCAO", "QR"]),
    whatsappAutomationEnabled: z.boolean().default(false)
  }).parse(req.body);

  const result = await saveOrganizationSetting(payload, req.barId!);
  res.json(result);
});

router.post("/branches", requireRole("ADMIN"), async (req, res) => {
  const data = branchSchema.omit({ id: true }).parse(req.body);
  const current = await getOrganizationSetting(req.barId!);
  const branch = branchSchema.parse({ ...data, id: randomUUID() });
  const result = await saveOrganizationSetting({ branches: [...current.branches, branch] }, req.barId!);
  res.status(201).json(result.branches);
});

router.put("/branches/:id", requireRole("ADMIN"), async (req, res) => {
  const data = branchSchema.partial().omit({ id: true }).parse(req.body);
  const current = await getOrganizationSetting(req.barId!);
  const branches = current.branches.map((item) => item.id === req.params.id ? branchSchema.parse({ ...item, ...data, id: item.id }) : item);
  const result = await saveOrganizationSetting({ branches }, req.barId!);
  res.json(result.branches);
});

export default router;
