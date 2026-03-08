import { startSocialSignInAction } from "@/app/(auth)/social-auth-actions";

export function GoogleSignInButton(props: {
  callbackPath: string;
  defaultEmailAddress?: string;
  entryPath: "/login" | "/signup";
}) {
  return (
    <form action={startSocialSignInAction} className="mt-6">
      <input name="callbackPath" type="hidden" value={props.callbackPath} />
      <input name="entryPath" type="hidden" value={props.entryPath} />
      <input name="providerId" type="hidden" value="google" />
      <input name="emailAddress" type="hidden" value={props.defaultEmailAddress ?? ""} />
      <button
        className="flex w-full items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)]"
        type="submit"
      >
        Continue with Google
      </button>
    </form>
  );
}