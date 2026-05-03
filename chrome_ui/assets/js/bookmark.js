function renderFolderTree(nodes, parentUl, onSelect, currentId, expandedSet) {
  nodes.forEach((node) => {
    if (!node.children) return; // 只渲染文件夹

    const li = document.createElement("li");
    li.className = "folder-node";

    const titleDiv = document.createElement("div");
    titleDiv.className = "folder-title";
    if (node.id === currentId) titleDiv.classList.add("active");

    const hasSubFolders = node.children.some((child) => child.children);
    const isExpanded = expandedSet.has(node.id);

    const arrow = document.createElement("span");
    arrow.className = "folder-arrow";
    arrow.textContent = hasSubFolders ? "▼" : "";
    if (hasSubFolders && !isExpanded) {
      arrow.classList.add("collapsed");
    }
    titleDiv.appendChild(arrow);

    const text = document.createElement("span");
    text.textContent = node.title || "未命名文件夹";
    titleDiv.appendChild(text);

    // 点击箭头：仅展开/折叠
    arrow.onclick = (e) => {
      e.stopPropagation();
      if (!hasSubFolders) return;
      if (expandedSet.has(node.id)) {
        expandedSet.delete(node.id);
      } else {
        expandedSet.add(node.id);
      }
      onSelect(null, true); // 仅重绘侧边栏，不切换右侧
    };

    // 点击标题：切换当前文件夹并展示右侧书签
    titleDiv.onclick = (e) => {
      e.stopPropagation();
      onSelect(node, false);
    };

    li.appendChild(titleDiv);

    if (hasSubFolders) {
      const subUl = document.createElement("ul");
      subUl.className = "folder-tree";
      subUl.style.marginLeft = "16px";
      subUl.style.display = isExpanded ? "block" : "none"; // 默认折叠
      renderFolderTree(node.children, subUl, onSelect, currentId, expandedSet);
      li.appendChild(subUl);
    }

    parentUl.appendChild(li);
  });
}

function renderBookmarkCards(folderNode) {
  const container = document.getElementById("bookmarks");
  container.innerHTML = "";
  if (!folderNode || !folderNode.children) return;

  folderNode.children.forEach((node) => {
    if (node.url) {
      const card = document.createElement("div");
      card.className = "bookmark-card";
      card.innerHTML = `<a href="${node.url}" target="_blank">${node.title || node.url}</a>`;
      container.appendChild(card);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    // 默认选中第一个可用文件夹
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

    let currentFolder = findFirstFolder(bookmarkTreeNodes[0]);

    // 默认全部折叠；只展开当前路径可选（这里先保持全折叠）
    const expandedSet = new Set();

    function renderSidebar() {
      const foldersUl = document.getElementById("folders");
      foldersUl.innerHTML = "";

      renderFolderTree(
        bookmarkTreeNodes,
        foldersUl,
        (node, onlyRefreshSidebar) => {
          if (!onlyRefreshSidebar && node) {
            currentFolder = node;
            renderBookmarkCards(node);
            document.getElementById("current-folder-title").textContent =
              node.title || "我的书签";
          }
          renderSidebar();
        },
        currentFolder?.id,
        expandedSet
      );
    }

    renderSidebar();
    renderBookmarkCards(currentFolder);
    document.getElementById("current-folder-title").textContent =
      currentFolder?.title || "我的书签";
  });
});
