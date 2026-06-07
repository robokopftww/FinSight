"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getProfile, updateProfile, type UserProfile } from "@/lib/api";

const frequencies: Array<NonNullable<UserProfile["payFrequency"]>> = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "annually",
];

export function OnboardingModal() {
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [employed, setEmployed] = useState<boolean | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [grossPay, setGrossPay] = useState("");
  const [payFrequency, setPayFrequency] = useState<NonNullable<UserProfile["payFrequency"]>>("monthly");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    void (async () => {
      const profile = await getProfile(await getToken());
      setOpen(!profile.onboardedAt);
    })();
  }, [getToken, isSignedIn]);

  if (!open) {
    return null;
  }

  async function persist(payload: Partial<UserProfile>) {
    setSaving(true);
    setError(null);
    try {
      await updateProfile(payload, await getToken());
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save profile");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-white">Tell us about your income</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">This personalizes your dashboard. You can change it anytime in Settings.</p>

        <div className="mt-5 space-y-4">
          <div>
            <div className="text-sm text-slate-300">Are you employed?</div>
            <div className="mt-2 flex gap-2">
              <Button variant={employed === true ? "primary" : "secondary"} onClick={() => setEmployed(true)}>Yes</Button>
              <Button variant={employed === false ? "primary" : "secondary"} onClick={() => setEmployed(false)}>No</Button>
            </div>
          </div>

          {employed ? (
            <div className="space-y-3">
              <input className={inputClass} placeholder="Job title (optional)" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
              <input className={inputClass} placeholder="Gross pay per period" min="0" type="number" value={grossPay} onChange={(event) => setGrossPay(event.target.value)} />
              <select className={inputClass} value={payFrequency} onChange={(event) => setPayFrequency(event.target.value as NonNullable<UserProfile["payFrequency"]>)}>
                {frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
              </select>
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        <div className="mt-6 flex justify-between gap-3">
          <Button variant="ghost" onClick={() => void persist({ employmentStatus: "unknown" })} disabled={saving}>Skip for now</Button>
          <Button
            onClick={() => void persist(employed
              ? { employmentStatus: "employed", jobTitle: jobTitle || null, grossPay: Number(grossPay), payFrequency }
              : { employmentStatus: "unemployed" })}
            disabled={saving || employed === null || (employed && !Number(grossPay))}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
