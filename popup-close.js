
/* Mile Zero - Popup Close Buttons */

(() => {
  "use strict";

  function closePopup(backdrop) {
    if (
      backdrop.id === "backdrop" &&
      typeof window.closeModal === "function"
    ) {
      window.closeModal();
    } else {
      backdrop.remove();
    }
  }

  function addCloseButton(backdrop) {
    const panel = Array.from(backdrop.children).find(
      child => child.classList?.contains("modal")
    );

    if (!panel || panel.querySelector(".mz-popup-close")) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mz-popup-close";
    button.setAttribute("aria-label", "Close window");
    button.title = "Close";
    button.textContent = "×";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      closePopup(backdrop);
    });

    panel.prepend(button);
  }

  function addButtons() {
    document
      .querySelectorAll(".modal-backdrop")
      .forEach(addCloseButton);
  }

  function start() {
    const styles = document.createElement("style");

    styles.textContent = `
      .mz-popup-close {
        position: sticky;
        top: 0;
        float: right;
        z-index: 10;
        width: 34px;
        height: 34px;
        min-width: 34px;
        margin: -8px -8px 4px 12px;
        padding: 0;
        display: grid;
        place-items: center;
        border: 1px solid #c9cdc2;
        border-radius: 50%;
        background: #eaece5;
        color: #27372c;
        font: 24px/1 Arial, sans-serif;
        cursor: pointer;
      }

      .mz-popup-close:hover {
        background: #dce3d7;
      }

      .mz-popup-close:focus-visible {
        outline: 3px solid #628066;
        outline-offset: 2px;
      }
    `;

    document.head.appendChild(styles);

    addButtons();

    const observer = new MutationObserver(addButtons);

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
