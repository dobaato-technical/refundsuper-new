"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("admin@aussieback.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/admin/login", { email, password });
      saveAuth(data.access_token, data.admin_email);
      toast.success("Welcome back");
      router.push("/admin");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] flex flex-col">
      <div className="px-6 md:px-12 py-5 border-b border-[#E5E7EB] bg-white">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#475569] hover:text-[#014E87]" data-testid="back-home">
          <ArrowLeft className="h-4 w-4" /> Back to site
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <form
          onSubmit={submit}
          className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-[0_18px_60px_-20px_rgba(1, 78, 135, 0.15)]"
          data-testid="admin-login-form"
        >
          <div className="h-12 w-12 rounded-xl bg-[#014E87] text-white flex items-center justify-center mb-5">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl font-medium text-[#014E87] mb-1">
            Admin sign-in
          </h1>
          <p className="text-sm text-[#475569] mb-6">
            Manage your refundmysuper lead pipeline.
          </p>

          <div className="space-y-4">
            <div>
              <Label className="text-sm text-[#014E87]">Email</Label>
              <Input
                data-testid="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#F8FAFC] border-[#E5E7EB] h-11 mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-sm text-[#014E87]">Password</Label>
              <Input
                data-testid="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#F8FAFC] border-[#E5E7EB] h-11 mt-1"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="admin-login-submit"
            className="w-full mt-6 bg-[#014E87] hover:bg-[#013A66] text-white h-12 rounded-lg shadow-[0_4px_14px_0_rgba(1, 78, 135, 0.28)] hover:-translate-y-0.5 transition-all disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
