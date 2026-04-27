const state = {
  recipes: [],
  selectedId: "",
  query: "",
  tag: "all",
  cookIndex: 0,
  navHidden: false,
  navDrawerOpen: false
};

const els = {
  brandButton: document.querySelector("#brandButton"),
  brandEyebrow: document.querySelector("#brandEyebrow"),
  brandTitle: document.querySelector("#brandTitle"),
  navButton: document.querySelector("#navButton"),
  navPanelCloseButton: document.querySelector("#navPanelCloseButton"),
  themeButton: document.querySelector("#themeButton"),
  layout: document.querySelector(".layout"),
  navBackdrop: document.querySelector("#navBackdrop"),
  recipePanel: document.querySelector("#recipePanel"),
  searchInput: document.querySelector("#searchInput"),
  tagStrip: document.querySelector("#tagStrip"),
  recipeList: document.querySelector("#recipeList"),
  recipeDetail: document.querySelector("#recipeDetail")
};

const tones = ["sage", "blue", "honey", "rose", "clay", "mint"];
const recipeImages = {
  "paprika-pasta": "/assets/recipes/pasta-with-sausage.jpg",
  "stekt-torsk-avokadohollandaise": "/assets/recipes/stekt-torsk-avokadohollandaise.jpg"
};
let activeWakeLock = null;
let suppressRecipeClickUntil = 0;
const mobileQuery = window.matchMedia("(max-width: 820px)");

function logoMarkSvg(className) {
  return `
    <svg class="${className}" viewBox="0 0 140 100" aria-hidden="true" focusable="false">
      <g transform="rotate(-12 47 51)">
        <rect x="38" y="28" width="17" height="45" rx="2" fill="var(--logo-book-green)"></rect>
        <rect x="42" y="36" width="9" height="3" fill="var(--surface)" opacity="0.85"></rect>
        <rect x="42" y="43" width="10" height="3" fill="var(--surface)" opacity="0.85"></rect>
        <rect x="42" y="65" width="9" height="3" fill="var(--surface)" opacity="0.85"></rect>
      </g>
      <rect x="60" y="24" width="19" height="52" rx="2" fill="var(--logo-book-yellow)"></rect>
      <rect x="64" y="32" width="11" height="4" fill="var(--surface)" opacity="0.85"></rect>
      <rect x="64" y="67" width="11" height="4" fill="var(--surface)" opacity="0.85"></rect>
      <rect x="83" y="20" width="20" height="56" rx="2" fill="var(--logo-book-rose)"></rect>
      <rect x="88" y="29" width="10" height="4" fill="var(--surface)" opacity="0.85"></rect>
      <rect x="88" y="39" width="10" height="3" fill="var(--surface)" opacity="0.85"></rect>
      <rect x="88" y="67" width="10" height="4" fill="var(--surface)" opacity="0.85"></rect>
      <rect x="24" y="78" width="95" height="7" rx="2" fill="var(--logo-shelf)"></rect>
      <path d="M28 85h8l-2 9h-4l-2-9ZM109 85h8l-2 9h-4l-2-9Z" fill="var(--logo-shelf)"></path>
    </svg>
  `;
}

function toneFor(value) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return tones[hash % tones.length];
}

function preferredTheme() {
  const storedTheme = localStorage.getItem("recipeShelf:theme");
  if (storedTheme) return storedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("recipeShelf:theme", theme);
}

function allTags() {
  return [...new Set(state.recipes.flatMap((recipe) => recipe.tags))].sort();
}

function isHomeView() {
  return !selectedRecipe();
}

function filteredRecipes() {
  const query = state.query.trim().toLowerCase();
  return state.recipes.filter((recipe) => {
    const matchesTag = state.tag === "all" || recipe.tags.includes(state.tag);
    const text = [
      recipe.title,
      recipe.tags.join(" "),
      recipe.sections.flatMap((section) => section.lines).join(" ")
    ]
      .join(" ")
      .toLowerCase();
    return matchesTag && (!query || text.includes(query));
  });
}

function selectedRecipe() {
  if (!state.selectedId) return null;
  return state.recipes.find((recipe) => recipe.id === state.selectedId) || null;
}

function sectionKind(section) {
  const name = section.name.toLowerCase();
  if (name === "steps") return "steps";
  if (name === "notes") return "notes";
  return "ingredients";
}

function usefulLines(section) {
  return section.lines.filter((line) => line.trim());
}

function stripMarker(line) {
  return line.trim().replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}

