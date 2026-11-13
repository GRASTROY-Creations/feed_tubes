# FeedTubes interface text. English: the source of truth. Every other file defines exactly these messages.

## Shared

common-add = Add
common-save = Save
common-cancel = Cancel
common-edit = Edit
common-remove = Remove
common-delete = Delete
common-search = Search
common-platform = Platform
common-channel = Channel
common-all-platforms = All platforms
common-all-channels = All channels
common-unknown-error = unknown error

## Tab bar

tabs-label = FeedTubes views
tabs-feed = Feed
tabs-settings = Settings
app-fetch = Fetch

## Feed

feed-grant-access = Grant access
feed-requesting = Requesting…
feed-load-more = Load more
feed-load-more-count = Load { $count } more ({ $remaining } remaining)
feed-status-refreshing = Refreshing feeds…
feed-status-failures =
    { $count ->
        [one] { $count } source could not be refreshed.
       *[other] { $count } sources could not be refreshed.
    }
feed-status-never-refreshed = Feed has not been refreshed yet.
feed-status-queued =
    { $count ->
        [one] { $count } source is queued and loads in the background.
       *[other] { $count } sources are queued and load in the background.
    }
feed-error-permissions =
    { $count ->
        [one] Access is needed for { $count } source. Grant access to load the full feed.
       *[other] Access is needed for { $count } sources. Grant access to load the full feed.
    }
feed-empty-no-subscriptions-title = No subscriptions yet
feed-empty-no-subscriptions-text = Add a channel or import a subscription file.
feed-empty-no-subscriptions-button = Open settings
feed-empty-refreshing-title = Refreshing feeds
feed-empty-refreshing-text = Your subscriptions are being checked for new videos.
feed-empty-no-videos-title = No videos yet
feed-empty-no-videos-text = Fetch the latest videos from your subscriptions.
feed-empty-no-videos-button = Fetch now
feed-empty-no-matches-title = No matching videos
feed-empty-no-matches-text = Try another platform or channel filter.
feed-empty-no-matches-button = Clear filters
feed-toast-access-granted = Access granted. Refreshing feeds.
feed-toast-access-denied = Access was not granted. Some sources will stay unavailable.
feed-toast-access-failed = Could not request access.

## Video cards

card-date-unknown = Date unknown
card-unknown-channel = Unknown channel
card-untitled = Untitled video
card-aria-label = { $title } on { $platform }
stream-live = LIVE: { $title }
stream-last = Last stream: { $title }
stream-live-game = LIVE: { $title } ({ $game })
stream-last-game = Last stream: { $title } ({ $game })
stream-untitled = Untitled stream

## Sidebar app

app-error-refresh-failed = Could not refresh feeds.
app-toast-background-refreshed = Feed refreshed in the background.
app-error-reload-failed = Could not reload the feed.
app-error-access-removed = Host access was removed. Some sources need access again.

## Refresh summary

refresh-no-subscriptions = Add an enabled subscription before refreshing.
refresh-all-recent = All sources were refreshed recently; { $wait }.
refresh-next-in = next refresh in { $time }
refresh-refreshed =
    { $count ->
        [one] Refreshed { $count } source
       *[other] Refreshed { $count } sources
    }
refresh-failed = { $count } failed
refresh-skipped = { $count } skipped (refreshed recently, { $wait })
refresh-queued =
    { $count ->
        [one] { $count } queued for the next batch
       *[other] { $count } queued for the next batches
    }
refresh-error-permission = Host permission is required for this source.
refresh-error-generic = Could not refresh this source.
background-refresh-failed = Refresh failed.
background-alarm-update-failed = Could not update the alarm.
background-alarm-read-failed = Could not read the alarm.

## Time

time-updated = Updated { $time }
time-never-fetched = No Feed
time-just-now = just now

## Settings: General

settings-general = General
settings-language = Language
settings-language-auto = Automatic (browser language)
settings-language-changed = Language changed.
settings-fetching-title = Automatic Fetching
settings-fetching-interval = Check each subscription
settings-fetching-every1h = Every 1 hour
settings-fetching-every3h = Every 3 hours
settings-fetching-every6h = Every 6 hours
settings-fetching-every12h = Every 12 hours
settings-fetching-every24h = Every 24 hours
settings-fetching-background = Fetch feed in the background
settings-fetching-hint = *Only subscriptions whose interval has passed are fetched, also when the sidebar opens. Channels without recent uploads are checked less often (at most daily). Large lists load in small batches.
settings-fetching-schedule-updated = Refresh schedule updated.
settings-fetching-background-on = Background refresh enabled.
settings-fetching-background-off = Background refresh disabled.
settings-data-title = Data & About
settings-data-storage = Stored data: { $size }.
settings-data-clear-cache = Clear cache
settings-data-reset = Reset all data
settings-data-hint-cache = *Clearing Cache does not remove subscriptions or settings
settings-data-hint-requests = *Feed requests go directly to the platforms and bridge services you configure.
settings-data-hint-privacy = *FeedTubes does not collect data.
settings-data-cache-cleared = Cache cleared.
settings-data-confirm-reset = Clear all FeedTubes data, including subscriptions and settings?
settings-data-purged = All data purged.
settings-version = Version

