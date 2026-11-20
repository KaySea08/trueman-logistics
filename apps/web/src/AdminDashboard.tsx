import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  EyeOff,
  LogOut,
  LockKeyhole,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import Brand from "./components/Brand";
import AdminQuoteRequests from "./components/AdminQuoteRequests";
import AdminStaffDirectory from "./components/AdminStaffDirectory";
import AdminDepartments from "./components/AdminDepartments";
import AdminAccountSecurity from "./components/AdminAccountSecurity";
import { AdminAssignments, AdminAuditHistory, AdminConfiguration, AdminRoleManager, AdminSessions } from "./components/AdminGovernance";
import { apiFetch } from "./api/client";
import "./admin.css";

type Summary = {
  total: number;
  pendingReview: number;
  active: number;
  inTransit: number;
  deliveredLast30Days: number;
  delayed: number;
  submittedToday: number;
};
type ShipmentRow = {
  id: string;
  shipmentNumber: string;
  status: string;
  reviewStatus: string;
  creationSource: string;
  submitterRole: string | null;
  submittedAt: string;
  quote?: { destinationCountryCode: string; destinationCity: string } | null;
  customer: {
    displayName: string;
    user: { email: string | null; phone: string | null };
  };
  createdBy: {
    email: string | null;
    staff: { fullName: string; employeeCode: string } | null;
  } | null;
  assignments: {
    staff: { id: string; fullName: string; employeeCode: string };
  }[];
};
type Staff = { id: string; fullName: string; employeeCode: string };
type Detail = ShipmentRow & {
  packages: {
    id: string;
    description: string;
    quantity: number;
    weightKg: string;
  }[];
  addresses: {
    id: string;
    kind: string;
    contactName: string;
    contactPhone: string;
    countryCode: string;
    city: string;
    addressLine: string;
  }[];
  events: {
    id: string;
    previousStatus: string | null;
    status: string;
    locationLabel: string | null;
    notes: string | null;
    source: string;
    actorUserId: string | null;
    occurredAt: string;
  }[];
  quote: {
    quoteNumber: string;
    currency: string;
    totalAmount: string;
    validUntil: string;
    destinationCountryCode: string;
    destinationCity: string;
  } | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdByUserId: string | null;
};
type ActivityItem = {
  id: string;
  action: string;
  occurredAt: string;
  shipment: { id: string; shipmentNumber: string } | null;
  actor: {
    email: string | null;
    staff: { fullName: string; employeeCode: string } | null;
  } | null;
};
type StaffSession = {
  permissions: string[];
  roles: string[];
  mustChangePassword: boolean;
};

type AdminTab =
  | "shipments"
  | "quotes"
  | "activity"
  | "staff"
  | "departments"
  | "assignments"
  | "roles"
  | "sessions"
  | "audit"
  | "configuration"
  | "account";

