"use client";

import { useEffect, useId, useRef, useState } from "react";
import { signIn } from "next-auth/react";

type Lang = "zh" | "en";

const i18n = {
  en: {
    title: "ViralGenie",
    subtitle: "Website, Social Media & Video Platform",
    tagline: "Sign in to continue",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Your password",
    submit: "Sign in",
    submitting: "Signing in...",
    incorrect: "Incorrect email or password",
    networkError: "Network error",
    bothRequired: "Email and password are required",
  },
  zh: {
    title: "ViralGenie",
    subtitle: "Website, Social Media & Video Platform",
    tagline: "登录以继续",
    emailLabel: "邮箱",
    emailPlaceholder: "you@example.com",
    passwordLabel: "密码",
    passwordPlaceholder: "请输入密码",
    submit: "登录",
    submitting: "登录中...",
    incorrect: "邮箱或密码错误",
    networkError: "网络错误",
    bothRequired: "邮箱和密码都必填",
  },
} as const;

function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  const langs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const l of langs) {
    if (l.toLowerCase().startsWith("zh")) return "zh";
    if (l.toLowerCase().startsWith("en")) return "en";
  }
  return "en";
}

function GenieLogo({ size = 88 }: { size?: number }) {
  // useId() returns a stable id that matches between SSR and client hydration.
  // Sanitize colons so the value is safe inside fill="url(#id)" everywhere.
  const id = `gg-${useId().replace(/:/g, "")}`;
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
      <path d="M 22 18 Q 26 12, 30 18" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M 30 16 Q 34 10, 38 16" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M 38 18 Q 42 12, 46 18" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="34" r="14" fill="white" />
      <circle cx="27" cy="32" r="1.8" fill="#1f2937" />
      <circle cx="37" cy="32" r="1.8" fill="#1f2937" />
      <path d="M 26 38 Q 32 43, 38 38" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" fill="none" />
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
        onClick={() => setLang("zh")}
        className={`px-3 py-1.5 rounded-full transition-all ${
          lang === "zh"
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
  // Default to "en" for SSR consistency; resolve browser/cached pref on mount.
  const [lang, setLang] = useState<Lang>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Priority: cached preference > browser locale > "en"
    const saved = localStorage.getItem("viralgenie_lang") as Lang | null;
    if (saved === "zh" || saved === "en") {
      setLang(saved);
    } else {
      setLang(detectBrowserLang());
    }
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("viralgenie_lang", lang);
    }
  }, [lang]);

  const t = i18n[lang];

  const submit = async () => {
    if (submitting) return;
    if (!email || !password) {
      setError(t.bothRequired);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
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
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-xl p-6 space-y-3">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-zinc-600 mb-1"
            >
              {t.emailLabel}
            </label>
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-zinc-600 mb-1"
            >
              {t.passwordLabel}
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t.passwordPlaceholder}
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            />
          </div>
          {error && <p className="text-sm text-rose-600 pt-1">{error}</p>}
          <button
            onClick={submit}
            disabled={!email || !password || submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 mt-1"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
