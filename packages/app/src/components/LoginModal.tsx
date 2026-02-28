import { useState } from "react";
import { Eye, EyeClosed } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/logo.png";
import "./LoginModal.css";

const DEFAULT_USERNAME = "demo";
const DEFAULT_PASSWORD = "123456";

/** 与后端 auth 路由一致 */
const USERNAME_MIN = 2;
const USERNAME_MAX = 64;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 128;

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
    <div
      className="login-modal"
      role="dialog"
      aria-modal="true"
      aria-label="登录"
    >
      <div className="login-modal__backdrop" aria-hidden />
      <div className="login-modal__card-wrap">
        <div className="login-modal__card">
          <div className="login-modal__header">
            <img src={logoImg} alt="ViteCut" className="login-modal__logo" />
            <p className="login-modal__subtitle">
              使用您的账号登录，使用 ViteCut
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
              minLength={USERNAME_MIN}
              maxLength={USERNAME_MAX}
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
                minLength={PASSWORD_MIN}
                maxLength={PASSWORD_MAX}
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
                  <Eye size={22} aria-hidden />
                ) : (
                  <EyeClosed size={22} aria-hidden />
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
              disabled={
                submitting ||
                !username.trim() ||
                !password ||
                username.trim().length < USERNAME_MIN ||
                password.length < PASSWORD_MIN
              }
            >
              {submitting ? "请稍候…" : "登录"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
