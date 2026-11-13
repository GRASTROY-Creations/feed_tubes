# FeedTubes interface text. German.

## Shared

common-add = Hinzufügen
common-save = Speichern
common-cancel = Abbrechen
common-edit = Bearbeiten
common-remove = Entfernen
common-delete = Löschen
common-search = Suchen
common-platform = Plattform
common-channel = Kanal
common-all-platforms = Alle Plattformen
common-all-channels = Alle Kanäle
common-unknown-error = unbekannter Fehler

## Tab bar

tabs-label = FeedTubes-Ansichten
tabs-feed = Feed
tabs-settings = Einstellungen
app-fetch = Abrufen

## Feed

feed-grant-access = Zugriff erlauben
feed-requesting = Wird angefordert…
feed-load-more = Mehr laden
feed-load-more-count = { $count } weitere laden ({ $remaining } übrig)
feed-status-refreshing = Feeds werden aktualisiert…
feed-status-failures =
    { $count ->
        [one] { $count } Quelle konnte nicht aktualisiert werden.
       *[other] { $count } Quellen konnten nicht aktualisiert werden.
    }
feed-status-never-refreshed = Der Feed wurde noch nicht aktualisiert.
feed-status-queued =
    { $count ->
        [one] { $count } Quelle wartet und wird im Hintergrund geladen.
       *[other] { $count } Quellen warten und werden im Hintergrund geladen.
    }
feed-error-permissions =
    { $count ->
        [one] Für { $count } Quelle wird Zugriff benötigt. Erlauben Sie den Zugriff, um den vollständigen Feed zu laden.
       *[other] Für { $count } Quellen wird Zugriff benötigt. Erlauben Sie den Zugriff, um den vollständigen Feed zu laden.
    }
feed-empty-no-subscriptions-title = Noch keine Abonnements
feed-empty-no-subscriptions-text = Fügen Sie einen Kanal hinzu oder importieren Sie eine Abonnement-Datei.
feed-empty-no-subscriptions-button = Einstellungen öffnen
feed-empty-refreshing-title = Feeds werden aktualisiert
feed-empty-refreshing-text = Ihre Abonnements werden auf neue Videos geprüft.
feed-empty-no-videos-title = Noch keine Videos
feed-empty-no-videos-text = Rufen Sie die neuesten Videos Ihrer Abonnements ab.
feed-empty-no-videos-button = Jetzt abrufen
feed-empty-no-matches-title = Keine passenden Videos
feed-empty-no-matches-text = Versuchen Sie einen anderen Plattform- oder Kanalfilter.
feed-empty-no-matches-button = Filter zurücksetzen
feed-toast-access-granted = Zugriff erlaubt. Feeds werden aktualisiert.
feed-toast-access-denied = Zugriff wurde nicht erlaubt. Einige Quellen bleiben nicht verfügbar.
feed-toast-access-failed = Zugriff konnte nicht angefordert werden.

## Video cards

card-date-unknown = Datum unbekannt
card-unknown-channel = Unbekannter Kanal
card-untitled = Video ohne Titel
card-aria-label = { $title } auf { $platform }
stream-live = LIVE: { $title }
stream-last = Letzter Stream: { $title }
stream-live-game = LIVE: { $title } ({ $game })
stream-last-game = Letzter Stream: { $title } ({ $game })
stream-untitled = Stream ohne Titel

## Sidebar app

app-error-refresh-failed = Feeds konnten nicht aktualisiert werden.
app-toast-background-refreshed = Feed im Hintergrund aktualisiert.
app-error-reload-failed = Feed konnte nicht neu geladen werden.
app-error-access-removed = Host-Zugriff wurde entfernt. Einige Quellen benötigen erneut Zugriff.

## Refresh summary

refresh-no-subscriptions = Fügen Sie vor dem Aktualisieren ein aktiviertes Abonnement hinzu.
refresh-all-recent = Alle Quellen wurden kürzlich aktualisiert; { $wait }.
refresh-next-in = nächste Aktualisierung in { $time }
refresh-refreshed =
    { $count ->
        [one] { $count } Quelle aktualisiert
       *[other] { $count } Quellen aktualisiert
    }
