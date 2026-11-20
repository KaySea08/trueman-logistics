import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  X,
  Calculator,
} from "lucide-react";
import { API_BASE_URL, apiRequest } from "../api/client";

type QuoteRequestRow = {
  id: string;
  requestNumber: string;
  mode: string;
  destinationCountryCode: string;
  destinationCity: string;
  status: "REQUESTED" | "PROCESSING" | "SENDING" | "SENT";
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  assignedTo: { id: string; fullName: string; employeeCode: string } | null;
  customer: {
    displayName: string;
    user: { email: string | null; phone: string | null };
  };
  resultQuote: {
    id: string;
    quoteNumber: string;
    status: string;
    currency: string;
    totalAmount: string;
    validUntil: string;
    subtotal: string;
    handlingFee: string;
    pricingSnapshot: {
      rateRuleId: string;
      rateRuleName: string;
      basis: string;
      breakdown?: PricingBreakdown;
    };
  } | null;
};

type PricingBreakdown = {
  baseCharge: number;
  weightCharge: number;
  volumeCharge: number;
  destinationSurcharge: number;
  handlingFee: number;
  insuranceFee: number;
  customsCharges: number;
  serviceCharges: number;
  discount: number;
  subtotal: number;
  totalAmount: number;
};

type PricingField = keyof Omit<PricingBreakdown, "subtotal" | "totalAmount">;

type RequestDetail = QuoteRequestRow & {
  requestSnapshot: {
    originCountryCode: string;
    chinaCollectionAddress: string;
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone: string;
    destinationAddressLine: string;
    handlingInstructions: string | null;
    packages: Array<{
      description: string;
      quantity: number;
      weightKg: number;
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    }>;
  };
  history: Array<{
    id: string;
    action: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actor: {
      email: string | null;
      staff: { fullName: string; employeeCode: string } | null;
    } | null;
  }>;
};

type QuoteStaff = { id: string; fullName: string; employeeCode: string };

type RateRule = {
  id: string;
  name: string;
  mode: string;
  basis: string;
  destinationCountryCode: string | null;
  currency: string;
  ratePerUnit: string;
  minimumCharge: string;
  handlingFee: string;
  volumetricDivisor: string;
  active: boolean;
  validFrom: string;
  validUntil: string | null;
};

type RequestPage = { items: QuoteRequestRow[]; nextCursor: string | null };
type DeliveryResult = {
  message: string;
  requestNumber: string;
  quoteNumber: string;
  status: string;
};
type CalculateResult = {
  message: string;
  requestNumber: string;
  quoteNumber: string;
  status: string;
  quote: NonNullable<QuoteRequestRow["resultQuote"]>;
};
type QueueMetrics = {
  requests: Record<string, number>;
  outbox: Record<string, number>;
};

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, init);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function money(value: string, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(
      Number(value),
    );
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
}

