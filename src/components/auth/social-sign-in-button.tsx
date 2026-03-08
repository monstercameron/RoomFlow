import { startSocialSignInAction } from "@/app/(auth)/social-auth-actions";
import type { SocialAuthProviderId } from "@/lib/auth-providers";
import { getSocialAuthProviderMetadata } from "@/lib/auth-providers";
import type { Workflow1Intent } from "@/lib/workflow1";

export function SocialSignInButton(props: {
  callbackPath: string;
  defaultEmailAddress?: string;
  entryPath: "/login" | "/signup";
  providerId: SocialAuthProviderId;
  workflow1Intent?: Workflow1Intent;
}) {
  const providerMetadata = getSocialAuthProviderMetadata(props.providerId);

  return (
    <form action={startSocialSignInAction} className="w-full">
      <input name="callbackPath" type="hidden" value={props.callbackPath} />
      <input name="entryPath" type="hidden" value={props.entryPath} />
      <input name="providerId" type="hidden" value={props.providerId} />
      <input name="emailAddress" type="hidden" value={props.defaultEmailAddress ?? ""} />
      <input name="inviteToken" type="hidden" value={props.workflow1Intent?.inviteToken ?? ""} />
      <input name="plan" type="hidden" value={props.workflow1Intent?.plan ?? ""} />
      <input name="source" type="hidden" value={props.workflow1Intent?.source ?? ""} />
      <input name="utmCampaign" type="hidden" value={props.workflow1Intent?.utmCampaign ?? ""} />
      <button
        aria-label={`Continue with ${providerMetadata.label}`}
        className="flex w-full items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:-translate-y-0.5 hover:border-[var(--color-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        type="submit"
      >
        Continue with {providerMetadata.label}
      </button>
    </form>
  );
}