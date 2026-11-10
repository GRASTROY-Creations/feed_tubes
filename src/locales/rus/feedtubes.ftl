# FeedTubes interface text. Russian.

## Shared

common-add = Добавить
common-save = Сохранить
common-cancel = Отмена
common-edit = Изменить
common-remove = Убрать
common-delete = Удалить
common-search = Поиск
common-platform = Платформа
common-channel = Канал
common-all-platforms = Все платформы
common-all-channels = Все каналы
common-unknown-error = неизвестная ошибка

## Tab bar

tabs-label = Разделы FeedTubes
tabs-feed = Лента
tabs-settings = Настройки
app-fetch = Обновить

## Feed

feed-grant-access = Разрешить доступ
feed-requesting = Запрос…
feed-load-more = Показать ещё
feed-load-more-count = Показать ещё { $count } (осталось { $remaining })
feed-status-refreshing = Обновление лент…
feed-status-failures =
    { $count ->
        [one] Не удалось обновить { $count } источник.
        [few] Не удалось обновить { $count } источника.
        [many] Не удалось обновить { $count } источников.
       *[other] Не удалось обновить { $count } источника.
    }
feed-status-never-refreshed = Лента ещё не обновлялась.
feed-error-permissions =
    { $count ->
        [one] Нужен доступ к { $count } источнику. Разрешите доступ, чтобы загрузить ленту полностью.
        [few] Нужен доступ к { $count } источникам. Разрешите доступ, чтобы загрузить ленту полностью.
        [many] Нужен доступ к { $count } источникам. Разрешите доступ, чтобы загрузить ленту полностью.
       *[other] Нужен доступ к { $count } источника. Разрешите доступ, чтобы загрузить ленту полностью.
    }
feed-empty-no-subscriptions-title = Подписок пока нет
feed-empty-no-subscriptions-text = Добавьте канал или импортируйте файл подписок.
feed-empty-no-subscriptions-button = Открыть настройки
feed-empty-refreshing-title = Обновление лент
feed-empty-refreshing-text = Проверяем ваши подписки на новые видео.
feed-empty-no-videos-title = Видео пока нет
feed-empty-no-videos-text = Загрузите последние видео из ваших подписок.
feed-empty-no-videos-button = Обновить сейчас
feed-empty-no-matches-title = Подходящих видео нет
feed-empty-no-matches-text = Попробуйте выбрать другую платформу или канал.
feed-empty-no-matches-button = Сбросить фильтры
feed-toast-access-granted = Доступ разрешён. Обновляем ленты.
feed-toast-access-denied = Доступ не разрешён. Некоторые источники останутся недоступны.
feed-toast-access-failed = Не удалось запросить доступ.

## Video cards

card-date-unknown = Дата неизвестна
card-unknown-channel = Неизвестный канал
card-untitled = Видео без названия
card-aria-label = { $title } на { $platform }
stream-live = В ЭФИРЕ: { $title }
stream-last = Последний эфир: { $title }
stream-live-game = В ЭФИРЕ: { $title } ({ $game })
stream-last-game = Последний эфир: { $title } ({ $game })
stream-untitled = Эфир без названия

## Sidebar app

app-error-refresh-failed = Не удалось обновить ленты.
app-toast-background-refreshed = Лента обновлена в фоне.
app-error-reload-failed = Не удалось перезагрузить ленту.
app-error-access-removed = Доступ к сайтам был отозван. Некоторым источникам снова нужен доступ.

## Refresh summary

refresh-no-subscriptions = Перед обновлением добавьте хотя бы одну включённую подписку.
refresh-all-recent = Все источники недавно обновлялись; { $wait }.
refresh-next-in = следующее обновление через { $time }
refresh-refreshed =
    { $count ->
        [one] Обновлён { $count } источник
        [few] Обновлено { $count } источника
        [many] Обновлено { $count } источников
       *[other] Обновлено { $count } источника
    }
refresh-failed = с ошибкой: { $count }
refresh-skipped = пропущено: { $count } (недавно обновлялись, { $wait })
refresh-error-permission = Для этого источника нужно разрешение на доступ к сайту.
refresh-error-generic = Не удалось обновить этот источник.
background-refresh-failed = Не удалось обновить.
background-alarm-update-failed = Не удалось изменить расписание обновления.
background-alarm-read-failed = Не удалось прочитать расписание обновления.

