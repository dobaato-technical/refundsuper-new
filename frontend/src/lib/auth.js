export function isAuthed() {
  return Boolean(localStorage.getItem("ab_admin_token"));
}

export function saveAuth(token, email) {
  localStorage.setItem("ab_admin_token", token);
  localStorage.setItem("ab_admin_email", email);
}

export function clearAuth() {
  localStorage.removeItem("ab_admin_token");
  localStorage.removeItem("ab_admin_email");
}

export function getAdminEmail() {
  return localStorage.getItem("ab_admin_email") || "";
}