function stepItemsFor(recipe) {
  if (recipe.stepItems?.length) return recipe.stepItems;
  return recipe.steps?.length
    ? recipe.steps.map((step) => ({ type: "instruction", text: step }))
    : recipe.sections.find((section) => section.name.toLowerCase() === "steps")?.lines.map((line) => ({
        type: "instruction",
        text: stripMarker(line)
      })).filter((item) => item.text) || [];
}

function filterTags() {
  return ["all", ...allTags()];
}

function selectTag(tag) {
  state.tag = tag;
  render();
}

function selectAdjacentTag(direction) {
  const tags = filterTags();
  const currentIndex = Math.max(tags.indexOf(state.tag), 0);
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), tags.length - 1);
  if (nextIndex === currentIndex) return;
  selectTag(tags[nextIndex]);
}

function tagButtons() {
  const tags = filterTags();
  return tags.map((tag) => {
    const button = document.createElement("button");
    button.className = "tag-button";
    button.type = "button";
    button.dataset.tone = tag === "all" ? "sage" : toneFor(tag);
    button.textContent = tag === "all" ? "All" : tag;
    button.setAttribute("aria-pressed", String(state.tag === tag));
    button.addEventListener("click", () => {
      selectTag(tag);
    });
    return button;
  });
}

function renderTags(container = els.tagStrip) {
  container.replaceChildren(...tagButtons());
}

function enableResultSwipe(container) {
  let startX = 0;
  let startY = 0;
  let swipeEnabled = false;

  container.addEventListener("touchstart", (event) => {
    swipeEnabled = !event.target.closest("button, input, a");
    if (!swipeEnabled) return;

    const touch = event.changedTouches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });

  container.addEventListener("touchend", (event) => {
    if (!swipeEnabled) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    swipeEnabled = false;

    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;

    suppressRecipeClickUntil = Date.now() + 350;
    selectAdjacentTag(deltaX < 0 ? 1 : -1);
  }, { passive: true });
}

function renderHomeResults(container) {
  const recipes = filteredRecipes();
  container.replaceChildren();

  if (recipes.length === 0) {
    container.innerHTML = `<p class="empty">No recipes match that search.</p>`;
    return;
  }

  container.append(
    ...recipes.map((recipe) => {
      const button = document.createElement("button");
      button.className = "home-card";
      button.type = "button";
      button.dataset.tone = tones[state.recipes.findIndex((item) => item.id === recipe.id) % tones.length];
      button.innerHTML = `
        <strong>${recipe.title}</strong>
        <span>${recipe.tags.length ? recipe.tags.join(" · ") : recipe.sourceFile}</span>
      `;
      button.addEventListener("click", () => {
        if (Date.now() < suppressRecipeClickUntil) return;
        selectRecipe(recipe.id);
      });
      return button;
    })
  );
}

function renderList() {
  const recipes = filteredRecipes();

  if (recipes.length === 0) {
    els.recipeList.innerHTML = `<p class="empty">No recipes match that search.</p>`;
    return;
  }

  els.recipeList.replaceChildren(
    ...recipes.map((recipe) => {
      const button = document.createElement("button");
      button.className = "recipe-card";
      button.type = "button";
      button.dataset.tone = tones[state.recipes.findIndex((item) => item.id === recipe.id) % tones.length];
      button.setAttribute("aria-current", String(recipe.id === state.selectedId));
      button.innerHTML = `
        <strong>${recipe.title}</strong>
        <span>${recipe.tags.length ? recipe.tags.join(" · ") : recipe.sourceFile}</span>
      `;
      button.addEventListener("click", () => selectRecipe(recipe.id));
      return button;
    })
  );
}

function selectRecipe(recipeId) {
  const recipeChanged = state.selectedId !== recipeId;
  state.selectedId = recipeId;
  state.cookIndex = 0;
  if (mobileQuery.matches) {
    state.navDrawerOpen = false;
  }
  render();
  if (recipeChanged) {
    window.scrollTo(0, 0);
  }
}

