import { FormEvent, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { apiRequest } from "../api/client";

type StaffEntry = {
  id: string;
  employeeCode: string;
  fullName: string;
  active: boolean;
  jobTitle: string | null;
  department: { name: string; active: boolean } | null;
  supervisor: { fullName: string } | null;
  user: {
    email: string | null;
    phone: string | null;
    status: string;
    createdAt: string;
    mfaEnabled: boolean;
    userRoles: Array<{ role: { name: string } }>;
  };
};

type StaffPage = {
  items: StaffEntry[];
  total: number;
  page: number;
  pageSize: number;
};

function display(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const staffRoles = [
  "ADMINISTRATOR",
  "OPERATIONS_MANAGER",
  "QUOTE_OFFICER",
  "SHIPMENT_OFFICER",
  "WAREHOUSE_PERSONNEL",
  "DELIVERY_PERSONNEL",
  "FINANCE_OFFICER",
  "CUSTOMER_SUPPORT",
];

export default function AdminStaffDirectory({
  canCreate,
}: {
  canCreate: boolean;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StaffPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [fullName, setFullName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [generateEmployeeCode, setGenerateEmployeeCode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function changeStatus(
    person: StaffEntry,
    action: "SUSPEND" | "REACTIVATE" | "DEACTIVATE",
  ) {
    if (
      !window.confirm(
        `${display(action)} ${person.fullName}'s account? Existing sessions will be revoked.`,
      )
    )
      return;
    setBusyStaffId(person.id);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{
        status: string;
        invitationSent?: boolean;
      }>(`/admin/staff/${encodeURIComponent(person.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setNotice(
        result.status === "INVITED"
          ? result.invitationSent
            ? "Staff invitation renewed."
            : "Account restored, but the verification email could not be sent. Resend verification."
          : "Staff account status updated.",
      );
      setRefresh((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update staff account.",
      );
    } finally {
      setBusyStaffId(null);
    }
  }

  async function resendInvitation(person: StaffEntry) {
    if (!person.user.email) return;
    setBusyStaffId(person.id);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ message: string }>(
        "/auth/resend-verification",
        {
          method: "POST",
          body: JSON.stringify({ email: person.user.email }),
        },
      );
      setNotice(result.message);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not resend verification.",
      );
    } finally {
      setBusyStaffId(null);
    }
  }

  async function createStaff(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{
        invitationSent: boolean;
        user: { staff: { employeeCode: string } };
      }>(
        "/admin/staff",
        {
          method: "POST",
          body: JSON.stringify({
            fullName,
            employeeCode: generateEmployeeCode ? undefined : employeeCode,
            generateEmployeeCode,
            email,
            password,
            role,
          }),
        },
      );
      setPassword("");
      setFullName("");
      setEmployeeCode("");
      setGenerateEmployeeCode(true);
      setEmail("");
      setShowCreate(false);
      const invitationMessage = result.invitationSent
        ? "A verification code was sent; share the temporary password separately through a secure channel."
        : "The verification email could not be sent. Ask the staff member to request another code.";
      setNotice(
        `Staff account created with employee ID ${result.user.staff.employeeCode}. ${invitationMessage}`,
      );
      setPage(1);
      setRefresh((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not create staff account.",
      );
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status) params.set("status", status);
    if (department.trim()) params.set("department", department.trim());
    setLoading(true);
    setError("");
    apiRequest<StaffPage>(`/admin/staff?${params}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setData(null);
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load staff.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, department, page, refresh, status]);

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <h2>Staff directory</h2>
        {canCreate && (
          <button
            type="button"
            className="admin-secondary"
            onClick={() => {
              setShowCreate((value) => !value);
              setPassword("");
            }}
          >
            {showCreate ? "Cancel" : "Create staff account"}
          </button>
        )}
        <button
          type="button"
          className="admin-refresh"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>
      {notice && (
        <div className="admin-quote-notice" role="status">
          {notice}
        </div>
      )}
      {showCreate && canCreate && (
        <form
          className="admin-form admin-staff-create-form"
          onSubmit={createStaff}
        >
          <label>
            Full name
            <input
              required
              minLength={2}
              maxLength={100}
              placeholder="Enter the staff member's name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
          <label className="admin-checkbox-field">
            <input
              type="checkbox"
              checked={generateEmployeeCode}
              onChange={(event) => {
                setGenerateEmployeeCode(event.target.checked);
                if (event.target.checked) setEmployeeCode("");
              }}
            />
            Generate employee ID automatically
          </label>
          {generateEmployeeCode ? (
            <p className="admin-form-hint">
              A unique employee ID will be assigned when the account is created.
            </p>
          ) : (
            <label>
              Employee ID
              <input
                required
                minLength={2}
                maxLength={50}
                placeholder="Enter an employee ID"
                value={employeeCode}
                onChange={(event) => setEmployeeCode(event.target.value)}
              />
            </label>
          )}
          <label>
            Email (staff user ID)
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              placeholder="staff@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Temporary password
            <input
              type="password"
              required
              minLength={12}
              maxLength={100}
              autoComplete="new-password"
              placeholder="At least 12 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Role
            <select
              required
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="" disabled>
                Choose a staff role
              </option>
              {staffRoles.map((item) => (
                <option key={item} value={item}>
                  {display(item)}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-primary" disabled={creating}>
            {creating ? "Creating..." : "Create account"}
          </button>
        </form>
      )}
      <div className="admin-filters">
        <label className="admin-search">
          <Search size={16} />
          <input
            aria-label="Search staff"
            placeholder="Name, employee ID, email or phone"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Account status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All account statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <label className="admin-search">
          <input
            aria-label="Filter by department"
            placeholder="Department"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {error && (
        <div className="admin-banner-error" role="alert">
          {error}
        </div>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Staff member</th>
              <th>Contact</th>
              <th>Department</th>
              <th>Supervisor</th>
              <th>Roles</th>
              <th>Account</th>
              <th>MFA</th>
              <th>Created</th>
              {canCreate && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="admin-empty" colSpan={canCreate ? 9 : 8}>
                  Loading staff...
                </td>
              </tr>
            ) : data?.items.length ? (
              data.items.map((person) => (
                <tr key={person.id}>
                  <td>
                    <b>{person.fullName}</b>
                    <small>
                      {person.employeeCode}
                      {person.jobTitle ? ` · ${person.jobTitle}` : ""}
                    </small>
                  </td>
                  <td>
                    {person.user.email ?? "No email"}
                    <small>{person.user.phone ?? "No phone"}</small>
                  </td>
                  <td>
                    {person.department?.name ?? "Unassigned"}
                    {person.department && !person.department.active && (
                      <small>Inactive department</small>
                    )}
                  </td>
                  <td>{person.supervisor?.fullName ?? "Unassigned"}</td>
                  <td>
                    {person.user.userRoles
                      .map(({ role }) => display(role.name))
                      .join(", ") || "No role"}
                  </td>
                  <td>
                    <span
                      className={`admin-pill ${person.user.status === "ACTIVE" && person.active ? "good" : "neutral"}`}
                    >
                      {display(person.user.status)}
                      {!person.active ? " / Inactive" : ""}
                    </span>
                  </td>
                  <td>{person.user.mfaEnabled ? "Enabled" : "Not enabled"}</td>
                  <td>
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                    }).format(new Date(person.user.createdAt))}
                  </td>
                  {canCreate && (
                    <td>
                      {!person.user.userRoles.some(
                        ({ role }) => role.name === "SUPER_ADMINISTRATOR",
                      ) && (
                        <div className="admin-action-row">
                          {person.user.status === "INVITED" &&
                            person.user.email && (
                              <button
                                type="button"
                                className="admin-secondary"
                                disabled={busyStaffId !== null}
                                onClick={() => void resendInvitation(person)}
                              >
                                Resend verification
                              </button>
                            )}
                          {person.user.status === "ACTIVE" && (
                            <button
                              type="button"
                              className="admin-secondary"
                              disabled={busyStaffId !== null}
                              onClick={() =>
                                void changeStatus(person, "SUSPEND")
                              }
                            >
                              Suspend
                            </button>
                          )}
                          {(person.user.status === "INVITED" ||
                            person.user.status === "ACTIVE" ||
                            person.user.status === "SUSPENDED") && (
                            <button
                              type="button"
                              className="admin-danger"
                              disabled={busyStaffId !== null}
                              onClick={() =>
                                void changeStatus(person, "DEACTIVATE")
                              }
                            >
                              Deactivate
                            </button>
                          )}
                          {(person.user.status === "SUSPENDED" ||
                            person.user.status === "DISABLED") && (
                            <button
                              type="button"
                              className="admin-secondary"
                              disabled={busyStaffId !== null}
                              onClick={() =>
                                void changeStatus(person, "REACTIVATE")
                              }
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              !error && (
                <tr>
                  <td className="admin-empty" colSpan={canCreate ? 9 : 8}>
                    No staff match these filters.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="admin-quote-pagination">
          <span>{data.total} staff</span>{" "}
          <button
            type="button"
            className="admin-secondary"
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>{" "}
          <span>Page {page}</span>{" "}
          <button
            type="button"
            className="admin-secondary"
            disabled={loading || page * data.pageSize >= data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
