import { FormEvent, useState } from "react";
import { Headphones, X } from "lucide-react";
import { useModalFocus } from "../hooks/useModalFocus";

const API =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:3000/api/v1";

export default function ServiceInquiry({
  service,
  onClose,
}: {
  service: string;
  onClose: () => void;
}) {
  const dialogRef = useModalFocus<HTMLElement>(onClose);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    `I would like to know your rates, estimated transit time and destination availability for ${service} from China.`,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API}/support/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: name,
          email,
          phone: phone || undefined,
          serviceName: service,
          message,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to submit inquiry.");
      }
      setSuccess(`${data.message} Reference: ${data.reference}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unexpected error.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="access-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="access-panel"
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-labelledby="inquiry-title"
        tabIndex={-1}
      >
        <button className="access-close" onClick={onClose} aria-label="Close">
          <X />
        </button>
        <span className="access-icon">
          <Headphones />
        </span>
        <h2 id="inquiry-title">Talk to our shipping team</h2>
        <p>
          Ask about {service} from China. Submit your details and our customer
          service team can follow up directly.
        </p>
        <form onSubmit={submit}>
          <label>
            Full name
            <input
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Phone / WhatsApp (optional)
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Include international dial code"
            />
          </label>
          <label>
            Your inquiry
            <textarea
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          <button className="btn btn-primary access-submit" disabled={busy}>
            {busy ? "Submitting…" : "Send inquiry"}
          </button>
        </form>
        {error && (
          <p className="access-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="access-success" role="status">
            {success}
          </p>
        )}
        <small className="access-security-note">
          Your inquiry is stored securely for the customer service team. Do not
          include passwords, verification codes or payment card details.
        </small>
      </section>
    </div>
  );
}
