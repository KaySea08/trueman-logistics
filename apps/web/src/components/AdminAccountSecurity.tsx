import { FormEvent, useState } from "react";
import { apiRequest } from "../api/client";

export default function AdminAccountSecurity({
  required,
  onChanged,
}: {
  required: boolean;
  onChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest("/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      onChanged();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not change your password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel admin-account-security">
      <div className="admin-panel-heading">
        <h2>Change password</h2>
      </div>
      {required && (
        <p className="admin-quote-notice" role="status">
          Change your temporary password to continue.
        </p>
      )}
      {error && (
        <div className="admin-banner-error" role="alert">
          {error}
        </div>
      )}
      <form className="admin-form admin-account-security-form" onSubmit={submit}>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={100}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={100}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={100}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <button className="admin-primary" disabled={busy}>
          {busy ? "Changing..." : "Change password"}
        </button>
      </form>
    </section>
  );
}
