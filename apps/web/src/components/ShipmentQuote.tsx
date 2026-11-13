import { FormEvent, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Package,
  X,
} from "lucide-react";
const API =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:3000/api/v1";
type Quote = {
  id: string;
  quoteNumber: string;
  mode: string;
  currency: string;
  subtotal: string;
  handlingFee: string;
  totalAmount: string;
  validUntil: string;
  chargeableWeightKg?: string;
  volumeCbm?: string;
  pricingSnapshot: {
    basis: string;
    billableUnits: number;
    ratePerUnit: number;
    actualWeightKg: number;
    volumetricWeightKg: number;
  };
};
export default function ShipmentQuote({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: () => void;
}) {
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
  const [quote, setQuote] = useState<Quote | null>(null);
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"request" | "quote" | "complete">("request");
  async function request(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/quotes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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
      const data = await res.json();
      if (res.status === 401) {
        setError("Please sign in to request a shipment quotation.");
        return;
      }
      if (!res.ok)
        throw new Error(data.message || "Unable to create quotation.");
      setQuote(data);
      setStep("quote");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    if (!quote) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/quotes/${quote.id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Unable to accept quotation.");
      setTracking(data.trackingReference || "");
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
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
                : step === "quote"
                  ? "Your quotation"
                  : "Shipment created"}
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
              Dimensions and weight are used to calculate chargeable weight or
              cargo volume. For multiple packages, enter the package count and
              the dimensions and weight of each identical package. For mixed
              packages, request a manual quotation.
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
                "Calculate quotation"
              )}{" "}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        {step === "quote" && quote && (
          <div className="shipment-quote-result">
            <div className="shipment-quote-number">
              {quote.quoteNumber}
              <span>
                · Valid until {new Date(quote.validUntil).toLocaleDateString()}
              </span>
            </div>
            <div className="shipment-quote-total">
              <small>Quoted total</small>
              <strong>
                {quote.currency} {Number(quote.totalAmount).toFixed(2)}
              </strong>
            </div>
            <dl>
              <div>
                <dt>Shipping method</dt>
                <dd>{quote.mode}</dd>
              </div>
              <div>
                <dt>Billing basis</dt>
                <dd>{quote.pricingSnapshot.basis.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt>Billable units</dt>
                <dd>{quote.pricingSnapshot.billableUnits}</dd>
              </div>
              <div>
                <dt>Freight charge</dt>
                <dd>
                  {quote.currency} {Number(quote.subtotal).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt>Handling fee</dt>
                <dd>
                  {quote.currency} {Number(quote.handlingFee).toFixed(2)}
                </dd>
              </div>
            </dl>
            <p>
              Transit estimates and any customs, duties or destination charges
              not included in this quotation will be confirmed separately by
              Trueman Logistics.
            </p>
            <button
              className="btn btn-primary shipment-quote-submit"
              onClick={accept}
              disabled={busy}
            >
              {busy ? "Processing…" : "Accept quotation and create shipment"}{" "}
              <ArrowRight size={16} />
            </button>
            <button
              className="shipment-quote-secondary"
              onClick={() => setStep("request")}
            >
              Edit shipment request
            </button>
          </div>
        )}
        {step === "complete" && (
          <div className="shipment-quote-result shipment-quote-complete">
            <CheckCircle2 size={42} />
            <h3>Your shipment has been created</h3>
            <p>
              Keep this tracking reference. It is shown only once for security.
            </p>
            <div className="shipment-tracking-token">
              {tracking ||
                "Shipment already accepted. Contact support for the existing reference."}
            </div>
            <button
              className="btn btn-primary shipment-quote-submit"
              onClick={onClose}
            >
              Done
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
