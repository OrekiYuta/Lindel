(function () {
  let prompts = { translate: "", refine: "" };

  function loadPrompts() {
    const url = chrome.runtime.getURL("assets/config/prompt.yml");
    return fetch(url)
      .then((r) => r.text())
      .then((text) => {
        text.split("\n").forEach((line) => {
          const match = line.match(/^(\w+):\s*"(.+)"$/);
          if (match) {
            prompts[match[1]] = match[2];
          }
        });
      });
  }

  function sendToChatGPT(text) {
    const editor = document.querySelector("#prompt-textarea");
    if (!editor) return;

    editor.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);

    const waitForSend = setInterval(() => {
      const btn =
        document.querySelector('button[data-testid="send-button"]') ||
        document.querySelector('button[aria-label="Send"]') ||
        document.querySelector('button[aria-label="发送"]');
      if (btn) {
        clearInterval(waitForSend);
        btn.click();
      }
    }, 200);

    setTimeout(() => {
      clearInterval(waitForSend);
      console.log("[Lindel] send button not found, trying Enter key");
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    }, 3000);
  }

  function createUI() {
    if (document.getElementById("lindel-chatgpt-helper")) return;

    const container = document.createElement("div");
    container.id = "lindel-chatgpt-helper";

    const cnGroup = document.createElement("div");
    cnGroup.className = "lindel-input-group";
    cnGroup.innerHTML =
      "<label>Translate</label>" +
      '<textarea placeholder="CN→EN / EN→CN"></textarea>' +
      "<button>Send</button>";

    const enGroup = document.createElement("div");
    enGroup.className = "lindel-input-group";
    enGroup.innerHTML =
      "<label>Wording Refinement</label>" +
      '<textarea placeholder="CN→EN→Refined EN"></textarea>' +
      "<button>Send</button>";

    container.appendChild(cnGroup);
    container.appendChild(enGroup);

    container.querySelectorAll("textarea").forEach((ta) => {
      ta.addEventListener("input", () => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
      });
    });

    cnGroup.querySelector("button").addEventListener("click", () => {
      const ta = cnGroup.querySelector("textarea");
      const text = ta.value.trim();
      if (!text) return;
      sendToChatGPT(prompts.translate + "\n" + text);
      ta.value = "";
      ta.style.height = "auto";
    });

    enGroup.querySelector("button").addEventListener("click", () => {
      const ta = enGroup.querySelector("textarea");
      const text = ta.value.trim();
      if (!text) return;
      sendToChatGPT(prompts.refine + "\n" + text);
      ta.value = "";
      ta.style.height = "auto";
    });

    const chips = document.querySelector('[data-testid="use-case-prompt-chips"]');
    if (!chips || !chips.parentElement) return;

    const parent = chips.parentElement;
    parent.style.display = "flex";
    parent.style.flexDirection = "column";
    parent.style.height = "100%";
    parent.insertBefore(container, chips.nextSibling);
  }

  function init() {
    loadPrompts().then(() => {
      createUI();

      const observer = new MutationObserver(() => {
        const helper = document.getElementById("lindel-chatgpt-helper");
        const chips = document.querySelector('[data-testid="use-case-prompt-chips"]');

        if (chips && !helper) {
          createUI();
        } else if (helper && !document.body.contains(helper)) {
          createUI();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
