const roleSelect = document.querySelector("#operator-role");

if (roleSelect) {
  const storageKey = "miopages-operator-demo-role";
  const defaultRole = roleSelect.value;
  const allowedRoles = new Set(Array.from(roleSelect.options, option => option.value));
  const examples = document.querySelectorAll("[data-role-example]");

  function showRole(value) {
    const role = allowedRoles.has(value) ? value : defaultRole;
    roleSelect.value = role;
    for (const example of examples) example.hidden = example.dataset.roleExample !== role;
  }

  function restoreRole() {
    try { showRole(localStorage.getItem(storageKey)); } catch { /* Storage is optional for this local demonstration. */ }
  }

  restoreRole();
  window.addEventListener("pageshow", restoreRole);
  roleSelect.addEventListener("change", () => {
    showRole(roleSelect.value);
    try { localStorage.setItem(storageKey, roleSelect.value); } catch { /* Keep the current page usable without storage. */ }
  });
  roleSelect.disabled = false;
}