## Settings: Subscriptions

settings-subscriptions = Subscriptions
subs-instance = Instance
subs-channel = Channel ID, URL, or handle
subs-alias = Alias
subs-alias-placeholder = Optional, shown instead of the channel name
subs-feed-url = Feed URL
subs-bridge-feed-url = RSS bridge feed URL (optional)
subs-enable-all = Enable all
subs-disable-all = Disable all
subs-delete-disabled = Delete disabled
subs-search-placeholder = Channel name
subs-fallback-title = Subscription
subs-toggle-label = Enable { $name }
subs-no-instance = No instance selected
subs-add-instance-hint = Add a { $kind } instance under Instances
subs-empty = No subscriptions yet.
subs-no-matches = No subscriptions match the current filters.
subs-deleted = Subscription deleted.
subs-youtube-access = Access to YouTube is needed to look up this channel.
subs-read-failed = Could not read the channel.
subs-exists = This subscription already exists.
subs-saved = Subscription saved.
subs-added = Subscription added.
subs-all-enabled = All subscriptions enabled.
subs-all-disabled = All subscriptions disabled.
subs-none-disabled = There are no disabled subscriptions.
subs-confirm-delete-disabled =
    { $count ->
        [one] Delete { $count } disabled subscription?
       *[other] Delete { $count } disabled subscriptions?
    }
subs-disabled-deleted = Disabled subscriptions deleted.
subs-show-more = Show { $count } more ({ $remaining } remaining)
placeholder-youtube = UC… / channel URL / @handle
placeholder-peertube = Channel handle or /c/ URL
placeholder-odysee = @name:claimid
placeholder-rutube = Numeric channel ID or URL
placeholder-dailymotion = Username or channel URL
placeholder-dtube = Channel name or d.tube/channel/… URL
placeholder-pixabay = Contributor name or profile URL
placeholder-twitch = Channel name or twitch.tv/… URL
placeholder-goodgame = Channel name or goodgame.ru/… URL
placeholder-vkvideo = Optional channel ID
placeholder-bilibili = Optional UID
placeholder-rumble = Optional channel slug
placeholder-generic = Optional channel ID

## Settings: Instances

settings-instances = Instances
inst-hint = PeerTube instances and bridge bases. Each subscription stores its own instance.
inst-kind = Kind
inst-kind-peertube = PeerTube
inst-kind-rsshub = RSSHub
inst-kind-vk = VK bridge
inst-kind-bilibili = Bilibili bridge
inst-kind-rumble = Rumble bridge
inst-kind-generic = Generic RSS
inst-label = Label
inst-label-placeholder = My instance
inst-base-url = Base URL
inst-test = Test
inst-test-tooltip = Test Connection
inst-search-placeholder = Label, kind, or URL
inst-invalid-url = Enter a valid http(s) base URL.
inst-confirm-remove = Remove the { $name } instance? Existing subscriptions keep their own instance URL.
inst-removed = Instance removed.
inst-empty = No instances configured. Add a PeerTube instance or bridge base above.
inst-no-matches = No instances match the search.
inst-choose-kind = Choose an instance kind.
inst-duplicate = That instance is already configured.
inst-saved = Instance saved.
inst-added = Instance added.
inst-testing = Testing connection…
inst-access-denied = Access to this host was not granted.
inst-connected = Connection succeeded.
inst-connection-failed = Connection failed: { $error }

## Settings: API keys

keys-title = API Keys
keys-pixabay = Pixabay API key
keys-pixabay-placeholder = Paste your key
keys-pixabay-hint = *Free key from pixabay.com/api/docs (Pixabay account needed). Stored only in this browser and never included in exports.
keys-pixabay-saved = Pixabay API key saved.
keys-pixabay-removed = Pixabay API key removed.
keys-twitch-client-id = Twitch Client ID
keys-twitch-client-id-placeholder = From your app at dev.twitch.tv
keys-twitch-client-id-saved = Twitch Client ID saved.
keys-twitch-client-id-removed = Twitch Client ID removed.
keys-twitch-redirect = Twitch OAuth Redirect URL (paste into your Twitch app)
keys-twitch-sign-in = Sign in with Twitch
keys-twitch-sign-out = Sign out
keys-twitch-hint-register = *Register a free application at dev.twitch.tv, category "Website Integration", with the redirect URL above.
keys-twitch-hint-bridge = *Twitch channels with an RSS bridge feed URL work without signing in.
keys-enter-client-id = Enter your Twitch Client ID first.
keys-twitch-access-denied = Access to Twitch was not granted.
keys-signed-in-toast = Signed in to Twitch as { $login }.
keys-sign-in-failed = Twitch sign-in failed.
keys-signed-out = Signed out of Twitch.
keys-signed-in-as = Signed in as { $login }.
keys-twitch-user = a Twitch user
keys-not-signed-in = Not signed in.

## Settings: Import / Export

