import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/logo.png";
import "./LoginModal.css";

const DEFAULT_USERNAME = "demo";
const DEFAULT_PASSWORD = "123456";

export function LoginModal() {
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-modal" role="dialog" aria-modal="true" aria-label="登录">
      <div className="login-modal__backdrop" aria-hidden />
      <div className="login-modal__card-wrap">
        <div className="login-modal__card">
          <div className="login-modal__header">
            <img
              src={logoImg}
              alt="ViteCut"
              className="login-modal__logo"
            />
            <p className="login-modal__subtitle">
              使用您的账号登录，继续使用 ViteCut
            </p>
          </div>
          <form onSubmit={handleSubmit} className="login-modal__form">
            <label className="login-modal__label">用户名</label>
            <input
              type="text"
              className="login-modal__input"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={submitting}
            />
            <label className="login-modal__label">密码</label>
            <div className="login-modal__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                className="login-modal__input login-modal__input--password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
              />
              <button
                type="button"
                className="login-modal__eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                title={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {error && (
              <div className="login-modal__error" role="alert">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="login-modal__submit"
              disabled={submitting || !username.trim() || !password}
            >
              {submitting ? "请稍候…" : "登录"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