function renderLine(section, line, recipe) {
  const kind = sectionKind(section);
  const text = stripMarker(line);
  const li = document.createElement("li");
  const isTip = /^tips?:/i.test(text);

  if (isTip) {
    li.className = "tip-line";
    li.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18h6"></path>
        <path d="M10 22h4"></path>
        <path d="M8 14a6 6 0 1 1 8 0c-1 1-1.5 2-1.5 4h-5c0-2-.5-3-1.5-4Z"></path>
      </svg>
      <span>${text.replace(/^tips?:\s*/i, "")}</span>
    `;
    return li;
  }

  if (kind === "ingredients") {
    const id = `check-${recipe.id}-${section.name}-${text}`.replace(/[^a-z0-9_-]+/gi, "-");
    li.innerHTML = `
      <label class="check-line">
        <input type="checkbox" id="${id}">
        <span>${text}</span>
      </label>
    `;
    return li;
  }

  li.textContent = text;
  return li;
}

function renderStepItem(item) {
  const li = document.createElement("li");
  li.className = item.type === "phase" ? "step-phase" : item.type === "tip" ? "step-tip" : "step-instruction";
  li.textContent = item.text;
  return li;
}

function renderSection(section, recipe) {
  const lines = usefulLines(section);
  if (lines.length === 0) return null;

  const block = document.createElement("section");
  block.className = "section-block";

  const heading = document.createElement("h3");
  heading.textContent = section.name;
  block.append(heading);

  const list = document.createElement("ul");
  list.className = sectionKind(section) === "steps" ? "step-list" : "line-list";
  if (sectionKind(section) === "steps" && recipe.stepItems?.length) {
    list.append(...recipe.stepItems.map(renderStepItem));
  } else {
    list.append(...lines.map((line) => renderLine(section, line, recipe)));
  }
  block.append(list);
  return block;
}

function startCooking(recipe, onClose) {
  const steps = stepItemsFor(recipe);

  if (steps.length === 0) return;
  state.cookIndex = 0;

  const overlay = document.createElement("div");
  overlay.className = "cook-overlay";
  overlay.innerHTML = `
    <div class="cook-top">
      <div class="cook-heading">
        <p class="cook-eyebrow">Cooking</p>
        <p class="cook-title">${recipe.title}</p>
      </div>
      <button class="icon-button" type="button" aria-label="Close cooking mode" title="Close">×</button>
    </div>
    <div class="cook-step"></div>
    <div class="cook-bottom">
      <button class="action-button" type="button" data-action="prev">Previous</button>
      <span class="cook-progress"></span>
      <button class="action-button primary" type="button" data-action="next">Next</button>
    </div>
  `;

  const stepEl = overlay.querySelector(".cook-step");
  const progressEl = overlay.querySelector(".cook-progress");
  const prevButton = overlay.querySelector('[data-action="prev"]');
  const nextButton = overlay.querySelector('[data-action="next"]');
  let wheelDelta = 0;
  let wheelReset;
  let stepTransition;

  function sync() {
    const step = steps[state.cookIndex];
    stepEl.classList.toggle("cook-step-phase", step.type === "phase");
    stepEl.classList.toggle("cook-step-tip", step.type === "tip");
    stepEl.textContent = step.text;
    progressEl.textContent = `${state.cookIndex + 1} / ${steps.length}`;
    prevButton.disabled = state.cookIndex === 0;
    nextButton.textContent = state.cookIndex === steps.length - 1 ? "Done" : "Next";
  }

  function closeOverlay() {
    document.removeEventListener("keydown", handleKeydown);
    overlay.removeEventListener("wheel", handleWheel);
    clearTimeout(wheelReset);
    clearTimeout(stepTransition);
    overlay.remove();
    onClose?.();
  }

  function showStep(nextIndex) {
    nextIndex = Math.min(Math.max(nextIndex, 0), steps.length - 1);
    if (nextIndex === state.cookIndex) return;

    clearTimeout(stepTransition);
    stepEl.classList.add("is-changing");
    stepTransition = setTimeout(() => {
      state.cookIndex = nextIndex;
      sync();
      requestAnimationFrame(() => stepEl.classList.remove("is-changing"));
    }, 140);
  }

  function moveStep(direction) {
    showStep(state.cookIndex + direction);
  }

  function moveToNextPhase() {
    const nextPhaseIndex = steps.findIndex((step, index) => index > state.cookIndex && step.type === "phase");
    showStep(nextPhaseIndex === -1 ? steps.length - 1 : nextPhaseIndex);
  }

  function handleKeydown(event) {
    if (!document.body.contains(overlay)) return;
    if (event.key === "Escape") closeOverlay();
    if (event.key === "ArrowRight") moveStep(1);
    if (event.key === "ArrowLeft") moveStep(-1);
    if (event.key === " ") {
      event.preventDefault();
      moveToNextPhase();
    }
  }

  function handleWheel(event) {
    event.preventDefault();
    wheelDelta += event.deltaY;
    clearTimeout(wheelReset);
    wheelReset = setTimeout(() => {
      wheelDelta = 0;
    }, 260);

    if (Math.abs(wheelDelta) < 120) return;
    moveStep(wheelDelta > 0 ? 1 : -1);
    wheelDelta = 0;
  }

  overlay.querySelector(".icon-button").addEventListener("click", closeOverlay);
  prevButton.addEventListener("click", () => {
    moveStep(-1);
  });
  nextButton.addEventListener("click", () => {
    if (state.cookIndex === steps.length - 1) {
      closeOverlay();
      return;
    }
    moveStep(1);
  });
  document.addEventListener("keydown", handleKeydown);
  overlay.addEventListener("wheel", handleWheel, { passive: false });

  document.body.append(overlay);
  sync();
}

async function keepAwake() {
  if (!("wakeLock" in navigator)) return false;
  try {
    activeWakeLock = await navigator.wakeLock.request("screen");
    activeWakeLock.addEventListener("release", () => {
      activeWakeLock = null;
    });
    return true;
  } catch {
    return false;
  }
}

async function releaseWakeLock() {
  if (!activeWakeLock) return;
  await activeWakeLock.release();
  activeWakeLock = null;
}

function renderHome() {
  if (state.recipes.length === 0) {
    els.recipeDetail.innerHTML = `<p class="empty">No recipes loaded. Run npm run convert first.</p>`;
    return;
  }

  const home = document.createElement("div");
  home.className = "home-page";
  home.innerHTML = `
    <div class="home-hero">
      <div class="home-brand" aria-label="Recipe Shelf">
        ${logoMarkSvg("home-logo-mark")}
        <p class="home-brand-eyebrow">Library</p>
        <h2 class="home-brand-title">Recipe Shelf</h2>
        <div class="home-brand-rule" aria-hidden="true"></div>
      </div>
      <p>A personal library of kitchen favorites.</p>
    </div>
    <label class="search home-search">
      <span>Search</span>
      <span class="search-field">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input type="search" autocomplete="off" placeholder="pasta, chickpeas, granola..." value="${state.query}">
      </span>
    </label>
    <div class="tag-strip home-filters" aria-label="Recipe tags"></div>
    <div class="home-recipe-grid"></div>
  `;

  const homeInput = home.querySelector(".home-search input");
  const grid = home.querySelector(".home-recipe-grid");

  homeInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    if (els.searchInput.value !== state.query) {
      els.searchInput.value = state.query;
    }
    renderHomeResults(grid);
  });

  renderTags(home.querySelector(".home-filters"));
  renderHomeResults(grid);

  els.recipeDetail.replaceChildren(home);
}

function renderDetail() {
  const recipe = selectedRecipe();
  if (!recipe) {
    renderHome();
    return;
  }

  const fragment = document.createDocumentFragment();
  const header = document.createElement("div");
  header.className = "detail-header recipe-header";
  header.innerHTML = `
    <div class="recipe-header__main">
      <h2>${recipe.title}</h2>
      <div class="recipe-tags">
        ${recipe.servings ? `<span class="recipe-tag recipe-tag--meta">${recipe.servings}</span>` : ""}
        ${recipe.tags.map((tag) => `<span class="recipe-tag recipe-tag--category">${tag}</span>`).join("")}
        <span class="recipe-tag recipe-tag--file">${recipe.sourceFile}</span>
      </div>
      <div class="recipe-tools" aria-label="Recipe tools">
        <button class="recipe-tool" type="button" data-action="cook" aria-label="Cooking mode" aria-pressed="false" title="Cooking mode">
          <svg class="recipe-tool__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 10h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-5Z"></path>
            <path d="M8 10V8a4 4 0 0 1 8 0v2"></path>
            <path d="M4 10h16"></path>
          </svg>
          <span>Cooking mode</span>
        </button>
        <span class="recipe-tools__separator" aria-hidden="true">·</span>
        <button class="recipe-tool" type="button" data-action="wake" aria-label="Stay awake" aria-pressed="${activeWakeLock ? "true" : "false"}" title="Stay awake">
          <svg class="recipe-tool__icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="16" height="11" rx="2"></rect>
            <path d="M9 20h6"></path>
            <path d="M12 16v4"></path>
          </svg>
          <span>Stay awake</span>
        </button>
      </div>
    </div>
  `;
  header.querySelector('[data-action="cook"]').addEventListener("click", (event) => {
    const button = event.currentTarget;
    button.setAttribute("aria-pressed", "true");
    startCooking(recipe, () => button.setAttribute("aria-pressed", "false"));
  });
  header.querySelector('[data-action="wake"]').addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (activeWakeLock) {
      await releaseWakeLock();
      button.setAttribute("aria-pressed", "false");
      return;
    }

    const ok = await keepAwake();
    button.setAttribute("aria-pressed", ok ? "true" : "false");
  });
  fragment.append(header);

  if (recipeImages[recipe.id]) {
    const imageBlock = document.createElement("figure");
    imageBlock.className = "recipe-image";
    imageBlock.innerHTML = `<img src="${recipeImages[recipe.id]}" alt="${recipe.title}">`;
    fragment.append(imageBlock);
  }

  for (const section of recipe.sections) {
    const block = renderSection(section, recipe);
    if (block) fragment.append(block);
  }

  const source = document.createElement("p");
  source.className = "recipe-source";
  source.innerHTML = recipe.source?.url
    ? `Source: <a href="${recipe.source.url}" target="_blank" rel="noreferrer">${recipe.source.label}</a>`
    : `Source: ${recipe.source?.label || "Unknown"}`;
  fragment.append(source);

  const footer = document.createElement("div");
  footer.className = "recipe-footer";
  footer.innerHTML = `<button class="action-button" type="button">Back to top</button>`;
  footer.querySelector("button").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  fragment.append(footer);

  els.recipeDetail.replaceChildren(fragment);
}

function render() {
  const homeView = isHomeView();
  const mobileView = mobileQuery.matches;
  const navVisible = !homeView && (mobileView ? state.navDrawerOpen : !state.navHidden);

  document.body.classList.toggle("is-home", homeView);
  document.body.classList.toggle("is-recipe", !homeView);
  document.body.classList.toggle("nav-drawer-open", !homeView && mobileView && state.navDrawerOpen);
  els.layout.classList.toggle("home-layout", homeView);
  els.layout.classList.toggle("nav-hidden", !homeView && (mobileView || state.navHidden));
  els.brandEyebrow.textContent = homeView ? "Library" : "";
  els.brandEyebrow.hidden = !homeView;
  els.brandTitle.textContent = homeView ? "Home" : "Recipe";
  els.recipePanel.hidden = !navVisible;
  els.navBackdrop.hidden = homeView || !mobileView || !state.navDrawerOpen;
  els.navButton.hidden = homeView || (!mobileView && navVisible);
  els.navPanelCloseButton.hidden = homeView || mobileView || !navVisible;
  els.navButton.setAttribute("aria-pressed", String(navVisible));
  els.navButton.setAttribute("aria-expanded", String(navVisible));
  els.navButton.setAttribute("aria-label", navVisible ? "Close recipe navigation" : "Open recipe navigation");
  els.navButton.title = navVisible ? "Close recipe navigation" : "Open recipe navigation";
  els.navButton.querySelector("span").textContent = navVisible ? "×" : "☰";
  if (mobileView && state.navDrawerOpen) {
    els.recipePanel.setAttribute("role", "dialog");
    els.recipePanel.setAttribute("aria-modal", "true");
  } else {
    els.recipePanel.setAttribute("role", "region");
    els.recipePanel.removeAttribute("aria-modal");
  }
  els.searchInput.value = state.query;

  if (!homeView) {
    renderTags();
    renderList();
  }

  renderDetail();
}

async function init() {
  setTheme(preferredTheme());
  function goHome() {
    state.selectedId = "";
    render();
  }

  els.brandButton.addEventListener("click", goHome);
  els.navButton.addEventListener("click", () => {
    if (mobileQuery.matches) {
      state.navDrawerOpen = !state.navDrawerOpen;
    } else {
      state.navHidden = !state.navHidden;
    }
    render();
  });
  els.navPanelCloseButton.addEventListener("click", () => {
    state.navHidden = true;
    render();
  });
  els.navBackdrop.addEventListener("click", () => {
    state.navDrawerOpen = false;
    render();
  });
  els.themeButton.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });
  enableResultSwipe(els.recipePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.navDrawerOpen) return;
    state.navDrawerOpen = false;
    render();
  });
  mobileQuery.addEventListener("change", () => {
    state.navDrawerOpen = false;
    render();
  });

  try {
    const response = await fetch("/data/recipes.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.recipes = data.recipes || [];
    state.selectedId = "";
  } catch (error) {
    els.recipeDetail.innerHTML = `<p class="empty">Could not load recipes: ${error.message}</p>`;
  }

  render();
}

init();
