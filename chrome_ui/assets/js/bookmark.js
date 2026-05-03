const BOOKMARK_SIDEBAR_WIDTH_KEY = "bookmarkSidebarWidth";

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function renderFolderTree(
  nodes,
  parentUl,
  onSelect,
  currentId,
  expandedSet,
  svgList,
  depth = 0
) {
  nodes.forEach((node) => {
    if (!node.children) return; // 只渲染文件夹

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
      if (Array.isArray(svgList) && svgList.length) {
        const randomSvg = svgList[Math.floor(Math.random() * svgList.length)];
        iconWrap.innerHTML = `<img src="${chrome.runtime.getURL(
          randomSvg
        )}" alt="icon" class="random-svg">`;
      }
      titleLink.appendChild(iconWrap);
    }

    const text = document.createElement("span");
    text.className = "title";
    text.textContent = node.title || "未命名文件夹";
    titleLink.appendChild(text);

    titleLink.appendChild(arrow);

    // 点击整行菜单：切换当前文件夹，并在有子目录时展开/折叠
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
      subUl.style.display = isExpanded ? "block" : "none"; // 默认折叠
      renderFolderTree(
        node.children,
        subUl,
        onSelect,
        currentId,
        expandedSet,
        svgList,
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

function renderBookmarkCards(folderNode) {
  const container = document.getElementById("bookmarks");
  const countEl = document.getElementById("bookmark-count");
  container.innerHTML = "";
  if (!folderNode || !folderNode.children) {
    countEl.textContent = "0 items";
    return;
  }

  const bookmarkItems = folderNode.children.filter((node) => node.url);
  countEl.textContent = `${bookmarkItems.length} items`;

  if (!bookmarkItems.length) {
    const emptyCol = document.createElement("div");
    emptyCol.className = "col-sm-12";

    const empty = document.createElement("div");
    empty.className = "bookmark-empty";
    empty.textContent = "这个文件夹里还没有书签";

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

    const iconWrap = document.createElement("span");
    iconWrap.className = "bookmark-site-icon";
    iconWrap.innerHTML = '<i class="fa fa-bookmark"></i>';

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

  // Chrome 通常把书签栏固定为 id=1
  let bar = root.children.find((n) => n && n.id === "1");

  // 本地化标题兜底
  if (!bar) {
    bar = root.children.find(
      (n) =>
        n &&
        typeof n.title === "string" &&
        ["书签栏", "Bookmarks bar", "Bookmark bar"].includes(n.title.trim())
    );
  }

  // 最后兜底：第一个可用目录
  if (!bar) {
    bar = root.children.find((n) => n && Array.isArray(n.children));
  }

  return bar || null;
}

document.addEventListener("DOMContentLoaded", () => {
  setupSidebarResize();

  // 避免占位链接 href="#" 触发页面回到顶部
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
        document.getElementById("current-folder-title").textContent = "我的书签";
        document.getElementById("bookmark-count").textContent = "0 items";
        return;
      }

    // 默认选中书签栏中的第一个可用文件夹
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

      // 默认全部折叠
      const expandedSet = new Set();

      function renderSidebar() {
        const foldersUl = document.getElementById("folders");
        foldersUl.innerHTML = "";

        // 只渲染书签栏下的内容
        renderFolderTree(
          bookmarkBarNode.children,
          foldersUl,
          (node) => {
            if (node) {
              currentFolder = node;
              renderBookmarkCards(node);
              document.getElementById("current-folder-title").textContent =
                node.title || "我的书签";
            }
            renderSidebar();
          },
          currentFolder?.id,
          expandedSet,
          svgList
        );
      }

      renderSidebar();
      renderBookmarkCards(currentFolder);
      document.getElementById("current-folder-title").textContent =
        currentFolder?.title || "我的书签";
    });
  }
});
