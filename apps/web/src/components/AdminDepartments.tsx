import { FormEvent, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiRequest } from "../api/client";

type Department = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  head: { fullName: string } | null;
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="admin-empty" colSpan={4}>
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
                </tr>
              ))
            ) : (
              !error && (
                <tr>
                  <td className="admin-empty" colSpan={4}>
                    No departments yet.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
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
