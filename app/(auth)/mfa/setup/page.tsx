"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, CheckCircle, AlertTriangle } from "lucide-react";

export default function MfaSetupPage() {
  const { user, isLoaded } = useUser();
  const { user: clerkUser } = useClerk();
  const router = useRouter();
  const [isEnabling, setIsEnabling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isLoaded && user?.twoFactorEnabled) {
      const role = (user.publicMetadata as Record<string, string>)?.role;
      const home = role === "SUPER_ADMIN" ? "/super-admin/dashboard" : "/admin/dashboard";
      router.push(home);
    }
  }, [isLoaded, user, router]);

  const handleEnableMfa = async () => {
    setIsEnabling(true);
    setError(null);
    try {
      const response = await fetch("/api/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate MFA secret");
      }

      const data = await response.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsEnabling(false);
    }
  };

  const handleVerify = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Invalid verification code");
      }

      setSuccess(true);
      await clerkUser?.reload();

      setTimeout(() => {
        const role = (user?.publicMetadata as Record<string, string>)?.role;
        const home = role === "SUPER_ADMIN" ? "/super-admin/dashboard" : "/admin/dashboard";
        router.push(home);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-xl text-white">Two-Factor Authentication Required</CardTitle>
          </div>
          <CardDescription className="text-neutral-400">
            Admin access requires MFA. Set up an authenticator app to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!qrCode && !success && (
            <div className="space-y-4">
              <div className="rounded-lg bg-neutral-800 p-4 text-sm text-neutral-300">
                <p className="mb-2 font-medium text-white">Why is this required?</p>
                <ul className="list-disc space-y-1 pl-4 text-neutral-400">
                  <li>Protects agency financial data</li>
                  <li>Required for all admin roles per PropFlow security policy</li>
                  <li>Prevents unauthorized access even if password is compromised</li>
                </ul>
              </div>
              <Button 
                onClick={handleEnableMfa} 
                disabled={isEnabling}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {isEnabling ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                ) : (
                  "Set Up Authenticator"
                )}
              </Button>
            </div>
          )}

          {qrCode && !success && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img src={qrCode} alt="MFA QR Code" className="h-48 w-48 rounded-lg border border-neutral-700" />
              </div>
              {secret && (
                <div className="rounded-lg bg-neutral-800 p-3 text-center">
                  <p className="text-xs text-neutral-500">Can&apos;t scan? Enter this code:</p>
                  <code className="mt-1 block text-sm font-mono text-emerald-400">{secret}</code>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Enter 6-digit code from your app</label>
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="border-neutral-700 bg-neutral-800 text-center text-lg tracking-[0.5em] text-white"
                />
              </div>
              <Button 
                onClick={handleVerify} 
                disabled={isVerifying || totpCode.length !== 6}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {isVerifying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                ) : (
                  "Verify & Enable"
                )}
              </Button>
            </div>
          )}

          {success && (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="text-lg font-semibold text-white">MFA Enabled Successfully</h3>
              <p className="text-sm text-neutral-400">Redirecting to your dashboard...</p>
              {backupCodes.length > 0 && (
                <div className="rounded-lg bg-amber-950/30 border border-amber-800/50 p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-medium text-amber-400">Save these backup codes</p>
                  </div>
                  <p className="text-xs text-neutral-400 mb-2">
                    If you lose access to your authenticator, use one of these codes to sign in. Each code can only be used once.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, i) => (
                      <code key={i} className="rounded bg-neutral-800 px-2 py-1 text-center text-xs font-mono text-neutral-300">{code}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-950/30 border border-red-800/50 p-3 text-sm text-red-400">{error}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
