import { FormEvent, useEffect, useState } from "react";

type LoginModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  statusMessage: string;
  onClose: () => void;
  onRequestCode: (email: string) => Promise<void>;
  onVerifyCode: (email: string, code: string) => Promise<void>;
};

export function LoginModal({
  isOpen,
  isSubmitting,
  statusMessage,
  onClose,
  onRequestCode,
  onVerifyCode,
}: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setCode("");
      setCodeSent(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleRequest = async (event: FormEvent) => {
    event.preventDefault();
    await onRequestCode(email);
    setCodeSent(true);
  };

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    await onVerifyCode(email, code);
  };

  return (
    <div
      className="fixed inset-0 z-30 grid place-items-center bg-stone-950/50 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[32px] border border-white/70 bg-[#fffaf3] p-6 shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
              Sign In
            </p>
            <h2 id="login-modal-title" className="mt-2 font-display text-3xl text-ink-900">
              Unlock your Pantry Chef account
            </h2>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300/80 bg-white text-lg text-ink-900"
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
          >
            x
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-600">
          Enter your email and we&apos;ll send a one-time code you can paste right here in
          this same browser.
        </p>

        <form className="mt-6 grid gap-3" onSubmit={codeSent ? handleVerify : handleRequest}>
          <label className="text-sm font-medium text-ink-900" htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            className="w-full rounded-2xl border border-stone-300/80 bg-white px-4 py-3.5 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="chef@example.com"
            required
            disabled={codeSent}
          />

          {codeSent ? (
            <>
              <label className="text-sm font-medium text-ink-900" htmlFor="login-code">
                One-time code
              </label>
              <input
                id="login-code"
                className="w-full rounded-2xl border border-stone-300/80 bg-white px-4 py-3.5 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </>
          ) : null}

          <button
            className="mt-2 rounded-full bg-sage-700 px-5 py-3.5 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? codeSent
                ? "Verifying code..."
                : "Sending code..."
              : codeSent
                ? "Verify code"
                : "Email me a code"}
          </button>

          {codeSent ? (
            <button
              className="rounded-full border border-stone-300/80 bg-white px-5 py-3 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={() => {
                setCode("");
                setCodeSent(false);
              }}
              disabled={isSubmitting}
            >
              Use a different email
            </button>
          ) : null}
        </form>

        {statusMessage ? (
          <p className="mt-4 rounded-2xl bg-sage-500/10 px-4 py-3 text-sm text-sage-700">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
