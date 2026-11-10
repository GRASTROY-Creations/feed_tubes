# FeedTubes interface text. Interslavic, Latin script. The Cyrillic variant (isv-Cyrl) is generated from this file.
# `cldr-*` messages replace the Intl formatting that CLDR has no Interslavic data for.

## Shared

common-add = Dodati
common-save = Sohraniti
common-cancel = Otměniti
common-edit = Redaktovati
common-remove = Odstraniti
common-delete = Izbrisati
common-search = Iskati
common-platform = Platforma
common-channel = Kanal
common-all-platforms = Vse platformy
common-all-channels = Vse kanaly
common-unknown-error = neznama pogrěška

## Tab bar

tabs-label = Vidy FeedTubes
tabs-feed = Lenta
tabs-settings = Nastavjenja
app-fetch = Polučiti

## Feed

feed-grant-access = Dati dostup
feed-requesting = Zapytyvanje…
feed-load-more = Zagruziti ješče
feed-load-more-count = Zagruziti ješče { $count } (ostaje { $remaining })
feed-status-refreshing = Obnovjenje lent…
feed-status-failures =
    { $count ->
        [one] { $count } izvor ne bylo možno obnoviti.
        [few] { $count } izvora ne bylo možno obnoviti.
        [many] { $count } izvorov ne bylo možno obnoviti.
       *[other] { $count } izvora ne bylo možno obnoviti.
    }
feed-status-never-refreshed = Lenta ješče ne byla obnovjena.
feed-error-permissions =
    { $count ->
        [one] Potrěben jest dostup do { $count } izvora. Dajte dostup, da by zagruziti cělu lentu.
        [few] Potrěben jest dostup do { $count } izvorov. Dajte dostup, da by zagruziti cělu lentu.
        [many] Potrěben jest dostup do { $count } izvorov. Dajte dostup, da by zagruziti cělu lentu.
       *[other] Potrěben jest dostup do { $count } izvorov. Dajte dostup, da by zagruziti cělu lentu.
    }
feed-empty-no-subscriptions-title = Ješče nema podpisok
feed-empty-no-subscriptions-text = Dodajte kanal ili importujte fajl podpisok.
feed-empty-no-subscriptions-button = Otvoriti nastavjenja
feed-empty-refreshing-title = Obnovjenje lent
feed-empty-refreshing-text = Vaše podpiski se prověrjajut na nove video.
feed-empty-no-videos-title = Ješče nema video
feed-empty-no-videos-text = Polučite najnovše video iz vaših podpisok.
feed-empty-no-videos-button = Polučiti teper
feed-empty-no-matches-title = Nema odpovědnyh video
feed-empty-no-matches-text = Poprobujte drugy filter platformy ili kanala.
feed-empty-no-matches-button = Očistiti filtry
feed-toast-access-granted = Dostup dany. Lenty se obnovjajut.
feed-toast-access-denied = Dostup ne byl dany. Někoje izvory ostanut nedostupne.
feed-toast-access-failed = Ne bylo možno zapytati dostup.

## Video cards

card-date-unknown = Data neznama
card-unknown-channel = Neznamy kanal
card-untitled = Video bez nazvy
card-aria-label = { $title } na { $platform }
stream-live = V EFIRU: { $title }
stream-last = Poslědnja translacija: { $title }
stream-live-game = V EFIRU: { $title } ({ $game })
stream-last-game = Poslědnja translacija: { $title } ({ $game })
stream-untitled = Translacija bez nazvy

## Sidebar app

app-error-refresh-failed = Ne bylo možno obnoviti lenty.
app-toast-background-refreshed = Lenta obnovjena v pozadju.
app-error-reload-failed = Ne bylo možno nanovo zagruziti lentu.
app-error-access-removed = Dostup do hosta byl odstranjeny. Někoje izvory potrěbujut dostup ponovno.

## Refresh summary

