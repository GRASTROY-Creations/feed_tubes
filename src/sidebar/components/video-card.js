import { createEl } from "../../lib/dom.js";
import { platformLabel } from "../../lib/platforms/registry.js";
import { formatAbsoluteTime, formatRelativeTime } from "../../lib/time.js";
import { isValidHttpUrl } from "../../lib/url.js";

function openInNewTab(url) {
  if (globalThis.browser?.tabs?.create) {
    return browser.tabs.create({ url });
  }

  return globalThis.open(url, "_blank", "noopener,noreferrer");
}

function mediaPlaceholder() {
  return createEl("span", {
    className: "video-card__placeholder",
    text: "▶",
    attrs: { "aria-hidden": "true" },
  });
}

function thumbnail(item) {
  const wrapper = createEl("div", { className: "video-card__thumb" });
  const thumbnailUrl = String(item.thumbnailUrl || "");

  if (!isValidHttpUrl(thumbnailUrl)) {
    wrapper.append(mediaPlaceholder());
    return wrapper;
  }

  const image = createEl("img", {
    className: "video-card__image",
    attrs: {
      src: thumbnailUrl,
      alt: "",
      loading: "lazy",
      decoding: "async",
      referrerpolicy: "no-referrer",
    },
  });

  image.addEventListener(
    "error",
    () => {
      image.remove();
      wrapper.append(mediaPlaceholder());
    },
    { once: true }
  );

  wrapper.append(image);
  return wrapper;
}

function dateLabel(item) {
  const relative = formatRelativeTime(item.publishedAt);
  const absolute = formatAbsoluteTime(item.publishedAt);

  return createEl("time", {
    className: "video-card__date",
    text: relative || absolute || "Date unknown",
    attrs: {
      datetime: item.publishedAt || "",
      title: absolute || "",
    },
  });
}

export function createVideoCard(item, options = {}) {
  if (!item || !isValidHttpUrl(item.url)) {
    return null;
  }

  const link = createEl("a", {
    className: "video-card",
    attrs: {
      href: item.url,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": `${item.title || "Video"} on ${platformLabel(item.platform)}`,
    },
  });

  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (options.onOpen) {
      options.onOpen(item);
      return;
    }
    Promise.resolve(openInNewTab(item.url)).catch(() => {
      // The browser will report navigation failures on its own.
    });
  });

  const body = createEl("div", { className: "video-card__body" });
  const meta = createEl("div", { className: "video-card__meta" });

  meta.append(
    createEl("span", {
      className: "badge",
      text: platformLabel(item.platform),
    }),
    dateLabel(item)
  );

  body.append(
    meta,
    createEl("h3", {
      className: "video-card__title",
      text: item.title || "Untitled video",
    }),
    createEl("p", {
      className: "video-card__channel",
      text: item.channelName || item.channelId || "Unknown channel",
    })
  );

  link.append(thumbnail(item), body);
  return link;
}
