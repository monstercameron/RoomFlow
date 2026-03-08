import { startSocialSignInAction } from "@/app/(auth)/social-auth-actions";
import type { SocialAuthProviderId } from "@/lib/auth-providers";
import { getSocialAuthProviderMetadata } from "@/lib/auth-providers";

export function SocialSignInButton(props: {
  callbackPath: string;
  defaultEmailAddress?: string;
  entryPath: "/login" | "/signup";
  providerId: SocialAuthProviderId;
}) {
  const providerMetadata = getSocialAuthProviderMetadata(props.providerId);

  return (
    <form action={startSocialSignInAction} className="mt-3">
      <input name="callbackPath" type="hidden" value={props.callbackPath} />
      <input name="entryPath" type="hidden" value={props.entryPath} />
      <input name="providerId" type="hidden" value={props.providerId} />
      <input name="emailAddress" type="hidden" value={props.defaultEmailAddress ?? ""} />
      <button
        className="flex w-full items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)]"
        type="submit"
      >
        Continue with {providerMetadata.label}
      </button>
    </form>
  );
}