settings-transfer = Import / Export
transfer-hint = Import FeedTubes CSV/JSON, YouTube Takeout/FreeTube CSV, FreeTube .db, NewPipe JSON, or OPML.
transfer-file = Subscription file
transfer-mode = Merge mode
transfer-mode-merge = Merge — Add and Update
transfer-mode-skip = Fill Up — Skip Duplicates
transfer-mode-replace = Replace — Remove All Current Subscriptions
transfer-import = Import
transfer-export-format = Export format
transfer-filter = Filter
transfer-filter-all = All Subscriptions
transfer-filter-enabled = Enabled only
transfer-download = Download file
transfer-importing = Importing…
transfer-imported =
    { $count ->
        [one] Imported { $count } subscription from { $format }.
       *[other] Imported { $count } subscriptions from { $format }.
    }
transfer-invalid-rows =
    { $count ->
        [one] { $count } invalid row skipped.
       *[other] { $count } invalid rows skipped.
    }
transfer-stored =
    { $count ->
        [one] { $count } subscription stored.
       *[other] { $count } subscriptions stored.
    }
transfer-none-found = No valid subscriptions were found.
transfer-confirm-replace = Replace all existing subscriptions with this file?
transfer-imported-toast = Subscriptions imported.
transfer-import-failed = Could not import the file.
transfer-choose-file = Choose a subscription file first.
transfer-too-large = The file is larger than the 5 MB limit.
transfer-access-needed = These sources need host access before they can be fetched.
transfer-grant-access = Grant access and fetch
transfer-choose-format = Choose an export format.
transfer-exported = Exported { $filename }.
transfer-export-failed = Could not export subscriptions.

## Import parsing

import-error-no-array = This JSON file does not contain a subscriptions array.
import-error-no-you-tube = This JSON file does not contain YouTube subscriptions.
import-error-csv-empty = The CSV file is empty.
import-error-opml-unavailable = OPML import is not available in this environment.
import-error-opml-xml = The OPML file is not valid XML.
import-error-empty = The selected file is empty.
import-error-unknown-format = Unrecognized subscription file format.
import-warn-newpipe = Skipped a non-YouTube NewPipe subscription.
import-warn-freetube-line = Skipped a FreeTube line that is not valid JSON.

## Subscription validation

validate-unknown-platform = Unknown or missing platform.
validate-instance-required = A { $platform } instance URL is required.
validate-channel-required = A channel ID or channel URL is required.
validate-feed-required = This platform needs an RSS/Atom or bridge feed URL.
validate-invalid-url = { $field } must be a valid http(s) URL.
validate-url-too-long = { $field } is too long.
validate-channel-too-long = The channel identifier is too long.
field-instance-url = Instance URL
field-channel-url = Channel URL
field-feed-url = Feed URL

## Network

fetch-http-error = Request failed with HTTP { $status } ({ $url }).
fetch-network-error = Could not reach { $url }: { $cause }
fetch-network-fallback = network error
fetch-host-paused = { $host } is refusing requests, so FeedTubes pauses it for a while.
fetch-host-budget = The hourly request limit for { $host } is reached; the rest follows later.

## Platforms

rss-needs-feed = This subscription needs a valid RSS or Atom feed URL.
rss-invalid-xml = The feed is not valid XML.
dtube-not-found = D.Tube has no channel named "{ $name }".
dtube-no-name = This D.Tube subscription has no channel name.
goodgame-not-found = goodgame.ru has no channel named "{ $name }".
goodgame-no-name = This goodgame.ru subscription has no channel name.
peertube-no-instance = This PeerTube subscription has no valid instance URL.
pixabay-no-key = Add your Pixabay API key in Settings → Instances to load Pixabay videos.
pixabay-no-name = This Pixabay subscription has no contributor name.
pixabay-no-videos = Pixabay returned no videos from "{ $name }".
twitch-sign-in = Sign in with Twitch in Settings → Instances, or give this subscription an RSS bridge feed URL.
twitch-expired = Your Twitch sign-in has expired. Sign in again in Settings → Instances.
twitch-not-found = Twitch has no channel named "{ $name }".
twitch-no-name = This Twitch subscription has no channel name.
twitch-auth-failed = Twitch sign-in failed: { $reason }
twitch-auth-state-mismatch = the response did not match the request.
twitch-auth-no-token = no access token was returned.
twitch-auth-rejected = Twitch rejected the sign-in token.
youtube-enter-id = Enter a YouTube channel ID (UC…), channel URL, or @handle.
youtube-lookup-failed = Could not look up { $url }: { $error }
youtube-request-failed = request failed
youtube-unresolved = Could not resolve that YouTube handle. Enter the UC… channel ID instead.
youtube-no-channel-id = This YouTube subscription has no channel ID. Edit it and enter the UC… ID.
youtube-invalid-xml = The YouTube feed is not valid XML.
youtube-empty-videos-tab = the Videos tab listed no videos
youtube-both-failed = YouTube feed failed ({ $feed }), and so did the fallback ({ $fallback }).

## Composite messages

error-raw = { $detail }
refresh-summary = { $parts }.
