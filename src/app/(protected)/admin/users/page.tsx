"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Trash2, CheckCircle, AlertCircle, Shield, Eye } from "lucide-react";

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ email: "", password: "", role: "VIEWER" });
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      setStatus({ type: "success", msg: `User "${data.email}" created.` });
      setForm({ email: "", password: "", role: "VIEWER" });
      await loadUsers();
    } else {
      setStatus({ type: "error", msg: data.error ?? "Failed to create user" });
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Delete user "${email}"? They will lose access immediately.`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      setStatus({ type: "error", msg: data.error ?? "Failed to delete user" });
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500 mt-1">Manage who has access to the leads manager.</p>
      </div>

      {/* Create user form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New User</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="space-y-1 w-40">
              <label className="text-sm font-medium text-gray-700">Role</label>
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="VIEWER">Viewer</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </div>

            {status && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2 ${
                status.type === "success"
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-red-700 bg-red-50 border border-red-200"
              }`}>
                {status.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {status.msg}
              </div>
            )}

            <Button type="submit" disabled={creating} className="gap-2">
              <UserPlus className="h-4 w-4" />
              {creating ? "Creating…" : "Create User"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Users list */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">No users yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((u) => {
                const initial = u.email[0].toUpperCase();
                const isAdmin = u.role === "ADMIN";
                return (
                  <div key={u.id} className="flex items-center justify-between px-4 sm:px-6 py-3.5 hover:bg-gray-50 transition-colors gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm ${
                        isAdmin
                          ? "bg-gradient-to-br from-purple-500 to-purple-700"
                          : "bg-gradient-to-br from-emerald-500 to-emerald-700"
                      }`}>
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                        <p className="text-xs text-gray-400">
                          Joined {new Date(u.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isAdmin ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {isAdmin ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {u.role}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(u.id, u.email)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