## Time

time-updated = Обновлено { $time }
time-never-fetched = Ленты нет
time-just-now = только что

## Settings: General

settings-general = Основные
settings-language = Язык
settings-language-auto = Автоматически (язык браузера)
settings-language-changed = Язык изменён.
settings-fetching-title = Автоматическое обновление
settings-fetching-interval = Интервал обновления
settings-fetching-every1h = Каждый час
settings-fetching-every3h = Каждые 3 часа
settings-fetching-every6h = Каждые 6 часов
settings-fetching-background = Обновлять ленту в фоне
settings-fetching-hint = *Лента обновляется при открытии боковой панели, если кэш устарел.
settings-fetching-schedule-updated = Расписание обновления изменено.
settings-fetching-background-on = Фоновое обновление включено.
settings-fetching-background-off = Фоновое обновление отключено.
settings-data-title = Данные и сведения
settings-data-storage = Сохранено данных: { $size }.
settings-data-clear-cache = Очистить кэш
settings-data-reset = Сбросить все данные
settings-data-hint-cache = *Очистка кэша не удаляет подписки и настройки
settings-data-hint-requests = *Запросы лент идут напрямую к платформам и указанным вами сервисам-мостам.
settings-data-hint-privacy = *FeedTubes не собирает данные.
settings-data-cache-cleared = Кэш очищен.
settings-data-confirm-reset = Удалить все данные FeedTubes, включая подписки и настройки?
settings-data-purged = Все данные удалены.
settings-version = Версия

## Settings: Subscriptions

settings-subscriptions = Подписки
subs-instance = Сервер
subs-channel = ID канала, URL или @handle
subs-alias = Псевдоним
subs-alias-placeholder = Необязательно, показывается вместо названия канала
subs-feed-url = URL ленты
subs-bridge-feed-url = URL ленты RSS-моста (необязательно)
subs-enable-all = Включить все
subs-disable-all = Отключить все
subs-delete-disabled = Удалить отключённые
subs-search-placeholder = Название канала
subs-fallback-title = Подписка
subs-toggle-label = Включить { $name }
subs-no-instance = Сервер не выбран
subs-add-instance-hint = Добавьте сервер { $kind } в разделе «Серверы»
subs-empty = Подписок пока нет.
subs-no-matches = Нет подписок, подходящих под текущие фильтры.
subs-deleted = Подписка удалена.
subs-youtube-access = Чтобы найти этот канал, нужен доступ к YouTube.
subs-read-failed = Не удалось получить данные канала.
subs-exists = Такая подписка уже есть.
subs-saved = Подписка сохранена.
subs-added = Подписка добавлена.
subs-all-enabled = Все подписки включены.
subs-all-disabled = Все подписки отключены.
subs-none-disabled = Отключённых подписок нет.
subs-confirm-delete-disabled =
    { $count ->
        [one] Удалить { $count } отключённую подписку?
        [few] Удалить { $count } отключённые подписки?
        [many] Удалить { $count } отключённых подписок?
       *[other] Удалить { $count } отключённой подписки?
    }
subs-disabled-deleted = Отключённые подписки удалены.
placeholder-youtube = UC… / URL канала / @handle
placeholder-peertube = Handle канала или URL с /c/
placeholder-odysee = @name:claimid
placeholder-rutube = Числовой ID канала или URL
placeholder-dailymotion = Имя пользователя или URL канала
placeholder-dtube = Имя канала или URL d.tube/channel/…
placeholder-pixabay = Имя автора или URL профиля
placeholder-twitch = Имя канала или URL twitch.tv/…
placeholder-goodgame = Имя канала или URL goodgame.ru/…
placeholder-vkvideo = ID канала (необязательно)
placeholder-bilibili = UID (необязательно)
placeholder-rumble = Slug канала (необязательно)
placeholder-generic = ID канала (необязательно)

## Settings: Instances

