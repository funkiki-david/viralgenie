"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";

type Lang = "cn" | "en";

const i18n = {
  en: {
    title: "ViralGenie",
    subtitle: "Website, Social Media & Video Platform",
    tagline: "Enter passcode to continue",
    placeholder: "Enter passcode",
    submit: "Enter",
    submitting: "Signing in...",
    incorrect: "Incorrect passcode",
    networkError: "Network error",
  },
  cn: {
    title: "ViralGenie",
    subtitle: "Website, Social Media & Video Platform",
    tagline: "输入密码以继续",
    placeholder: "请输入访问码",
    submit: "进入",
    submitting: "登录中...",
    incorrect: "访问码错误",
    networkError: "网络错误",
  },
} as const;

function GenieLogo({ size = 88 }: { size?: number }) {
  const id = useMemo(() => `gg-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#${id})`} />
      <path
        d="M 22 18 Q 26 12, 30 18"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 30 16 Q 34 10, 38 16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 38 18 Q 42 12, 46 18"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="34" r="14" fill="white" />
      <circle cx="27" cy="32" r="1.8" fill="#1f2937" />
      <circle cx="37" cy="32" r="1.8" fill="#1f2937" />
      <path
        d="M 26 38 Q 32 43, 38 38"
        stroke="#1f2937"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function LangToggle({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-zinc-100 p-1 text-xs font-medium">
      <button
        onClick={() => setLang("cn")}
        className={`px-3 py-1.5 rounded-full transition-all ${
          lang === "cn"
            ? "bg-white text-zinc-900 shadow-sm"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        中文
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1.5 rounded-full transition-all ${
          lang === "en"
            ? "bg-white text-zinc-900 shadow-sm"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        EN
      </button>
    </div>
  );
}

export default function LoginPage() {
  const [lang, setLang] = useState<Lang>("cn");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("viralgenie_lang") as Lang | null;
      if (saved === "cn" || saved === "en") setLang(saved);
    }
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("viralgenie_lang", lang);
    }
  }, [lang]);

  const t = i18n[lang];

  const submit = async () => {
    if (!passcode || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        passcode,
        redirect: false,
        callbackUrl: "/",
      });
      if (result?.error) {
        setError(t.incorrect);
        setSubmitting(false);
        return;
      }
      // Force same-origin "/" to dodge any NEXTAUTH_URL/port mismatch in dev.
      window.location.href = "/";
    } catch {
      setError(t.networkError);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-purple-50 via-white to-emerald-50">
      <div className="absolute top-4 right-4">
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <GenieLogo size={88} />
          <h1
            className="mt-5 text-4xl bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent"
            style={{ fontFamily: "var(--font-sora)", fontWeight: 700 }}
          >
            {t.title}
          </h1>
          <p
            className="mt-2 text-xs text-zinc-500"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {t.subtitle}
          </p>
          <p className="mt-4 text-sm text-zinc-600">{t.tagline}</p>
        </div>
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-xl p-6 space-y-4">
          <input
            ref={inputRef}
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t.placeholder}
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            onClick={submit}
            disabled={!passcode || submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
