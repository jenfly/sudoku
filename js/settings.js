// Settings screen: builds the toggle list from a static schema and wires
// changes back through a single onChange(key, value) callback.

const SETTINGS_SCHEMA = [
  {
    title: "Gameplay assistance",
    rows: [
      {
        key: "autoCheckMistakes",
        label: "Auto-check mistakes",
        desc: "Immediately flag entries that don't match the solution.",
      },
      {
        key: "highlightDuplicates",
        label: "Highlight duplicates",
        desc: "Flag numbers that repeat in a row, column, or box.",
      },
      {
        key: "highlightSameNumber",
        label: "Highlight same numbers",
        desc: "Highlight every cell matching the selected digit.",
      },
      {
        key: "highlightPeers",
        label: "Highlight row & column",
        desc: "Tint the selected cell's row, column, and box.",
      },
      {
        key: "autoRemovePencilMarks",
        label: "Auto-remove pencil marks",
        desc: "Clear notes invalidated by a new entry.",
      },
    ],
  },
  {
    title: "Display",
    rows: [
      { key: "showTimer", label: "Show timer", desc: "Display elapsed time on the game screen." },
      { key: "showMistakes", label: "Show mistake counter", desc: "Display the mistake count on the game screen." },
      { key: "darkMode", label: "Dark mode", desc: "Use a dark palette throughout the app." },
    ],
  },
  {
    title: "Difficulty",
    rows: [
      {
        key: "rememberLastLevel",
        label: "Remember last level",
        desc: "The app always resumes or starts at your last-used level.",
        locked: true,
      },
      {
        key: "limitMistakes",
        label: "Limit mistakes",
        desc: "End the puzzle after 3 mistakes, instead of tracking only.",
      },
    ],
  },
];

function renderSettings(container, settings, onChange) {
  container.innerHTML = "";
  for (const group of SETTINGS_SCHEMA) {
    const section = document.createElement("section");
    section.className = "settings-section";

    const heading = document.createElement("h2");
    heading.className = "settings-heading";
    heading.textContent = group.title;
    section.appendChild(heading);

    const card = document.createElement("div");
    card.className = "settings-card";

    for (const row of group.rows) {
      const rowEl = document.createElement("div");
      rowEl.className = "settings-row";

      const textEl = document.createElement("div");
      textEl.className = "settings-row-text";
      const labelEl = document.createElement("div");
      labelEl.className = "settings-row-label";
      labelEl.textContent = row.label;
      const descEl = document.createElement("div");
      descEl.className = "settings-row-desc";
      descEl.textContent = row.desc;
      textEl.appendChild(labelEl);
      textEl.appendChild(descEl);

      const switchEl = document.createElement("button");
      switchEl.type = "button";
      switchEl.className = "switch";
      const checked = row.locked ? true : !!settings[row.key];
      switchEl.classList.toggle("is-on", checked);
      switchEl.setAttribute("role", "switch");
      switchEl.setAttribute("aria-checked", String(checked));
      switchEl.disabled = !!row.locked;
      if (row.locked) switchEl.classList.add("is-locked");

      if (!row.locked) {
        switchEl.addEventListener("click", () => {
          const next = !settings[row.key];
          onChange(row.key, next);
        });
      }

      rowEl.appendChild(textEl);
      rowEl.appendChild(switchEl);
      card.appendChild(rowEl);
    }

    section.appendChild(card);
    container.appendChild(section);
  }
}

window.SettingsUI = { renderSettings };
