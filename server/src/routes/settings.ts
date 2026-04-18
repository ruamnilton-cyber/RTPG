import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { updateSaasClientByLinkedUser } from "../services/platform";
import { getBrandSetting, getEstablishmentProfileSetting, getVisualThemeSetting, removeBrandLogo, saveBrandLogo, saveEstablishmentProfileSetting, saveVisualThemeSetting } from "../services/settings";

const router = Router();

router.use(requireAuth, requireBar);

router.get("/", async (req, res) => {
  const [theme, brand, establishment] = await Promise.all([
    getVisualThemeSetting(req.barId!),
    getBrandSetting(req.barId!),
    getEstablishmentProfileSetting(req.barId!)
  ]);
  res.json({ theme, brand, establishment });
});

router.put("/theme", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({ paletteId: z.string().min(2) }).parse(req.body);
  await saveVisualThemeSetting(data.paletteId, req.barId!);
  res.json({ ok: true, paletteId: data.paletteId });
});

router.put("/brand/logo", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    fileName: z.string().min(1),
    dataUrl: z.string().min(10)
  }).parse(req.body);

  const result = await saveBrandLogo(data, req.barId!);
  res.json(result);
});

router.delete("/brand/logo", requireRole("ADMIN"), async (req, res) => {
  const result = await removeBrandLogo(req.barId!);
  res.json(result);
});

router.put("/establishment", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    tradeName: z.string().default(""),
    legalName: z.string().default(""),
    cnpj: z.string().default(""),
    phone: z.string().default(""),
    email: z.string().default(""),
    address: z.string().default(""),
    openingHours: z.string().default(""),
    serviceFee: z.number().default(0),
    serviceFeeLocked: z.boolean().default(false),
    deliveryFee: z.number().default(0),
    currency: z.string().default("BRL"),
    timeZone: z.string().default("America/Sao_Paulo"),
    instagram: z.string().default(""),
    facebook: z.string().default(""),
    website: z.string().default(""),
    notes: z.string().default("")
  }).parse(req.body);

  const result = await saveEstablishmentProfileSetting(data, req.barId!);
  await updateSaasClientByLinkedUser(req.user!.userId, {
    businessName: data.tradeName || data.legalName || undefined,
    phone: data.phone || undefined,
    email: data.email || undefined
  });
  res.json(result);
});

export default router;