settings-instances = Серверы
inst-hint = Серверы PeerTube и адреса мостов. Каждая подписка хранит свой сервер.
inst-kind = Тип
inst-kind-peertube = PeerTube
inst-kind-rsshub = RSSHub
inst-kind-vk = Мост VK
inst-kind-bilibili = Мост Bilibili
inst-kind-rumble = Мост Rumble
inst-kind-generic = Обычный RSS
inst-label = Название
inst-label-placeholder = Мой сервер
inst-base-url = Базовый URL
inst-test = Проверить
inst-test-tooltip = Проверить подключение
inst-search-placeholder = Название, тип или URL
inst-invalid-url = Введите правильный базовый URL http(s).
inst-confirm-remove = Убрать сервер { $name }? Существующие подписки сохранят свой URL сервера.
inst-removed = Сервер убран.
inst-empty = Серверы не настроены. Добавьте выше сервер PeerTube или адрес моста.
inst-no-matches = Нет серверов, подходящих под запрос.
inst-choose-kind = Выберите тип сервера.
inst-duplicate = Этот сервер уже настроен.
inst-saved = Сервер сохранён.
inst-added = Сервер добавлен.
inst-testing = Проверка подключения…
inst-access-denied = Доступ к этому сайту не разрешён.
inst-connected = Подключение установлено.
inst-connection-failed = Ошибка подключения: { $error }

## Settings: API keys

keys-title = Ключи API
keys-pixabay = Ключ API Pixabay
keys-pixabay-placeholder = Вставьте ключ
keys-pixabay-hint = *Бесплатный ключ на pixabay.com/api/docs (нужна учётная запись Pixabay). Хранится только в этом браузере и никогда не попадает в экспорт.
keys-pixabay-saved = Ключ API Pixabay сохранён.
keys-pixabay-removed = Ключ API Pixabay удалён.
keys-twitch-client-id = Twitch Client ID
keys-twitch-client-id-placeholder = Из вашего приложения на dev.twitch.tv
keys-twitch-client-id-saved = Twitch Client ID сохранён.
keys-twitch-client-id-removed = Twitch Client ID удалён.
keys-twitch-redirect = URL перенаправления OAuth для Twitch (вставьте в приложение Twitch)
keys-twitch-sign-in = Войти через Twitch
keys-twitch-sign-out = Выйти
keys-twitch-hint-register = *Зарегистрируйте бесплатное приложение на dev.twitch.tv в категории "Website Integration", указав URL перенаправления выше.
keys-twitch-hint-bridge = *Каналы Twitch с URL ленты RSS-моста работают без входа.
keys-enter-client-id = Сначала введите Twitch Client ID.
keys-twitch-access-denied = Доступ к Twitch не разрешён.
keys-signed-in-toast = Выполнен вход в Twitch как { $login }.
keys-sign-in-failed = Не удалось войти в Twitch.
keys-signed-out = Выполнен выход из Twitch.
keys-signed-in-as = Вход выполнен как { $login }.
keys-twitch-user = пользователь Twitch
keys-not-signed-in = Вход не выполнен.

## Settings: Import / Export

settings-transfer = Импорт и экспорт
transfer-hint = Импорт из CSV/JSON FeedTubes, CSV YouTube Takeout/FreeTube, .db FreeTube, JSON NewPipe или OPML.
transfer-file = Файл подписок
transfer-mode = Режим объединения
transfer-mode-merge = Объединить — добавить и обновить
transfer-mode-skip = Дополнить — пропустить повторы
transfer-mode-replace = Заменить — удалить все текущие подписки
transfer-import = Импорт
transfer-export-format = Формат экспорта
transfer-filter = Фильтр
transfer-filter-all = Все подписки
transfer-filter-enabled = Только включённые
transfer-download = Скачать файл
transfer-importing = Импорт…
transfer-imported =
    { $count ->
        [one] Импортирована { $count } подписка из { $format }.
        [few] Импортировано { $count } подписки из { $format }.
        [many] Импортировано { $count } подписок из { $format }.
       *[other] Импортировано { $count } подписки из { $format }.
    }
transfer-invalid-rows =
    { $count ->
        [one] Пропущена { $count } неверная строка.
        [few] Пропущено { $count } неверные строки.
        [many] Пропущено { $count } неверных строк.
       *[other] Пропущено { $count } неверной строки.
    }
transfer-stored =
    { $count ->
        [one] Сохранена { $count } подписка.
        [few] Сохранено { $count } подписки.
        [many] Сохранено { $count } подписок.
       *[other] Сохранено { $count } подписки.
    }
