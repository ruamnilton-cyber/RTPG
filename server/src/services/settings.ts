import fs from "node:fs";
import path from "node:path";
import { appEnv } from "../env";
import { prisma } from "../lib/prisma";
import { getStoredSetting, setStoredSetting } from "./system-settings";

type VisualThemeSetting = {
  paletteId: string;
};

type EstablishmentBrandSetting = {
  logoUrl: string | null;
};

type EstablishmentProfileSetting = {
  tradeName: string;
  legalName: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  serviceFee: number;
  serviceFeeLocked: boolean;
  deliveryFee: number;
  currency: string;
  timeZone: string;
  instagram: string;
  facebook: string;
  website: string;
  coverImageUrl: string | null;
  notes: string;
};

const DEFAULT_THEME: VisualThemeSetting = { paletteId: "preto-dourado-grafite" };
const DEFAULT_BRAND: EstablishmentBrandSetting = { logoUrl: null };
const DEFAULT_PROFILE: EstablishmentProfileSetting = {
  tradeName: "RTPG Gestão",
  legalName: "",
  cnpj: "",
  phone: "",
  email: "",
  address: "",
  openingHours: "",
  serviceFee: 0,
  serviceFeeLocked: true,
  deliveryFee: 0,
  currency: "BRL",
  timeZone: "America/Sao_Paulo",
  instagram: "",
  facebook: "",
  website: "",
  coverImageUrl: null,
  notes: ""
};

export async function getVisualThemeSetting() {
  return getStoredSetting("visual-theme", DEFAULT_THEME);
}

export async function saveVisualThemeSetting(paletteId: string) {
  return setStoredSetting("visual-theme", { paletteId });
}

export async function getBrandSetting() {
  return getStoredSetting("brand-setting", DEFAULT_BRAND);
}

export async function getEstablishmentProfileSetting() {
  const stored = await getStoredSetting<Partial<EstablishmentProfileSetting>>("establishment-profile", DEFAULT_PROFILE);
  return { ...DEFAULT_PROFILE, ...stored };
}

export async function saveEstablishmentProfileSetting(profile: Partial<EstablishmentProfileSetting>) {
  const current = await getEstablishmentProfileSetting();
  const next = { ...current, ...profile };
  await setStoredSetting("establishment-profile", next);
  return next;
}

export async function saveBrandLogo(input: { fileName: string; dataUrl: string }) {
  const matches = input.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Formato de imagem inválido.");
  }

  const mimeType = matches[1];
  const base64 = matches[2];
  const extensionMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/svg+xml": "svg"
  };
  const extension = extensionMap[mimeType];
  if (!extension) {
    throw new Error("Formato não suportado. Use PNG, JPG, JPEG ou SVG.");
  }

  const uploadsDir = path.join(appEnv.storageDir, "uploads", "branding");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const filePath = path.join(uploadsDir, `logo-principal.${extension}`);
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));

  const logoUrl = `/storage-files/uploads/branding/logo-principal.${extension}`;
  await setStoredSetting("brand-setting", { logoUrl });
  return { logoUrl };
}

export async function removeBrandLogo() {
  const current = await getBrandSetting();
  if (current.logoUrl) {
    const relativePath = current.logoUrl.replace(/^\/storage-files\//, "");
    const absolutePath = path.join(appEnv.storageDir, relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  await setStoredSetting("brand-setting", { logoUrl: null });
  return { logoUrl: null };
}

export async function saveProductImage(input: { productId: string; fileName: string; dataUrl: string }) {
  const matches = input.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Formato de imagem inválido.");
  }

  const mimeType = matches[1];
  const base64 = matches[2];
  const extensionMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/svg+xml": "svg"
  };
  const extension = extensionMap[mimeType];
  if (!extension) {
    throw new Error("Formato não suportado. Use PNG, JPG, JPEG ou SVG.");
  }

  const uploadsDir = path.join(appEnv.storageDir, "uploads", "products");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const filePath = path.join(uploadsDir, `${input.productId}.${extension}`);
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  const imageUrl = `/storage-files/uploads/products/${input.productId}.${extension}`;

  await prisma.product.update({
    where: { id: input.productId },
    data: { imageUrl }
  });

  return { imageUrl };
}

export async function removeProductImage(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product?.imageUrl) {
    return { imageUrl: null };
  }

  const relativePath = product.imageUrl.replace(/^\/storage-files\//, "");
  const absolutePath = path.join(appEnv.storageDir, relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }

  await prisma.product.update({
    where: { id: productId },
    data: { imageUrl: null }
  });

  return { imageUrl: null };
}