refresh-failed = { $count } fehlgeschlagen
refresh-skipped = { $count } übersprungen (kürzlich aktualisiert, { $wait })
refresh-queued =
    { $count ->
        [one] { $count } für die nächste Runde vorgemerkt
       *[other] { $count } für die nächsten Runden vorgemerkt
    }
refresh-error-permission = Für diese Quelle ist eine Host-Berechtigung erforderlich.
refresh-error-generic = Diese Quelle konnte nicht aktualisiert werden.
background-refresh-failed = Aktualisierung fehlgeschlagen.
background-alarm-update-failed = Der Alarm konnte nicht aktualisiert werden.
background-alarm-read-failed = Der Alarm konnte nicht gelesen werden.

## Time

time-updated = Aktualisiert { $time }
time-never-fetched = Kein Feed
time-just-now = gerade eben

## Settings: General

settings-general = Allgemein
settings-language = Sprache
settings-language-auto = Automatisch (Browsersprache)
settings-language-changed = Sprache geändert.
settings-fetching-title = Automatischer Abruf
settings-fetching-interval = Jedes Abonnement prüfen
settings-fetching-every1h = Jede Stunde
settings-fetching-every3h = Alle 3 Stunden
settings-fetching-every6h = Alle 6 Stunden
settings-fetching-every12h = Alle 12 Stunden
settings-fetching-every24h = Alle 24 Stunden
settings-fetching-background = Feed im Hintergrund abrufen
settings-fetching-hint = *Abgerufen werden nur Abonnements, deren Intervall abgelaufen ist, auch beim Öffnen der Sidebar. Kanäle ohne neue Uploads werden seltener geprüft (höchstens täglich). Große Listen werden in kleinen Runden geladen.
settings-fetching-schedule-updated = Aktualisierungsplan geändert.
settings-fetching-background-on = Hintergrundaktualisierung aktiviert.
settings-fetching-background-off = Hintergrundaktualisierung deaktiviert.
settings-data-title = Daten & Info
settings-data-storage = Gespeicherte Daten: { $size }.
settings-data-clear-cache = Cache leeren
settings-data-reset = Alle Daten zurücksetzen
settings-data-hint-cache = *Das Leeren des Caches entfernt keine Abonnements oder Einstellungen
settings-data-hint-requests = *Feed-Anfragen gehen direkt an die Plattformen und Bridge-Dienste, die Sie konfigurieren.
settings-data-hint-privacy = *FeedTubes sammelt keine Daten.
settings-data-cache-cleared = Cache geleert.
settings-data-confirm-reset = Alle FeedTubes-Daten löschen, einschließlich Abonnements und Einstellungen?
settings-data-purged = Alle Daten gelöscht.
settings-version = Version

## Settings: Subscriptions

settings-subscriptions = Abonnements
subs-instance = Instanz
subs-channel = Kanal-ID, URL oder Handle
subs-alias = Alias
subs-alias-placeholder = Optional, wird statt des Kanalnamens angezeigt
subs-feed-url = Feed-URL
subs-bridge-feed-url = RSS-Bridge-Feed-URL (optional)
subs-enable-all = Alle aktivieren
subs-disable-all = Alle deaktivieren
subs-delete-disabled = Deaktivierte löschen
subs-search-placeholder = Kanalname
subs-fallback-title = Abonnement
subs-toggle-label = { $name } aktivieren
subs-no-instance = Keine Instanz ausgewählt
subs-add-instance-hint = Fügen Sie unter Instanzen eine { $kind }-Instanz hinzu
subs-empty = Noch keine Abonnements.
subs-no-matches = Keine Abonnements entsprechen den aktuellen Filtern.
subs-deleted = Abonnement gelöscht.
subs-youtube-access = Zum Nachschlagen dieses Kanals wird Zugriff auf YouTube benötigt.
subs-read-failed = Der Kanal konnte nicht gelesen werden.
subs-exists = Dieses Abonnement existiert bereits.
subs-saved = Abonnement gespeichert.
subs-added = Abonnement hinzugefügt.
subs-all-enabled = Alle Abonnements aktiviert.
subs-all-disabled = Alle Abonnements deaktiviert.
subs-none-disabled = Es gibt keine deaktivierten Abonnements.
subs-confirm-delete-disabled =
    { $count ->
        [one] { $count } deaktiviertes Abonnement löschen?
       *[other] { $count } deaktivierte Abonnements löschen?
    }
