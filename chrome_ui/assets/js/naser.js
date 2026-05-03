const NASER_SIDEBAR_WIDTH_KEY = "naserSidebarWidth";
const NASER_STATUS_PENDING = "pending";
const NASER_STATUS_REACHABLE = "reachable";
const NASER_STATUS_UNAVAILABLE = "unavailable";
const NASER_STATUS_CACHE_KEY = "naserStatusCache";
const NASER_CHECK_CONCURRENCY = 6;
const NASER_CHECK_TIMEOUT_MS = 8000;
const NASER_STATUS_CACHE_TTL_REACHABLE_MS = 24 * 60 * 60 * 1000;
const NASER_STATUS_CACHE_TTL_UNAVAILABLE_MS = 30 * 60 * 1000;
const NASER_STATUS_CACHE_SAVE_DEBOUNCE_MS = 300;
const NASER_STATUS_CACHE_MAX_ENTRIES = 5000;
const NASER_ALL_GROUP_ID = "__all__";
const NASER_ALL_GROUP_TITLE = "All Links";

let naserStatusCacheSaveTimer = null;

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function setCurrentCount(count) {
  const element = document.getElementById("naser-current-value");
  if (element) element.textContent = String(count);
}

function setTotalCount(count) {
  const element = document.getElementById("naser-total-value");
  if (element) element.textContent = String(count);
}

function setReachableCount(count) {
  const element = document.getElementById("naser-reachable-value");
  if (element) element.textContent = String(count);
}

function setUnavailableCount(count) {
  const element = document.getElementById("naser-unavailable-value");
  if (element) element.textContent = String(count);
}

function setupSidebarResize() {
  const pageBody = document.querySelector(".naser-page");
  const sidebar = document.querySelector(".naser-sidebar-wrap");
  const resizer = document.querySelector(".naser-sidebar-resizer");
  if (!pageBody || !sidebar || !resizer) return;

  const minWidth = 220;
  const maxWidth = 520;

  function applySidebarWidth(width) {
    const next = clamp(width, minWidth, maxWidth);
    pageBody.style.setProperty("--naser-sidebar-width", `${next}px`);
    localStorage.setItem(NASER_SIDEBAR_WIDTH_KEY, String(next));
  }

  const cachedWidth = Number.parseInt(
    localStorage.getItem(NASER_SIDEBAR_WIDTH_KEY),
    10
  );
  if (Number.isFinite(cachedWidth)) {
    applySidebarWidth(cachedWidth);
  }

  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener("mousedown", (event) => {
    dragging = true;
    startX = event.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    document.body.classList.add("naser-resizing");
    event.preventDefault();
  });

  window.addEventListener("mousemove", (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - startX;
    applySidebarWidth(startWidth + deltaX);
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("naser-resizing");
  });
}

function unquoteYamlValue(value) {
  const trimmed = String(value ?? "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseYamlArray(value) {
  const inner = value.trim().replace(/^\[/, "").replace(/]$/, "");
  if (!inner.trim()) return [];

  return inner
    .split(",")
    .map((part) => unquoteYamlValue(part))
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseYamlScalar(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseYamlArray(trimmed);
  }
  return unquoteYamlValue(trimmed);
}

function parseLinksYaml(yamlText) {
  const lines = String(yamlText || "").split(/\r?\n/);
  const tiles = [];
  let currentTile = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed === "tiles:") {
      continue;
    }

    if (trimmed === "-") {
      if (currentTile && Object.keys(currentTile).length) {
        tiles.push(currentTile);
      }
      currentTile = {};
      continue;
    }

    if (!currentTile) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1);
    currentTile[key] = parseYamlScalar(rawValue);
  }

  if (currentTile && Object.keys(currentTile).length) {
    tiles.push(currentTile);
  }

  return {
    tiles: tiles.map((tile, index) => ({
      id: tile.id || `tile-${index + 1}`,
      name: String(tile.name || `Link ${index + 1}`),
      url: String(tile.url || "").trim(),
      img: tile.img ? String(tile.img).trim() : "",
      bg_color: tile.bg_color ? String(tile.bg_color).trim() : "",
      txt_color: tile.txt_color ? String(tile.txt_color).trim() : "",
      tags: Array.isArray(tile.tags)
        ? tile.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [],
    })),
  };
}

