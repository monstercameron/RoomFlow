import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import {
	isDevelopmentModeVerificationBypassEnabled,
	parseBypassCandidateEmailAddress,
} from "@/lib/dev-auth-bypass";
import { prisma } from "@/lib/prisma";

const authRouteHandler = toNextJsHandler(auth);

export const GET = authRouteHandler.GET;

export async function POST(request: Request) {
	const requestPathname = new URL(request.url).pathname;

	if (requestPathname.endsWith("/sign-in/email")) {
		const candidateEmailAddress = await parseBypassCandidateEmailAddress(request);

		if (isDevelopmentModeVerificationBypassEnabled(candidateEmailAddress)) {
			await prisma.user.updateMany({
				where: {
					email: candidateEmailAddress?.trim().toLowerCase(),
					emailVerified: false,
				},
				data: {
					emailVerified: true,
				},
			});
		}
	}

	return authRouteHandler.POST(request);
}
