import { FormEvent, useEffect, useState } from "react";
import { RefreshCw, Monitor, Search } from "lucide-react";
import { apiRequest } from "../api/client";

type Permission = { id: string; key: string; description: string | null };
type Role = { id: string; name: string; description: string | null; isSystem: boolean; rolePermissions: { permission: Permission }[]; _count: { userRoles: number } };
const label = (value: string) => value.replace(/_/g, " ");

export function AdminRoleManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([apiRequest<Role[]>("/admin/roles"), apiRequest<Permission[]>("/admin/roles/permissions")])
      .then(([nextRoles, nextPermissions]) => { if (active) { setRoles(nextRoles); setPermissions(nextPermissions); setSelectedRoleId((current) => current || nextRoles[0]?.id || ""); } })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load roles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [version]);
  const activeRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const permissionGroups = permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const category = permission.key.split(":")[0];
    (groups[category] ??= []).push(permission);
    return groups;
  }, {});
  const activePermissionGroups = (activeRole?.rolePermissions.map(({ permission }) => permission) ?? []).reduce<Record<string, Permission[]>>((groups, permission) => {
    const category = permission.key.split(":")[0];
    (groups[category] ??= []).push(permission);
    return groups;
  }, {});
  function openRole(role: Role) {
    setSelectedRoleId(role.id); setCreating(false); setEditingRole(null); setName(role.name);
    setDescription(role.description ?? ""); setSelected(role.rolePermissions.map(({ permission }) => permission.key));
    setError(""); setNotice("");
  }
  function beginEdit() {
    if (!activeRole || activeRole.isSystem) return;
    setEditingRole(activeRole); setCreating(false); setName(activeRole.name); setDescription(activeRole.description ?? "");
    setSelected(activeRole.rolePermissions.map(({ permission }) => permission.key)); setError(""); setNotice("");
  }
  function beginCreate() {
    setCreating(true); setEditingRole(null); setName(""); setDescription(""); setSelected([]); setError(""); setNotice("");
  }
  function cancelEdit() {
    setCreating(false); setEditingRole(null);
    if (activeRole) { setName(activeRole.name); setDescription(activeRole.description ?? ""); setSelected(activeRole.rolePermissions.map(({ permission }) => permission.key)); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const body = JSON.stringify({ name, description: description.trim() || undefined, permissions: selected });
      const saved = await apiRequest<{ id: string }>(editingRole ? `/admin/roles/${encodeURIComponent(editingRole.id)}` : "/admin/roles", { method: editingRole ? "PATCH" : "POST", body });
      setSelectedRoleId(saved.id); setCreating(false); setEditingRole(null); setNotice("Role permissions saved and audited."); setVersion((v) => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the role."); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel admin-governance">
    <div className="admin-panel-heading"><div><h2>Roles &amp; permissions</h2><p>Review access by role. Built-in roles are protected from edits.</p></div><button type="button" className="admin-refresh" disabled={loading} onClick={() => setVersion((v) => v + 1)}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div>
    {error && <div className="admin-banner-error" role="alert">{error}</div>}{notice && <div className="admin-quote-notice" role="status">{notice}</div>}
    {loading ? <div className="admin-empty">Loading roles…</div> : <div className="admin-role-workspace">
      <nav className="admin-role-index" aria-label="Roles">
        <div className="admin-role-index-heading"><h3>Access roles</h3><button type="button" className="admin-primary" onClick={beginCreate}>Create role</button></div>
        {roles.map((role) => <button type="button" key={role.id} className={`admin-role-choice ${selectedRoleId === role.id && !creating ? "selected" : ""}`} aria-current={selectedRoleId === role.id && !creating ? "true" : undefined} onClick={() => openRole(role)}>
          <span><b>{label(role.name)}</b><small>{role._count.userRoles} staff · {role.rolePermissions.length} permissions</small></span><span className={`admin-pill ${role.isSystem ? "neutral" : "good"}`}>{role.isSystem ? "Built-in" : "Custom"}</span>
        </button>)}
        {!roles.length && <p className="admin-role-empty">No roles configured yet.</p>}
      </nav>
      <div className="admin-role-detail">
        {(creating || editingRole) ? <form className="admin-role-editor" onSubmit={save}>
          <header><div><span className="admin-role-kicker">{creating ? "NEW ACCESS ROLE" : "ROLE SETTINGS"}</span><h3>{creating ? "Create a custom role" : `Edit ${label(editingRole?.name ?? "")}`}</h3></div><button type="button" className="admin-secondary" onClick={cancelEdit}>Cancel</button></header>
          {creating && <label>Role key<input required minLength={2} maxLength={80} pattern="[A-Z][A-Z0-9_]*" placeholder="e.g. ROUTE_COORDINATOR" value={name} onChange={(e) => setName(e.target.value.toUpperCase())}/></label>}
          <label>Description<input maxLength={500} placeholder="Describe the work this role supports" value={description} onChange={(e) => setDescription(e.target.value)}/></label>
          <div className="admin-permission-groups"><div className="admin-permission-heading"><h4>Permission set</h4><span>{selected.length} selected</span></div>{Object.entries(permissionGroups).map(([category, items]) => <fieldset key={category}><legend>{label(category)}</legend>{items.map((permission) => <label className="admin-permission-row" key={permission.id}><input type="checkbox" checked={selected.includes(permission.key)} onChange={(event) => setSelected((old) => event.target.checked ? [...old, permission.key] : old.filter((key) => key !== permission.key))}/><span><b>{permission.key}</b><small>{permission.description}</small></span></label>)}</fieldset>)}</div>
          <footer><span>Administrative control permissions are reserved for the built-in security role.</span><button className="admin-primary" disabled={busy || (!editingRole && !name.trim())}>{busy ? "Saving…" : creating ? "Create role" : "Save permissions"}</button></footer>
        </form> : activeRole ? <div className="admin-role-overview">
          <header><div><span className="admin-role-kicker">{activeRole.isSystem ? "BUILT-IN ROLE" : "CUSTOM ROLE"}</span><h3>{label(activeRole.name)}</h3><p>{activeRole.description ?? "No description provided."}</p></div>{!activeRole.isSystem && <button className="admin-primary" type="button" onClick={beginEdit}>Edit permissions</button>}</header>
          <div className="admin-role-summary"><span><b>{activeRole._count.userRoles}</b> assigned staff</span><span><b>{activeRole.rolePermissions.length}</b> permissions</span><span>{activeRole.isSystem ? "Protected" : "Customizable"}</span></div>
          <div className="admin-role-permissions"><h4>Effective permissions</h4>{Object.entries(activePermissionGroups).map(([category, items]) => <section key={category}><h5>{label(category)}</h5><ul>{items.map((permission) => <li key={permission.id}><b>{permission.key}</b><span>{permission.description}</span></li>)}</ul></section>)}{!activeRole.rolePermissions.length && <p className="admin-role-empty">This role has no permissions assigned.</p>}</div>
        </div> : <div className="admin-role-empty">Choose a role to review its effective permissions.</div>}
      </div>
    </div>}
  </section>;
}

type SessionRow = { id: string; createdAt: string; lastActivityAt: string; expiresAt: string; userAgent: string | null; user: { id: string; email: string | null; status: string; staff: { fullName: string; employeeCode: string } | null; userRoles: { role: { name: string } }[] } };
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
function dateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function AdminSessions() {
  const [data, setData] = useState<Page<SessionRow> | null>(null); const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [version, setVersion] = useState(0);
  useEffect(() => { let active = true; const params = new URLSearchParams({ page: String(page), pageSize: "25" }); if (search.trim()) params.set("search", search.trim()); setLoading(true); apiRequest<Page<SessionRow>>(`/admin/security/sessions?${params}`).then((result) => { if (active) setData(result); }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load sessions."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [page, search, version]);
  async function revoke(session: SessionRow) { if (!window.confirm(`Revoke ${session.user.staff?.fullName ?? session.user.email ?? "this"} session?`)) return; setBusy(session.id); setError(""); try { await apiRequest(`/admin/security/sessions/${encodeURIComponent(session.id)}`, { method: "DELETE" }); setNotice("Session revoked."); setVersion((v) => v + 1); } catch (e) { setError(e instanceof Error ? e.message : "Could not revoke the session."); } finally { setBusy(""); } }
  async function revokeAll(session: SessionRow) { const name = session.user.staff?.fullName ?? session.user.email ?? "this staff account"; if (!window.confirm(`Revoke all active sessions for ${name}?`)) return; setBusy(session.user.id); setError(""); try { await apiRequest(`/admin/security/users/${encodeURIComponent(session.user.id)}/sessions`, { method: "DELETE" }); setNotice(`All active sessions for ${name} were revoked.`); setVersion((v) => v + 1); } catch (e) { setError(e instanceof Error ? e.message : "Could not revoke the account sessions."); } finally { setBusy(""); } }
  return <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Sessions &amp; devices</h2><p>Active staff sessions with coarse source masking and recent activity.</p></div><button type="button" className="admin-refresh" disabled={loading} onClick={() => setVersion((v) => v + 1)}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div>
    <div className="admin-filters"><label className="admin-search"><Search size={16}/><input aria-label="Search sessions" placeholder="Staff name, email or employee ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/></label></div>
    {error && <div className="admin-banner-error" role="alert">{error}</div>}{notice && <div className="admin-quote-notice" role="status">{notice}</div>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Staff member</th><th>Device</th><th>Created</th><th>Last activity</th><th>Expires</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="admin-empty">Loading sessions…</td></tr> : data?.items.map((session) => <tr key={session.id}><td><b>{session.user.staff?.fullName ?? "Staff account"}</b><small>{session.user.staff?.employeeCode} · {session.user.email}</small></td><td><Monitor size={15}/> {session.userAgent?.slice(0, 100) ?? "Browser metadata unavailable"}</td><td>{dateTime(session.createdAt)}</td><td>{dateTime(session.lastActivityAt)}</td><td>{dateTime(session.expiresAt)}</td><td><div className="admin-action-row"><button className="admin-danger" type="button" disabled={busy === session.id || busy === session.user.id} onClick={() => void revoke(session)}>{busy === session.id ? "Revoking…" : "Revoke"}</button><button className="admin-secondary" type="button" disabled={busy === session.user.id} onClick={() => void revokeAll(session)}>Revoke all</button></div></td></tr>)}{!loading && !data?.items.length && <tr><td colSpan={6} className="admin-empty">No active staff sessions found.</td></tr>}</tbody></table></div>
    {data && <div className="admin-quote-pagination"><span>{data.total} active sessions</span><button className="admin-secondary" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page}</span><button className="admin-secondary" disabled={loading || page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button></div>}
  </section>;
}

type AuditRow = { id: string; action: string; targetType: string; targetId: string | null; outcome: string; correlationId: string; eventHash: string; occurredAt: string; actor: { email: string | null; staff: { fullName: string; employeeCode: string } | null; userRoles: { role: { name: string } }[] } | null };
export function AdminAuditHistory() {
  const [data, setData] = useState<Page<AuditRow> | null>(null); const [search, setSearch] = useState(""); const [outcome, setOutcome] = useState(""); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [version, setVersion] = useState(0);
  useEffect(() => { let active = true; const params = new URLSearchParams({ page: String(page), pageSize: "25" }); if (search.trim()) params.set("search", search.trim()); if (outcome) params.set("outcome", outcome); setLoading(true); apiRequest<Page<AuditRow>>(`/admin/security/audit?${params}`).then((result) => { if (active) setData(result); }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load audit history."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [page, search, outcome, version]);
  return <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Immutable audit history</h2><p>Append-only, hash-chained security and administration events.</p></div><button type="button" className="admin-refresh" disabled={loading} onClick={() => setVersion((v) => v + 1)}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div><div className="admin-filters"><label className="admin-search"><Search size={16}/><input aria-label="Search audit history" placeholder="Action, actor or target" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/></label><select aria-label="Audit outcome" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}><option value="">All outcomes</option><option value="SUCCESS">Success</option><option value="FAILURE">Failure</option><option value="DENIED">Denied</option></select></div>{error && <div className="admin-banner-error" role="alert">{error}</div>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Event</th><th>Actor</th><th>Target</th><th>Outcome</th><th>Time</th><th>Chain</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="admin-empty">Loading audit history…</td></tr> : data?.items.map((event) => <tr key={event.id}><td><b>{label(event.action)}</b><small>{event.correlationId}</small></td><td>{event.actor?.staff?.fullName ?? event.actor?.email ?? "System"}<small>{event.actor?.userRoles.map(({ role }) => label(role.name)).join(", ")}</small></td><td>{event.targetType}<small>{event.targetId ?? "—"}</small></td><td><span className={`admin-pill ${event.outcome === "SUCCESS" ? "good" : event.outcome === "FAILURE" ? "bad" : "warn"}`}>{event.outcome}</span></td><td>{dateTime(event.occurredAt)}</td><td><code title={event.eventHash}>{event.eventHash.slice(0, 12)}…</code></td></tr>)}{!loading && !data?.items.length && <tr><td colSpan={6} className="admin-empty">No audit events match the filters.</td></tr>}</tbody></table></div>{data && <div className="admin-quote-pagination"><span>{data.total} events</span><button className="admin-secondary" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page}</span><button className="admin-secondary" disabled={loading || page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button></div>}</section>;
}

type AssignmentRow = { id: string; assignedAt: string; unassignedAt: string | null; reason: string | null; staff: { id: string; fullName: string; employeeCode: string; department: { id: string; name: string } | null }; assignedBy: { email: string | null; staff: { fullName: string; employeeCode: string } | null } | null; shipment: { id: string; shipmentNumber: string; status: string; reviewStatus: string; estimatedDelivery: string | null } };
type WorkloadRow = { id: string; fullName: string; employeeCode: string; department: { id: string; name: string } | null; activeAssignments: number };
export function AdminAssignments() {
  const [data, setData] = useState<Page<AssignmentRow> | null>(null); const [workload, setWorkload] = useState<WorkloadRow[]>([]); const [staffId, setStaffId] = useState(""); const [departmentId, setDepartmentId] = useState(""); const [status, setStatus] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [current, setCurrent] = useState("true"); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [version, setVersion] = useState(0);
  useEffect(() => { let active = true; const params = new URLSearchParams({ page: String(page), pageSize: "25", current }); if (staffId) params.set("staffId", staffId); if (departmentId) params.set("departmentId", departmentId); if (status) params.set("status", status); if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString()); if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString()); setLoading(true); Promise.all([apiRequest<Page<AssignmentRow>>(`/admin/operations/assignments?${params}`), apiRequest<WorkloadRow[]>("/admin/operations/assignments/workload")]).then(([assignments, load]) => { if (active) { setData(assignments); setWorkload(load); } }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load assignments."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [current, page, staffId, departmentId, status, from, to, version]);
  const people = [...new Map([...workload, ...(data?.items.map(({ staff }) => ({ ...staff, activeAssignments: 0 })) ?? [])].map((person) => [person.id, person])).values()];
  return <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Shipment assignments</h2><p>Current ownership and preserved reassignment history.</p></div><button type="button" className="admin-refresh" disabled={loading} onClick={() => setVersion((v) => v + 1)}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div>
    <section className="admin-workload-section" aria-labelledby="assignment-workload-title"><div className="admin-workload-heading"><h3 id="assignment-workload-title">Current workload</h3><span>Open shipment assignments by staff member</span></div><div className="admin-table-wrap"><table className="admin-table admin-workload-table"><thead><tr><th>Staff member</th><th>Department</th><th>Open assignments</th></tr></thead><tbody>{workload.length ? workload.map((person) => <tr key={person.id}><td><b>{person.fullName}</b><small>{person.employeeCode}</small></td><td>{person.department?.name ?? "Unassigned department"}</td><td><span className="admin-workload-count">{person.activeAssignments}</span></td></tr>) : <tr><td className="admin-empty" colSpan={3}>No active staff have shipment assignments.</td></tr>}</tbody></table></div></section>
    <div className="admin-filters"><select aria-label="Assignment status" value={current} onChange={(e) => { setCurrent(e.target.value); setPage(1); }}><option value="true">Current assignments</option><option value="false">Completed assignments</option><option value="">All assignment history</option></select><select aria-label="Filter assignment by staff" value={staffId} onChange={(e) => { setStaffId(e.target.value); setPage(1); }}><option value="">All staff</option>{people.map((person) => <option key={person.id} value={person.id}>{person.fullName} · {person.employeeCode}</option>)}</select><select aria-label="Filter assignment by department" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}><option value="">All departments</option>{[...new Map(workload.filter((person) => person.department).map((person) => [person.department!.id, person.department!])).values()].map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select aria-label="Filter assignment by shipment status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All shipment statuses</option>{["IN_TRANSIT", "ARRIVED_DESTINATION", "CUSTOMS_PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "CANCELLED"].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select><label>From<input aria-label="Assignments from date" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}/></label><label>To<input aria-label="Assignments to date" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}/></label></div>{error && <div className="admin-banner-error" role="alert">{error}</div>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Shipment</th><th>Assigned to</th><th>Department</th><th>Assigned by</th><th>Assigned</th><th>Closed</th><th>Reason</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="admin-empty">Loading assignments…</td></tr> : data?.items.map((item) => <tr key={item.id}><td><b>{item.shipment.shipmentNumber}</b><small>{item.shipment.status.replace(/_/g, " ")}{item.shipment.estimatedDelivery && new Date(item.shipment.estimatedDelivery) < new Date() && item.unassignedAt === null ? " · Past estimated delivery" : ""}</small></td><td>{item.staff.fullName}<small>{item.staff.employeeCode}</small></td><td>{item.staff.department?.name ?? "Unassigned"}</td><td>{item.assignedBy?.staff?.fullName ?? item.assignedBy?.email ?? "Historical / unavailable"}</td><td>{dateTime(item.assignedAt)}</td><td>{item.unassignedAt ? dateTime(item.unassignedAt) : <span className="admin-pill good">Current</span>}</td><td>{item.reason ?? "—"}</td></tr>)}{!loading && !data?.items.length && <tr><td colSpan={7} className="admin-empty">No assignments match these filters.</td></tr>}</tbody></table></div>{data && <div className="admin-quote-pagination"><span>{data.total} assignments</span><button className="admin-secondary" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page}</span><button className="admin-secondary" disabled={loading || page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button></div>}
  </section>;
}

type Configuration = { sessionDays: number; sessionPolicyVersion: number; privilegedMfaRequired: boolean; minimumPasswordLength: number; updatedAt: string | null };
export function AdminConfiguration() {
  const [configuration, setConfiguration] = useState<Configuration | null>(null); const [sessionDays, setSessionDays] = useState(7); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [version, setVersion] = useState(0);
  useEffect(() => { let active = true; setLoading(true); apiRequest<Configuration>("/admin/configuration").then((value) => { if (active) { setConfiguration(value); setSessionDays(value.sessionDays); } }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load configuration."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [version]);
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); setNotice(""); try { const result = await apiRequest<{ sessionDays: number; version: number }>("/admin/configuration/session-policy", { method: "PUT", body: JSON.stringify({ sessionDays }) }); setNotice(`Session duration saved as ${result.sessionDays} days (version ${result.version}).`); setVersion((v) => v + 1); } catch (e) { setError(e instanceof Error ? e.message : "Could not update session policy."); } finally { setBusy(false); } }
  return <section className="admin-panel"><div className="admin-panel-heading"><div><h2>System configuration</h2><p>Security settings are versioned and recorded in the immutable audit history.</p></div><button type="button" className="admin-refresh" disabled={loading} onClick={() => setVersion((v) => v + 1)}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div>{error && <div className="admin-banner-error" role="alert">{error}</div>}{notice && <div className="admin-quote-notice" role="status">{notice}</div>}
    {loading ? <div className="admin-empty">Loading current policies…</div> : configuration && <><form className="admin-form admin-configuration-form" onSubmit={save}><h3>Session policy</h3><p>Applies to new sessions. Existing sessions keep their current expiry and can be revoked in Sessions &amp; devices.</p><label>Session duration<select value={sessionDays} onChange={(e) => setSessionDays(Number(e.target.value))}>{[1,3,7,14,30].map((days) => <option key={days} value={days}>{days} days</option>)}</select></label><button className="admin-primary" disabled={busy || sessionDays === configuration.sessionDays}>{busy ? "Saving…" : "Save session policy"}</button><small>Configuration version {configuration.sessionPolicyVersion}{configuration.updatedAt ? ` · Updated ${dateTime(configuration.updatedAt)}` : " · Default policy"}</small></form><div className="admin-control-state"><h3>Enforced identity controls</h3><p><b>Privileged MFA</b><span className="admin-pill good">Required</span></p><p><b>Minimum password length</b><span>{configuration.minimumPasswordLength} characters</span></p><small>These controls are fixed by the current security policy and cannot be disabled from this screen.</small></div></>}
  </section>;
}
