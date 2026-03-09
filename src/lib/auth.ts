import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import {
  sendEmailVerificationEmail,
  sendMagicLinkEmail,
  sendPasswordResetEmail,
} from "@/lib/auth-email";
import {
  getConfiguredSocialAuthProviderIds,
  getConfiguredSocialAuthProviders,
} from "@/lib/auth-providers";
import { WorkspacePlanType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorkflow1WorkspaceBootstrapDecision } from "@/lib/workflow1";
import { ensureWorkspaceForUser } from "@/lib/workspaces";

const oneHourInSeconds = 60 * 60;
const configuredSocialAuthProviders = getConfiguredSocialAuthProviders();
const trustedSocialAuthProviderIds = getConfiguredSocialAuthProviderIds();

export const auth = betterAuth({
  account: {
    accountLinking: {
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
      disableImplicitLinking: true,
      enabled: true,
      trustedProviders: trustedSocialAuthProviderIds,
      updateUserInfoOnLink: true,
    },
  },
  appName: "Roomflow",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: configuredSocialAuthProviders,
  plugins: [
    nextCookies(),
    magicLink({
      allowedAttempts: 1,
      disableSignUp: true,
      expiresIn: 60 * 5,
      async sendMagicLink({ email, token, url }) {
        const generatedMagicLinkUrl = new URL(url);
        const callbackUrl = generatedMagicLinkUrl.searchParams.get("callbackURL") ?? undefined;

        await sendMagicLinkEmail({
          callbackUrl,
          recipientEmailAddress: email,
          token,
        });
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    async sendResetPassword({ token, url, user }) {
      // Better Auth generates a default reset URL; we rewrite it to the app route
      // so the UI can own the password-reset experience.
      const generatedResetUrl = new URL(url);
      const callbackUrl = generatedResetUrl.searchParams.get("callbackURL") ?? undefined;

      await sendPasswordResetEmail({
        callbackUrl,
        recipientEmailAddress: user.email,
        recipientName: user.name,
        token,
      });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignIn: true,
    sendOnSignUp: true,
    async sendVerificationEmail({ token, url, user }) {
      // Better Auth points verification links at its own endpoint; this rewrites
      // them through the app page so the UI can explain pending, success, and retry states.
      const generatedVerificationUrl = new URL(url);
      const callbackUrl = generatedVerificationUrl.searchParams.get("callbackURL") ?? undefined;

      await sendEmailVerificationEmail({
        callbackUrl,
        recipientEmailAddress: user.email,
        recipientName: user.name,
        token,
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        async after(user, context) {
          if (!user?.id || !user.email) {
            return;
          }

          const callbackPath =
            typeof context?.body?.callbackURL === "string"
              ? context.body.callbackURL
              : typeof context?.query?.callbackURL === "string"
                ? context.query.callbackURL
                : null;
          const bootstrapDecision = getWorkflow1WorkspaceBootstrapDecision(callbackPath);

          if (bootstrapDecision.shouldSkipWorkspaceCreation) {
            return;
          }

          await ensureWorkspaceForUser({
            id: user.id,
            email: user.email,
            name: user.name,
          }, {
            planType:
              bootstrapDecision.plan === "org"
                ? WorkspacePlanType.ORG
                : WorkspacePlanType.PERSONAL,
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
    changeEmail: {
      enabled: true,
    },
    additionalFields: {
      image: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
});
