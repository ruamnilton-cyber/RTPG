import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { appEnv } from "../env";

export type AuthPayload = {
  userId: string;
  role: "ADMIN" | "GERENTE" | "CAIXA" | "GARCOM" | "COZINHA" | "FINANCEIRO" | "OPERADOR";
  name: string;
  email: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, appEnv.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, appEnv.jwtSecret) as AuthPayload;
}
