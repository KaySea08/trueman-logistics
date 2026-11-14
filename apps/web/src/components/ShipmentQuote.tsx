import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Package,
  X,
} from "lucide-react";
import { apiRequest, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type QuoteRequestReceipt = {
  id: string;
  requestNumber: string;
  status: string;
  createdAt: string;
  message: string;
};

export default function ShipmentQuote({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [mode, setMode] = useState("AIR");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [sender, setSender] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [origin, setOrigin] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [weight, setWeight] = useState("1");
  const [length, setLength] = useState("30");
  const [width, setWidth] = useState("30");
  const [height, setHeight] = useState("30");
  const [instructions, setInstructions] = useState("");
  const [receipt, setReceipt] = useState<QuoteRequestReceipt | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"request" | "submitted">("request");
  async function request(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest<QuoteRequestReceipt>("/quotes", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          mode,
          destinationCountryCode: country.toUpperCase(),
          destinationCity: city,
          destinationAddressLine: address,
          recipientName: recipient,
          recipientPhone,
          senderName: sender,
          senderPhone,
          chinaCollectionAddress: origin,
          handlingInstructions: instructions || undefined,
          packages: [
            {
              description,
              quantity: Number(quantity),
              weightKg: Number(weight),
              lengthCm: Number(length),
              widthCm: Number(width),
              heightCm: Number(height),
            },
          ],
        }),
      });
      setReceipt(data);
      setStep("submitted");
      await queryClient.invalidateQueries({
        queryKey: ["customer", user?.id, "quote-requests"],
      });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Please sign in to send a quotation request."
          : err instanceof Error
            ? err.message
            : "Request failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="shipment-quote-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="shipment-quote-modal"
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-labelledby="shipment-quote-title"
      >
        <header>
          <div>
            <span className="section-kicker">
              CHINA ORIGIN · WORLDWIDE DELIVERY
            </span>
            <h2 id="shipment-quote-title">
              {step === "request"
                ? "Request a shipping quote"
                : "Request received"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quotation form"
          >
            <X />
          </button>
        </header>
        {step === "request" && (
          <form onSubmit={request}>
            <div className="shipment-quote-grid">
              <label>
                Shipping method
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="AIR">Air freight</option>
                  <option value="SEA">Sea freight</option>
                  <option value="EXPRESS">Express shipping</option>
                </select>
              </label>
              <label>
                Destination country code
                <input
                  required
                  maxLength={2}
                  minLength={2}
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  placeholder="e.g. GH"
                />
              </label>
              <label>
                Destination city
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Accra"
                />
              </label>
              <label>
                Recipient full name
                <input
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </label>
              <label>
                Recipient phone (international format)
                <input
                  required
                  pattern="\+[1-9][0-9]{7,14}"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+233..."
                />
              </label>
              <label className="shipment-quote-full">
                Destination delivery address
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <label>
                Sender full name
                <input
                  required
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                />
              </label>
              <label>
                Sender phone (international format)
                <input
                  required
                  pattern="\+[1-9][0-9]{7,14}"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="+86..."
                />
              </label>
              <label className="shipment-quote-full">
                China collection address
                <input
                  required
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                />
              </label>
              <div className="shipment-quote-divider shipment-quote-full">
                <Package size={17} /> Cargo details
              </div>
              <label className="shipment-quote-full">
                Cargo description
                <input
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the goods"
                />
              </label>
              <label>
                Package quantity
                <input
                  required
                  type="number"
                  min="1"
                  max="500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <label>
                Total weight per package (kg)
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </label>
              <label>
                Length (cm)
                <input
                  required
                  type="number"
                  min="1"
                  step="0.1"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
              </label>
              <label>
                Width (cm)
                <input
                  required
                  type="number"
                  min="1"
                  step="0.1"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </label>
              <label>
                Height (cm)
                <input
                  required
                  type="number"
                  min="1"
                  step="0.1"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </label>
              <label className="shipment-quote-full">
                Special handling instructions (optional)
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </label>
            </div>
            <p className="shipment-quote-hint">
              Our team will review these details, calculate your quotation, and
              email you when it is ready. For multiple packages, enter the
              package count and dimensions and weight for each identical
              package. For mixed packages, request a manual quotation.
            </p>
            <button
              className="btn btn-primary shipment-quote-submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={16} /> Calculating…
                </>
              ) : (
                "Send quote request"
              )}{" "}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        {step === "submitted" && receipt && (
          <div className="shipment-quote-result shipment-quote-complete">
            <CheckCircle2 size={42} />
            <h3>Your quote request is in the queue</h3>
            <p>
              Our team will calculate the quotation and email you when it is
              ready.
            </p>
            <div className="shipment-tracking-token">
              {receipt.requestNumber}
            </div>
            <button
              className="btn btn-primary shipment-quote-submit"
              onClick={onClose}
            >
              Done <ArrowRight size={16} />
            </button>
          </div>
        )}
        {error && (
          <p className="shipment-quote-error" role="alert">
            {error}
            {error.includes("sign in") && (
              <button
                onClick={() => {
                  onClose();
                  onLogin();
                }}
              >
                Sign in
              </button>
            )}
          </p>
        )}
        <small className="shipment-quote-security">
          Your request is linked to your authenticated customer account. Prices
          are calculated by Trueman's configured rate rules.
        </small>
      </section>
    </div>
  );
}
