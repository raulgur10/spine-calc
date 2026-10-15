import { useState } from "react";
import { authAvailable, signIn, signOut, sendPasswordReset, setPassword } from "./auth";
import { COLORS, FONT_SANS } from "./theme";
import { useI18n } from "./i18n";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${COLORS.inputBorder}`, background: COLORS.inputBg, color: COLORS.text,
  fontSize: 14, fontFamily: FONT_SANS, outline: "none", marginBottom: 10,
};
const btnPrimary = (disabled) => ({
  width: "100%", padding: "11px 14px", borderRadius: 8, border: "none",
  background: disabled ? COLORS.textMuted : COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT_SANS,
});
const linkBtn = { background: "none", border: "none", color: COLORS.accent, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: FONT_SANS, textDecoration: "underline" };

export function AuthModal({ mode: modeInicial = "login", onClose, onDone }) {
  const { t } = useI18n();
  const [mode, setMode] = useState(modeInicial); // login | reset | password
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: "error"|"ok", texto }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "login") {
        await signIn(email, pass);
        onDone?.();
      } else if (mode === "reset") {
        await sendPasswordReset(email);
        setMsg({ tipo: "ok", texto: t("auth.reset.enviado") });
      } else {
        if (pass.length < 10) throw new Error(t("auth.pass.corta"));
        if (pass !== pass2) throw new Error(t("auth.pass.no_coincide"));
        await setPassword(pass);
        // Se limpia el token del enlace para que recargar no lo reintente.
        history.replaceState(null, "", window.location.pathname + window.location.search);
        onDone?.();
      }
    } catch (err) {
      const texto = /invalid login/i.test(err.message) ? t("auth.error.credenciales") : err.message;
      setMsg({ tipo: "error", texto });
    } finally {
      setBusy(false);
    }
  };

  const titulo = { login: t("auth.titulo"), reset: t("auth.reset.titulo"), password: t("auth.pass.titulo") }[mode];

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 12000, background: "rgba(15,27,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 380, background: COLORS.card, borderRadius: 14, padding: "22px 22px 18px", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", fontFamily: FONT_SANS }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.5, marginBottom: 16 }}>
          {mode === "password" ? t("auth.pass.ayuda") : t("auth.ayuda")}
        </div>

        {mode !== "password" && (
          <input type={mode === "reset" ? "email" : "text"} required autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder={mode === "reset" ? t("auth.correo") : t("auth.usuario")} value={email}
            onChange={(e) => setEmail(e.target.value)} style={inputStyle} autoFocus />
        )}
        {mode !== "reset" && (
          <input type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? t("auth.contrasena") : t("auth.pass.nueva")} value={pass}
            onChange={(e) => setPass(e.target.value)} style={inputStyle} autoFocus={mode === "password"} />
        )}
        {mode === "password" && (
          <input type="password" required autoComplete="new-password" placeholder={t("auth.pass.repite")} value={pass2}
            onChange={(e) => setPass2(e.target.value)} style={inputStyle} />
        )}

        {msg && (
          <div style={{ fontSize: 12.5, marginBottom: 10, padding: "8px 10px", borderRadius: 6,
            background: msg.tipo === "error" ? COLORS.redBg : COLORS.greenBg, color: msg.tipo === "error" ? COLORS.red : COLORS.green }}>
            {msg.texto}
          </div>
        )}

        <button type="submit" disabled={busy} style={btnPrimary(busy)}>
          {busy ? "…" : { login: t("auth.entrar"), reset: t("auth.reset.enviar"), password: t("auth.pass.guardar") }[mode]}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          {mode === "login" && <button type="button" style={linkBtn} onClick={() => { setMode("reset"); setMsg(null); }}>{t("auth.olvide")}</button>}
          {mode === "reset" && <button type="button" style={linkBtn} onClick={() => { setMode("login"); setMsg(null); }}>{t("auth.volver")}</button>}
          <button type="button" style={{ ...linkBtn, color: COLORS.textDim, marginLeft: "auto" }} onClick={onClose}>{t("common.cerrar")}</button>
        </div>
      </form>
    </div>
  );
}

// Botón de la barra superior: «Entrar» o el correo con «Salir».
export function AuthButton({ session, onLogin }) {
  const { t } = useI18n();
  if (!authAvailable) return null;
  const base = { padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT_SANS };
  if (!session) {
    return (
      <button onClick={onLogin} style={{ ...base, border: `1px solid ${COLORS.accent}`, background: "transparent", color: COLORS.accent }}>
        {t("auth.entrar")}
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: COLORS.textDim, fontFamily: FONT_SANS }}>
      <span title={session.user?.email} style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user?.email}</span>
      <button onClick={() => signOut()} style={{ ...base, border: `1px solid ${COLORS.inputBorder}`, background: "transparent", color: COLORS.textDim }}>
        {t("auth.salir")}
      </button>
    </span>
  );
}