refresh-no-subscriptions = Pred obnovjenjem dodajte aktivnu podpisku.
refresh-all-recent = Vse izvory byli nedavno obnovjene; { $wait }.
refresh-next-in = slědujuče obnovjenje za { $time }
refresh-refreshed =
    { $count ->
        [one] Obnovjeny { $count } izvor
        [few] Obnovjene { $count } izvora
        [many] Obnovjeno { $count } izvorov
       *[other] Obnovjeno { $count } izvorov
    }
refresh-failed = { $count } neuspěšno
refresh-skipped = { $count } propuščeno (nedavno obnovjene, { $wait })
refresh-error-permission = Za toj izvor jest potrěbno dozvoljenje dostupa do hosta.
refresh-error-generic = Ne bylo možno obnoviti toj izvor.
background-refresh-failed = Obnovjenje ne udalo se.
background-alarm-update-failed = Ne bylo možno obnoviti budilnik.
background-alarm-read-failed = Ne bylo možno pročitati budilnik.

## Time

time-updated = Obnovjeno { $time }
time-never-fetched = Lenty ne jest
time-just-now = teperj

## Settings: General

settings-general = Obče
settings-language = Jezyk
settings-language-auto = Avtomatično (jezyk pregledača)
settings-language-changed = Jezyk izměnjeny.
settings-fetching-title = Avtomatično polučenje
settings-fetching-interval = Interval polučenja
settings-fetching-every1h = Každy 1 čas
settings-fetching-every3h = Každe 3 časa
settings-fetching-every6h = Každyh 6 časov
settings-fetching-background = Polučati lentu v pozadju
settings-fetching-hint = *Lenta se polučaje pri otvorjenju bočnoj paneli, ako keš jest zastarěly.
settings-fetching-schedule-updated = Raspis obnovjenja izměnjeny.
settings-fetching-background-on = Obnovjenje v pozadju vključeno.
settings-fetching-background-off = Obnovjenje v pozadju izključeno.
settings-data-title = Dane i informacija
settings-data-storage = Sohranjene dane: { $size }.
settings-data-clear-cache = Očistiti keš
settings-data-reset = Izbrisati vse dane
settings-data-hint-cache = *Očiščenje keša ne odstranjaje podpisok ni nastavjenj
settings-data-hint-requests = *Zapyty lent idut prjamo do platform i mostovyh servisov, ktore vy nastavjate.
settings-data-hint-privacy = *FeedTubes ne sbiraje danyh.
settings-data-cache-cleared = Keš očiščeny.
settings-data-confirm-reset = Izbrisati vse dane FeedTubes, vključajuči podpiski i nastavjenja?
settings-data-purged = Vse dane izbrisane.
settings-version = Versija

## Settings: Subscriptions

settings-subscriptions = Podpiski
subs-instance = Instancija
subs-channel = ID kanala, URL ili @handle
subs-alias = Psevdonim
subs-alias-placeholder = Neobvezno, pokazyvaje se oměsto imena kanala
subs-feed-url = URL lenty
subs-bridge-feed-url = URL lenty RSS-mosta (neobvezno)
subs-enable-all = Vključiti vse
subs-disable-all = Izključiti vse
subs-delete-disabled = Izbrisati izključene
subs-search-placeholder = Ime kanala
subs-fallback-title = Podpiska
subs-toggle-label = Vključiti { $name }
subs-no-instance = Nijedna instancija ne jest izbrana
subs-add-instance-hint = Dodajte instanciju { $kind } v Instancije
subs-empty = Ješče nema podpisok.
subs-no-matches = Nijedna podpiska ne odpovědaje tekučim filtram.
subs-deleted = Podpiska izbrisana.
subs-youtube-access = Za iskanje togo kanala jest potrěben dostup do YouTube.
subs-read-failed = Ne bylo možno pročitati kanal.
subs-exists = Taka podpiska uže jest.
subs-saved = Podpiska sohranjena.
subs-added = Podpiska dodana.
subs-all-enabled = Vse podpiski vključene.
subs-all-disabled = Vse podpiski izključene.
subs-none-disabled = Nema izključenyh podpisok.
subs-confirm-delete-disabled =
    { $count ->
        [one] Izbrisati { $count } izključenu podpisku?
        [few] Izbrisati { $count } izključene podpiski?
        [many] Izbrisati { $count } izključenyh podpisok?
       *[other] Izbrisati { $count } izključenyh podpisok?
    }
