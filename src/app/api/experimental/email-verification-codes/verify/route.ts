import { NextResponse } from "next/server";
import { buildEmailVerificationPagePath, normalizeApplicationPath } from "@/lib/auth-urls";
import { consumeEmailVerificationCode } from "@/lib/email-verification-codes";

type VerificationCodeSurface = "profile" | "verify-email";

export type ExperimentalEmailVerificationCodeVerifyRouteDependencies = {
  consumeCode: typeof consumeEmailVerificationCode;
};

const defaultExperimentalEmailVerificationCodeVerifyRouteDependencies: ExperimentalEmailVerificationCodeVerifyRouteDependencies = {
  consumeCode: consumeEmailVerificationCode,
};

function buildReturnUrlWithSearchParam(params: {
  key: string;
  returnTo?: string | null;
  value: string;
}) {
  const returnPath = normalizeApplicationPath(params.returnTo);
  const returnUrl = new URL(returnPath, "http://127.0.0.1:3001");

  returnUrl.searchParams.set(params.key, params.value);

  return `${returnUrl.pathname}${returnUrl.search}`;
}

function buildFailureRedirectPath(params: {
  code: "CODE_EXPIRED" | "INVALID_CODE";
  returnTo?: string | null;
  surface: VerificationCodeSurface;
}) {
  if (params.surface === "profile") {
    return buildReturnUrlWithSearchParam({
      key: "profileError",
      returnTo: params.returnTo,
      value:
        params.code === "CODE_EXPIRED"
          ? "That security code expired. Request a fresh verification email and try again."
          : "That security code was not recognized. Paste the newest code from the inbox and try again.",
    });
  }

  return buildEmailVerificationPagePath({
    nextPath: params.returnTo,
    verificationErrorCode: params.code,
  });
}

export async function handleExperimentalEmailVerificationCodeVerifyGet(
  request: Request,
  dependencies: ExperimentalEmailVerificationCodeVerifyRouteDependencies = defaultExperimentalEmailVerificationCodeVerifyRouteDependencies,
) {
  const requestUrl = new URL(request.url);
  const candidateCode = requestUrl.searchParams.get("code") ?? "";
  const surface = (requestUrl.searchParams.get("surface") === "profile" ? "profile" : "verify-email") satisfies VerificationCodeSurface;
  const returnTo = requestUrl.searchParams.get("returnTo");
  const consumedCode = await dependencies.consumeCode(candidateCode);

  if (consumedCode.status === "invalid") {
    return NextResponse.redirect(
      new URL(
        buildFailureRedirectPath({ code: "INVALID_CODE", returnTo, surface }),
        requestUrl.origin,
      ),
    );
  }

  if (consumedCode.status === "expired") {
    return NextResponse.redirect(
      new URL(
        buildFailureRedirectPath({ code: "CODE_EXPIRED", returnTo, surface }),
        requestUrl.origin,
      ),
    );
  }

  const verifyEmailUrl = new URL("/api/auth/verify-email", requestUrl.origin);

  verifyEmailUrl.searchParams.set("token", consumedCode.token);
  verifyEmailUrl.searchParams.set("callbackURL", consumedCode.callbackPath);

  return NextResponse.redirect(verifyEmailUrl);
}

export async function GET(request: Request) {
  return handleExperimentalEmailVerificationCodeVerifyGet(request);
}