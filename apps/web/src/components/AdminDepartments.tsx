import { FormEvent, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiRequest } from "../api/client";

type Department = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  head: { id: string; fullName: string } | null;
  _count: { members: number };
};
type DepartmentPage = { items: Department[]; total: number; pageSize: number };

export default function AdminDepartments() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DepartmentPage | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [headId, setHeadId] = useState("");
  const [active, setActive] = useState(true);
  const [staffOptions, setStaffOptions] = useState<{ id: string; fullName: string; employeeCode: string; department: { id: string } | null }[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiRequest<DepartmentPage>(`/admin/departments?page=${page}&pageSize=20`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setData(null);
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load departments.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, version]);

  useEffect(() => {
    apiRequest<{ items: { id: string; fullName: string; employeeCode: string; active: boolean; department: { id: string } | null; user: { status: string } }[] }>("/admin/staff?page=1&pageSize=100")
      .then((result) => setStaffOptions(result.items.filter((item) => item.active && item.user.status === "ACTIVE")))
      .catch(() => setStaffOptions([]));
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest("/admin/departments", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      setName("");
      setDescription("");
      setNotice("Department created.");
      setPage(1);
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not create department.",
      );
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(department: Department) {
    setEditing(department); setEditName(department.name); setEditDescription(department.description ?? ""); setHeadId(department.head?.id ?? ""); setActive(department.active); setError("");
  }

  async function updateDepartment(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest(`/admin/departments/${encodeURIComponent(editing.id)}`, { method: "PATCH", body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || null, headId: headId || null, active }) });
      setEditing(null); setNotice("Department updated."); setVersion((v) => v + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update department."); }
    finally { setBusy(false); }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <h2>Departments</h2>
        <button
          type="button"
          className="admin-refresh"
          disabled={loading}
          onClick={() => setVersion((value) => value + 1)}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>
      {error && (
        <div className="admin-banner-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="admin-quote-notice" role="status">
          {notice}
        </div>
      )}
      <form className="admin-form" onSubmit={create}>
        <label>
          Department name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label>
          Description (optional)
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
          />
        </label>
        <button
          className="admin-primary"
          disabled={busy || name.trim().length < 2}
        >
          {busy ? "Creating..." : "Create department"}
        </button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Head</th>
              <th>Members</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="admin-empty" colSpan={5}>
                  Loading departments...
                </td>
              </tr>
            ) : data?.items.length ? (
              data.items.map((department) => (
                <tr key={department.id}>
                  <td>
                    <b>{department.name}</b>
                    {department.description && (
                      <small>{department.description}</small>
                    )}
                  </td>
                  <td>{department.head?.fullName ?? "Unassigned"}</td>
                  <td>{department._count.members}</td>
                  <td>
                    <span
                      className={`admin-pill ${department.active ? "good" : "neutral"}`}
                    >
                      {department.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td><button type="button" className="admin-secondary" onClick={() => beginEdit(department)}>Edit</button></td>
                </tr>
              ))
            ) : (
              !error && (
                <tr>
                  <td className="admin-empty" colSpan={5}>
                    No departments yet.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {editing && <form className="admin-form admin-staff-profile-form" onSubmit={updateDepartment}>
        <h3>Edit {editing.name}</h3>
        <label>Department name<input required minLength={2} maxLength={100} value={editName} onChange={(e) => setEditName(e.target.value)}/></label>
        <label>Description<input maxLength={1000} value={editDescription} onChange={(e) => setEditDescription(e.target.value)}/></label>
        <label>Department head<select value={headId} onChange={(e) => setHeadId(e.target.value)}><option value="">Unassigned</option>{staffOptions.filter((person) => person.department?.id === editing.id).map((person) => <option key={person.id} value={person.id}>{person.fullName} · {person.employeeCode}</option>)}</select></label>
        <label className="admin-checkbox-field"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/> Active</label>
        <div className="admin-action-row"><button className="admin-primary" disabled={busy}>{busy ? "Saving…" : "Save department"}</button><button type="button" className="admin-secondary" onClick={() => setEditing(null)}>Cancel</button></div>
      </form>}
      {data && (
        <div className="admin-quote-pagination">
          <span>{data.total} departments</span>{" "}
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