subs-disabled-deleted = Izključene podpiski izbrisane.
placeholder-youtube = UC… / URL kanala / @handle
placeholder-peertube = @handle kanala ili /c/ URL
placeholder-odysee = @name:claimid
placeholder-rutube = Čislovy ID kanala ili URL
placeholder-dailymotion = Ime koristnika ili URL kanala
placeholder-dtube = Ime kanala ili URL d.tube/channel/…
placeholder-pixabay = Ime avtora ili URL profila
placeholder-twitch = Ime kanala ili URL twitch.tv/…
placeholder-goodgame = Ime kanala ili URL goodgame.ru/…
placeholder-vkvideo = ID kanala (neobvezno)
placeholder-bilibili = UID (neobvezno)
placeholder-rumble = Slug kanala (neobvezno)
placeholder-generic = ID kanala (neobvezno)

## Settings: Instances

settings-instances = Instancije
inst-hint = Instancije PeerTube i bazy mostov. Každa podpiska sohranjaje svoju instanciju.
inst-kind = Tip
inst-kind-peertube = PeerTube
inst-kind-rsshub = RSSHub
inst-kind-vk = VK-most
inst-kind-bilibili = Bilibili-most
inst-kind-rumble = Rumble-most
inst-kind-generic = Obče RSS
inst-label = Oznaka
inst-label-placeholder = Moja instancija
inst-base-url = Bazovy URL
inst-test = Test
inst-test-tooltip = Testovati svezj
inst-search-placeholder = Oznaka, tip ili URL
inst-invalid-url = Vpišite pravilny bazovy URL http(s).
inst-confirm-remove = Odstraniti instanciju { $name }? Jestvujuče podpiski ohranjajut svoj URL instancije.
inst-removed = Instancija odstranjena.
inst-empty = Nema nastavjenyh instancij. Dodajte vyše instanciju PeerTube ili bazu mosta.
inst-no-matches = Nijedna instancija ne odpovědaje iskanju.
inst-choose-kind = Izberite tip instancije.
inst-duplicate = Ta instancija uže jest nastavjena.
inst-saved = Instancija sohranjena.
inst-added = Instancija dodana.
inst-testing = Testovanje svezi…
inst-access-denied = Dostup do togo hosta ne byl dany.
inst-connected = Svezj uspěšna.
inst-connection-failed = Svezj neuspěšna: { $error }

## Settings: API keys

keys-title = Ključi API
keys-pixabay = Ključ API Pixabay
keys-pixabay-placeholder = Vstavite vaš ključ
keys-pixabay-hint = *Bezplatny ključ na pixabay.com/api/docs (potrěbno jest konto Pixabay). Sohranjaje se jedino v tom pregledaču i nikdy ne jest vključeny v eksport.
keys-pixabay-saved = Ključ API Pixabay sohranjeny.
keys-pixabay-removed = Ključ API Pixabay odstranjeny.
keys-twitch-client-id = Twitch Client ID
keys-twitch-client-id-placeholder = Iz vašej aplikacije na dev.twitch.tv
keys-twitch-client-id-saved = Twitch Client ID sohranjeny.
keys-twitch-client-id-removed = Twitch Client ID odstranjeny.
keys-twitch-redirect = URL preusměrjenja Twitch OAuth (vstavite v vašu aplikaciju Twitch)
keys-twitch-sign-in = Vojti črez Twitch
keys-twitch-sign-out = Vyjti
keys-twitch-hint-register = *Registrujte bezplatnu aplikaciju na dev.twitch.tv, kategorija "Website Integration", s vyše pokazanym URL preusměrjenja.
keys-twitch-hint-bridge = *Kanaly Twitch s URL lenty RSS-mosta funkcionirujut bez vhoda.
keys-enter-client-id = Najprvo vpišite vaš Twitch Client ID.
keys-twitch-access-denied = Dostup do Twitch ne byl dany.
keys-signed-in-toast = Vhod v Twitch kako { $login }.
keys-sign-in-failed = Vhod v Twitch neuspěšny.
keys-signed-out = Vyhod iz Twitch.
keys-signed-in-as = Vhod kako { $login }.
keys-twitch-user = koristnik Twitch
keys-not-signed-in = Ne jeste vošli.

