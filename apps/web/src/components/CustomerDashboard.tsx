import { Fragment, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileText,
  LogOut,
  PackageCheck,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import Brand from "./Brand";
import { useModalFocus } from "../hooks/useModalFocus";

const API_ERROR_TEXT = "We couldn't load this information. Please try again.";

type Address = {
  kind: string;
  city: string;
  countryCode: string;
};

type ShipmentEvent = {
  status: string;
  locationLabel: string | null;
  occurredAt: string;
};

type CustomerShipment = {
  shipmentNumber: string;
  status: string;
  mode: string;
  updatedAt: string;
  estimatedDelivery: string | null;
  addresses: Address[];
  events: ShipmentEvent[];
};

type CustomerQuote = {
  id: string;
  quoteNumber: string;
  status: string;
  mode: string;
  destinationCountryCode: string;
  destinationCity: string;
  currency: string;
  totalAmount: string;
  validUntil: string;
  createdAt: string;
};

type CustomerQuoteRequest = {
  id: string;
  requestNumber: string;
  mode: string;
  destinationCountryCode: string;
  destinationCity: string;
  status: string;
  createdAt: string;
};

type QuoteAcceptance = {
  message: string;
  trackingReference: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value: string) {
  if (["DELIVERED", "CUSTOMS_CLEARED", "APPROVED"].includes(value))
    return "good";
  if (
    ["CUSTOMS_PROCESSING", "HELD_FOR_INSPECTION", "PENDING_REVIEW"].includes(
      value,
    )
  )
    return "attention";
  return "moving";
}

function formatMoney(amount: string, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function StateRow({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns: number;
}) {
  return (
    <tr>
      <td className="customer-state-cell" colSpan={columns}>
        {children}
      </td>
    </tr>
  );
}

export default function CustomerDashboard({
  onOpenQuote,
}: {
  onOpenQuote: () => void;
}) {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedShipment, setExpandedShipment] = useState<string | null>(null);
  const [reviewingQuote, setReviewingQuote] = useState<CustomerQuote | null>(
    null,
  );
  const [acceptance, setAcceptance] = useState<QuoteAcceptance | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const quoteDialogRef = useModalFocus<HTMLElement>(
    () => {
      if (!accepting) setReviewingQuote(null);
    },
    reviewingQuote !== null,
  );

  const shipmentsQuery = useQuery({
    queryKey: ["customer", user?.id, "shipments"],
    enabled: Boolean(user),
    queryFn: () => apiRequest<CustomerShipment[]>("/shipments/me"),
  });
  const quotesQuery = useQuery({
    queryKey: ["customer", user?.id, "quotes"],
    enabled: Boolean(user),
    queryFn: () => apiRequest<CustomerQuote[]>("/quotes/me"),
  });
  const quoteRequestsQuery = useQuery({
    queryKey: ["customer", user?.id, "quote-requests"],
    enabled: Boolean(user),
    queryFn: () => apiRequest<CustomerQuoteRequest[]>("/quote-requests/me"),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const intent = params.get("intent");
    if (intent === "quote") {
      onOpenQuote();
      navigate(location.pathname, { replace: true });
      return;
    }
    if (intent !== "review-quote" || quotesQuery.isLoading) return;

    const quoteId = params.get("quoteId");
    const quote = quotesQuery.data?.find((item) => item.id === quoteId);
    if (quote) openQuote(quote);
    else setReviewError("That quotation is no longer available to review.");
    navigate(location.pathname, { replace: true });
  }, [
    location.pathname,
    location.search,
    navigate,
    onOpenQuote,
    quotesQuery.data,
    quotesQuery.isLoading,
  ]);

  useEffect(() => {
    const failedSession = [
      shipmentsQuery.error,
      quotesQuery.error,
      quoteRequestsQuery.error,
    ].some((error) => error instanceof ApiError && error.status === 401);
    if (failedSession) void refreshUser().catch(() => undefined);
  }, [
    quoteRequestsQuery.error,
    quotesQuery.error,
    refreshUser,
    shipmentsQuery.error,
  ]);

  async function signOut() {
    try {
      await logout();
    } finally {
      queryClient.clear();
      navigate("/", { replace: true });
    }
  }

  function openQuote(quote: CustomerQuote) {
    setReviewingQuote(quote);
    setAcceptance(null);
    setReviewError("");
  }

  async function acceptQuote() {
    if (!reviewingQuote) return;
    setAccepting(true);
    setReviewError("");
    try {
      const result = await apiRequest<QuoteAcceptance>(
        `/quotes/${encodeURIComponent(reviewingQuote.id)}/accept`,
        { method: "POST" },
      );
      setAcceptance(result);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customer", user?.id, "quotes"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customer", user?.id, "shipments"],
        }),
      ]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try {
          const currentUser = await refreshUser();
          if (!currentUser) {
            navigate(
              `/dashboard?intent=review-quote&quoteId=${encodeURIComponent(reviewingQuote.id)}`,
              { replace: true },
            );
            return;
          }
        } catch {
          setReviewError("We couldn't check your session. Please try again.");
          return;
        }
      }
      setReviewError(
        error instanceof Error ? error.message : "Unable to accept this quote.",
      );
    } finally {
      setAccepting(false);
    }
  }

  const outstandingQuotes = (quotesQuery.data ?? []).filter(
    (quote) => quote.status === "QUOTED",
  );

  return (
    <div className="customer-dashboard">
      <header className="customer-dashboard-header">
        <div className="customer-dashboard-header-inner">
          <Brand href="/" />
          <nav aria-label="Customer account navigation">
            <a className="active" href="#dashboard-top">
              Overview
            </a>
            <a href="#active-shipments">Shipments</a>
            <a href="#outstanding-quotes">Quotes</a>
          </nav>
          <div className="customer-dashboard-user">
            <span>
              {user?.customer?.displayName || user?.email || "Customer"}
            </span>
            <button type="button" onClick={signOut} aria-label="Sign out">
              <LogOut size={16} /> <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="customer-dashboard-main" id="dashboard-top">
        <div className="customer-dashboard-actions">
          <div>
            <h1>Account overview</h1>
            <p>Shipments and quotations linked to your account.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenQuote}
          >
            Request a quote <ArrowRight size={16} />
          </button>
        </div>

        <div className="customer-dashboard-grid">
          <section
            className="customer-data-section"
            id="active-shipments"
            aria-labelledby="shipments-title"
          >
            <div className="customer-section-heading">
              <div className="customer-section-icon">
                <Truck size={19} />
              </div>
              <div>
                <h2 id="shipments-title">Active shipments</h2>
                <p>Recent movement and tracking updates</p>
              </div>
              <span className="customer-section-count">
                {shipmentsQuery.data ? shipmentsQuery.data.length : "—"}
              </span>
            </div>
            <div className="customer-desktop-table">
              <div className="customer-table-scroll">
                <table className="customer-data-table">
                  <thead>
                    <tr>
                      <th scope="col">Shipment</th>
                      <th scope="col">Route</th>
                      <th scope="col">Status</th>
                      <th scope="col">Updated</th>
                      <th scope="col">Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipmentsQuery.isLoading && (
                      <StateRow columns={5}>
                        <RefreshCw className="spin" size={17} /> Loading your
                        shipments…
                      </StateRow>
                    )}
                    {shipmentsQuery.isError && (
                      <StateRow columns={5}>
                        <span className="customer-data-error">
                          <CircleAlert size={17} />
                          {shipmentsQuery.error instanceof Error
                            ? shipmentsQuery.error.message
                            : API_ERROR_TEXT}
                          <button
                            type="button"
                            onClick={() => void shipmentsQuery.refetch()}
                          >
                            Retry
                          </button>
                        </span>
                      </StateRow>
                    )}
                    {shipmentsQuery.isSuccess &&
                      shipmentsQuery.data.length === 0 && (
                        <StateRow columns={5}>
                          <div className="customer-empty-state">
                            <PackageCheck size={22} />
                            <b>No active shipments yet</b>
                            <span>
                              Accepted quotes will appear here as shipments.
                            </span>
                          </div>
                        </StateRow>
                      )}
                    {shipmentsQuery.data?.map((shipment) => {
                      const origin = shipment.addresses.find(
                        (address) => address.kind === "ORIGIN",
                      );
                      const destination = shipment.addresses.find(
                        (address) => address.kind === "DESTINATION",
                      );
                      const isExpanded =
                        expandedShipment === shipment.shipmentNumber;
                      return (
                        <Fragment key={shipment.shipmentNumber}>
                          <tr>
                            <td>
                              <b className="customer-reference">
                                {shipment.shipmentNumber}
                              </b>
                              <span className="customer-subtext">
                                {formatStatus(shipment.mode)}
                              </span>
                            </td>
                            <td>
                              <span className="customer-route">
                                {origin
                                  ? `${origin.city}, ${origin.countryCode}`
                                  : "China"}
                                <span aria-hidden="true"> → </span>
                                {destination
                                  ? `${destination.city}, ${destination.countryCode}`
                                  : "Destination pending"}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`customer-status ${statusTone(shipment.status)}`}
                              >
                                {formatStatus(shipment.status)}
                              </span>
                            </td>
                            <td className="customer-date">
                              {formatDateTime(shipment.updatedAt)}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="customer-row-action"
                                aria-expanded={isExpanded}
                                onClick={() =>
                                  setExpandedShipment(
                                    isExpanded ? null : shipment.shipmentNumber,
                                  )
                                }
                              >
                                View tracking <ChevronDown size={14} />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="customer-event-row">
                              <td colSpan={5}>
                                {shipment.events.length ? (
                                  <ol className="customer-event-list">
                                    {shipment.events.map((event, index) => (
                                      <li key={`${event.occurredAt}-${index}`}>
                                        <span className="customer-event-dot" />
                                        <b>{formatStatus(event.status)}</b>
                                        <span>
                                          {event.locationLabel ||
                                            "Location not recorded"}
                                        </span>
                                        <time dateTime={event.occurredAt}>
                                          {formatDateTime(event.occurredAt)}
                                        </time>
                                      </li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p className="customer-subtext">
                                    No tracking updates have been recorded yet.
                                  </p>
                                )}
                                <small>
                                  The one-time tracking reference is not stored
                                  for later display.
                                </small>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="customer-mobile-record-list">
              {shipmentsQuery.isLoading && (
                <div className="customer-mobile-state">
                  <RefreshCw className="spin" size={17} /> Loading your
                  shipments…
                </div>
              )}
              {shipmentsQuery.isError && (
                <div className="customer-mobile-state customer-data-error">
                  <CircleAlert size={17} />
                  {shipmentsQuery.error instanceof Error
                    ? shipmentsQuery.error.message
                    : API_ERROR_TEXT}
                  <button
                    type="button"
                    onClick={() => void shipmentsQuery.refetch()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {shipmentsQuery.isSuccess && shipmentsQuery.data.length === 0 && (
                <div className="customer-mobile-state customer-empty-state">
                  <PackageCheck size={22} />
                  <b>No active shipments yet</b>
                  <span>Accepted quotes will appear here as shipments.</span>
                </div>
              )}
              {shipmentsQuery.data?.map((shipment) => {
                const origin = shipment.addresses.find(
                  (address) => address.kind === "ORIGIN",
                );
                const destination = shipment.addresses.find(
                  (address) => address.kind === "DESTINATION",
                );
                const isExpanded = expandedShipment === shipment.shipmentNumber;

                return (
                  <article
                    className="customer-mobile-record"
                    key={shipment.shipmentNumber}
                  >
                    <div className="customer-mobile-record-head">
                      <div>
                        <b className="customer-reference">
                          {shipment.shipmentNumber}
                        </b>
                        <span className="customer-subtext">
                          {formatStatus(shipment.mode)}
                        </span>
                      </div>
                      <span
                        className={`customer-status ${statusTone(shipment.status)}`}
                      >
                        {formatStatus(shipment.status)}
                      </span>
                    </div>
                    <div className="customer-mobile-record-route">
                      <span>Route</span>
                      <b>
                        {origin
                          ? `${origin.city}, ${origin.countryCode}`
                          : "China"}
                        <span aria-hidden="true"> → </span>
                        {destination
                          ? `${destination.city}, ${destination.countryCode}`
                          : "Destination pending"}
                      </b>
                    </div>
                    <div className="customer-mobile-record-meta">
                      <span>Updated</span>
                      <time dateTime={shipment.updatedAt}>
                        {formatDateTime(shipment.updatedAt)}
                      </time>
                    </div>
                    <button
                      type="button"
                      className="customer-mobile-track-action"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedShipment(
                          isExpanded ? null : shipment.shipmentNumber,
                        )
                      }
                    >
                      {isExpanded ? "Hide updates" : "View tracking updates"}
                      <ChevronDown size={15} />
                    </button>
                    {isExpanded && (
                      <div className="customer-mobile-events">
                        {shipment.events.length ? (
                          <ol className="customer-event-list">
                            {shipment.events.map((event, index) => (
                              <li key={`${event.occurredAt}-${index}`}>
                                <span className="customer-event-dot" />
                                <b>{formatStatus(event.status)}</b>
                                <span>
                                  {event.locationLabel ||
                                    "Location not recorded"}
                                </span>
                                <time dateTime={event.occurredAt}>
                                  {formatDateTime(event.occurredAt)}
                                </time>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <span>
                            No tracking updates have been recorded yet.
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {quoteRequestsQuery.data && quoteRequestsQuery.data.length > 0 && (
              <div className="customer-request-queue">
                <h3>Requests with our team</h3>
                {quoteRequestsQuery.data.slice(0, 3).map((request) => (
                  <div className="customer-request-row" key={request.id}>
                    <span>
                      <b>{request.requestNumber}</b>
                      <small>
                        {formatStatus(request.mode)} · {request.destinationCity}
                        , {request.destinationCountryCode}
                      </small>
                    </span>
                    <span className="customer-status attention">
                      {request.status === "SENDING"
                        ? "Sending to you"
                        : request.status === "PROCESSING"
                          ? "Being calculated"
                          : "Request received"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className="customer-data-section"
            id="outstanding-quotes"
            aria-labelledby="quotes-title"
          >
            <div className="customer-section-heading">
              <div className="customer-section-icon quote">
                <FileText size={18} />
              </div>
              <div>
                <h2 id="quotes-title">Outstanding quotes</h2>
                <p>Current quotations awaiting your review</p>
              </div>
              <span className="customer-section-count">
                {quotesQuery.data ? outstandingQuotes.length : "—"}
              </span>
            </div>
            <div className="customer-desktop-table">
              <div className="customer-table-scroll">
                <table className="customer-data-table customer-quotes-table">
                  <thead>
                    <tr>
                      <th scope="col">Quote</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Expires</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotesQuery.isLoading && (
                      <StateRow columns={4}>
                        <RefreshCw className="spin" size={17} /> Loading your
                        quotes…
                      </StateRow>
                    )}
                    {quotesQuery.isError && (
                      <StateRow columns={4}>
                        <span className="customer-data-error">
                          <CircleAlert size={17} />
                          {quotesQuery.error instanceof Error
                            ? quotesQuery.error.message
                            : API_ERROR_TEXT}
                          <button
                            type="button"
                            onClick={() => void quotesQuery.refetch()}
                          >
                            Retry
                          </button>
                        </span>
                      </StateRow>
                    )}
                    {quotesQuery.isSuccess &&
                      outstandingQuotes.length === 0 && (
                        <StateRow columns={4}>
                          <div className="customer-empty-state">
                            <FileText size={21} />
                            <b>No quotes awaiting review</b>
                            <span>
                              New quotations will appear here with their price
                              and expiry.
                            </span>
                            <button type="button" onClick={onOpenQuote}>
                              Request a quote
                            </button>
                          </div>
                        </StateRow>
                      )}
                    {outstandingQuotes.map((quote) => (
                      <tr key={quote.id}>
                        <td>
                          <b className="customer-reference">
                            {quote.quoteNumber}
                          </b>
                          <span className="customer-subtext">
                            {formatStatus(quote.mode)} · {quote.destinationCity}
                            , {quote.destinationCountryCode}
                          </span>
                        </td>
                        <td className="customer-money">
                          {formatMoney(quote.totalAmount, quote.currency)}
                        </td>
                        <td className="customer-date">
                          {formatDate(quote.validUntil)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="customer-row-action review"
                            onClick={() => openQuote(quote)}
                          >
                            Review <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="customer-mobile-record-list">
              {quotesQuery.isLoading && (
                <div className="customer-mobile-state">
                  <RefreshCw className="spin" size={17} /> Loading your quotes…
                </div>
              )}
              {quotesQuery.isError && (
                <div className="customer-mobile-state customer-data-error">
                  <CircleAlert size={17} />
                  {quotesQuery.error instanceof Error
                    ? quotesQuery.error.message
                    : API_ERROR_TEXT}
                  <button
                    type="button"
                    onClick={() => void quotesQuery.refetch()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {quotesQuery.isSuccess && outstandingQuotes.length === 0 && (
                <div className="customer-mobile-state customer-empty-state">
                  <FileText size={21} />
                  <b>No quotes awaiting review</b>
                  <span>
                    New quotations will appear here with their price and expiry.
                  </span>
                  <button type="button" onClick={onOpenQuote}>
                    Request a quote
                  </button>
                </div>
              )}
              {outstandingQuotes.map((quote) => (
                <article className="customer-mobile-record" key={quote.id}>
                  <div className="customer-mobile-record-head">
                    <div>
                      <b className="customer-reference">{quote.quoteNumber}</b>
                      <span className="customer-subtext">
                        {formatStatus(quote.mode)} · {quote.destinationCity},{" "}
                        {quote.destinationCountryCode}
                      </span>
                    </div>
                    <b className="customer-money">
                      {formatMoney(quote.totalAmount, quote.currency)}
                    </b>
                  </div>
                  <div className="customer-mobile-record-meta">
                    <span>Expires</span>
                    <time dateTime={quote.validUntil}>
                      {formatDate(quote.validUntil)}
                    </time>
                  </div>
                  <button
                    type="button"
                    className="customer-mobile-track-action"
                    onClick={() => openQuote(quote)}
                  >
                    Review quotation <ArrowRight size={14} />
                  </button>
                </article>
              ))}
            </div>
            {quoteRequestsQuery.data && quoteRequestsQuery.data.length > 0 && (
              <div className="customer-request-queue customer-request-queue-mobile">
                <h3>Requests with our team</h3>
                {quoteRequestsQuery.data.slice(0, 3).map((request) => (
                  <div className="customer-request-row" key={request.id}>
                    <span>
                      <b>{request.requestNumber}</b>
                      <small>
                        {formatStatus(request.mode)} · {request.destinationCity}
                        , {request.destinationCountryCode}
                      </small>
                    </span>
                    <span className="customer-status attention">
                      {request.status === "SENDING"
                        ? "Sending to you"
                        : request.status === "PROCESSING"
                          ? "Being calculated"
                          : "Request received"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {reviewingQuote && (
        <div
          className="customer-quote-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !accepting)
              setReviewingQuote(null);
          }}
        >
          <section
            ref={quoteDialogRef}
            className="customer-quote-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-review-title"
            tabIndex={-1}
          >
            <button
              type="button"
              className="customer-quote-close"
              aria-label="Close quote review"
              onClick={() => setReviewingQuote(null)}
            >
              <X size={19} />
            </button>
            <span className="section-kicker">QUOTE REVIEW</span>
            <h2 id="quote-review-title">
              {acceptance ? "Quote accepted" : "Review quotation"}
            </h2>
            <p className="customer-reference">{reviewingQuote.quoteNumber}</p>
            <dl className="customer-quote-details">
              <div>
                <dt>Destination</dt>
                <dd>
                  {reviewingQuote.destinationCity},{" "}
                  {reviewingQuote.destinationCountryCode}
                </dd>
              </div>
              <div>
                <dt>Shipping method</dt>
                <dd>{formatStatus(reviewingQuote.mode)}</dd>
              </div>
              <div>
                <dt>Quoted total</dt>
                <dd>
                  {formatMoney(
                    reviewingQuote.totalAmount,
                    reviewingQuote.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Valid until</dt>
                <dd>{formatDate(reviewingQuote.validUntil)}</dd>
              </div>
            </dl>
            {acceptance ? (
              <div className="customer-quote-accepted" role="status">
                <CheckCircle2 size={20} />
                <p>{acceptance.message}</p>
                {acceptance.trackingReference && (
                  <div className="customer-tracking-reveal">
                    <b>Save this tracking reference now</b>
                    <code>{acceptance.trackingReference}</code>
                    <small>
                      It will not be shown again after you close this window.
                    </small>
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setReviewingQuote(null)}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="customer-quote-note">
                  Accepting creates a shipment for this account. The tracking
                  reference is displayed once after acceptance.
                </p>
                {reviewError && (
                  <p className="customer-dashboard-error" role="alert">
                    {reviewError}
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-primary customer-accept-quote"
                  disabled={accepting}
                  onClick={() => void acceptQuote()}
                >
                  {accepting ? (
                    <>
                      <RefreshCw className="spin" size={15} /> Accepting…
                    </>
                  ) : (
                    "Accept quotation and create shipment"
                  )}
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
