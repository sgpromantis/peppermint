import { prisma } from "../../prisma";

const nodemailer = require("nodemailer");
const { ConfidentialClientApplication } = require("@azure/identity");

export async function createTransportProvider() {
  const provider = await prisma.email.findFirst({});

  if (!provider) {
    throw new Error("No email provider configured.");
  }

  if (provider?.serviceType === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: provider?.user,
        clientId: provider?.clientId,
        clientSecret: provider?.clientSecret,
        refreshToken: provider?.refreshToken,
        accessToken: provider?.accessToken,
        expiresIn: provider?.expiresIn,
      },
    });
  } else if (provider?.serviceType === "microsoft") {
    // Microsoft
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: provider?.clientId,
        authority: `https://login.microsoftonline.com/${provider?.tenantId}`,
        clientSecret: provider?.clientSecret,
      },
    });

    const result = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    return nodemailer.createTransport({
      service: "hotmail",
      auth: {
        type: "OAuth2",
        user: provider?.user,
        clientId: provider?.clientId,
        clientSecret: provider?.clientSecret,
        accessToken: result.accessToken,
      },
    });
  } else if (provider?.serviceType === "other") {
    // Username/password configuration
    const portNum = parseInt(String(provider?.port), 10);
    const isSecure = portNum === 465 || portNum === 587;
    
    return nodemailer.createTransport({
      host: provider.host,
      port: portNum,
      secure: portNum === 465, // true for 465 (implicit TLS), false for 587 (STARTTLS)
      requireTLS: portNum === 587, // Force STARTTLS for port 587
      auth: {
        user: provider?.user,
        pass: provider?.pass,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });
  } else {
    throw new Error("No valid authentication method configured.");
  }
}