## Settings: Import / Export

settings-transfer = Import / Eksport
transfer-hint = Importujte FeedTubes CSV/JSON, YouTube Takeout/FreeTube CSV, FreeTube .db, NewPipe JSON ili OPML.
transfer-file = Fajl podpisok
transfer-mode = Režim slijanja
transfer-mode-merge = Slijati — dodati i obnoviti
transfer-mode-skip = Dopolniti — propustiti dvojniky
transfer-mode-replace = Zaměniti — odstraniti vse tekuče podpiski
transfer-import = Importovati
transfer-export-format = Format eksporta
transfer-filter = Filter
transfer-filter-all = Vse podpiski
transfer-filter-enabled = Jedino vključene
transfer-download = Skačati fajl
transfer-importing = Importovanje…
transfer-imported =
    { $count ->
        [one] Importovana { $count } podpiska iz { $format }.
        [few] Importovane { $count } podpiski iz { $format }.
        [many] Importovano { $count } podpisok iz { $format }.
       *[other] Importovano { $count } podpisok iz { $format }.
    }
transfer-invalid-rows =
    { $count ->
        [one] Propuščeny { $count } nepravilny redok.
        [few] Propuščene { $count } nepravilne redky.
        [many] Propuščeno { $count } nepravilnyh redkov.
       *[other] Propuščeno { $count } nepravilnyh redkov.
    }
transfer-stored =
    { $count ->
        [one] Sohranjena { $count } podpiska.
        [few] Sohranjene { $count } podpiski.
        [many] Sohranjeno { $count } podpisok.
       *[other] Sohranjeno { $count } podpisok.
    }
transfer-none-found = Ne byli najdene nijake pravilne podpiski.
transfer-confirm-replace = Zaměniti vse jestvujuče podpiski tym faljom?
transfer-imported-toast = Podpiski importovane.
transfer-import-failed = Ne bylo možno importovati fajl.
transfer-choose-file = Najprvo izberite fajl podpisok.
transfer-too-large = Fajl jest bolje veliky neželi limit 5 MB.
transfer-choose-format = Izberite format eksporta.
transfer-exported = Eksportovano { $filename }.
transfer-export-failed = Ne bylo možno eksportovati podpiski.

## Import parsing

import-error-no-array = Toj fajl JSON ne imaje massiva podpisok.
import-error-no-you-tube = Toj fajl JSON ne imaje podpisok YouTube.
import-error-csv-empty = Fajl CSV jest prazdny.
import-error-opml-unavailable = Import OPML ne jest dostupny v tom okruženju.
import-error-opml-xml = Fajl OPML ne jest pravilny XML.
import-error-empty = Izbrany fajl jest prazdny.
import-error-unknown-format = Nerazpoznany format fajla podpisok.
import-warn-newpipe = Propuščena podpiska NewPipe, ktora ne jest z YouTube.
import-warn-freetube-line = Propuščeny redok FreeTube, ktory ne jest pravilny JSON.

## Subscription validation

validate-unknown-platform = Neznama ili otsutna platforma.
validate-instance-required = Potrěben jest URL instancije { $platform }.
validate-channel-required = Potrěben jest ID kanala ili URL kanala.
validate-feed-required = Ta platforma potrěbuje URL lenty RSS/Atom ili mosta.
validate-invalid-url = { $field } musi byti pravilny URL http(s).
validate-url-too-long = { $field } jest prědolgy.
validate-channel-too-long = Identifikator kanala jest prědolgy.
field-instance-url = URL instancije
field-channel-url = URL kanala
field-feed-url = URL lenty

## Network

fetch-http-error = Zapyt neuspěšny s HTTP { $status } ({ $url }).
fetch-network-error = Ne bylo možno dostignuti { $url }: { $cause }
fetch-network-fallback = pogrěška sěti

## Platforms