function human(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eligibleRates(rates: RateRule[], request: QuoteRequestRow) {
  const now = Date.now();
  return rates.filter(
    (rate) =>
      rate.active &&
      rate.mode === request.mode &&
      (!rate.destinationCountryCode ||
        rate.destinationCountryCode === request.destinationCountryCode) &&
      new Date(rate.validFrom).getTime() <= now &&
      (!rate.validUntil || new Date(rate.validUntil).getTime() > now),
  );
}

const pricingFields: Array<{ key: PricingField; label: string }> = [
  { key: "baseCharge", label: "Base shipping charge" },
  { key: "weightCharge", label: "Weight-based charge" },
  { key: "volumeCharge", label: "Volume-based charge" },
  { key: "destinationSurcharge", label: "Destination surcharge" },
  { key: "handlingFee", label: "Handling fee" },
  { key: "insuranceFee", label: "Insurance fee" },
  { key: "customsCharges", label: "Customs and other charges" },
  { key: "serviceCharges", label: "Additional service charges" },
  { key: "discount", label: "Discount" },
];

const emptyPricingOverrides = (): Record<PricingField, string> => ({
  baseCharge: "",
  weightCharge: "",
  volumeCharge: "",
  destinationSurcharge: "",
  handlingFee: "",
  insuranceFee: "",
  customsCharges: "",
  serviceCharges: "",
  discount: "",
});

export default function AdminQuoteRequests({
  canManageAll,
}: {
  canManageAll: boolean;
}) {
  const [page, setPage] = useState<RequestPage>({
    items: [],
    nextCursor: null,
  });
  const [rates, setRates] = useState<RateRule[]>([]);
  const [staff, setStaff] = useState<QuoteStaff[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [selected, setSelected] = useState<RequestDetail | null>(null);
  const [rateRuleId, setRateRuleId] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [pricingOverrides, setPricingOverrides] = useState<
    Record<PricingField, string>
  >(emptyPricingOverrides);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextCursor: string | null, append: boolean, quiet = false) => {
      if (!quiet) {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError("");
      }
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (nextCursor) params.set("cursor", nextCursor);
        if (debouncedSearch.trim())
          params.set("search", debouncedSearch.trim());
        if (statusFilter) params.set("status", statusFilter);
        if (modeFilter) params.set("mode", modeFilter);
        if (destinationFilter)
          params.set("destinationCountryCode", destinationFilter);
        if (createdFrom) params.set("createdFrom", createdFrom);
        if (createdTo) params.set("createdTo", createdTo);
        params.set("sort", sort);
        const result = await adminRequest<RequestPage>(
          `/admin/quote-requests?${params}`,
        );
        setPage((current) => ({
          items: append ? [...current.items, ...result.items] : result.items,
          nextCursor: result.nextCursor,
        }));
        setCursor(result.nextCursor);
      } catch (requestError) {
        if (!quiet) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load quote requests.",
          );
        }
      } finally {
        if (!quiet) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      createdFrom,
      createdTo,
      destinationFilter,
      modeFilter,
      debouncedSearch,
      sort,
      statusFilter,
    ],
  );

  const loadRates = useCallback(async () => {
    try {
      setRates(await adminRequest<RateRule[]>("/admin/rates"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load rate rules.",
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadStaff = useCallback(async () => {
    try {
      setStaff(await adminRequest<QuoteStaff[]>("/admin/quote-requests/staff"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load quotation officers.",
      );
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      setMetrics(
        await adminRequest<QueueMetrics>("/admin/quote-requests/health"),
      );
    } catch {
      // Queue data and polling continue to work if the metrics endpoint is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadPage(null, false);
    void loadRates();
    if (canManageAll) void loadStaff();
    void loadMetrics();
  }, [canManageAll, loadMetrics, loadPage, loadRates, loadStaff]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      void loadPage(null, false, true);
      void loadMetrics();
    };
    const source = new EventSource(`${API_BASE_URL}/admin/quote-requests/events`, {
      withCredentials: true,
    });
    source.addEventListener("quote-request", refresh);
    const poll = window.setInterval(refresh, 15_000);
    return () => {
      active = false;
      source.close();
      window.clearInterval(poll);
    };
  }, [loadMetrics, loadPage]);

  const matchingRates = useMemo(
    () => (selected ? eligibleRates(rates, selected) : []),
    [rates, selected],
  );

  async function openRequest(row: QuoteRequestRow) {
    setError("");
    setNotice("");
    setSelected(null);
    try {
      const detail = await adminRequest<RequestDetail>(
        `/admin/quote-requests/${encodeURIComponent(row.id)}`,
      );
      setSelected(detail);
      setAssignedStaffId(detail.assignedTo?.id ?? "");
      setInternalNote("");
      setPricingOverrides({
        ...emptyPricingOverrides(),
        ...Object.fromEntries(
          Object.entries(
            detail.resultQuote?.pricingSnapshot.breakdown ?? {},
          ).map(([key, value]) => [key, String(value)]),
        ),
      });
      setApproved(false);
      const previousRateRule = detail.resultQuote?.pricingSnapshot.rateRuleId;
      const eligible = eligibleRates(rates, detail);
      setRateRuleId(
        eligible.some((rate) => rate.id === previousRateRule)
          ? previousRateRule!
          : (eligible[0]?.id ?? ""),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load the request details.",
      );
    }
  }

  async function calculateDraft() {
    if (!selected || !rateRuleId) return;
    setBusy(true);
    setError("");
    setNotice("");
    setApproved(false);
    try {
      const overrides = Object.fromEntries(
        Object.entries(pricingOverrides)
          .filter(([, value]) => value.trim() !== "")
          .map(([key, value]) => [key, Number(value)]),
      );
      const result = await adminRequest<CalculateResult>(
        `/admin/quote-requests/${encodeURIComponent(selected.id)}/calculate`,
        {
          method: "POST",
          body: JSON.stringify({ rateRuleId, ...overrides }),
        },
      );
      setNotice(result.message);
      setSelected((current) =>
        current
          ? { ...current, status: "PROCESSING", resultQuote: result.quote }
          : current,
      );
      await loadPage(null, false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not calculate the quote.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendToCustomer() {
    if (!selected?.resultQuote || !approved) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await adminRequest<DeliveryResult>(
        `/admin/quote-requests/${encodeURIComponent(selected.id)}/send`,
        { method: "POST" },
      );
      setNotice(result.message);
      setSelected(null);
      await Promise.all([loadPage(null, false), loadMetrics()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not queue the quotation email.",
      );
      await loadPage(null, false);
    } finally {
      setBusy(false);
    }
  }

  async function assignSelected() {
    if (!selected || !assignedStaffId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminRequest(
        `/admin/quote-requests/${encodeURIComponent(selected.id)}/assignment`,
        {
          method: "PATCH",
          body: JSON.stringify({ staffProfileId: assignedStaffId }),
        },
      );
      setNotice("Quotation request assigned.");
      await openRequest(selected);
      await loadPage(null, false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not assign this request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addInternalNote() {
    if (!selected || internalNote.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(
        `/admin/quote-requests/${encodeURIComponent(selected.id)}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ note: internalNote.trim() }),
        },
      );
      setInternalNote("");
      await openRequest(selected);
      setNotice("Internal note added.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save the note.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="admin-panel admin-quote-requests">
        <div className="admin-panel-heading">
          <div>
            <h2>Customer quote requests</h2>
            <p>
              Review shipment details, select a current rate, then calculate and
              email the quotation.
            </p>
          </div>
          <div className="admin-quote-queue-actions">
            <span className="admin-result-count">
              {page.items.length} shown
            </span>
            <button
              type="button"
              className="admin-refresh"
              onClick={() => void loadPage(null, false)}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>
        {error && (
          <div className="admin-banner-error">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}
        {notice && (
          <div className="admin-quote-notice" role="status">
            {notice}
          </div>
        )}
        <div className="admin-quote-metrics" aria-label="Quote queue health">
          <article>
            <span>New requests</span>
            <b>{metrics?.requests.REQUESTED ?? "—"}</b>
          </article>
          <article>
            <span>Processing</span>
            <b>{metrics?.requests.PROCESSING ?? "—"}</b>
          </article>
          <article>
            <span>Email sending</span>
            <b>{metrics?.requests.SENDING ?? "—"}</b>
          </article>
          <article className={metrics?.outbox.DEAD_LETTER ? "attention" : ""}>
            <span>Dead-letter events</span>
            <b>{metrics?.outbox.DEAD_LETTER ?? "—"}</b>
          </article>
        </div>
        <div className="admin-quote-filters">
          <label className="admin-quote-search">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Reference, customer, email, destination"
              maxLength={100}
            />
          </label>
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All active</option>
              <option value="REQUESTED">New</option>
              <option value="PROCESSING">Processing</option>
              <option value="SENDING">Sending</option>
              <option value="SENT">Sent</option>
            </select>
          </label>
          <label>
            Method
            <select
              value={modeFilter}
              onChange={(event) => setModeFilter(event.target.value)}
            >
              <option value="">All methods</option>
              <option value="AIR">Air</option>
              <option value="SEA">Sea</option>
              <option value="EXPRESS">Express</option>
            </select>
          </label>
          <label>
            Destination
            <input
              value={destinationFilter}
              onChange={(event) =>
                setDestinationFilter(event.target.value.toUpperCase())
              }
              placeholder="Country code"
              maxLength={2}
            />
          </label>
          <label>
            From
            <input
              type="date"
              value={createdFrom}
              onChange={(event) => setCreatedFrom(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={createdTo}
              onChange={(event) => setCreatedTo(event.target.value)}
            />
          </label>
          <label>
            Sort
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "newest" | "oldest")
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Customer</th>
                <th>Destination</th>
                <th>Method</th>
                <th>Status</th>
                <th>Received</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="admin-empty" colSpan={7}>
                    <RefreshCw size={16} className="spin" /> Loading quote
                    requests…
                  </td>
                </tr>
              ) : page.items.length === 0 ? (
                <tr>
                  <td className="admin-empty" colSpan={7}>
                    No quote requests are waiting for review.
                  </td>
                </tr>
              ) : (
                page.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.requestNumber}</b>
                      <small>
                        {row.resultQuote?.quoteNumber ?? "Awaiting calculation"}
                      </small>
                      <small>
                        {row.assignedTo
                          ? `Assigned: ${row.assignedTo.fullName}`
                          : "Unassigned"}
                      </small>
                    </td>
                    <td>
                      {row.customer.displayName}
                      <small>
                        {row.customer.user.email ??
                          row.customer.user.phone ??
                          "No contact"}
                      </small>
                    </td>
                    <td>
                      {row.destinationCity}, {row.destinationCountryCode}
                    </td>
                    <td>{human(row.mode)}</td>
                    <td>
                      <span
                        className={`admin-pill ${row.status === "SENDING" ? "warn" : "neutral"}`}
                      >
                        {human(row.status)}
                      </span>
                    </td>
                    <td>{date(row.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-row-action"
                        onClick={() => void openRequest(row)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {page.nextCursor && (
          <div className="admin-quote-pagination">
            <button
              type="button"
              className="admin-secondary"
              disabled={loadingMore}
              onClick={() => void loadPage(cursor, true)}
            >
              {loadingMore ? (
                <RefreshCw size={15} className="spin" />
              ) : (
                <ChevronDown size={15} />
              )}
              Load next 50
            </button>
          </div>
        )}
      </section>

      {selected && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setSelected(null);
          }}
        >
          <section
            className="admin-detail-panel admin-quote-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-quote-detail-title"
          >
            <header>
              <div>
                <span className="admin-eyebrow">CUSTOMER QUOTE REQUEST</span>
                <h2 id="admin-quote-detail-title">{selected.requestNumber}</h2>
              </div>
              <button
                type="button"
                className="admin-icon-button"
                aria-label="Close quote request"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="admin-quote-detail-content">
              <section>
                <h3>Customer</h3>
                <dl>
                  <div>
                    <dt>Name</dt>
                    <dd>{selected.customer.displayName}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>
                      {selected.customer.user.email ?? "No email address"}
                    </dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selected.customer.user.phone ?? "Not provided"}</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3>Shipment</h3>
                <dl>
                  <div>
                    <dt>Method</dt>
                    <dd>{human(selected.mode)}</dd>
                  </div>
                  <div>
                    <dt>Destination</dt>
                    <dd>
                      {selected.destinationCity},{" "}
                      {selected.destinationCountryCode}
                    </dd>
                  </div>
                  <div>
                    <dt>Origin collection</dt>
                    <dd>{selected.requestSnapshot.chinaCollectionAddress}</dd>
                  </div>
                  <div>
                    <dt>Delivery address</dt>
                    <dd>{selected.requestSnapshot.destinationAddressLine}</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3>Cargo details</h3>
                <div className="admin-quote-package-list">
                  {selected.requestSnapshot.packages.map((pkg, index) => (
                    <article key={`${pkg.description}-${index}`}>
                      <b>{pkg.description}</b>
                      <span>
                        {pkg.quantity} package{pkg.quantity === 1 ? "" : "s"} ·{" "}
                        {pkg.weightKg} kg each
                      </span>
                      <small>
                        {pkg.lengthCm} × {pkg.widthCm} × {pkg.heightCm} cm
                      </small>
                    </article>
                  ))}
                </div>
                {selected.requestSnapshot.handlingInstructions && (
                  <p className="admin-quote-instructions">
                    Handling instructions:{" "}
                    {selected.requestSnapshot.handlingInstructions}
                  </p>
                )}
              </section>
              {canManageAll && (
                <section className="admin-quote-assignment">
                  <h3>Assignment</h3>
                  <label>
                    Quote officer
                    <select
                      value={assignedStaffId}
                      onChange={(event) =>
                        setAssignedStaffId(event.target.value)
                      }
                    >
                      <option value="">Select an active quote officer</option>
                      {staff.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.fullName} · {person.employeeCode}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="admin-secondary"
                    disabled={!assignedStaffId || busy}
                    onClick={() => void assignSelected()}
                  >
                    Assign request
                  </button>
                </section>
              )}
              <section className="admin-quote-internal-note">
                <h3>Internal note</h3>
                <label>
                  <span className="admin-sr-only">Add internal note</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={internalNote}
                    onChange={(event) => setInternalNote(event.target.value)}
                    placeholder="Record an internal handling note"
                  />
                </label>
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={internalNote.trim().length < 3 || busy}
                  onClick={() => void addInternalNote()}
                >
                  Add note
                </button>
              </section>
              <section className="admin-quote-history">
                <h3>Request history</h3>
                <ol>
                  {selected.history.map((item) => {
                    const note =
                      item.metadata && typeof item.metadata.note === "string"
                        ? item.metadata.note
                        : null;
                    const actor =
                      item.actor?.staff?.fullName ??
                      item.actor?.email ??
                      "System";
                    return (
                      <li key={item.id}>
                        <b>{human(item.action)}</b>
                        <span>{actor}</span>
                        {note && <p>{note}</p>}
                        <time>{date(item.createdAt)}</time>
                      </li>
                    );
                  })}
                  {!selected.history.length && (
                    <li className="admin-quote-no-history">
                      No history has been recorded yet.
                    </li>
                  )}
                </ol>
              </section>
              <section className="admin-quote-calculate">
                <h3>Review calculated quotation</h3>
                {selected.resultQuote && (
                  <p className="admin-quote-retry-note">
                    Draft quote {selected.resultQuote.quoteNumber} exists.
                    Current total:{" "}
                    {money(
                      selected.resultQuote.totalAmount,
                      selected.resultQuote.currency,
                    )}
                    . Recalculate if needed, review the breakdown, then
                    explicitly approve sending.
                  </p>
                )}
                <label>
                  Rate rule
                  <select
                    value={rateRuleId}
                    onChange={(event) => setRateRuleId(event.target.value)}
                  >
                    <option value="">Select a matching rate rule</option>
                    {matchingRates.map((rate) => (
                      <option key={rate.id} value={rate.id}>
                        {rate.name} · {rate.currency} {rate.ratePerUnit}/
                        {rate.basis.toLowerCase().replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                {!matchingRates.length && (
                  <p className="admin-quote-instructions">
                    No active rate rule matches this method and destination.
                    Create or update a rate rule first.
                  </p>
                )}
                <div className="admin-quote-pricing-fields">
                  {pricingFields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <input
                        type="number"
                        min="0"
                        max="10000000"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Use rate-rule default"
                        value={pricingOverrides[field.key]}
                        disabled={busy || selected.status === "SENDING"}
                        onChange={(event) => {
                          setApproved(false);
                          setPricingOverrides((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <p className="admin-quote-instructions">
                  Leave a line blank to use the selected rate rule’s default.
                  All amounts are validated and calculated by the API.
                </p>
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={
                    busy || !rateRuleId || selected.status === "SENDING"
                  }
                  onClick={() => void calculateDraft()}
                >
                  {busy ? (
                    <>
                      <RefreshCw size={15} className="spin" /> Calculating…
                    </>
                  ) : (
                    <>
                      <Calculator size={16} />
                      {selected.resultQuote?.status === "DRAFT"
                        ? "Recalculate draft"
                        : "Calculate draft"}
                    </>
                  )}
                </button>
                {selected.resultQuote?.status === "DRAFT" && (
                  <div className="admin-quote-preview">
                    <h4>Draft {selected.resultQuote.quoteNumber}</h4>
                    <dl>
                      {pricingFields.map((field) => (
                        <div key={field.key}>
                          <dt>{field.label}</dt>
                          <dd>
                            {money(
                              String(
                                selected.resultQuote?.pricingSnapshot
                                  .breakdown?.[field.key] ?? 0,
                              ),
                              selected.resultQuote?.currency ?? "USD",
                            )}
                          </dd>
                        </div>
                      ))}
                      <div>
                        <dt>Subtotal</dt>
                        <dd>
                          {money(
                            selected.resultQuote.subtotal,
                            selected.resultQuote.currency,
                          )}
                        </dd>
                      </div>
                      <div className="total">
                        <dt>Final quotation</dt>
                        <dd>
                          {money(
                            selected.resultQuote.totalAmount,
                            selected.resultQuote.currency,
                          )}
                        </dd>
                      </div>
                    </dl>
                    <label className="admin-quote-approval">
                      <input
                        type="checkbox"
                        checked={approved}
                        disabled={busy}
                        onChange={(event) => setApproved(event.target.checked)}
                      />
                      I reviewed the breakdown and approve sending this quote.
                    </label>
                    <button
                      type="button"
                      className="admin-primary"
                      disabled={busy || !approved}
                      onClick={() => void sendToCustomer()}
                    >
                      {busy ? (
                        <>
                          <RefreshCw size={15} className="spin" /> Queueing
                          email…
                        </>
                      ) : (
                        <>
                          Send to customer <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                )}
                {selected.status === "SENDING" && (
                  <p className="admin-quote-instructions">
                    A send is already in progress. Refresh the queue shortly.
                  </p>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
