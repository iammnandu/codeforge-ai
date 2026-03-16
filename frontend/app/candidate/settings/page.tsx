"use client";
import { useEffect, useState } from "react";
import { CandidateShell } from "@/components/shells/CandidateShell";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export default function CandidateSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profile, setProfile] = useState({
    email: "",
    username: "",
    full_name: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    api.get("/users/me")
      .then(({ data }) => {
        setProfile({
          email: data.email || "",
          username: data.username || "",
          full_name: data.full_name || "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put("/users/me", profile);
      toast.success("Profile updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New password and confirm password must match");
      return;
    }
    setSavingPassword(true);
    try {
      await api.put("/users/me/password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success("Password changed successfully");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500";

  return (
    <CandidateShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your profile and account security</p>
        </div>

        {loading ? (
          <div className="h-24 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
        ) : (
          <>
            <form onSubmit={saveProfile} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-semibold">Profile</h2>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                <input
                  value={profile.full_name}
                  onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Username</label>
                  <input
                    value={profile.username}
                    onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium"
              >
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </form>

            <form onSubmit={changePassword} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-semibold">Security</h2>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Current password</label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">New password</label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Confirm new password</label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, confirm_password: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium"
              >
                {savingPassword ? "Updating..." : "Change Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </CandidateShell>
  );
}
