const BOOKMARK_SIDEBAR_WIDTH_KEY = "bookmarkSidebarWidth";

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function getFolderIconKey(node) {
  return node?.id || node?.title || "bookmark-folder";
}

function buildFolderIconMap(nodes, svgList) {
  const folderIconMap = new Map();
  if (!Array.isArray(nodes) || !Array.isArray(svgList) || !svgList.length) {
    return folderIconMap;
  }

  nodes.forEach((node) => {
    if (!node?.children) return;
    const randomSvg = svgList[Math.floor(Math.random() * svgList.length)];
    if (randomSvg) {
      folderIconMap.set(getFolderIconKey(node), randomSvg);
    }
  });

  return folderIconMap;
}

function pickFolderIconPath(node, folderIconMap) {
  return folderIconMap.get(getFolderIconKey(node)) || "";
}

function renderFolderTree(
  nodes,
  parentUl,
  onSelect,
  currentId,
  expandedSet,
  folderIconMap,
  depth = 0
) {
  nodes.forEach((node) => {
    if (!node.children) return; // Render folders only.

    const li = document.createElement("li");
    li.className = "folder-node";

    const titleLink = document.createElement("a");
    titleLink.className = "folder-title";
    titleLink.href = "#";
    if (node.id === currentId) titleLink.classList.add("active");

    const hasSubFolders = node.children.some((child) => child.children);
    const isExpanded = expandedSet.has(node.id);

    if (hasSubFolders) {
      li.classList.add("has-sub");
      if (isExpanded) li.classList.add("expanded");
    }

    const arrow = document.createElement("span");
    arrow.className = "folder-arrow";
    arrow.textContent = hasSubFolders ? "▾" : "";
    if (hasSubFolders && !isExpanded) {
      arrow.classList.add("collapsed");
    }
    if (depth === 0) {
      const iconWrap = document.createElement("span");
      iconWrap.className = "random-icon";
      const randomSvg = pickFolderIconPath(node, folderIconMap);
      if (randomSvg) {
        iconWrap.innerHTML = `<img src="${chrome.runtime.getURL(
          randomSvg
        )}" alt="icon" class="random-svg">`;
      }
      titleLink.appendChild(iconWrap);
    }

    const text = document.createElement("span");
    text.className = "title";
    text.textContent = node.title || "Untitled Folder";
    titleLink.appendChild(text);

    titleLink.appendChild(arrow);

    // Click row: select folder, and toggle expand/collapse if it has subfolders.
    titleLink.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (hasSubFolders) {
        if (expandedSet.has(node.id)) {
          expandedSet.delete(node.id);
        } else {
          expandedSet.add(node.id);
        }
      }
      onSelect(node, false);
    };

    li.appendChild(titleLink);

    if (hasSubFolders) {
      const subUl = document.createElement("ul");
      subUl.className = "folder-tree";
      subUl.style.marginLeft = "16px";
      subUl.style.display = isExpanded ? "block" : "none"; // Collapsed by default.
      renderFolderTree(
        node.children,
        subUl,
        onSelect,
        currentId,
        expandedSet,
        folderIconMap,
        depth + 1
      );
      li.appendChild(subUl);
    }

    parentUl.appendChild(li);
  });
}

function setupSidebarResize() {
  const pageBody = document.querySelector(".bookmark-page");
  const sidebar = document.querySelector(".bookmark-sidebar-wrap");
  const resizer = document.querySelector(".bookmark-sidebar-resizer");
  if (!pageBody || !sidebar || !resizer) return;

  const minWidth = 220;
  const maxWidth = 520;

  function applySidebarWidth(width) {
    const next = clamp(width, minWidth, maxWidth);
    pageBody.style.setProperty("--bookmark-sidebar-width", `${next}px`);
    localStorage.setItem(BOOKMARK_SIDEBAR_WIDTH_KEY, String(next));
  }

  const cachedWidth = Number.parseInt(
    localStorage.getItem(BOOKMARK_SIDEBAR_WIDTH_KEY),
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
    document.body.classList.add("bookmark-resizing");
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
    document.body.classList.remove("bookmark-resizing");
  });
}

function countAllBookmarks(node) {
  if (!node) return 0;
  if (node.url) return 1;
  if (!Array.isArray(node.children)) return 0;
  return node.children.reduce((sum, child) => sum + countAllBookmarks(child), 0);
}

function setCurrentCount(count) {
  const countValueEl = document.getElementById("bookmark-current-value");
  if (countValueEl) {
    countValueEl.textContent = String(count);
  }
}

function setTotalCount(count) {
  const totalValueEl = document.getElementById("bookmark-total-value");
  if (totalValueEl) {
    totalValueEl.textContent = String(count);
  }
}

function getBookmarkFaviconUrl(pageUrl) {
  if (!pageUrl) return "";
  return chrome.runtime.getURL(
    `_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`
  );
}

function createBookmarkSiteIcon(pageUrl, title) {
  const iconWrap = document.createElement("span");
  iconWrap.className = "bookmark-site-icon";

  const fallbackIcon = document.createElement("i");
  fallbackIcon.className = "fa fa-bookmark bookmark-site-icon-fallback";
  fallbackIcon.setAttribute("aria-hidden", "true");

  const faviconUrl = getBookmarkFaviconUrl(pageUrl);
  if (!faviconUrl) {
    iconWrap.appendChild(fallbackIcon);
    return iconWrap;
  }

  const faviconImg = document.createElement("img");
  faviconImg.className = "bookmark-site-favicon";
  faviconImg.src = faviconUrl;
  faviconImg.alt = title || "Site icon";
  faviconImg.width = 18;
  faviconImg.height = 18;
  faviconImg.loading = "lazy";

  faviconImg.addEventListener("error", () => {
    faviconImg.remove();
    if (!iconWrap.querySelector(".bookmark-site-icon-fallback")) {
      iconWrap.appendChild(fallbackIcon);
    }
  });

  iconWrap.appendChild(faviconImg);
  iconWrap.appendChild(fallbackIcon);

  faviconImg.addEventListener("load", () => {
    faviconImg.classList.add("is-ready");
    fallbackIcon.classList.add("is-hidden");
  });

  return iconWrap;
}

