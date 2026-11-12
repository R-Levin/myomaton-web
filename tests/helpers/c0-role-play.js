const reviewForm = document.querySelector("#rehearsal-note");
const perspective = document.querySelector("#operator-role");
const noteList = document.querySelector("#rehearsal-handoff");
const titles = {
  "content-reviewer": "Content Reviewer",
  "technical-operator": "Technical Operator",
};
const tasks = {
  "content-reviewer": ["Observation", "Request a content change"],
  "technical-operator": ["QA observation", "Request a technical change"],
};

if (reviewForm && perspective && noteList) {
  const category = reviewForm.elements.namedItem("category");
  const note = reviewForm.elements.namedItem("note");
  const fields = reviewForm.querySelector("fieldset");
  const status = document.querySelector("#rehearsal-note-status");
  function updateTasks() {
    const choices = tasks[perspective.value];
    if (!choices) return;
    category.replaceChildren(...choices.map(choice => new Option(choice)));
    status.textContent = "";
  }
  updateTasks();
  fields.disabled = false;
  perspective.addEventListener("change", updateTasks);
  window.addEventListener("pageshow", updateTasks);
  reviewForm.addEventListener("submit", event => {
    event.preventDefault();
    const role = perspective.value;
    const value = note.value.trim();
    if (!tasks[role]?.includes(category.value) || !value || value.length > 500) return;
    const recipient = role === "content-reviewer" ? titles["technical-operator"] : titles["content-reviewer"];
    const entry = document.createElement("li");
    entry.textContent = `${titles[role]} → ${recipient} · ${category.value} · ${value}`;
    noteList.append(entry);
    note.value = "";
    status.textContent = `Rehearsal note available to the ${recipient} perspective in this tab.`;
  });
}
