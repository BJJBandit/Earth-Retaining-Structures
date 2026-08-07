import { mountClassification } from "./classification.js";
import { mountStability } from "./stability.js";
import { mountReinforcement } from "./reinforcement.js";
import { mountAnchors } from "./anchors.js";

const app = document.getElementById("app");
const tabs = document.querySelectorAll(".tab-btn");

const mounted = {};
const mounters = {
  classification: mountClassification,
  stability: mountStability,
  reinforcement: mountReinforcement,
  anchors: mountAnchors,
};

function showTab(name) {
  tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
  Object.entries(mounted).forEach(([key, elm]) => {
    elm.style.display = key === name ? "block" : "none";
  });
  if (!mounted[name]) {
    const container = document.createElement("div");
    app.appendChild(container);
    mounted[name] = container;
    mounters[name](container);
  }
}

tabs.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

showTab("classification");