rss-needs-feed = Ta podpiska potrěbuje pravilny URL lenty RSS ili Atom.
rss-invalid-xml = Lenta ne jest pravilny XML.
dtube-not-found = D.Tube ne imaje kanala s imenem "{ $name }".
dtube-no-name = Ta podpiska D.Tube ne imaje imena kanala.
goodgame-not-found = goodgame.ru ne imaje kanala s imenem "{ $name }".
goodgame-no-name = Ta podpiska goodgame.ru ne imaje imena kanala.
peertube-no-instance = Ta podpiska PeerTube ne imaje pravilnogo URL instancije.
pixabay-no-key = Dodajte vaš ključ API Pixabay v Nastavjenja → Instancije, da by zagruziti video Pixabay.
pixabay-no-name = Ta podpiska Pixabay ne imaje imena avtora.
pixabay-no-videos = Pixabay ne vratil nijakyh video od "{ $name }".
twitch-sign-in = Vojdite črez Twitch v Nastavjenja → Instancije ili dajte toj podpiskě URL lenty RSS-mosta.
twitch-expired = Vaš vhod v Twitch istekl. Vojdite ponovno v Nastavjenja → Instancije.
twitch-not-found = Twitch ne imaje kanala s imenem "{ $name }".
twitch-no-name = Ta podpiska Twitch ne imaje imena kanala.
twitch-auth-failed = Vhod v Twitch neuspěšny: { $reason }
twitch-auth-state-mismatch = odgovor ne odpovědal zapytu.
twitch-auth-no-token = ne byl vračeny token dostupa.
twitch-auth-rejected = Twitch odhylil token vhoda.
youtube-enter-id = Vpišite ID kanala YouTube (UC…), URL kanala ili @handle.
youtube-lookup-failed = Ne bylo možno najdti { $url }: { $error }
youtube-request-failed = zapyt neuspěšny
youtube-unresolved = Ne bylo možno razrěšiti toj @handle YouTube. Vpišite oměsto togo ID kanala UC….
youtube-no-channel-id = Ta podpiska YouTube ne imaje ID kanala. Redaktujte ju i vpišite ID UC….
youtube-invalid-xml = Lenta YouTube ne jest pravilny XML.
youtube-empty-videos-tab = karta "Video" ne pokazala nijakyh video
youtube-both-failed = Lenta YouTube neuspěšna ({ $feed }), i rezervny metod takože ({ $fallback }).

## Composite messages

error-raw = { $detail }
refresh-summary = { $parts }.

## Formatting without CLDR data

cldr-minutes-ago =
    { $count ->
        [one] { $count } minutu nazad
        [few] { $count } minuty nazad
        [many] { $count } minut nazad
       *[other] { $count } minuty nazad
    }
cldr-hours-ago =
    { $count ->
        [one] { $count } čas nazad
        [few] { $count } časa nazad
        [many] { $count } časov nazad
       *[other] { $count } časa nazad
    }
cldr-days-ago =
    { $count ->
        [one] { $count } denj nazad
        [few] { $count } dnja nazad
        [many] { $count } dnjev nazad
       *[other] { $count } dnja nazad
    }
cldr-weeks-ago =
    { $count ->
        [one] { $count } tydenj nazad
        [few] { $count } tydnja nazad
        [many] { $count } tydnjev nazad
       *[other] { $count } tydnja nazad
    }
cldr-months-ago =
    { $count ->
        [one] { $count } měsec nazad
        [few] { $count } měseca nazad
        [many] { $count } měsecev nazad
       *[other] { $count } měseca nazad
    }
cldr-years-ago =
    { $count ->
        [one] { $count } god nazad
        [few] { $count } goda nazad
        [many] { $count } godov nazad
       *[other] { $count } goda nazad
    }
cldr-minutes-short = { $count } min
cldr-hours-short = { $count } č
cldr-bytes = { $count } B
cldr-kilobytes = { $count } KB
cldr-megabytes = { $count } MB
cldr-datetime = { $day }.{ $month }.{ $year } { $hour }:{ $minute }
cldr-list-pair = { $head } i { $tail }
cldr-list-more = { $head }, { $tail }
