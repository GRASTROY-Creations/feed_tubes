"use strict";

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const status = document.getElementById("status");

    if (status) {
      status.textContent = "Sidebar ready.";
    }

    console.debug("FeedTubes sidebar initialized.");
  },
  { once: true }
);
