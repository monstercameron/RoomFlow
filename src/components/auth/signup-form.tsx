"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildEmailVerificationPagePath } from "@/lib/auth-urls";
import { authClient } from "@/lib/auth-client";
import {
  getWorkflow1PasswordState,
  validateWorkflow1SignupFields,
  type Workflow1SignupFieldErrors,
} from "@/lib/workflow1";

 function PasswordRequirement(props: { label: string; satisfied: boolean }) {
   return (
     <div
       className={`rounded-2xl border px-3 py-2 text-sm ${props.satisfied
         ? "border-[rgba(41,125,78,0.18)] bg-[rgba(41,125,78,0.08)] text-[rgb(41,125,78)]"
         : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
       }`}
     >
       {props.label}
     </div>
   );
 }

 export function SignupForm(props?: {
   callbackPath?: string;
   defaultEmailAddress?: string;
 }) {
   const router = useRouter();
   const callbackPath = props?.callbackPath ?? "/onboarding";
   const [name, setName] = useState("");
   const [email, setEmail] = useState(props?.defaultEmailAddress ?? "");
   const [password, setPassword] = useState("");
   const [confirmPassword, setConfirmPassword] = useState("");
   const [message, setMessage] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [fieldErrors, setFieldErrors] = useState<Workflow1SignupFieldErrors>({});
   const [hasValidated, setHasValidated] = useState(false);
   const [pending, setPending] = useState(false);
   const passwordState = useMemo(() => getWorkflow1PasswordState(password), [password]);

   function getNextFieldErrors(
     overrides?: Partial<{
       confirmPassword: string;
       email: string;
       name: string;
       password: string;
     }>,
   ) {
     return validateWorkflow1SignupFields({
       confirmPassword: overrides?.confirmPassword ?? confirmPassword,
       email: overrides?.email ?? email,
       name: overrides?.name ?? name,
       password: overrides?.password ?? password,
     });
   }

   function maybeRefreshFieldErrors(
     overrides?: Partial<{
       confirmPassword: string;
       email: string;
       name: string;
       password: string;
     }>,
   ) {
     if (!hasValidated) {
       return;
     }

     setFieldErrors(getNextFieldErrors(overrides));
   }

   return (
     <form
       className="mt-8 grid gap-4 md:grid-cols-2"
       noValidate
       onSubmit={async (event) => {
         event.preventDefault();
         setPending(true);
         setError(null);
         setMessage(null);
         setHasValidated(true);

         const nextFieldErrors = getNextFieldErrors();

         if (Object.keys(nextFieldErrors).length > 0) {
           setFieldErrors(nextFieldErrors);
           setPending(false);
           return;
         }

         setFieldErrors({});

        const signupPreflightResponse = await fetch("/api/auth/signup-preflight", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        });

        if (signupPreflightResponse.ok) {
          const signupPreflightPayload = (await signupPreflightResponse.json()) as {
            exists?: boolean;
          };

          if (signupPreflightPayload.exists) {
            setError("This email already has a Roomflow account. Log in or use a magic link to recover access.");
            setPending(false);
            return;
          }
        }

         await authClient.signUp.email(
           {
             callbackURL: callbackPath,
             email: email.trim(),
             name: name.trim(),
             password,
           },
           {
             onError(context) {
               const rawMessage = context.error.message;

               if (/already exists|already registered|already associated|user already/i.test(rawMessage)) {
                 setError("This email already has a Roomflow account. Log in or use a magic link to recover access.");
                 return;
               }

               setError(rawMessage);
             },
             onSuccess() {
               setMessage("Account created. Check your verification email to continue into Roomflow.");
               router.push(
                 buildEmailVerificationPagePath({
                   emailAddress: email.trim(),
                   nextPath: callbackPath,
                 }),
               );
               router.refresh();
             },
           },
         );

         setPending(false);
       }}
     >
       <label className="space-y-2" htmlFor="signup-name">
         <span className="text-sm font-medium">Name</span>
         <input
           aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
           aria-invalid={fieldErrors.name ? true : undefined}
           className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]"
           id="signup-name"
           onChange={(event) => {
             const nextValue = event.target.value;
             setName(nextValue);
             maybeRefreshFieldErrors({ name: nextValue });
           }}
           placeholder="Alex Rivera"
           type="text"
           value={name}
         />
         {fieldErrors.name ? (
           <div className="text-sm text-[var(--color-accent-strong)]" id="signup-name-error">
             {fieldErrors.name}
           </div>
         ) : null}
       </label>
       <label className="space-y-2" htmlFor="signup-email">
         <span className="text-sm font-medium">Email</span>
         <input
           aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
           aria-invalid={fieldErrors.email ? true : undefined}
           className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]"
           id="signup-email"
           onChange={(event) => {
             const nextValue = event.target.value;
             setEmail(nextValue);
             maybeRefreshFieldErrors({ email: nextValue });
           }}
           placeholder="alex@roomflow.app"
           type="email"
           value={email}
         />
         {fieldErrors.email ? (
           <div className="text-sm text-[var(--color-accent-strong)]" id="signup-email-error">
             {fieldErrors.email}
           </div>
         ) : null}
       </label>
       <label className="space-y-2" htmlFor="signup-password">
         <span className="text-sm font-medium">Password</span>
         <input
           aria-describedby={fieldErrors.password ? "signup-password-error" : "signup-password-help"}
           aria-invalid={fieldErrors.password ? true : undefined}
           className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]"
           id="signup-password"
           onChange={(event) => {
             const nextValue = event.target.value;
             setPassword(nextValue);
             maybeRefreshFieldErrors({ password: nextValue });
           }}
           placeholder="Choose a secure password"
           type="password"
           value={password}
         />
         <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]" id="signup-password-help">
           Strength: {passwordState.strengthLabel}
         </div>
         {fieldErrors.password ? (
           <div className="text-sm text-[var(--color-accent-strong)]" id="signup-password-error">
             {fieldErrors.password}
           </div>
         ) : null}
       </label>
       <label className="space-y-2" htmlFor="signup-confirm-password">
         <span className="text-sm font-medium">Confirm password</span>
         <input
           aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-password-error" : undefined}
           aria-invalid={fieldErrors.confirmPassword ? true : undefined}
           className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition focus-visible:border-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.18)]"
           id="signup-confirm-password"
           onChange={(event) => {
             const nextValue = event.target.value;
             setConfirmPassword(nextValue);
             maybeRefreshFieldErrors({ confirmPassword: nextValue });
           }}
           placeholder="Re-enter your password"
           type="password"
           value={confirmPassword}
         />
         {fieldErrors.confirmPassword ? (
           <div className="text-sm text-[var(--color-accent-strong)]" id="signup-confirm-password-error">
             {fieldErrors.confirmPassword}
           </div>
         ) : null}
       </label>
       <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 md:col-span-2">
         <div className="flex flex-wrap items-center justify-between gap-2">
           <div>
             <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
               Password checkpoint
             </div>
             <div className="mt-1 text-sm text-[var(--color-muted)]">
               Roomflow uses the minimum needed for a secure operator account.
             </div>
           </div>
           <div className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink)]">
             {passwordState.strengthLabel}
           </div>
         </div>
         <div className="mt-4 grid gap-3 md:grid-cols-2">
           <PasswordRequirement label="10 or more characters" satisfied={passwordState.meetsLength} />
           <PasswordRequirement label="Uppercase letter" satisfied={passwordState.hasUppercase} />
           <PasswordRequirement label="Lowercase letter" satisfied={passwordState.hasLowercase} />
           <PasswordRequirement label="Number or symbol mix" satisfied={passwordState.hasNumber || passwordState.hasSymbol} />
         </div>
       </div>
       {error ? (
         <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)] md:col-span-2">
           {error}
         </div>
       ) : null}
       {message ? (
         <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)] md:col-span-2">
           {message}
         </div>
       ) : null}
       <div className="text-sm leading-6 text-[var(--color-muted)] md:col-span-2">
         We only use this information to create the operator identity and workspace access you need to start onboarding.
       </div>
       <button
         className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
         disabled={pending}
         type="submit"
       >
         {pending ? "Creating account..." : "Create account"}
       </button>
     </form>
   );
 }
