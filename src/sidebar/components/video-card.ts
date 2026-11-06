import { createEl } from "../../lib/dom.js";
import { platformLabel } from "../../lib/platforms/registry.js";
import { formatDateTime } from "../../lib/time.js";
import type { FeedItem } from "../../lib/types.js";
import { isValidHttpUrl } from "../../lib/url.js";

function mediaPlaceholder(): HTMLSpanElement {
  return createEl("span", {
    className: "video-card__placeholder",
    text: "▶",
    attrs: { "aria-hidden": "true" },
  });
}

function thumbnail(item: FeedItem): HTMLDivElement {
  const wrapper = createEl("div", { className: "video-card__thumb" });

  if (!isValidHttpUrl(item.thumbnailUrl)) {
    wrapper.append(mediaPlaceholder());
    return wrapper;
  }

  const image = createEl("img", {
    className: "video-card__image",
    attrs: {
      src: item.thumbnailUrl,
      alt: "",
      loading: "lazy",
      decoding: "async",
      referrerpolicy: "no-referrer",
    },
  });

  image.addEventListener(
    "error",
    () => {
      image.replaceWith(mediaPlaceholder());
    },
    { once: true }
  );

  wrapper.append(image);
  return wrapper;
}

function dateLabel(item: FeedItem): HTMLTimeElement {
  return createEl("time", {
    className: "video-card__date",
    text: formatDateTime(item.publishedAt) || "Date unknown",
    attrs: { datetime: item.publishedAt },
  });
}

function openInNewTab(url: string): void {
  browser.tabs.create({ url }).catch((error: unknown) => {
    console.warn("FeedTubes could not open the video.", error);
  });
}

/** Card linking to a video; returns `null` for items without a valid URL. */
export function createVideoCard(item: FeedItem): HTMLAnchorElement | null {
  if (!isValidHttpUrl(item.url)) {
    return null;
  }

  const label = platformLabel(item.platform);
  const link = createEl("a", {
    className: "video-card",
    attrs: {
      href: item.url,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": `${item.title || "Video"} on ${label}`,
    },
  });

  link.addEventListener("click", (event) => {
    // Open through the tabs API so the video opens in the main window, not the sidebar.
    event.preventDefault();
    openInNewTab(item.url);
  });

  // Title and channel at the top; date (left) and source tag (right) pinned to the bottom.
  const footer = createEl("div", {
    className: "video-card__footer",
    children: [dateLabel(item), createEl("span", { className: "badge badge--small", text: label })],
  });

  const body = createEl("div", {
    className: "video-card__body",
    children: [
      createEl("h3", { className: "video-card__title", text: item.title || "Untitled video" }),
      createEl("p", {
        className: "video-card__channel",
        text: item.channelName || item.channelId || "Unknown channel",
      }),
      footer,
    ],
  });

  link.append(thumbnail(item), body);
  return link;
}
