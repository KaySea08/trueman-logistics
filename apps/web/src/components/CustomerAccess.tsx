import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Eye, EyeOff, X } from "lucide-react";
import { apiRequest, ApiError } from "../api/client";
import { useAuth, type AuthUser } from "../auth/AuthContext";
import Brand from "./Brand";

type Mode =
  | "login"
  | "register"
  | "verify"
  | "mfa"
  | "mfaSetup"
  | "forgot"
  | "reset"
  | "confirm";
export default function LoginDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { login, verifyMfa, setupMfa, enableMfa, consumeReturnTo } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signedInAs, setSignedInAs] = useState("");
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function finishSignIn(authUser: AuthUser) {
    setSignedInAs(
      authUser.customer?.displayName || authUser.email || "your account",
    );
    setMode("confirm");
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    const destination = consumeReturnTo();
    onClose();
    navigate(destination);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setCanResendVerification(false);
    try {
      if (mode === "login") {
        const outcome = await login(email, password);
        if (outcome.kind === "mfa-required") {
          setChallenge(outcome.challenge);
          setMode("mfa");
          return;
        }
        if (outcome.kind === "mfa-setup-required") {
          const setup = await setupMfa();
          setQrCode(setup.qrCodeDataUrl);
          setRecoveryCodes(setup.recoveryCodes);
          setMode("mfaSetup");
          return;
        }
        await finishSignIn(outcome.user);
        return;
      }

      if (mode === "mfa") {
        await finishSignIn(await verifyMfa(challenge, code));
        return;
      }

      if (mode === "mfaSetup") {
        await finishSignIn(await enableMfa(code));
        return;
      }

      const paths: Partial<Record<Mode, string>> = {
        register: "/auth/register",
        verify: "/auth/verify-email",
        forgot: "/auth/password/forgot",
        reset: "/auth/password/reset",
      };
      const path = paths[mode];
      if (!path) throw new Error("This sign-in step is unavailable.");
      const payload: Record<string, unknown> =
        mode === "register"
          ? { email, password, fullName, phone: phone || undefined }
          : mode === "verify"
            ? { email, code }
            : mode === "forgot"
              ? { email }
              : { email, code, newPassword: password };
      const data = await apiRequest<{ message?: string }>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (mode === "register") {
        setPassword("");
        setMode("verify");
        setMessage(
          "We sent a verification code to your email. In local development, open Mailpit at http://localhost:8025.",
        );
      } else if (mode === "verify") {
        setCode("");
        setPassword("");
        setMode("login");
        setMessage(data.message ?? "Email verified. You can now sign in.");
      } else if (mode === "forgot") {
        setMode("reset");
        setMessage(
          "If the account exists, a reset code has been sent to your email.",
        );
      } else setMessage(data.message ?? "Completed successfully.");
    } catch (e) {
      if (
        mode === "register" &&
        e instanceof ApiError &&
        e.status === 409 &&
        e.message.toLowerCase().includes("email")
      ) {
        setCanResendVerification(true);
      }
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }
  async function resendVerification() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ message?: string }>(
        "/auth/resend-verification",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setMode("verify");
      setMessage(data.message ?? "A verification code has been requested.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }
  const title: Record<Mode, string> = {
    login: "Customer login",
    register: "Create your account",
    verify: "Verify your email",
    mfa: "Two-factor verification",
    mfaSetup: "Secure your staff account",
    forgot: "Reset your password",
    reset: "Choose a new password",
    confirm: "Signed in",
  };
  return (
    <div
      className="access-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="access-panel customer-access-panel"
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
      >
        <button className="access-close" onClick={onClose} aria-label="Close">
          <X />
        </button>
        <div className="customer-access-brand">
          <Brand href="/" />
        </div>
        <h2 id="access-title">{title[mode]}</h2>
        <p>Secure access to your Trueman Logistics account.</p>
        {mode === "confirm" ? (
          <div className="customer-access-confirmation" role="status">
            <CircleCheck size={23} />
            <span>
              Signed in as <b>{signedInAs}</b>
            </span>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "mfaSetup" && (
              <div className="mfa-setup-content">
                <p>
                  Scan this QR code with an authenticator app such as Microsoft
                  Authenticator or Google Authenticator.
                </p>
                {qrCode && (
                  <img src={qrCode} alt="Authenticator setup QR code" />
                )}
                <b>Save these recovery codes somewhere safe:</b>
                <code>{recoveryCodes.join("  ")}</code>
              </div>
            )}
            {mode === "register" && (
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </label>
            )}
            {!["mfa", "mfaSetup"].includes(mode) && (
              <label>
                Email address
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
            )}
            {mode === "register" && (
              <label>
                Phone number (optional)
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="Include country code"
                />
              </label>
            )}
            {["login", "register", "reset"].includes(mode) && (
              <label
                className="customer-password-group"
                htmlFor="customer-password"
              >
                {mode === "reset" ? "New password" : "Password"}
                <span className="customer-password-field">
                  <input
                    id="customer-password"
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={
                      mode === "login" ? 1 : mode === "register" ? 5 : 12
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                  <button
                    className="customer-password-toggle"
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            )}
            {["verify", "mfa", "mfaSetup", "reset"].includes(mode) && (
              <label>
                Six-digit verification code
                <input
                  required
                  inputMode="numeric"
                  pattern={
                    mode === "mfa" ? "([0-9]{6}|[A-Fa-f0-9]{10})" : "[0-9]{6}"
                  }
                  maxLength={mode === "mfa" ? 10 : 6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                />
              </label>
            )}
            <button className="btn btn-primary access-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : mode === "verify"
                      ? "Verify email"
                      : mode === "mfa"
                        ? "Verify and sign in"
                        : mode === "mfaSetup"
                          ? "Enable MFA"
                          : mode === "forgot"
                            ? "Send reset code"
                            : "Reset password"}
            </button>
          </form>
        )}
        {error && (
          <p className="access-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="access-success" role="status">
            {message}
          </p>
        )}
        {mode !== "confirm" && (
          <div className="access-links">
            {mode === "login" ? (
              <>
                <button onClick={() => setMode("register")}>
                  Create an account
                </button>
                <button onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              </>
            ) : mode === "register" ? (
              <>
                {canResendVerification && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={resendVerification}
                  >
                    Resend verification code
                  </button>
                )}
                <button
                  onClick={() => {
                    setCanResendVerification(false);
                    setMode("login");
                  }}
                >
                  Already registered? Sign in
                </button>
              </>
            ) : mode === "verify" ? (
              <button
                type="button"
                disabled={busy}
                onClick={resendVerification}
              >
                Resend verification code
              </button>
            ) : (
              <button onClick={() => setMode("login")}>Back to sign in</button>
            )}
          </div>
        )}
        <small className="access-security-note">
          We never ask you to share your password or verification code with
          support staff.
        </small>
      </section>
    </div>
  );
}