subs-disabled-deleted = Deaktivierte Abonnements gelöscht.
subs-show-more = { $count } weitere anzeigen ({ $remaining } übrig)
placeholder-youtube = UC… / Kanal-URL / @handle
placeholder-peertube = Kanal-Handle oder /c/-URL
placeholder-odysee = @name:claimid
placeholder-rutube = Numerische Kanal-ID oder URL
placeholder-dailymotion = Benutzername oder Kanal-URL
placeholder-dtube = Kanalname oder d.tube/channel/…-URL
placeholder-pixabay = Name des Urhebers oder Profil-URL
placeholder-twitch = Kanalname oder twitch.tv/…-URL
placeholder-goodgame = Kanalname oder goodgame.ru/…-URL
placeholder-vkvideo = Optionale Kanal-ID
placeholder-bilibili = Optionale UID
placeholder-rumble = Optionaler Kanal-Slug
placeholder-generic = Optionale Kanal-ID

## Settings: Instances

settings-instances = Instanzen
inst-hint = PeerTube-Instanzen und Bridge-Basisadressen. Jedes Abonnement speichert seine eigene Instanz.
inst-kind = Art
inst-kind-peertube = PeerTube
inst-kind-rsshub = RSSHub
inst-kind-vk = VK-Bridge
inst-kind-bilibili = Bilibili-Bridge
inst-kind-rumble = Rumble-Bridge
inst-kind-generic = Generisches RSS
inst-label = Bezeichnung
inst-label-placeholder = Meine Instanz
inst-base-url = Basis-URL
inst-test = Testen
inst-test-tooltip = Verbindung testen
inst-search-placeholder = Bezeichnung, Art oder URL
inst-invalid-url = Geben Sie eine gültige http(s)-Basis-URL ein.
inst-confirm-remove = Instanz { $name } entfernen? Bestehende Abonnements behalten ihre eigene Instanz-URL.
inst-removed = Instanz entfernt.
inst-empty = Keine Instanzen konfiguriert. Fügen Sie oben eine PeerTube-Instanz oder Bridge-Basisadresse hinzu.
inst-no-matches = Keine Instanzen entsprechen der Suche.
inst-choose-kind = Wählen Sie eine Instanzart.
inst-duplicate = Diese Instanz ist bereits konfiguriert.
inst-saved = Instanz gespeichert.
inst-added = Instanz hinzugefügt.
inst-testing = Verbindung wird getestet…
inst-access-denied = Zugriff auf diesen Host wurde nicht erlaubt.
inst-connected = Verbindung erfolgreich.
inst-connection-failed = Verbindung fehlgeschlagen: { $error }

## Settings: API keys

