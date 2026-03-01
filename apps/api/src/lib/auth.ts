// functions for easily finding relevant auth methods

import { prisma } from "../prisma";
import { EncryptionService } from "./services/encryption.service";
import { MicrosoftLoginService } from "./services/microsoft-login.service";

export async function getOidcConfig() {
  const config = await prisma.openIdConfig.findFirst();
  if (!config) {
    throw new Error("Config not found in the database");
  }
  return config;
}

export async function getOAuthProvider() {
  const provider = await prisma.oAuthProvider.findFirst();
  if (!provider) {
    throw new Error(`OAuth provider ${provider} not found`);
  }
  
  // Decrypt credentials
  const decryptedSecret = await EncryptionService.decrypt(provider.clientSecret);
  
  return {
    ...provider,
    clientSecret: decryptedSecret,
  };
}

export async function getAzureAdConfig(): Promise<{ clientId: string; clientSecret: string; tenantId: string; redirectUri: string } | null> {
  return await MicrosoftLoginService.getConfig();
}

export async function isAzureAdConfigured(): Promise<boolean> {
  return await MicrosoftLoginService.isConfigured();
}

export async function getSAMLProvider(providerName: any) {
  const provider = await prisma.sAMLProvider.findUnique({
    where: { name: providerName },
  });
  if (!provider) {
    throw new Error(`SAML provider ${providerName} not found`);
  }
  return provider;
}

