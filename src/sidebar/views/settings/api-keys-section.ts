import { getElement, setText } from "../../../lib/dom.js";
import { errorMessage } from "../../../lib/errors.js";
import { requestOrigins } from "../../../lib/permissions.js";
import {
  revokeTwitchToken,
  signInWithTwitch,
  TWITCH_AUTH_ORIGINS,
} from "../../../lib/twitch-auth.js";
import type { ApiKeys } from "../../../lib/types.js";
import type { AppContext } from "../../app-context.js";
import { showError, showToast } from "../../components/toast.js";
import { withDisabled, type SettingsSection } from "./shared.js";
import { t, type MessageKey } from "../../../lib/i18n/index.js";

/** Personal API keys and the Twitch sign-in. Text fields are saved when they lose focus. */
export function initApiKeysSection(app: AppContext): SettingsSection {
  const elements = {
    pixabay: getElement("pixabay-api-key", HTMLInputElement),
    twitchClientId: getElement("twitch-client-id", HTMLInputElement),
    twitchRedirect: getElement("twitch-redirect-url", HTMLInputElement),
    twitchSignIn: getElement("twitch-sign-in", HTMLButtonElement),
    twitchSignOut: getElement("twitch-sign-out", HTMLButtonElement),
    twitchStatus: getElement("twitch-status", HTMLParagraphElement),
  };

  const keys = (): ApiKeys => app.state.settings.apiKeys;

  async function saveKeys(partial: Partial<ApiKeys>): Promise<void> {
    const { settings } = app.state;
    await app.persistSettings({ ...settings, apiKeys: { ...settings.apiKeys, ...partial } });
  }

  function bindTextField(
    input: HTMLInputElement,
    field: "pixabay" | "twitchClientId",
    messages: { saved: MessageKey; removed: MessageKey }
  ): void {
    input.addEventListener("change", () => {
      const value = input.value.trim();
      if (value === keys()[field]) {
        return;
      }
      // A new Client ID invalidates the old sign-in, which belonged to the previous app.
      const partial: Partial<ApiKeys> =
        field === "twitchClientId"
          ? { twitchClientId: value, twitchToken: "", twitchLogin: "" }
          : { [field]: value };
      void saveKeys(partial).then(() => {
        showToast(t(value ? messages.saved : messages.removed));
      });
    });
  }

  bindTextField(elements.pixabay, "pixabay", {
    saved: "keys-pixabay-saved",
    removed: "keys-pixabay-removed",
  });
  bindTextField(elements.twitchClientId, "twitchClientId", {
    saved: "keys-twitch-client-id-saved",
    removed: "keys-twitch-client-id-removed",
  });

  elements.twitchRedirect.value = browser.identity.getRedirectURL();
  elements.twitchRedirect.addEventListener("focus", () => {
    elements.twitchRedirect.select();
  });

  elements.twitchSignIn.addEventListener("click", () => {
    const clientId = elements.twitchClientId.value.trim() || keys().twitchClientId;
    if (!clientId) {
      showError(t("keys-enter-client-id"));
      return;
    }

    // Request host access before any await, so it still counts as a user action.
    const access = requestOrigins(TWITCH_AUTH_ORIGINS);
    void withDisabled(elements.twitchSignIn, async () => {
      try {
        if (!(await access)) {
          showError(t("keys-twitch-access-denied"));
          return;
        }
        const session = await signInWithTwitch(clientId);
        await saveKeys({
          twitchClientId: clientId,
          twitchToken: session.token,
          twitchLogin: session.login,
        });
        showToast(t("keys-signed-in-toast", { login: session.login }));
      } catch (error) {
        showError(errorMessage(error, t("keys-sign-in-failed")));
      }
    });
  });

  elements.twitchSignOut.addEventListener("click", () => {
    const { twitchClientId, twitchToken } = keys();
    void withDisabled(elements.twitchSignOut, async () => {
      await revokeTwitchToken(twitchClientId, twitchToken);
      await saveKeys({ twitchToken: "", twitchLogin: "" });
      showToast(t("keys-signed-out"));
    });
  });

  return {
    render() {
      const current = keys();
      // Never overwrite what the user is typing.
      if (document.activeElement !== elements.pixabay) {
        elements.pixabay.value = current.pixabay;
      }
      if (document.activeElement !== elements.twitchClientId) {
        elements.twitchClientId.value = current.twitchClientId;
      }

      const signedIn = Boolean(current.twitchToken);
      elements.twitchSignIn.hidden = signedIn;
      elements.twitchSignOut.hidden = !signedIn;
      setText(
        elements.twitchStatus,
        signedIn
          ? t("keys-signed-in-as", { login: current.twitchLogin || t("keys-twitch-user") })
          : t("keys-not-signed-in")
      );
    },
  };
}