keys-title = API-Schlüssel
keys-pixabay = Pixabay-API-Schlüssel
keys-pixabay-placeholder = Schlüssel einfügen
keys-pixabay-hint = *Kostenloser Schlüssel von pixabay.com/api/docs (Pixabay-Konto erforderlich). Wird nur in diesem Browser gespeichert und nie exportiert.
keys-pixabay-saved = Pixabay-API-Schlüssel gespeichert.
keys-pixabay-removed = Pixabay-API-Schlüssel entfernt.
keys-twitch-client-id = Twitch-Client-ID
keys-twitch-client-id-placeholder = Aus Ihrer App auf dev.twitch.tv
keys-twitch-client-id-saved = Twitch-Client-ID gespeichert.
keys-twitch-client-id-removed = Twitch-Client-ID entfernt.
keys-twitch-redirect = Twitch-OAuth-Weiterleitungs-URL (in Ihre Twitch-App einfügen)
keys-twitch-sign-in = Mit Twitch anmelden
keys-twitch-sign-out = Abmelden
keys-twitch-hint-register = *Registrieren Sie eine kostenlose Anwendung auf dev.twitch.tv, Kategorie "Website Integration", mit der obigen Weiterleitungs-URL.
keys-twitch-hint-bridge = *Twitch-Kanäle mit einer RSS-Bridge-Feed-URL funktionieren ohne Anmeldung.
keys-enter-client-id = Geben Sie zuerst Ihre Twitch-Client-ID ein.
keys-twitch-access-denied = Zugriff auf Twitch wurde nicht erlaubt.
keys-signed-in-toast = Bei Twitch angemeldet als { $login }.
keys-sign-in-failed = Twitch-Anmeldung fehlgeschlagen.
keys-signed-out = Von Twitch abgemeldet.
keys-signed-in-as = Angemeldet als { $login }.
keys-twitch-user = ein Twitch-Benutzer
keys-not-signed-in = Nicht angemeldet.

## Settings: Import / Export

settings-transfer = Import / Export
transfer-hint = Importiert FeedTubes-CSV/JSON, YouTube-Takeout/FreeTube-CSV, FreeTube-.db, NewPipe-JSON oder OPML.
transfer-file = Abonnement-Datei
transfer-mode = Zusammenführungsmodus
transfer-mode-merge = Zusammenführen — Hinzufügen und Aktualisieren
transfer-mode-skip = Auffüllen — Duplikate überspringen
transfer-mode-replace = Ersetzen — Alle aktuellen Abonnements entfernen
transfer-import = Importieren
transfer-export-format = Exportformat
transfer-filter = Filter
transfer-filter-all = Alle Abonnements
transfer-filter-enabled = Nur aktivierte
transfer-download = Datei herunterladen
transfer-importing = Wird importiert…
transfer-imported =
    { $count ->
        [one] { $count } Abonnement aus { $format } importiert.
       *[other] { $count } Abonnements aus { $format } importiert.
    }
transfer-invalid-rows =
    { $count ->
        [one] { $count } ungültige Zeile übersprungen.
       *[other] { $count } ungültige Zeilen übersprungen.
    }
transfer-stored =
    { $count ->
        [one] { $count } Abonnement gespeichert.
       *[other] { $count } Abonnements gespeichert.
    }
transfer-none-found = Es wurden keine gültigen Abonnements gefunden.
transfer-confirm-replace = Alle bestehenden Abonnements durch diese Datei ersetzen?
transfer-imported-toast = Abonnements importiert.
transfer-import-failed = Die Datei konnte nicht importiert werden.
transfer-choose-file = Wählen Sie zuerst eine Abonnement-Datei.
transfer-too-large = Die Datei überschreitet die Grenze von 5 MB.
transfer-access-needed = Diese Quellen brauchen Host-Zugriff, bevor sie abgerufen werden können.
transfer-grant-access = Zugriff erlauben und abrufen
transfer-choose-format = Wählen Sie ein Exportformat.
transfer-exported = { $filename } exportiert.
transfer-export-failed = Abonnements konnten nicht exportiert werden.

## Import parsing

import-error-no-array = Diese JSON-Datei enthält kein Abonnement-Array.
import-error-no-you-tube = Diese JSON-Datei enthält keine YouTube-Abonnements.
import-error-csv-empty = Die CSV-Datei ist leer.
import-error-opml-unavailable = OPML-Import ist in dieser Umgebung nicht verfügbar.
import-error-opml-xml = Die OPML-Datei ist kein gültiges XML.
import-error-empty = Die ausgewählte Datei ist leer.
import-error-unknown-format = Unbekanntes Format der Abonnement-Datei.
import-warn-newpipe = Ein NewPipe-Abonnement, das nicht von YouTube ist, wurde übersprungen.
import-warn-freetube-line = Eine FreeTube-Zeile mit ungültigem JSON wurde übersprungen.