const shipmentStatuses = [
  "ORDER_RECEIVED",
  "ORDER_CONFIRMED",
  "AWAITING_PICKUP",
  "PICKED_UP",
  "ORIGIN_FACILITY",
  "EXPORT_PROCESSING",
  "DEPARTED_ORIGIN",
  "IN_TRANSIT",
  "ARRIVED_DESTINATION",
  "CUSTOMS_PROCESSING",
  "CUSTOMS_CLEARED",
  "DESTINATION_FACILITY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "HELD_FOR_INSPECTION",
  "RETURNED_TO_SENDER",
  "CANCELLED",
];

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;
    throw new Error(message ?? `Request failed (${response.status}).`);
  }
  return data as T;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function human(value?: string | null) {
  return (value ?? "Unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (x) => x.toUpperCase());
}
function statusClass(value: string) {
  if (["APPROVED", "DELIVERED", "CUSTOMS_CLEARED"].includes(value))
    return "good";
  if (["REJECTED", "CANCELLED", "DELIVERY_FAILED"].includes(value))
    return "bad";
  if (
    ["PENDING_REVIEW", "NEEDS_CORRECTION", "HELD_FOR_INSPECTION"].includes(
      value,
    )
  )
    return "warn";
  return "neutral";
}

export default function AdminDashboard() {
  const [mode, setMode] = useState<
    "checking" | "login" | "verify" | "mfa" | "setup" | "dashboard"
  >("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState("PENDING_REVIEW");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [selected, setSelected] = useState<Detail | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [eventStatus, setEventStatus] = useState("ORDER_CONFIRMED");
  const [eventLocation, setEventLocation] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [tab, setTab] = useState<AdminTab>("shipments");
  const [refreshing, setRefreshing] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loginNotice, setLoginNotice] = useState("");
  const canAccessOperations =
    !mustChangePassword && permissions.includes("shipments:manage");
  const canAccessQuotes =
    !mustChangePassword &&
    (permissions.includes("quotes:manage") ||
      permissions.includes("rates:manage"));
  const canManageAllQuotes = permissions.includes("rates:manage");
  const canManageStaff =
    !mustChangePassword && permissions.includes("staff:manage");
  const canManageDepartments =
    !mustChangePassword && permissions.includes("system:manage");
  const canManageRoles = !mustChangePassword && permissions.includes("roles:manage");
  const canManageSessions = !mustChangePassword && permissions.includes("sessions:manage");
  const canReadAudit = !mustChangePassword && permissions.includes("audit:read");

  const navigationGroup =
    tab === "shipments" || tab === "activity" || tab === "assignments"
      ? "operations"
      : tab === "quotes"
        ? "quotes"
        : tab === "staff" || tab === "departments" || tab === "roles"
          ? "people"
          : "security";
  const openNavigationGroup = (group: "operations" | "quotes" | "people" | "security") => {
    if (group === "operations") setTab("shipments");
    else if (group === "quotes") setTab("quotes");
    else if (group === "people") {
      setTab(canManageStaff ? "staff" : canManageDepartments ? "departments" : "roles");
    } else setTab(canManageSessions ? "sessions" : canReadAudit ? "audit" : canManageDepartments ? "configuration" : "account");
  };
  const sectionTabs: { value: AdminTab; label: string }[] =
    navigationGroup === "operations"
      ? [
          { value: "shipments", label: "Shipments" },
          { value: "activity", label: "Staff activity" },
          { value: "assignments", label: "Assignments & workload" },
        ]
      : navigationGroup === "people"
        ? [
            ...(canManageStaff ? [{ value: "staff" as const, label: "Staff directory" }] : []),
            ...(canManageDepartments ? [{ value: "departments" as const, label: "Departments" }] : []),
            ...(canManageRoles ? [{ value: "roles" as const, label: "Roles & permissions" }] : []),
          ]
        : navigationGroup === "security"
          ? [
              ...(canManageSessions ? [{ value: "sessions" as const, label: "Sessions & devices" }] : []),
              ...(canReadAudit ? [{ value: "audit" as const, label: "Audit history" }] : []),
              ...(canManageDepartments ? [{ value: "configuration" as const, label: "System configuration" }] : []),
              { value: "account", label: "Account security" },
            ]
          : [];

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search.trim()) params.set("search", search.trim());
    if (reviewFilter) params.set("reviewStatus", reviewFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("creationSource", sourceFilter);
    return params.toString();
  }, [search, reviewFilter, statusFilter, sourceFilter]);

  const loadDashboard = useCallback(async () => {
    if (!permissions.includes("shipments:manage")) return;
    setRefreshing(true);
    try {
      const [stats, rows, people, actions] = await Promise.all([
        api<Summary>("/admin/operations/summary"),
        api<{ items: ShipmentRow[] }>(`/admin/operations/shipments?${query}`),
        api<Staff[]>("/admin/operations/staff"),
        api<ActivityItem[]>("/admin/operations/activity"),
      ]);
      setSummary(stats);
      setShipments(rows.items);
      setStaff(people);
      setActivity(actions);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Could not load the operations dashboard.";
      if (
        message.includes("Authentication") ||
        message.includes("Session") ||
        message.includes("permission")
      )
        setMode("login");
      setError(message);
    } finally {
      setRefreshing(false);
    }
  }, [permissions, query]);

  function applySession(session: StaffSession) {
    const nextPermissions = session.permissions ?? [];
    const nextRoles = session.roles ?? [];
    if (!nextRoles.some((role) => role !== "CUSTOMER")) {
      setError("A staff account is required.");
      setMode("login");
      return;
    }
    const hasOperations = nextPermissions.includes("shipments:manage");
    const hasQuotes =
      nextPermissions.includes("quotes:manage") ||
      nextPermissions.includes("rates:manage");
    const hasStaff = nextPermissions.includes("staff:manage");
    const hasDepartments = nextPermissions.includes("system:manage");
    setPermissions(nextPermissions);
    setRoles(nextRoles);
    setMustChangePassword(Boolean(session.mustChangePassword));
    setTab(
      session.mustChangePassword
        ? "account"
        : hasOperations
          ? "shipments"
          : hasQuotes
            ? "quotes"
            : hasStaff
              ? "staff"
              : hasDepartments
                ? "departments"
                : "account",
    );
    setMode("dashboard");
  }

  async function enterWorkspace() {
    applySession(await api<StaffSession>("/auth/me"));
  }

  useEffect(() => {
    let active = true;
    api<StaffSession>("/auth/me")
      .then((session) => {
        if (!active) return;
        applySession(session);
      })
      .catch(() => {
        if (active) setMode("login");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mode === "dashboard" && canAccessOperations) void loadDashboard();
  }, [canAccessOperations, mode, loadDashboard]);

  async function beginStaffSetup() {
    const setup = await api<{ qrCodeDataUrl: string; recoveryCodes: string[] }>(
      "/auth/mfa/setup",
      { method: "POST" },
    );
    setQrCode(setup.qrCodeDataUrl);
    setRecoveryCodes(setup.recoveryCodes);
    setMode("setup");
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setLoginNotice("");
    try {
      const result = await api<{
        user?: { roles: string[] };
        mfaRequired?: boolean;
        challenge?: string;
        mfaSetupRequired?: boolean;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setPassword("");
      if (result.mfaRequired && result.challenge) {
        setChallenge(result.challenge);
        setMode("mfa");
      } else if (result.mfaSetupRequired) await beginStaffSetup();
      else await enterWorkspace();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setLoginNotice("");
    try {
      const result = await api<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setCode("");
      setMode("login");
      setLoginNotice(result.message);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not verify your email.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>(
        "/auth/resend-verification",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setLoginNotice(result.message);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not request a verification code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/mfa/login", {
        method: "POST",
        body: JSON.stringify({ challenge, code }),
      });
      await enterWorkspace();
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "MFA verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function enableMfa(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      await enterWorkspace();
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function openShipment(id: string) {
    setError("");
    try {
      const detail = await api<Detail>(
        `/admin/operations/shipments/${encodeURIComponent(id)}`,
      );
      setSelected(detail);
      setReviewNote(detail.reviewNote ?? "");
      setAssignmentId(detail.assignments.find((x) => x.staff)?.staff.id ?? "");
      const suggested: Record<string, string> = {
        ORDER_RECEIVED: "ORDER_CONFIRMED",
        ORDER_CONFIRMED: "AWAITING_PICKUP",
        AWAITING_PICKUP: "PICKED_UP",
        PICKED_UP: "ORIGIN_FACILITY",
        ORIGIN_FACILITY: "EXPORT_PROCESSING",
        EXPORT_PROCESSING: "DEPARTED_ORIGIN",
        DEPARTED_ORIGIN: "IN_TRANSIT",
        IN_TRANSIT: "ARRIVED_DESTINATION",
        ARRIVED_DESTINATION: "CUSTOMS_PROCESSING",
        CUSTOMS_PROCESSING: "CUSTOMS_CLEARED",
        CUSTOMS_CLEARED: "DESTINATION_FACILITY",
        DESTINATION_FACILITY: "OUT_FOR_DELIVERY",
        OUT_FOR_DELIVERY: "DELIVERED",
        DELIVERY_FAILED: "OUT_FOR_DELIVERY",
      };
      setEventStatus(suggested[detail.status] ?? "HELD_FOR_INSPECTION");
      setEventLocation("");
      setEventNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open shipment.");
    }
  }

  async function review(action: "APPROVE" | "REJECT" | "REQUEST_CORRECTION") {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/admin/operations/shipments/${encodeURIComponent(selected.id)}/review`,
        {
          method: "POST",
          body: JSON.stringify({ action, reviewNote: reviewNote || undefined }),
        },
      );
      await openShipment(selected.id);
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!selected || !assignmentId) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/admin/operations/shipments/${encodeURIComponent(selected.id)}/assign`,
        {
          method: "POST",
          body: JSON.stringify({ staffId: assignmentId, reason: assignmentReason.trim() || undefined }),
        },
      );
      await openShipment(selected.id);
      setAssignmentReason("");
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function appendEvent(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/admin/operations/shipments/${encodeURIComponent(selected.id)}/events`,
        {
          method: "POST",
          body: JSON.stringify({
            status: eventStatus,
            locationLabel: eventLocation || undefined,
            notes: eventNote || undefined,
          }),
        },
      );
      await openShipment(selected.id);
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tracking update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* local view is cleared regardless */
    }
    setSelected(null);
    setSummary(null);
    setPermissions([]);
    setRoles([]);
    setMustChangePassword(false);
    setMode("login");
  }

  if (mode === "checking")
    return (
      <div className="admin-screen">
        <div className="admin-loading">
          <RefreshCw className="spin" size={22} /> Checking secure staff
          session…
        </div>
      </div>
    );

  if (
    mode === "login" ||
    mode === "verify" ||
    mode === "mfa" ||
    mode === "setup"
  ) {
    return (
      <div className="admin-screen">
        <div className="admin-auth-card">
          <a className="admin-back-link" href="/">
            <ArrowLeft size={15} /> Back to public website
          </a>
          <div className="admin-auth-logo">
            <Brand href="/" />
          </div>
          <span className="admin-eyebrow">
            TRUEMAN LOGISTICS · STAFF ACCESS
          </span>
          <h1>
            {mode === "login"
              ? "Staff portal"
              : mode === "verify"
                ? "Verify staff email"
                : mode === "mfa"
                  ? "Verify your identity"
                  : "Secure your staff account"}
          </h1>
          <p className="admin-auth-copy">
            {mode === "login"
              ? "Sign in with your authorised staff account. Access is controlled by your assigned permissions."
              : mode === "verify"
                ? "Enter the verification code sent to your email."
                : mode === "mfa"
                  ? "Enter the current authenticator code to continue."
                  : "Scan the QR code with an authenticator app, save your recovery codes, then verify the setup."}
          </p>
          {mode === "login" && (
            <form className="admin-form" onSubmit={login}>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="admin-password-group" htmlFor="admin-password">
                Password
                <span className="admin-password-field">
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="admin-password-toggle"
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
              <button className="admin-primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in securely"}
              </button>
              <button
                type="button"
                className="admin-secondary"
                onClick={() => {
                  setError("");
                  setLoginNotice("");
                  setMode("verify");
                }}
              >
                Verify staff email
              </button>
            </form>
          )}
          {mode === "verify" && (
            <form className="admin-form" onSubmit={verifyEmail}>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <button className="admin-primary" disabled={busy}>
                {busy ? "Verifying..." : "Verify email"}
              </button>
              <button
                type="button"
                className="admin-secondary"
                disabled={busy}
                onClick={() => void resendVerification()}
              >
                Resend verification code
              </button>
              <button
                type="button"
                className="admin-secondary"
                onClick={() => {
                  setError("");
                  setLoginNotice("");
                  setMode("login");
                }}
              >
                Back to sign in
              </button>
            </form>
          )}
          {mode === "mfa" && (
            <form className="admin-form" onSubmit={verifyMfa}>
              <label>
                Authenticator or recovery code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={10}
                />
              </label>
              <button className="admin-primary" disabled={busy}>
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
            </form>
          )}
          {mode === "setup" && (
            <form className="admin-form" onSubmit={enableMfa}>
              {qrCode && (
                <img
                  className="admin-qr"
                  src={qrCode}
                  alt="Staff authenticator setup QR code"
                />
              )}
              <div className="admin-recovery">
                <b>Recovery codes — save these securely</b>
                <code>{recoveryCodes.join(" · ")}</code>
              </div>
              <label>
                Six-digit authenticator code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className="admin-primary" disabled={busy}>
                {busy ? "Enabling…" : "Enable MFA and enter dashboard"}
              </button>
            </form>
          )}
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          {(mode === "login" || mode === "verify") && loginNotice && (
            <p role="status">{loginNotice}</p>
          )}
          <div className="admin-auth-foot">
            <ShieldCheck size={15} /> Protected staff access · Activity is
            audited
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a href="/" className="admin-side-brand">
          <span>
            <ShieldCheck size={22} />
          </span>
          <b>
            TRUEMAN<small>LOGISTICS</small>
          </b>
        </a>
        <div className="admin-side-label">WORKSPACE</div>
        <nav className="admin-side-nav" aria-label="Admin sections">
          {canAccessOperations && (
            <button className={navigationGroup === "operations" ? "active" : ""} aria-current={navigationGroup === "operations" ? "page" : undefined} onClick={() => openNavigationGroup("operations")}>
              <ClipboardList size={17} /> Operations
            </button>
          )}
          {canAccessQuotes && (
            <button className={navigationGroup === "quotes" ? "active" : ""} aria-current={navigationGroup === "quotes" ? "page" : undefined} onClick={() => openNavigationGroup("quotes")}>
              <Package size={17} /> Quote requests
            </button>
          )}
          {(canManageStaff || canManageDepartments || canManageRoles) && (
            <button className={navigationGroup === "people" ? "active" : ""} aria-current={navigationGroup === "people" ? "page" : undefined} onClick={() => openNavigationGroup("people")}>
              <Users size={17} /> Staff &amp; access
            </button>
          )}
          <button className={navigationGroup === "security" ? "active" : ""} aria-current={navigationGroup === "security" ? "page" : undefined} onClick={() => openNavigationGroup("security")}>
            <LockKeyhole size={17} /> Security &amp; settings
          </button>
        </nav>
        <div className="admin-side-bottom">
          <div className="admin-secure-state">
            <span /> Secure session active
          </div>
          <button className="admin-signout-button" onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
          <a href="/">← Public website</a>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">
              CHINA ORIGIN · GLOBAL OPERATIONS
            </span>
            <h1>
              {tab === "shipments"
                ? "Shipment Operations Centre"
                : tab === "quotes"
                  ? "Customer quote requests"
                  : tab === "staff"
                    ? "Staff directory"
                    : tab === "departments"
                      ? "Departments"
                      : tab === "account"
                        ? "Account security"
                        : tab === "roles"
                          ? "Roles & permissions"
                          : tab === "assignments"
                            ? "Assignments & workload"
                          : tab === "sessions"
                            ? "Sessions & devices"
                            : tab === "audit"
                                ? "Audit history"
                                : tab === "configuration"
                                  ? "System configuration"
                        : "Staff activity"}
            </h1>
          </div>
          {(tab === "shipments" || tab === "activity") && (
            <button
              className="admin-refresh"
              onClick={() => void loadDashboard()}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
          )}
        </header>
        {error && (
          <div className="admin-banner-error">
            <AlertTriangle size={17} />
            {error}
            <button onClick={() => setError("")}>
              <XCircle size={16} />
            </button>
          </div>
        )}
        {sectionTabs.length > 1 && (
          <nav className="admin-section-tabs" aria-label="Workspace pages">
            {sectionTabs.map((item) => (
              <button
                key={item.value}
                type="button"
                className={tab === item.value ? "active" : ""}
                aria-current={tab === item.value ? "page" : undefined}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
        {summary && (tab === "shipments" || tab === "activity") && (
          <section className="admin-stat-grid">
            <article>
              <span>
                <Package size={18} />
              </span>
              <small>Total shipments</small>
              <b>{summary.total.toLocaleString()}</b>
            </article>
            <article className="attention">
              <span>
                <Clock3 size={18} />
              </span>
              <small>Awaiting review</small>
              <b>{summary.pendingReview.toLocaleString()}</b>
            </article>
            <article>
              <span>
                <Truck size={18} />
              </span>
              <small>Active shipments</small>
              <b>{summary.active.toLocaleString()}</b>
            </article>
            <article>
              <span>
                <Activity size={18} />
              </span>
              <small>In transit</small>
              <b>{summary.inTransit.toLocaleString()}</b>
            </article>
            <article>
              <span>
                <CheckCircle2 size={18} />
              </span>
              <small>Delivered · 30 days</small>
              <b>{summary.deliveredLast30Days.toLocaleString()}</b>
            </article>
            <article className={summary.delayed ? "attention" : ""}>
              <span>
                <AlertTriangle size={18} />
              </span>
              <small>Past ETA</small>
              <b>{summary.delayed.toLocaleString()}</b>
            </article>
          </section>
        )}
        {tab === "shipments" ? (
          <>
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Shipment register</h2>
                  <p>
                    Customer and staff submissions, with original submitter
                    attribution.
                  </p>
                </div>
                <span className="admin-result-count">
                  {shipments.length} shown
                </span>
              </div>
              <div className="admin-filters">
                <label className="admin-search">
                  <Search size={16} />
                  <input
                    placeholder="Search shipment, customer or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Review status"
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value)}
                >
                  <option value="">All review states</option>
                  <option value="PENDING_REVIEW">Pending review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="NEEDS_CORRECTION">Needs correction</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select
                  aria-label="Shipment status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All shipment statuses</option>
                  {shipmentStatuses.map((x) => (
                    <option key={x} value={x}>
                      {human(x)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Submission source"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="">All submitters</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="STAFF">Staff</option>
                  <option value="SYSTEM">System</option>
                </select>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Shipment</th>
                      <th>Customer</th>
                      <th>Submitted by</th>
                      <th>Source / role</th>
                      <th>Review</th>
                      <th>Shipment status</th>
                      <th>Submitted</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <b>{row.shipmentNumber}</b>
                          <small>
                            {row.quote?.destinationCity
                              ? `${row.quote.destinationCity}, ${row.quote.destinationCountryCode}`
                              : "China origin"}
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
                          {row.createdBy?.staff?.fullName ??
                            row.createdBy?.email ??
                            "Historical / unavailable"}
                          <small>
                            {row.createdBy?.staff?.employeeCode ??
                              row.createdBy?.email ??
                              "Attribution not recorded"}
                          </small>
                        </td>
                        <td>
                          <b>{human(row.creationSource)}</b>
                          <small>{human(row.submitterRole)}</small>
                        </td>
                        <td>
                          <span
                            className={`admin-pill ${statusClass(row.reviewStatus)}`}
                          >
                            {human(row.reviewStatus)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`admin-pill ${statusClass(row.status)}`}
                          >
                            {human(row.status)}
                          </span>
                        </td>
                        <td>{formatDate(row.submittedAt)}</td>
                        <td>
                          <button
                            className="admin-row-action"
                            onClick={() => void openShipment(row.id)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!shipments.length && (
                      <tr>
                        <td colSpan={8} className="admin-empty">
                          No shipments match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <div className="admin-secondary-stats">
              <span>
                <b>{summary?.submittedToday ?? 0}</b> submitted today
              </span>
              <span>
                <b>{staff.length}</b> active staff profiles
              </span>
            </div>
          </>
        ) : tab === "quotes" ? (
          <AdminQuoteRequests canManageAll={canManageAllQuotes} />
        ) : tab === "staff" ? (
          <AdminStaffDirectory
            canCreate={roles.includes("SUPER_ADMINISTRATOR")}
          />
        ) : tab === "departments" ? (
          <AdminDepartments />
        ) : tab === "roles" ? (
          <AdminRoleManager />
        ) : tab === "assignments" ? (
          <AdminAssignments />
        ) : tab === "sessions" ? (
          <AdminSessions />
        ) : tab === "audit" ? (
          <AdminAuditHistory />
        ) : tab === "configuration" ? (
          <AdminConfiguration />
        ) : tab === "account" ? (
          <AdminAccountSecurity
            required={mustChangePassword}
            onChanged={() => {
              setPermissions([]);
              setRoles([]);
              setMustChangePassword(false);
              setPassword("");
              setLoginNotice("Password changed. Sign in again.");
              setMode("login");
            }}
          />
        ) : (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>Recent operational activity</h2>
                <p>Shipment events recorded by authenticated staff accounts.</p>
              </div>
            </div>
            <div className="admin-activity-list">
              {activity.map((item) => (
                <article key={item.id}>
                  <span className="admin-activity-icon">
                    <Activity size={17} />
                  </span>
                  <div>
                    <b>
                      {human(item.action)}
                      {item.shipment
                        ? ` · ${item.shipment.shipmentNumber}`
                        : ""}
                    </b>
                    <p>
                      Recorded by{" "}
                      {item.actor?.staff?.fullName ??
                        item.actor?.email ??
                        "Staff account"}
                    </p>
                    <small>{formatDate(item.occurredAt)}</small>
                  </div>
                </article>
              ))}
              {!activity.length && (
                <p className="admin-empty">
                  No staff activity has been recorded yet.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
      {selected && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="admin-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shipment-detail-title"
          >
            <header>
              <div>
                <span className="admin-eyebrow">SHIPMENT RECORD</span>
                <h2 id="shipment-detail-title">{selected.shipmentNumber}</h2>
              </div>
              <button
                className="admin-icon-button"
                onClick={() => setSelected(null)}
                aria-label="Close shipment details"
              >
                <XCircle size={21} />
              </button>
            </header>
            <div className="admin-detail-scroll">
              <div className="admin-detail-grid">
                <div>
                  <small>Customer</small>
                  <b>{selected.customer.displayName}</b>
                  <span>
                    {selected.customer.user.email ??
                      selected.customer.user.phone}
                  </span>
                </div>
                <div>
                  <small>Submitted</small>
                  <b>{formatDate(selected.submittedAt)}</b>
                </div>
                <div>
                  <small>Original submitter</small>
                  <b>
                    {selected.createdBy?.staff?.fullName ??
                      selected.createdBy?.email ??
                      "Not recorded"}
                  </b>
                  <span>
                    {human(selected.submitterRole)} ·{" "}
                    {human(selected.creationSource)}
                  </span>
                </div>
                <div>
                  <small>Review state</small>
                  <b>{human(selected.reviewStatus)}</b>
                  <span>{selected.reviewNote ?? "No review note"}</span>
                </div>
              </div>
              <section className="admin-detail-section">
                <h3>Addresses</h3>
                {selected.addresses.map((address) => (
                  <div className="admin-address" key={address.id}>
                    <b>{human(address.kind)}</b>
                    <span>
                      {address.contactName} · {address.contactPhone}
                    </span>
                    <span>
                      {address.addressLine}, {address.city},{" "}
                      {address.countryCode}
                    </span>
                  </div>
                ))}
              </section>
              <section className="admin-detail-section">
                <h3>Cargo</h3>
                {selected.packages.map((pack) => (
                  <div className="admin-package" key={pack.id}>
                    <b>{pack.description}</b>
                    <span>
                      {pack.quantity} package(s) · {String(pack.weightKg)} kg
                      each
                    </span>
                  </div>
                ))}
              </section>
              <section className="admin-detail-section">
                <h3>Review decision</h3>
                <textarea
                  placeholder="Add review note (required for rejection or correction request)"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                />
                <div className="admin-action-row">
                  <button
                    disabled={
                      busy ||
                      !["PENDING_REVIEW", "NEEDS_CORRECTION"].includes(
                        selected.reviewStatus,
                      )
                    }
                    className="admin-primary"
                    onClick={() => void review("APPROVE")}
                  >
                    Approve
                  </button>
                  <button
                    disabled={
                      busy ||
                      !reviewNote.trim() ||
                      !["PENDING_REVIEW", "NEEDS_CORRECTION"].includes(
                        selected.reviewStatus,
                      )
                    }
                    className="admin-secondary"
                    onClick={() => void review("REQUEST_CORRECTION")}
                  >
                    Request correction
                  </button>
                  <button
                    disabled={
                      busy ||
                      !reviewNote.trim() ||
                      !["PENDING_REVIEW", "NEEDS_CORRECTION"].includes(
                        selected.reviewStatus,
                      )
                    }
                    className="admin-danger"
                    onClick={() => void review("REJECT")}
                  >
                    Reject
                  </button>
                </div>
              </section>
              <section className="admin-detail-section">
                <h3>Staff assignment</h3>
                <div className="admin-inline-form">
                  <select
                    value={assignmentId}
                    onChange={(e) => setAssignmentId(e.target.value)}
                  >
                    <option value="">Select active staff</option>
                    {staff.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName} · {person.employeeCode}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Reason for reassignment"
                    placeholder="Reason (required for reassignment)"
                    maxLength={500}
                    value={assignmentReason}
                    onChange={(e) => setAssignmentReason(e.target.value)}
                  />
                  <button
                    className="admin-secondary"
                    disabled={
                      busy ||
                      !assignmentId ||
                      selected.reviewStatus !== "APPROVED"
                    }
                    onClick={() => void assign()}
                  >
                    Assign
                  </button>
                </div>
              </section>
              <section className="admin-detail-section">
                <h3>Append tracking event</h3>
                <form onSubmit={appendEvent} className="admin-form">
                  <label>
                    Next shipment status
                    <select
                      value={eventStatus}
                      onChange={(e) => setEventStatus(e.target.value)}
                    >
                      {shipmentStatuses.map((x) => (
                        <option key={x} value={x}>
                          {human(x)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Location
                    <input
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="e.g. Shanghai export warehouse"
                    />
                  </label>
                  <label>
                    Operational note
                    <textarea
                      rows={2}
                      value={eventNote}
                      onChange={(e) => setEventNote(e.target.value)}
                      placeholder="Record the verified operational update"
                    />
                  </label>
                  <button
                    className="admin-primary"
                    disabled={busy || selected.reviewStatus !== "APPROVED"}
                  >
                    Append event
                  </button>
                </form>
              </section>
              <section className="admin-detail-section">
                <h3>Shipment history</h3>
                <div className="admin-timeline">
                  {selected.events.map((event) => (
                    <article key={event.id}>
                      <span />
                      <div>
                        <b>{human(event.status)}</b>
                        <p>
                          {event.locationLabel ?? "Location not supplied"} ·{" "}
                          {event.notes ?? "No note"}
                        </p>
                        <small>
                          {formatDate(event.occurredAt)} · {human(event.source)}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
