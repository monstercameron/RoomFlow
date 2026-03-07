import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { ensureWorkspaceForUser } from "@/lib/workspaces";

const oneHourInSeconds = 60 * 60;

export const auth = betterAuth({
  appName: "Roomflow",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  databaseHooks: {
    user: {
      create: {
        async after(user) {
          if (!user?.id || !user.email) {
            return;
          }

          await ensureWorkspaceForUser({
            id: user.id,
            email: user.email,
            name: user.name,
          });
        },
      },
    },
  },
  session: {
    expiresIn: oneHourInSeconds,
    updateAge: 15 * 60,
  },
  user: {
    additionalFields: {
      image: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
});