## Subscription validation

validate-unknown-platform = Unbekannte oder fehlende Plattform.
validate-instance-required = Eine { $platform }-Instanz-URL ist erforderlich.
validate-channel-required = Eine Kanal-ID oder Kanal-URL ist erforderlich.
validate-feed-required = Diese Plattform benötigt eine RSS/Atom- oder Bridge-Feed-URL.
validate-invalid-url = { $field } muss eine gültige http(s)-URL sein.
validate-url-too-long = { $field } ist zu lang.
validate-channel-too-long = Die Kanalkennung ist zu lang.
field-instance-url = Instanz-URL
field-channel-url = Kanal-URL
field-feed-url = Feed-URL

## Network

fetch-http-error = Anfrage fehlgeschlagen mit HTTP { $status } ({ $url }).
fetch-network-error = { $url } nicht erreichbar: { $cause }
fetch-network-fallback = Netzwerkfehler
fetch-host-paused = { $host } lehnt Anfragen ab, daher pausiert FeedTubes diesen Host eine Weile.
fetch-host-budget = Das stündliche Anfragelimit für { $host } ist erreicht; der Rest folgt später.

## Platforms

rss-needs-feed = Dieses Abonnement benötigt eine gültige RSS- oder Atom-Feed-URL.
rss-invalid-xml = Der Feed ist kein gültiges XML.
dtube-not-found = D.Tube hat keinen Kanal namens „{ $name }“.
dtube-no-name = Dieses D.Tube-Abonnement hat keinen Kanalnamen.
goodgame-not-found = goodgame.ru hat keinen Kanal namens „{ $name }“.
goodgame-no-name = Dieses goodgame.ru-Abonnement hat keinen Kanalnamen.
peertube-no-instance = Dieses PeerTube-Abonnement hat keine gültige Instanz-URL.
pixabay-no-key = Fügen Sie Ihren Pixabay-API-Schlüssel unter Einstellungen → Instanzen hinzu, um Pixabay-Videos zu laden.
pixabay-no-name = Dieses Pixabay-Abonnement hat keinen Urhebernamen.
pixabay-no-videos = Pixabay hat keine Videos von „{ $name }“ geliefert.
twitch-sign-in = Melden Sie sich unter Einstellungen → Instanzen mit Twitch an oder geben Sie diesem Abonnement eine RSS-Bridge-Feed-URL.
twitch-expired = Ihre Twitch-Anmeldung ist abgelaufen. Melden Sie sich unter Einstellungen → Instanzen erneut an.
twitch-not-found = Twitch hat keinen Kanal namens „{ $name }“.
twitch-no-name = Dieses Twitch-Abonnement hat keinen Kanalnamen.
twitch-auth-failed = Twitch-Anmeldung fehlgeschlagen: { $reason }
twitch-auth-state-mismatch = die Antwort passte nicht zur Anfrage.
twitch-auth-no-token = es wurde kein Zugriffstoken zurückgegeben.
twitch-auth-rejected = Twitch hat das Anmeldetoken abgelehnt.
youtube-enter-id = Geben Sie eine YouTube-Kanal-ID (UC…), Kanal-URL oder ein @handle ein.
youtube-lookup-failed = { $url } konnte nicht nachgeschlagen werden: { $error }
youtube-request-failed = Anfrage fehlgeschlagen
youtube-unresolved = Dieses YouTube-Handle konnte nicht aufgelöst werden. Geben Sie stattdessen die UC…-Kanal-ID ein.
youtube-no-channel-id = Dieses YouTube-Abonnement hat keine Kanal-ID. Bearbeiten Sie es und geben Sie die UC…-ID ein.
youtube-invalid-xml = Der YouTube-Feed ist kein gültiges XML.
youtube-empty-videos-tab = der Videos-Tab enthielt keine Videos
youtube-both-failed = YouTube-Feed fehlgeschlagen ({ $feed }), ebenso der Ausweichweg ({ $fallback }).

## Composite messages

error-raw = { $detail }
refresh-summary = { $parts }.
