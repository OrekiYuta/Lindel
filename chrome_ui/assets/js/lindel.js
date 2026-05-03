$(document).ready(function () {
    function normalizeUrl(rawUrl) {
        try {
            const url = new URL(rawUrl);
            url.hash = "";
            return url.href;
        } catch (_error) {
            return rawUrl;
        }
    }

    function openOrFocusTab(targetUrl) {
        const normalizedTarget = normalizeUrl(targetUrl);

        chrome.tabs.query({}, function (tabs) {
            const existingTab = tabs.find(function (tab) {
                return tab.url && normalizeUrl(tab.url) === normalizedTarget;
            });

            if (existingTab && existingTab.id !== undefined) {
                chrome.tabs.update(existingTab.id, {active: true});
                if (existingTab.windowId !== undefined) {
                    chrome.windows.update(existingTab.windowId, {focused: true});
                }
                return;
            }

            chrome.tabs.create({url: targetUrl});
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
            .map(function (part) {
                return unquoteYamlValue(part);
            })
            .map(function (part) {
                return part.trim();
            })
            .filter(Boolean);
    }

    function parseYamlScalar(value) {
        const trimmed = String(value ?? "").trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            return parseYamlArray(trimmed);
        }
        if (trimmed === "true") return true;
        if (trimmed === "false") return false;
        return unquoteYamlValue(trimmed);
    }

    function parseMainYaml(yamlText) {
        const data = {
            menu: [],
            sections: [],
            cards: [],
        };

        const lines = String(yamlText || "").split(/\r?\n/);
        let currentCollection = "";
        let currentItem = null;

        function pushCurrentItem() {
            if (!currentCollection || !currentItem || !Object.keys(currentItem).length) {
                return;
            }
            if (Array.isArray(data[currentCollection])) {
                data[currentCollection].push(currentItem);
            }
            currentItem = null;
        }

        lines.forEach(function (rawLine) {
            const trimmed = rawLine.trim();
            if (!trimmed || trimmed.startsWith("#")) return;

            const sectionMatch = trimmed.match(/^([A-Za-z0-9_]+):\s*$/);
            if (sectionMatch) {
                pushCurrentItem();
                const nextCollection = sectionMatch[1];
                currentCollection = Array.isArray(data[nextCollection]) ? nextCollection : "";
                return;
            }

            if (trimmed === "-") {
                pushCurrentItem();
                currentItem = {};
                return;
            }

            if (trimmed.startsWith("- ")) {
                pushCurrentItem();
                currentItem = {};

                const inlinePair = trimmed.slice(2).trim();
                if (inlinePair) {
                    const inlineSeparatorIndex = inlinePair.indexOf(":");
                    if (inlineSeparatorIndex >= 0) {
                        const inlineKey = inlinePair.slice(0, inlineSeparatorIndex).trim();
                        const inlineRawValue = inlinePair.slice(inlineSeparatorIndex + 1);
                        currentItem[inlineKey] = parseYamlScalar(inlineRawValue);
                    }
                }
                return;
            }

            if (!currentCollection || !currentItem) return;

            const separatorIndex = trimmed.indexOf(":");
            if (separatorIndex < 0) return;
            const key = trimmed.slice(0, separatorIndex).trim();
            const rawValue = trimmed.slice(separatorIndex + 1);
            currentItem[key] = parseYamlScalar(rawValue);
        });

        pushCurrentItem();

        return data;
    }

    function getOrderValue(value, fallback) {
        const parsed = Number.parseInt(String(value ?? ""), 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeMenuItems(items) {
        return (Array.isArray(items) ? items : []).map(function (item, index) {
            const rawBadge = item.badge;
            let badge = "";
            if (typeof rawBadge === "string") {
                badge = rawBadge.trim();
            }

            return {
                id: String(item.id || "menu-" + (index + 1)),
                title: String(item.title || "Untitled"),
                anchor: String(item.anchor || "").trim(),
                parent: String(item.parent || "").trim(),
                icon: String(item.icon || "").trim(),
                badge: badge,
                order: getOrderValue(item.order, index),
            };
        });
    }

    function normalizeSections(items) {
        return (Array.isArray(items) ? items : []).map(function (item, index) {
            return {
                id: String(item.id || "section-" + (index + 1)),
                title: String(item.title || "Untitled"),
                order: getOrderValue(item.order, index),
            };
        });
    }

    function normalizeCards(items) {
        return (Array.isArray(items) ? items : []).map(function (item, index) {
            return {
                section: String(item.section || "").trim(),
                title: String(item.title || "Untitled"),
                description: String(item.description || "").trim(),
                page: String(item.page || "").trim(),
                url: String(item.url || "").trim(),
                icon: String(item.icon || "").trim(),
                order: getOrderValue(item.order, index),
            };
        });
    }

    function sortByOrderThenTitle(items) {
        return items.slice().sort(function (left, right) {
            if (left.order !== right.order) return left.order - right.order;
            return left.title.localeCompare(right.title, "zh-Hans-CN", {sensitivity: "base"});
        });
    }

    function buildMenuTree(menuItems) {
        const itemMap = new Map();
        const roots = [];

        sortByOrderThenTitle(menuItems).forEach(function (item) {
            itemMap.set(item.id, Object.assign({}, item, {children: []}));
        });

        itemMap.forEach(function (item) {
            if (item.parent && itemMap.has(item.parent)) {
                itemMap.get(item.parent).children.push(item);
            } else {
                roots.push(item);
            }
        });

        return roots;
    }

    function renderMenuNode(node) {
        const li = document.createElement("li");
        if (node.children.length) {
            li.classList.add("has-sub");
        }

        const link = document.createElement("a");
        if (node.anchor) {
            link.href = "#" + node.anchor;
            link.classList.add("smooth");
        } else {
            link.href = "#";
        }

        const icon = document.createElement("span");
        icon.className = "random-icon";
        if (node.icon) {
            icon.setAttribute("data-icon", node.icon);
        }
        link.appendChild(icon);

        const title = document.createElement("span");
        title.className = "title";
        title.textContent = node.title;
        link.appendChild(title);

        if (node.badge) {
            const badge = document.createElement("span");
            badge.className = "label label-pink pull-right hidden-collapsed menu-badge";
            badge.textContent = node.badge;
            link.appendChild(badge);
        }

        li.appendChild(link);

        if (node.children.length) {
            const ul = document.createElement("ul");
            sortByOrderThenTitle(node.children).forEach(function (child) {
                ul.appendChild(renderMenuNode(child));
            });
            li.appendChild(ul);
        }

        return li;
    }

    function renderMenu(menuItems) {
        const menuRoot = document.getElementById("main-menu");
        if (!menuRoot) return;
        menuRoot.innerHTML = "";

        const tree = buildMenuTree(menuItems);
        tree.forEach(function (node) {
            menuRoot.appendChild(renderMenuNode(node));
        });
    }

    function renderSections(sections, cards) {
        const container = document.getElementById("lindel-sections");
        if (!container) return;
        container.innerHTML = "";

        const sortedSections = sortByOrderThenTitle(sections);

        sortedSections.forEach(function (section) {
            const heading = document.createElement("h4");
            heading.className = "text-gray";

            const icon = document.createElement("i");
            icon.className = "linecons-tag";
            icon.style.marginRight = "7px";
            icon.id = section.id;
            heading.appendChild(icon);
            heading.appendChild(document.createTextNode(section.title));

            container.appendChild(heading);

            const row = document.createElement("div");
            row.className = "row";

            const sectionCards = sortByOrderThenTitle(
                cards.filter(function (card) {
                    return card.section === section.id;
                })
            );

            sectionCards.forEach(function (cardData) {
                const col = document.createElement("div");
                col.className = "col-sm-3";

                const card = document.createElement("div");
                card.className = "xe-widget xe-conversations box2 label-info";
                card.setAttribute("data-toggle", "tooltip");
                card.setAttribute("data-placement", "bottom");
                card.setAttribute("title", "");

                if (cardData.page) {
                    card.setAttribute("data-page", cardData.page);
                    card.setAttribute("data-original-title", cardData.page);
                } else if (cardData.url) {
                    card.setAttribute("data-url", cardData.url);
                    card.setAttribute("data-original-title", cardData.url);
                } else {
                    card.setAttribute("data-original-title", "#");
                }

                const entry = document.createElement("div");
                entry.className = "xe-comment-entry";

                const icon = document.createElement("span");
                icon.className = "random-icon";
                if (cardData.icon) {
                    icon.setAttribute("data-icon", cardData.icon);
                }
                entry.appendChild(icon);

                const comment = document.createElement("div");
                comment.className = "xe-comment";

                const titleLink = document.createElement("a");
                titleLink.href = "#";
                titleLink.className = "xe-user-name overflowClip_1";

                const strong = document.createElement("strong");
                strong.textContent = cardData.title;
                titleLink.appendChild(strong);

                const desc = document.createElement("p");
                desc.className = "overflowClip_2";
                desc.textContent = cardData.description;

                comment.appendChild(titleLink);
                comment.appendChild(desc);
                entry.appendChild(comment);
                card.appendChild(entry);
                col.appendChild(card);
                row.appendChild(col);
            });

            container.appendChild(row);
            container.appendChild(document.createElement("br"));
        });
    }

    function applyIcons(svgList) {
        $(".random-icon").each(function () {
            const fixedIcon = $(this).data("icon");
            if (fixedIcon) {
                $(this).html(
                    '<img src="' +
                    chrome.runtime.getURL(fixedIcon) +
                    '" alt="icon" class="random-svg">'
                );
                return;
            }

            if (!Array.isArray(svgList) || !svgList.length) return;

            const randomSvg = svgList[Math.floor(Math.random() * svgList.length)];
            $(this).html(
                '<img src="' +
                chrome.runtime.getURL(randomSvg) +
                '" alt="icon" class="random-svg">'
            );
        });
    }

    async function loadMainConfig() {
        const configUrl = chrome.runtime.getURL(".data/main.yml");
        console.log("[Lindel Debug] loading main config:", configUrl);

        const response = await fetch(configUrl, {cache: "no-store"});
        if (!response.ok) {
            throw new Error("Failed to load .data/main.yml: " + response.status);
        }

        const text = await response.text();
        const parsed = parseMainYaml(text);
        const normalized = {
            menu: normalizeMenuItems(parsed.menu),
            sections: normalizeSections(parsed.sections),
            cards: normalizeCards(parsed.cards),
        };

        console.log("[Lindel Debug] parsed main config:", {
            menuCount: normalized.menu.length,
            sectionCount: normalized.sections.length,
            cardCount: normalized.cards.length,
        });

        return normalized;
    }

    function initializeInteractions() {
        const observer = lozad();
        observer.observe();

        $(document).on("click", ".has-sub", function () {
            var _this = $(this);
            if (!$(this).hasClass("expanded")) {
                setTimeout(function () {
                    _this.find("ul").attr("style", "");
                }, 300);
            } else {
                $(".has-sub ul").each(function (_id, ele) {
                    var _that = $(this);
                    if (_this.find("ul")[0] !== ele) {
                        setTimeout(function () {
                            _that.attr("style", "");
                        }, 300);
                    }
                });
            }
        });

        $(".user-info-menu .hidden-sm").click(function () {
            if ($(".sidebar-menu").hasClass("collapsed")) {
                $(".has-sub.expanded > ul").attr("style", "");
            } else {
                $(".has-sub.expanded > ul").show();
            }
        });

        $(document).on("click", "#main-menu li ul li", function () {
            $(this).siblings("li").removeClass("active");
            $(this).addClass("active");
        });

        $(document).on("click", "a.smooth", function (ev) {
            ev.preventDefault();
            const target = $(this).attr("href");
            if (!target || !$(target).length) return;
            public_vars.$mainMenu
                .add(public_vars.$sidebarProfile)
                .toggleClass("mobile-is-visible");
            ps_destroy();
            $("html, body").animate(
                {
                    scrollTop: $(target).offset().top - 30,
                },
                {duration: 500, easing: "swing"}
            );
        });

        $(document).on("click", ".xe-widget[data-page]", function () {
            const page = $(this).data("page");
            if (!page) return;
            openOrFocusTab(chrome.runtime.getURL(page));
        });

        $(document).on("click", ".xe-widget[data-url]", function () {
            const url = $(this).data("url");
            if (!url || url === "#") return;
            openOrFocusTab(url);
        });
    }

    initializeInteractions();

    const svgListUrl = chrome.runtime.getURL("assets/json/svg-icons.json");
    Promise.all([
        fetch(svgListUrl, {cache: "force-cache"})
            .then(function (response) {
                return response.ok ? response.json() : [];
            })
            .catch(function () {
                return [];
            }),
        loadMainConfig(),
    ])
        .then(function (results) {
            const svgList = results[0];
            const config = results[1];

            console.log("[Lindel Debug] render snapshot:", {
                menuCount: config.menu.length,
                sectionCount: config.sections.length,
                cardCount: config.cards.length,

            });

            renderMenu(config.menu);
            renderSections(config.sections, config.cards);
            applyIcons(svgList);
        })
        .catch(function (error) {
            console.error("Failed to initialize Lindel from .data/main.yml:", error);
            $("#main-menu").empty();
            $("#lindel-sections").html(
                '<div class="alert alert-danger">Failed to load .data/main.yml</div>'
            );
        });
});