function renderBookmarkCards(folderNode) {
  const container = document.getElementById("bookmarks");
  container.innerHTML = "";
  if (!folderNode || !folderNode.children) {
    setCurrentCount(0);
    return;
  }

  const bookmarkItems = folderNode.children.filter((node) => node.url);
  setCurrentCount(bookmarkItems.length);

  if (!bookmarkItems.length) {
    const emptyCol = document.createElement("div");
    emptyCol.className = "col-sm-12";

    const empty = document.createElement("div");
    empty.className = "bookmark-empty";
    empty.textContent = "No bookmarks in this folder yet.";

    emptyCol.appendChild(empty);
    container.appendChild(emptyCol);
    return;
  }

  bookmarkItems.forEach((node) => {
    const col = document.createElement("div");
    col.className = "col-sm-3 col-xs-12";

    const card = document.createElement("div");
    card.className = "xe-widget xe-conversations box2 label-info bookmark-card";
    card.setAttribute("data-toggle", "tooltip");
    card.setAttribute("data-placement", "bottom");
    card.setAttribute("title", "");
    card.setAttribute("data-original-title", node.url || "");
    card.onclick = () => window.open(node.url, "_blank");

    const entry = document.createElement("div");
    entry.className = "xe-comment-entry";

    const iconWrap = createBookmarkSiteIcon(node.url, node.title || node.url);

    const comment = document.createElement("div");
    comment.className = "xe-comment";

    const titleLink = document.createElement("a");
    titleLink.href = node.url;
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    titleLink.className = "xe-user-name overflowClip_1";

    const strong = document.createElement("strong");
    strong.textContent = node.title || node.url;
    titleLink.appendChild(strong);

    const desc = document.createElement("p");
    desc.className = "overflowClip_2";
    desc.textContent = node.url;

    comment.appendChild(titleLink);
    comment.appendChild(desc);

    entry.appendChild(iconWrap);
    entry.appendChild(comment);
    card.appendChild(entry);
    col.appendChild(card);
    container.appendChild(col);
  });
}

function pickBookmarkBarNode(bookmarkTreeNodes) {
  const root = Array.isArray(bookmarkTreeNodes) ? bookmarkTreeNodes[0] : null;
  if (!root || !Array.isArray(root.children)) return null;

  // Chrome usually keeps the bookmark bar at id=1.
  let bar = root.children.find((n) => n && n.id === "1");

  // Localized title fallback.
  if (!bar) {
    bar = root.children.find(
      (n) =>
        n &&
        typeof n.title === "string" &&
        ["Bookmarks bar", "Bookmark bar"].includes(n.title.trim())
    );
  }

  // Final fallback: first available folder-like node.
  if (!bar) {
    bar = root.children.find((n) => n && Array.isArray(n.children));
  }

  return bar || null;
}

document.addEventListener("DOMContentLoaded", () => {
  setupSidebarResize();

  // Prevent placeholder links from scrolling back to the top.
  document
    .querySelectorAll(".user-info-navbar a[href='#'], .logo-env a[href='#']")
    .forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
      });
    });

  const svgListUrl = chrome.runtime.getURL("assets/json/svg-icons.json");
  $.getJSON(svgListUrl)
    .done((svgList) => {
      initializeBookmarkPage(Array.isArray(svgList) ? svgList : []);
    })
    .fail(() => {
      initializeBookmarkPage([]);
    });

  function initializeBookmarkPage(svgList) {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      const bookmarkBarNode = pickBookmarkBarNode(bookmarkTreeNodes);

      if (!bookmarkBarNode || !Array.isArray(bookmarkBarNode.children)) {
        document.getElementById("folders").innerHTML = "";
        document.getElementById("bookmarks").innerHTML = "";
        document.getElementById("current-folder-title").textContent = "Bookmarks";
        setTotalCount(0);
        setCurrentCount(0);
        return;
      }

      const totalBookmarkCount = countAllBookmarks(bookmarkBarNode);
      setTotalCount(totalBookmarkCount);
      const folderIconMap = buildFolderIconMap(
        bookmarkBarNode.children,
        svgList
      );

      // Default selection: first available folder under bookmark bar.
      function findFirstFolder(node) {
        if (node.children && node.children.length) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findFirstFolder(child);
            if (found) return found;
          }
        }
        return node;
      }

      let currentFolder = findFirstFolder(bookmarkBarNode);

      // Start with all tree branches collapsed.
      const expandedSet = new Set();

      function renderSidebar() {
        const foldersUl = document.getElementById("folders");
        foldersUl.innerHTML = "";

        // Render only nodes under bookmark bar.
        renderFolderTree(
          bookmarkBarNode.children,
          foldersUl,
          (node) => {
            if (node) {
              currentFolder = node;
              renderBookmarkCards(node);
              document.getElementById("current-folder-title").textContent =
                node.title || "Bookmarks";
            }
            renderSidebar();
          },
          currentFolder?.id,
          expandedSet,
          folderIconMap
        );
      }

      renderSidebar();
      renderBookmarkCards(currentFolder);
      document.getElementById("current-folder-title").textContent =
        currentFolder?.title || "Bookmarks";
    });
  }
});
