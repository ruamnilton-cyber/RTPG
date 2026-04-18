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
  tradeName: "RTPG Gestao",
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

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp"
};

function parseSafeImageDataUrl(dataUrl: string) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!matches) {
    throw new Error("Formato de imagem invalido.");
  }

  const mimeType = matches[1];
  const extension = IMAGE_EXTENSIONS[mimeType];
  if (!extension) {
    throw new Error("Formato nao suportado. Use PNG, JPG, JPEG ou WEBP.");
  }

  const buffer = Buffer.from(matches[2], "base64");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Imagem muito grande. Use um arquivo de ate 4MB.");
  }

  return { extension, buffer };
}

function resolvePublicStoragePath(url: string) {
  const relativePath = url.replace(/^\/storage-files\//, "");
  const absolutePath = path.resolve(appEnv.storageDir, relativePath);
  const storageRoot = path.resolve(appEnv.storageDir);
  if (!absolutePath.startsWith(storageRoot)) {
    return null;
  }
  return absolutePath;
}

function settingKey(key: string, barId?: string) {
  return barId ? `${key}:${barId}` : key;
}

export async function getVisualThemeSetting(barId?: string) {
  return getStoredSetting(settingKey("visual-theme", barId), DEFAULT_THEME);
}

export async function saveVisualThemeSetting(paletteId: string, barId?: string) {
  return setStoredSetting(settingKey("visual-theme", barId), { paletteId });
}

export async function getBrandSetting(barId?: string) {
  return getStoredSetting(settingKey("brand-setting", barId), DEFAULT_BRAND);
}

export async function getEstablishmentProfileSetting(barId?: string) {
  const stored = await getStoredSetting<Partial<EstablishmentProfileSetting>>(settingKey("establishment-profile", barId), DEFAULT_PROFILE);
  return { ...DEFAULT_PROFILE, ...stored };
}

export async function saveEstablishmentProfileSetting(profile: Partial<EstablishmentProfileSetting>, barId?: string) {
  const current = await getEstablishmentProfileSetting(barId);
  const next = { ...current, ...profile };
  await setStoredSetting(settingKey("establishment-profile", barId), next);
  return next;
}

export async function saveBrandLogo(input: { fileName: string; dataUrl: string }, barId?: string) {
  const { extension, buffer } = parseSafeImageDataUrl(input.dataUrl);
  const safeScope = barId ?? "global";
  const uploadsDir = path.join(appEnv.storageDir, "uploads", "branding", safeScope);
  fs.mkdirSync(uploadsDir, { recursive: true });

  const filePath = path.join(uploadsDir, `logo-principal.${extension}`);
  fs.writeFileSync(filePath, buffer);

  const logoUrl = `/storage-files/uploads/branding/${safeScope}/logo-principal.${extension}`;
  await setStoredSetting(settingKey("brand-setting", barId), { logoUrl });
  return { logoUrl };
}

export async function removeBrandLogo(barId?: string) {
  const current = await getBrandSetting(barId);
  if (current.logoUrl) {
    const absolutePath = resolvePublicStoragePath(current.logoUrl);
    if (absolutePath && fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  await setStoredSetting(settingKey("brand-setting", barId), { logoUrl: null });
  return { logoUrl: null };
}

export async function saveProductImage(input: { productId: string; fileName: string; dataUrl: string }) {
  const { extension, buffer } = parseSafeImageDataUrl(input.dataUrl);
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) {
    throw new Error("Produto nao encontrado.");
  }

  const uploadsDir = path.join(appEnv.storageDir, "uploads", "products");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const filePath = path.join(uploadsDir, `${input.productId}.${extension}`);
  fs.writeFileSync(filePath, buffer);
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

  const absolutePath = resolvePublicStoragePath(product.imageUrl);
  if (absolutePath && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }

  await prisma.product.update({
    where: { id: productId },
    data: { imageUrl: null }
  });

  return { imageUrl: null };
}