function getGroupTitle(tag) {
  if (!tag) return NASER_ALL_GROUP_TITLE;
  return String(tag)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildGroups(tiles) {
  const groups = [
    {
      id: NASER_ALL_GROUP_ID,
      title: NASER_ALL_GROUP_TITLE,
      tag: "",
      items: tiles.slice(),
    },
  ];

  const groupMap = new Map();
  tiles.forEach((tile) => {
    const tags = Array.isArray(tile.tags) && tile.tags.length ? tile.tags : ["untagged"];
    tags.forEach((tag) => {
      if (!groupMap.has(tag)) {
        groupMap.set(tag, {
          id: tag,
          title: getGroupTitle(tag),
          tag,
          items: [],
        });
      }
      groupMap.get(tag).items.push(tile);
    });
  });

  return groups.concat(Array.from(groupMap.values()));
}

function getFolderIconKey(group) {
  return group?.id || group?.title || "naser-group";
}

function buildFolderIconMap(groups, svgList) {
  const iconMap = new Map();
  if (!Array.isArray(groups) || !Array.isArray(svgList) || !svgList.length) {
    return iconMap;
  }

  groups.forEach((group) => {
    const randomSvg = svgList[Math.floor(Math.random() * svgList.length)];
    if (randomSvg) {
      iconMap.set(getFolderIconKey(group), randomSvg);
    }
  });

  return iconMap;
}

function pickFolderIconPath(group, folderIconMap) {
  return folderIconMap.get(getFolderIconKey(group)) || "";
}

function renderSidebar(groups, currentGroupId, folderIconMap, onSelect) {
  const foldersUl = document.getElementById("folders");
  if (!foldersUl) return;
  foldersUl.innerHTML = "";

  groups.forEach((group) => {
    const li = document.createElement("li");
    li.className = "folder-node";

    const link = document.createElement("a");
    link.href = "#";
    link.className = "folder-title";
    if (group.id === currentGroupId) {
      link.classList.add("active");
    }

    const iconWrap = document.createElement("span");
    iconWrap.className = "random-icon";
    const randomSvg = pickFolderIconPath(group, folderIconMap);
    if (randomSvg) {
      iconWrap.innerHTML = `<img src="${chrome.runtime.getURL(randomSvg)}" alt="icon" class="random-svg">`;
    }
    link.appendChild(iconWrap);

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = group.title;
    link.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "naser-folder-meta";
    meta.textContent = String(group.items.length);
    link.appendChild(meta);

    link.addEventListener("click", (event) => {
      event.preventDefault();
      onSelect(group);
    });

    li.appendChild(link);
    foldersUl.appendChild(li);
  });
}

function isCacheableStatus(status) {
  return [NASER_STATUS_REACHABLE, NASER_STATUS_UNAVAILABLE].includes(status);
}

function getStatusCacheTtl(status) {
  if (status === NASER_STATUS_REACHABLE) {
    return NASER_STATUS_CACHE_TTL_REACHABLE_MS;
  }
  if (status === NASER_STATUS_UNAVAILABLE) {
    return NASER_STATUS_CACHE_TTL_UNAVAILABLE_MS;
  }
  return 0;
}

function pruneStatusCache(cache) {
  const now = Date.now();
  const validEntries = Object.entries(cache || {})
    .filter(([url, entry]) => {
      if (!url || !entry || typeof entry !== "object") return false;
      if (!isCacheableStatus(entry.status)) return false;
      if (!Number.isFinite(entry.checkedAt)) return false;
      return now - entry.checkedAt <= getStatusCacheTtl(entry.status);
    })
    .sort((left, right) => right[1].checkedAt - left[1].checkedAt)
    .slice(0, NASER_STATUS_CACHE_MAX_ENTRIES);

  return Object.fromEntries(validEntries);
}

function loadStatusCache() {
  try {
    const raw = localStorage.getItem(NASER_STATUS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return pruneStatusCache(parsed);
  } catch (_error) {
    return {};
  }
}

function persistStatusCache(cache) {
  try {
    localStorage.setItem(NASER_STATUS_CACHE_KEY, JSON.stringify(pruneStatusCache(cache)));
  } catch (_error) {
    // Ignore storage failures.
  }
}

function scheduleStatusCachePersist(cache) {
  window.clearTimeout(naserStatusCacheSaveTimer);
  naserStatusCacheSaveTimer = window.setTimeout(() => {
    persistStatusCache(cache);
  }, NASER_STATUS_CACHE_SAVE_DEBOUNCE_MS);
}

function getCachedStatus(url, cache) {
  if (!url || !cache) return null;
  const entry = cache[url];
  if (!entry || !Number.isFinite(entry.checkedAt)) return null;
  if (!isCacheableStatus(entry.status)) return null;
  if (Date.now() - entry.checkedAt > getStatusCacheTtl(entry.status)) {
    delete cache[url];
    scheduleStatusCachePersist(cache);
    return null;
  }
  return entry.status;
}

function updateStatusCache(url, status, cache) {
  if (!url || !isCacheableStatus(status) || !cache) return;
  cache[url] = {
    status,
    checkedAt: Date.now(),
  };
  scheduleStatusCachePersist(cache);
}

function applyCachedStatuses(tiles, statusMap, cache) {
  tiles.forEach((tile) => {
    const cachedStatus = getCachedStatus(tile.url, cache);
    if (cachedStatus) {
      statusMap.set(tile.id, cachedStatus);
    }
  });
}

function summarizeStatuses(tiles, statusMap) {
  return tiles.reduce(
    (summary, tile) => {
      const status = statusMap.get(tile.id);
      if (status === NASER_STATUS_REACHABLE) summary.reachable += 1;
      if (status === NASER_STATUS_UNAVAILABLE) summary.unavailable += 1;
      return summary;
    },
    { reachable: 0, unavailable: 0 }
  );
}

function updateStatusSummary(tiles, statusMap) {
  const summary = summarizeStatuses(tiles, statusMap);
  setReachableCount(summary.reachable);
  setUnavailableCount(summary.unavailable);
}

function applyCardStatus(card, status) {
  if (!card) return;
  card.classList.remove(
    "naser-card-status-pending",
    "naser-card-status-reachable",
    "naser-card-status-unavailable"
  );
  card.classList.add(`naser-card-status-${status}`);
}

function updateCardStatus(tileId, status) {
  const card = document.querySelector(`[data-bookmark-id="${tileId}"]`);
  applyCardStatus(card, status);
}

function shouldTreatResponseAsReachable(response) {
  if (!response) return false;
  if (response.ok) return true;
  return [401, 403].includes(response.status);
}

async function fetchStatus(url, method) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), NASER_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });

    if (shouldTreatResponseAsReachable(response)) {
      return NASER_STATUS_REACHABLE;
    }

    if (method === "HEAD" && [405, 500, 501].includes(response.status)) {
      return null;
    }

    return NASER_STATUS_UNAVAILABLE;
  } catch (_error) {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function probeStatus(url) {
  if (!url) return NASER_STATUS_UNAVAILABLE;

  const headStatus = await fetchStatus(url, "HEAD");
  if (headStatus) return headStatus;

  const getStatus = await fetchStatus(url, "GET");
  return getStatus || NASER_STATUS_UNAVAILABLE;
}

function createAvailabilityScheduler(tiles, statusMap, onUpdate, cache, initialGroupId = "") {
  const pendingTiles = tiles.filter((tile) => tile?.url && !statusMap.has(tile.id)).slice();
  let priorityGroupId = initialGroupId;

  function sortPending() {
    pendingTiles.sort((left, right) => {
      const leftScore = priorityGroupId && left.tags.includes(priorityGroupId) ? 0 : 1;
      const rightScore = priorityGroupId && right.tags.includes(priorityGroupId) ? 0 : 1;
      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.name.localeCompare(right.name, "zh-Hans-CN", { sensitivity: "base" });
    });
  }

  function reprioritize(groupId = "") {
    priorityGroupId = groupId === NASER_ALL_GROUP_ID ? "" : groupId;
    sortPending();
  }

  reprioritize(priorityGroupId);

  async function worker() {
    while (pendingTiles.length) {
      const tile = pendingTiles.shift();
      if (!tile?.url) continue;
      const status = await probeStatus(tile.url);
      statusMap.set(tile.id, status);
      updateStatusCache(tile.url, status, cache);
      onUpdate(tile, status);
    }
  }

  const workerCount = Math.min(NASER_CHECK_CONCURRENCY, pendingTiles.length);
  const completionPromise = Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  return {
    reprioritize,
    completionPromise,
  };
}


function getTileTextColor(tile) {
  return tile?.txt_color ? String(tile.txt_color).trim() : "";
}

function getTileBackgroundColor(tile) {
  return tile?.bg_color ? String(tile.bg_color).trim() : "";
}

function renderEmptyState(message) {
  const container = document.getElementById("bookmarks");
  if (!container) return;
  container.innerHTML = "";

  const col = document.createElement("div");
  col.className = "col-sm-12";

  const empty = document.createElement("div");
  empty.className = "naser-empty";
  empty.textContent = message;

  col.appendChild(empty);
  container.appendChild(col);
}

function renderCards(group, statusMap) {
  const container = document.getElementById("bookmarks");
  if (!container) return;
  container.innerHTML = "";

  const items = Array.isArray(group?.items) ? group.items : [];
  setCurrentCount(items.length);

  if (!items.length) {
    renderEmptyState("No links found in this group yet.");
    return;
  }

  items.forEach((tile) => {
    const col = document.createElement("div");
    col.className = "col-sm-3 col-xs-12";

    const card = document.createElement("div");
    card.className = "xe-widget xe-conversations box2 label-info naser-card";
    card.setAttribute("data-bookmark-id", tile.id);
    card.setAttribute("data-toggle", "tooltip");
    card.setAttribute("data-placement", "bottom");
    card.setAttribute("title", "");
    card.setAttribute("data-original-title", tile.url || "");
    card.onclick = () => {
      if (tile.url) window.open(tile.url, "_blank", "noopener,noreferrer");
    };

    const tileBackgroundColor = getTileBackgroundColor(tile);
    if (tileBackgroundColor) {
      card.style.backgroundColor = tileBackgroundColor;
    }

    const statusBar = document.createElement("div");
    statusBar.className = "naser-card-status-bar";
    card.appendChild(statusBar);

    const status = statusMap?.get(tile.id) || NASER_STATUS_PENDING;
    applyCardStatus(card, status);

    const entry = document.createElement("div");
    entry.className = "xe-comment-entry";

    const comment = document.createElement("div");
    comment.className = "xe-comment";

    const tileTextColor = getTileTextColor(tile);
    if (tileTextColor) {
      comment.style.color = tileTextColor;
    }

    const titleLink = document.createElement("a");
    titleLink.href = tile.url || "#";
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    titleLink.className = "xe-user-name overflowClip_1";

    const strong = document.createElement("strong");
    strong.textContent = tile.name || tile.url || "Untitled";
    if (tileTextColor) {
      strong.style.color = tileTextColor;
    }
    titleLink.appendChild(strong);

    const desc = document.createElement("p");
    desc.className = "overflowClip_2";
    desc.textContent = tile.url || "#";
    if (tileTextColor) {
      desc.style.color = tileTextColor;
    }

    comment.appendChild(titleLink);
    comment.appendChild(desc);

    entry.appendChild(comment);
    card.appendChild(entry);
    col.appendChild(card);
    container.appendChild(col);
  });
}

async function loadLinksData() {
  const url = chrome.runtime.getURL(".data/links.yml");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load .data/links.yml: ${response.status}`);
  }
  const text = await response.text();
  return parseLinksYaml(text);
}

document.addEventListener("DOMContentLoaded", () => {
  setupSidebarResize();

  document
    .querySelectorAll(".user-info-navbar a[href='#'], .logo-env a[href='#']")
    .forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
      });
    });

  const svgListUrl = chrome.runtime.getURL("assets/json/svg-icons.json");

  Promise.all([
    fetch(svgListUrl, { cache: "force-cache" })
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => []),
    loadLinksData(),
  ])
    .then(([svgList, data]) => {
      const allTiles = Array.isArray(data?.tiles)
        ? data.tiles.filter((tile) => tile.url)
        : [];

      if (!allTiles.length) {
        document.getElementById("folders").innerHTML = "";
        document.getElementById("current-folder-title").textContent = "Little Root Town";
        setTotalCount(0);
        setReachableCount(0);
        setUnavailableCount(0);
        setCurrentCount(0);
        renderEmptyState("No links available in .data/links.yml.");
        return;
      }

      const groups = buildGroups(allTiles);
      const preferredGroup = groups.find((group) => group.id === "main");
      let currentGroup = preferredGroup || groups[0];
      const folderIconMap = buildFolderIconMap(groups, Array.isArray(svgList) ? svgList : []);
      const statusCache = loadStatusCache();
      const statusMap = new Map();
      applyCachedStatuses(allTiles, statusMap, statusCache);

      setTotalCount(allTiles.length);
      updateStatusSummary(allTiles, statusMap);

      const scheduler = createAvailabilityScheduler(
        allTiles,
        statusMap,
        (tile, status) => {
          updateStatusSummary(allTiles, statusMap);
          updateCardStatus(tile.id, status);
        },
        statusCache,
        currentGroup?.id || ""
      );

      function applyCurrentGroup(group) {
        currentGroup = group || groups[0];
        scheduler.reprioritize(currentGroup?.id || "");
        renderSidebar(groups, currentGroup?.id, folderIconMap, applyCurrentGroup);
        renderCards(currentGroup, statusMap);
        document.getElementById("current-folder-title").textContent =
          currentGroup?.title || "Little Root Town";
      }

      applyCurrentGroup(currentGroup);
      scheduler.completionPromise.catch(() => {
        // Ignore probe failures; cards fall back to unavailable.
      });
    })
    .catch((error) => {
      console.error("Failed to initialize Little Root Town page:", error);
      document.getElementById("folders").innerHTML = "";
      document.getElementById("current-folder-title").textContent = "Little Root Town";
      setTotalCount(0);
      setReachableCount(0);
      setUnavailableCount(0);
      setCurrentCount(0);
      renderEmptyState("Failed to load .data/links.yml.");
    });
});