transfer-none-found = Подходящих подписок не найдено.
transfer-confirm-replace = Заменить все текущие подписки содержимым этого файла?
transfer-imported-toast = Подписки импортированы.
transfer-import-failed = Не удалось импортировать файл.
transfer-choose-file = Сначала выберите файл подписок.
transfer-too-large = Файл больше допустимых 5 МБ.
transfer-choose-format = Выберите формат экспорта.
transfer-exported = Файл { $filename } экспортирован.
transfer-export-failed = Не удалось экспортировать подписки.

## Import parsing

import-error-no-array = В этом файле JSON нет массива подписок.
import-error-no-you-tube = В этом файле JSON нет подписок YouTube.
import-error-csv-empty = Файл CSV пуст.
import-error-opml-unavailable = Импорт OPML недоступен в этой среде.
import-error-opml-xml = Файл OPML не является корректным XML.
import-error-empty = Выбранный файл пуст.
import-error-unknown-format = Неизвестный формат файла подписок.
import-warn-newpipe = Пропущена подписка NewPipe не с YouTube.
import-warn-freetube-line = Пропущена строка FreeTube с некорректным JSON.

## Subscription validation

validate-unknown-platform = Платформа неизвестна или не указана.
validate-instance-required = Нужен URL сервера { $platform }.
validate-channel-required = Нужен ID или URL канала.
validate-feed-required = Для этой платформы нужен URL ленты RSS/Atom или моста.
validate-invalid-url = { $field }: требуется правильный URL http(s).
validate-url-too-long = { $field }: слишком длинный.
validate-channel-too-long = Идентификатор канала слишком длинный.
field-instance-url = URL сервера
field-channel-url = URL канала
field-feed-url = URL ленты

## Network

fetch-http-error = Запрос завершился ошибкой HTTP { $status } ({ $url }).
fetch-network-error = Не удалось подключиться к { $url }: { $cause }
fetch-network-fallback = ошибка сети

## Platforms

rss-needs-feed = Для этой подписки нужен правильный URL ленты RSS или Atom.
rss-invalid-xml = Лента не является корректным XML.
dtube-not-found = На D.Tube нет канала «{ $name }».
dtube-no-name = У этой подписки D.Tube не указано имя канала.
goodgame-not-found = На goodgame.ru нет канала «{ $name }».
goodgame-no-name = У этой подписки goodgame.ru не указано имя канала.
peertube-no-instance = У этой подписки PeerTube нет правильного URL сервера.
pixabay-no-key = Чтобы загружать видео Pixabay, добавьте ключ API Pixabay в разделе Настройки → Серверы.
pixabay-no-name = У этой подписки Pixabay не указано имя автора.
pixabay-no-videos = Pixabay не вернул видео автора «{ $name }».
twitch-sign-in = Войдите через Twitch в разделе Настройки → Серверы или укажите для этой подписки URL ленты RSS-моста.
twitch-expired = Срок действия входа в Twitch истёк. Войдите снова в разделе Настройки → Серверы.
twitch-not-found = На Twitch нет канала «{ $name }».
twitch-no-name = У этой подписки Twitch не указано имя канала.
twitch-auth-failed = Не удалось войти в Twitch: { $reason }
twitch-auth-state-mismatch = ответ не соответствует запросу.
twitch-auth-no-token = токен доступа не получен.
twitch-auth-rejected = Twitch отклонил токен входа.
youtube-enter-id = Введите ID канала YouTube (UC…), URL канала или @handle.
youtube-lookup-failed = Не удалось найти { $url }: { $error }
youtube-request-failed = ошибка запроса
youtube-unresolved = Не удалось распознать этот @handle YouTube. Введите вместо него ID канала UC….
youtube-no-channel-id = У этой подписки YouTube нет ID канала. Измените её и введите ID UC….
youtube-invalid-xml = Лента YouTube не является корректным XML.
youtube-empty-videos-tab = на вкладке «Видео» нет ни одного видео
youtube-both-failed = Ошибка ленты YouTube ({ $feed }), а также запасного способа ({ $fallback }).

## Composite messages

error-raw = { $detail }
refresh-summary = { $parts }.
