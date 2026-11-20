import { FormEvent, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { apiRequest } from "../api/client";

type StaffEntry = {
  id: string;
  employeeCode: string;
  fullName: string;
  active: boolean;
  jobTitle: string | null;
  department: { id: string; name: string; active: boolean } | null;
  supervisor: { id: string; fullName: string } | null;
  user: {
    email: string | null;
    phone: string | null;
    status: string;
    createdAt: string;
    lastLoginAt: string | null;
    mfaEnabled: boolean;
    userRoles: Array<{ role: { id?: string; name: string } }>;
  };
};

type StaffProfile = StaffEntry & {
  reports?: { id: string; fullName: string; employeeCode: string }[];
  assignments?: { id: string; assignedAt: string; reason: string | null; shipment: { id: string; shipmentNumber: string; status: string } }[];
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
  const [activeFilter, setActiveFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState({ fullName: "", jobTitle: "", phone: "", departmentId: "", supervisorId: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [roleToAssign, setRoleToAssign] = useState("");
  const [mfaVerificationCode, setMfaVerificationCode] = useState("");

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
    setBusyStaffId(person.id);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ invitationSent: boolean }>(`/admin/staff/${encodeURIComponent(person.id)}/invitation`, { method: "POST" });
      setNotice(result.invitationSent ? "Staff invitation resent." : "The invitation could not be sent. Try again later.");
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
    if (activeFilter) params.set("active", activeFilter);
    params.set("sortBy", sortBy);
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
  }, [activeFilter, debouncedSearch, department, page, refresh, sortBy, status]);

  useEffect(() => {
    apiRequest<{ items: { id: string; name: string; active: boolean }[] }>("/admin/departments?page=1&pageSize=100")
      .then((result) => setDepartments(result.items.filter((item) => item.active)))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!canCreate) return;
    apiRequest<{ id: string; name: string; isSystem: boolean }[]>("/admin/roles")
      .then((items) => setAvailableRoles(items.filter((item) => item.name !== "SUPER_ADMINISTRATOR" && item.name !== "CUSTOMER")))
      .catch(() => setAvailableRoles([]));
  }, [canCreate]);

  useEffect(() => {
    if (profile) setProfileDraft({ fullName: profile.fullName, jobTitle: profile.jobTitle ?? "", phone: profile.user.phone ?? "", departmentId: profile.department?.id ?? "", supervisorId: profile.supervisor?.id ?? "" });
  }, [profile]);

  async function openProfile(person: StaffEntry) {
    setError("");
    try { setProfile(await apiRequest<StaffProfile>(`/admin/staff/${encodeURIComponent(person.id)}`)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load staff profile."); }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!profile) return;
    setSavingProfile(true); setError(""); setNotice("");
    try {
      await apiRequest(`/admin/staff/${encodeURIComponent(profile.id)}`, { method: "PATCH", body: JSON.stringify({ fullName: profileDraft.fullName.trim(), jobTitle: profileDraft.jobTitle.trim() || null, phone: profileDraft.phone.trim() || null, departmentId: profileDraft.departmentId || null, supervisorId: profileDraft.supervisorId || null }) });
      setProfile(null); setNotice("Staff profile updated."); setRefresh((v) => v + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update staff profile."); }
    finally { setSavingProfile(false); }
  }

  async function assignRole() {
    if (!profile || !roleToAssign) return;
    setSavingProfile(true); setError("");
    try {
      await apiRequest(`/admin/staff/${encodeURIComponent(profile.id)}/roles`, { method: "POST", body: JSON.stringify({ roleId: roleToAssign }) });
      setRoleToAssign(""); await openProfile(profile); setRefresh((v) => v + 1); setNotice("Role assigned. The staff member must sign in again.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not assign role."); }
    finally { setSavingProfile(false); }
  }

  async function removeRole(roleId: string) {
    if (!profile || !window.confirm("Remove this role? The staff member’s active sessions will be revoked.")) return;
    setSavingProfile(true); setError("");
    try {
      await apiRequest(`/admin/staff/${encodeURIComponent(profile.id)}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
      await openProfile(profile); setRefresh((v) => v + 1); setNotice("Role removed. The staff member must sign in again.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not remove role."); }
    finally { setSavingProfile(false); }
  }

  async function resetMfa() {
    if (!profile || !mfaVerificationCode.trim()) return;
    if (!window.confirm(`Reset MFA for ${profile.fullName}? Their active sessions will be revoked and they must enroll again.`)) return;
    setSavingProfile(true); setError(""); setNotice("");
    try {
      await apiRequest(`/admin/staff/${encodeURIComponent(profile.id)}/mfa-reset`, { method: "POST", body: JSON.stringify({ code: mfaVerificationCode.trim() }) });
      setMfaVerificationCode(""); await openProfile(profile); setRefresh((v) => v + 1); setNotice("MFA reset. The staff member must enroll again at next sign-in.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not reset staff MFA."); }
    finally { setSavingProfile(false); }
  }

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
              {availableRoles.map((item) => (
                <option key={item.id} value={item.name}>
                  {display(item.name)}
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
        <select aria-label="Employment status" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}>
          <option value="">All employment statuses</option><option value="true">Active profile</option><option value="false">Inactive profile</option>
        </select>
        <select aria-label="Sort staff" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="name">Sort by name</option><option value="createdAt">Sort by registration</option><option value="department">Sort by department</option><option value="lastLoginAt">Sort by last activity</option>
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
                    <button type="button" className="admin-staff-profile-link" onClick={() => void openProfile(person)}>{person.fullName}</button>
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
      {profile && (
        <section className="admin-staff-profile" aria-labelledby="staff-profile-title">
          <div className="admin-panel-heading"><div><h3 id="staff-profile-title">{profile.fullName}</h3><p>{profile.employeeCode} · {profile.user.email ?? "No email"} · Last login {profile.user.lastLoginAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(profile.user.lastLoginAt)) : "Not recorded"}</p></div><button type="button" className="admin-secondary" onClick={() => setProfile(null)}>Close profile</button></div>
          {canCreate ? <form className="admin-form admin-staff-profile-form" onSubmit={saveProfile}>
            <label>Full name<input required minLength={2} maxLength={100} value={profileDraft.fullName} onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })}/></label>
            <label>Job title<input maxLength={100} value={profileDraft.jobTitle} onChange={(e) => setProfileDraft({ ...profileDraft, jobTitle: e.target.value })}/></label>
            <label>Phone<input maxLength={32} value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}/></label>
            <label>Department<select value={profileDraft.departmentId} onChange={(e) => setProfileDraft({ ...profileDraft, departmentId: e.target.value })}><option value="">Unassigned</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Supervisor<select value={profileDraft.supervisorId} onChange={(e) => setProfileDraft({ ...profileDraft, supervisorId: e.target.value })}><option value="">Unassigned</option>{(data?.items ?? []).filter((item) => item.id !== profile.id && item.active).map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.employeeCode}</option>)}</select></label>
            <button className="admin-primary" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</button>
          </form> : <p>{profile.jobTitle ?? "No job title"} · {profile.department?.name ?? "No department"} · Supervisor: {profile.supervisor?.fullName ?? "Unassigned"}</p>}
          <div className="admin-profile-assignments"><h4>Assigned roles</h4>{profile.user.userRoles.map(({ role: assigned }) => <div key={assigned.id ?? assigned.name}><b>{display(assigned.name)}</b>{canCreate && assigned.name !== "SUPER_ADMINISTRATOR" && <button type="button" className="admin-danger" disabled={savingProfile || profile.user.userRoles.length <= 1 || !assigned.id} onClick={() => assigned.id && void removeRole(assigned.id)}>Remove</button>}</div>)}{canCreate && <div className="admin-action-row"><select aria-label="Role to assign" value={roleToAssign} onChange={(e) => setRoleToAssign(e.target.value)}><option value="">Choose a role to add</option>{availableRoles.filter((item) => !profile.user.userRoles.some(({ role: assigned }) => assigned.id === item.id)).map((item) => <option key={item.id} value={item.id}>{display(item.name)}</option>)}</select><button type="button" className="admin-secondary" disabled={savingProfile || !roleToAssign} onClick={() => void assignRole()}>Assign role</button></div>}</div>
          {canCreate && <div className="admin-mfa-reset"><h4>Reset staff MFA</h4><p>The staff member will be signed out and must enroll again. Confirm with your current authenticator or recovery code.</p><div className="admin-action-row"><input aria-label="Administrator MFA confirmation code" autoComplete="one-time-code" maxLength={10} placeholder="Your authenticator or recovery code" value={mfaVerificationCode} onChange={(e) => setMfaVerificationCode(e.target.value)}/><button type="button" className="admin-danger" disabled={savingProfile || !mfaVerificationCode.trim()} onClick={() => void resetMfa()}>Reset MFA</button></div></div>}
          <div className="admin-profile-assignments"><h4>Current shipment assignments</h4>{profile.assignments?.length ? profile.assignments.map((item) => <div key={item.id}><b>{item.shipment.shipmentNumber}</b><span>{item.shipment.status.replace(/_/g, " ")}</span><small>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(item.assignedAt))}{item.reason ? ` · ${item.reason}` : ""}</small></div>) : <p>No current shipment assignments.</p>}</div>
        </section>
      )}
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
