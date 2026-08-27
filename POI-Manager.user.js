// ==UserScript==
// @name         [LSS] POI-Manager
// @namespace    https://github.com/Caddy21/LSS-Scripte
// @version      0.2.0
// @description  Verwaltet LSS-POIs mit IndexedDB und bereitet den automatisierten OSM-Import vor.
// @author       Caddy21
// @match        https://www.leitstellenspiel.de/*
// @grant        none
// @run-at       document-idle
// @icon         https://www.leitstellenspiel.de/favicon.ico
// ==/UserScript==

(function () {
    'use strict';

    // Konfiguration
    const DEBUG = true;
    const DEBUG_DATA = false;

    const SCRIPT_NAME = '[LSS] POI-Manager';

    const DB_NAME = 'LSSPoiManager';
    const DB_VERSION = 1;

    const POI_STORE = 'pois';
    const META_STORE = 'meta';

    // Nach dieser Zeit gilt der Cache als veraltet.
    const CACHE_MAX_AGE = 30 * 60 * 1000;

    // Nach einem zukünftigen POI-Import wird nach dieser Zeit
    // erneut die LSS-API abgefragt.
    const POST_IMPORT_SYNC_DELAY = 5 * 60 * 1000;

    const POI_API_URL = '/mission_positions.json';
    const POI_PAGE_URL = '/pois';

    let db = null;
    let lssPoiTypes = [];

    init();

    async function init() {
        debugLog('Initialisierung gestartet.');

        addProfileMenuButton();

        try {
            await initDatabase();

            debugLog('IndexedDB erfolgreich initialisiert.');

            if (isPoiPage()) {
                await initPoiPage();
            }
        } catch (error) {
            debugError('Initialisierung fehlgeschlagen:', error);
        }
    }

    function isPoiPage() {
        return window.location.pathname === POI_PAGE_URL;
    }

    // Debug
    function debugLog(...args) {
        if (DEBUG) {
            console.log(SCRIPT_NAME, ...args);
        }
    }

    function debugData(label, data) {
        if (DEBUG && DEBUG_DATA) {
            console.log(SCRIPT_NAME, label, data);
        }
    }

    function debugWarn(...args) {
        console.warn(SCRIPT_NAME, ...args);
    }

    function debugError(...args) {
        console.error(SCRIPT_NAME, ...args);
    }

    // Profil-Menü
    function addProfileMenuButton() {
        if (document.getElementById('poi-manager-btn')) {
            return;
        }

        const menu = document.querySelector('#menu_profile + ul.dropdown-menu');

        if (!menu) {
            debugLog('Profil-Dropdown nicht gefunden.');
            return;
        }

        const divider = menu.querySelector('li.divider');

        if (!divider) {
            debugWarn('Divider im Profil-Dropdown nicht gefunden.');
            return;
        }

        const li = document.createElement('li');

        const a = document.createElement('a');

        a.href = POI_PAGE_URL;
        a.id = 'poi-manager-btn';
        a.innerHTML =
            '<span class="glyphicon glyphicon-road"></span>&nbsp;&nbsp; POI-Manager';

        li.appendChild(a);

        menu.insertBefore(li, divider);

        debugLog('POI-Manager Button ins Profil-Dropdown eingefügt.');
    }

    // IndexedDB
    function initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = event => {
                const database = event.target.result;

                debugLog(
                    'IndexedDB Upgrade:',
                    event.oldVersion,
                    '→',
                    event.newVersion
                );

                if (!database.objectStoreNames.contains(POI_STORE)) {
                    const poiStore = database.createObjectStore(
                        POI_STORE,
                        {
                            keyPath: 'id'
                        }
                    );

                    poiStore.createIndex(
                        'poi_type',
                        'poi_type',
                        {
                            unique: false
                        }
                    );

                    poiStore.createIndex(
                        'latitude',
                        'latitude',
                        {
                            unique: false
                        }
                    );

                    poiStore.createIndex(
                        'longitude',
                        'longitude',
                        {
                            unique: false
                        }
                    );

                    debugLog('POI Object Store erstellt.');
                }

                if (!database.objectStoreNames.contains(META_STORE)) {
                    database.createObjectStore(
                        META_STORE,
                        {
                            keyPath: 'key'
                        }
                    );

                    debugLog('Meta Object Store erstellt.');
                }
            };

            request.onsuccess = event => {
                db = event.target.result;

                db.onversionchange = () => {
                    db.close();

                    debugWarn(
                        'IndexedDB wurde von einer anderen Instanz aktualisiert.'
                    );
                };

                resolve(db);
            };

            request.onerror = event => {
                reject(
                    event.target.error ||
                    new Error('IndexedDB konnte nicht geöffnet werden.')
                );
            };

            request.onblocked = () => {
                debugWarn(
                    'IndexedDB Öffnung wurde blockiert.'
                );
            };
        });
    }

    function putPoi(poi) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                POI_STORE,
                'readwrite'
            );

            const store = transaction.objectStore(
                POI_STORE
            );

            const request = store.put(poi);

            request.onsuccess = () => resolve();
            request.onerror = event =>
                reject(event.target.error);
        });
    }

    function putPois(pois, progressCallback = null) {
        return new Promise((resolve, reject) => {
            if (!pois.length) {
                resolve();
                return;
            }

            const transaction = db.transaction(
                POI_STORE,
                'readwrite'
            );

            const store = transaction.objectStore(
                POI_STORE
            );

            let completed = 0;

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = event => {
                reject(event.target.error);
            };

            transaction.onabort = event => {
                reject(
                    event.target.error ||
                    new Error('IndexedDB-Transaktion abgebrochen.')
                );
            };

            pois.forEach(poi => {
                const request = store.put(poi);

                request.onsuccess = () => {
                    completed++;

                    if (progressCallback) {
                        progressCallback(
                            completed,
                            pois.length
                        );
                    }
                };

                request.onerror = event => {
                    debugError(
                        'Fehler beim Speichern von POI:',
                        poi,
                        event.target.error
                    );
                };
            });
        });
    }

    function getPoi(id) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                POI_STORE,
                'readonly'
            );

            const store = transaction.objectStore(
                POI_STORE
            );

            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = event => {
                reject(event.target.error);
            };
        });
    }

    function getAllPois() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                POI_STORE,
                'readonly'
            );

            const store = transaction.objectStore(
                POI_STORE
            );

            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = event => {
                reject(event.target.error);
            };
        });
    }

    function getPoiCount() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                POI_STORE,
                'readonly'
            );

            const store = transaction.objectStore(
                POI_STORE
            );

            const request = store.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = event => {
                reject(event.target.error);
            };
        });
    }

    function clearPois() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                POI_STORE,
                'readwrite'
            );

            const store = transaction.objectStore(
                POI_STORE
            );

            const request = store.clear();

            request.onsuccess = () => resolve();

            request.onerror = event => {
                reject(event.target.error);
            };
        });
    }

    // Meta-Daten
    function setMeta(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                META_STORE,
                'readwrite'
            );

            const store = transaction.objectStore(
                META_STORE
            );

            const request = store.put({
                key,
                value
            });

            request.onsuccess = () => resolve();

            request.onerror = event => {
                reject(event.target.error);
            };
        });
    }

    function getMeta(key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                META_STORE,
                'readonly'
            );

            const store = transaction.objectStore(
                META_STORE
            );

            const request = store.get(key);

            request.onsuccess = () => {
                resolve(
                    request.result
                        ? request.result.value
                        : null
                );
            };

            request.onerror = event => {
                reject(event.target.error);
            };
        });
    }

    // LSS POI-Typen
    function loadLSSPoiTypes() {
        const select = document.getElementById(
            'mission_position_poi_type'
        );

        if (!select) {
            debugWarn(
                'LSS POI-Typ-Dropdown nicht gefunden.'
            );

            return [];
        }

        lssPoiTypes = Array.from(
            select.options
        )
            .filter(option => option.value !== '')
            .map(option => ({
                id: Number(option.value),
                name: option.textContent.trim()
            }));

        debugLog(
            `${lssPoiTypes.length} LSS-POI-Typen erkannt.`
        );

        debugData(
            'LSS POI-Typen:',
            lssPoiTypes
        );

        return lssPoiTypes;
    }

    // POI-Seite
    async function initPoiPage() {
        debugLog('POI-Seite erkannt.');

        loadLSSPoiTypes();

        createPoiManagerUI();

        await updatePoiCacheStatus();

        const cacheState =
            await getCacheState();

        if (
            cacheState.exists &&
            !cacheState.expired
        ) {
            debugLog(
                'IndexedDB-Cache ist aktuell.'
            );

            updateUiCacheStatus(
                cacheState
            );

            return;
        }

        if (cacheState.exists) {
            debugLog(
                'IndexedDB-Cache ist veraltet.'
            );

            updateUiCacheStatus(
                cacheState
            );

            startBackgroundSync();

            return;
        }

        debugLog(
            'Noch kein POI-Cache vorhanden.'
        );

        startInitialSync();
    }

    function createPoiManagerUI() {
        if (
            document.getElementById(
                'lss-poi-manager-panel'
            )
        ) {
            return;
        }

        const originalPoiPanel =
            document.getElementById(
                'new_poi'
            );

        if (!originalPoiPanel) {
            debugWarn(
                'Bereich #new_poi nicht gefunden.'
            );

            return;
        }

        const panel =
            document.createElement('div');

        panel.id =
            'lss-poi-manager-panel';

        panel.className =
            'panel panel-primary';

        panel.style.marginBottom =
            '15px';

        panel.innerHTML = `
            <div class="panel-heading">
                <span class="glyphicon glyphicon-road"></span>
                <strong>&nbsp;POI-Manager</strong>
            </div>

            <div class="panel-body">

                <div id="lss-poi-cache-status"
                     class="alert alert-info">
                    POI-Datenbank wird geprüft...
                </div>

                <div class="row">

                    <div class="col-sm-6">

                        <div class="form-group">
                            <label>
                                Lokale POI-Datenbank
                            </label>

                            <div id="lss-poi-cache-count"
                                 style="font-size: 18px;">
                                -
                            </div>
                        </div>

                    </div>

                    <div class="col-sm-6">

                        <div class="form-group">
                            <label>
                                Letzte Synchronisierung
                            </label>

                            <div id="lss-poi-cache-date">
                                -
                            </div>
                        </div>

                    </div>

                </div>

                <div class="form-group">

                    <label for="lss-poi-type-test">
                        Erkannte LSS-POI-Typen
                    </label>

                    <select
                        id="lss-poi-type-test"
                        class="form-control">
                    </select>

                </div>

                <div class="btn-group">

                    <button
                        type="button"
                        id="lss-poi-sync-button"
                        class="btn btn-primary">

                        <span class="glyphicon glyphicon-refresh"></span>
                        &nbsp;POI-Daten aktualisieren

                    </button>

                    <button
                        type="button"
                        id="lss-poi-db-info-button"
                        class="btn btn-default">

                        <span class="glyphicon glyphicon-info-sign"></span>
                        &nbsp;Datenbankinfo

                    </button>

                </div>

                <div
                    id="lss-poi-sync-progress"
                    style="display:none; margin-top:15px;">

                    <div class="progress">

                        <div
                            id="lss-poi-sync-progress-bar"
                            class="progress-bar progress-bar-striped active"
                            role="progressbar"
                            style="width:0%;">

                            0%

                        </div>

                    </div>

                    <div
                        id="lss-poi-sync-progress-text"
                        class="text-muted">

                        Lade POIs...

                    </div>

                </div>

            </div>
        `;

        originalPoiPanel.parentNode.insertBefore(
            panel,
            originalPoiPanel
        );

        populatePoiTypeTestSelect();

        const syncButton =
            document.getElementById(
                'lss-poi-sync-button'
            );

        syncButton.addEventListener(
            'click',
            () => {
                syncLSSPois(true);
            }
        );

        const infoButton =
            document.getElementById(
                'lss-poi-db-info-button'
            );

        infoButton.addEventListener(
            'click',
            showDatabaseInfo
        );
    }

    function populatePoiTypeTestSelect() {
        const select =
            document.getElementById(
                'lss-poi-type-test'
            );

        if (!select) {
            return;
        }

        select.innerHTML = '';

        lssPoiTypes.forEach(type => {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                String(type.id);

            option.textContent =
                `${type.name} (${type.id})`;

            select.appendChild(
                option
            );
        });
    }

    // Cache-Zustand
    async function getCacheState() {
        const lastSync =
            await getMeta(
                'lastSync'
            );

        const poiCount =
            await getPoiCount();

        const exists =
            poiCount > 0;

        const timestamp =
            Number(lastSync || 0);

        const age =
            timestamp
                ? Date.now() - timestamp
                : Infinity;

        return {
            exists,
            poiCount,
            lastSync: timestamp,
            age,
            expired:
                !timestamp ||
                age > CACHE_MAX_AGE
        };
    }

    async function updatePoiCacheStatus() {
        const state =
            await getCacheState();

        updateUiCacheStatus(
            state
        );
    }

    function updateUiCacheStatus(
        state
    ) {
        const status =
            document.getElementById(
                'lss-poi-cache-status'
            );

        const count =
            document.getElementById(
                'lss-poi-cache-count'
            );

        const date =
            document.getElementById(
                'lss-poi-cache-date'
            );

        if (!status) {
            return;
        }

        if (count) {
            count.textContent =
                `${formatNumber(
                    state.poiCount
                )} POIs`;
        }

        if (date) {
            date.textContent =
                state.lastSync
                    ? formatDate(
                        state.lastSync
                    )
                    : 'Noch nie';
        }

        if (!state.exists) {
            status.className =
                'alert alert-warning';

            status.innerHTML =
                '<strong>Keine lokale POI-Datenbank vorhanden.</strong><br>' +
                'Die LSS-POIs werden jetzt erstmalig geladen.';

            return;
        }

        if (state.expired) {
            status.className =
                'alert alert-warning';

            status.innerHTML =
                '<strong>Lokale POI-Datenbank ist veraltet.</strong><br>' +
                'Die vorhandenen Daten können weiterhin verwendet werden. ' +
                'Eine Aktualisierung läuft im Hintergrund.';

            return;
        }

        status.className =
            'alert alert-success';

        status.innerHTML =
            '<strong>POI-Datenbank ist aktuell.</strong><br>' +
            'Die Duplikatprüfung kann lokal gegen die gespeicherten POIs erfolgen.';
    }

    // LSS API Synchronisierung
    async function syncLSSPois(
        manual = false
    ) {
        if (!db) {
            debugError(
                'IndexedDB ist nicht verfügbar.'
            );

            return;
        }

        const syncButton =
            document.getElementById(
                'lss-poi-sync-button'
            );

        if (syncButton) {
            syncButton.disabled = true;
        }

        showSyncProgress(
            true
        );

        setSyncProgress(
            0,
            'Lade LSS-POIs...'
        );

        debugLog(
            'Starte Synchronisierung:',
            manual
                ? 'manuell'
                : 'automatisch'
        );

        try {
            const response =
                await fetch(
                    POI_API_URL,
                    {
                        method: 'GET',
                        credentials: 'same-origin',
                        cache: 'no-store',
                        headers: {
                            'Accept':
                                'application/json'
                        }
                    }
                );

            debugLog(
                'LSS POI API HTTP Status:',
                response.status
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status} ${response.statusText}`
                );
            }

            setSyncProgress(
                10,
                'Antwort von LSS erhalten...'
            );

            const data =
                await response.json();

            debugData(
                'mission_positions.json:',
                data
            );

            if (!Array.isArray(data)) {
                throw new Error(
                    'Die Antwort von /mission_positions.json ist kein Array.'
                );
            }

            debugLog(
                `${data.length} POIs von LSS erhalten.`
            );

            setSyncProgress(
                20,
                `${formatNumber(
                    data.length
                )} POIs erhalten...`
            );

            const normalizedPois =
                normalizeLSSPois(
                    data
                );

            debugLog(
                `${normalizedPois.length} POIs normalisiert.`
            );

            setSyncProgress(
                30,
                'Speichere POIs in IndexedDB...'
            );

            await clearPois();

            let lastProgress =
                -1;

            await putPois(
                normalizedPois,
                (
                    completed,
                    total
                ) => {
                    const percent =
                        30 +
                        Math.round(
                            (
                                completed /
                                total
                            ) *
                            60
                        );

                    if (
                        percent !==
                        lastProgress
                    ) {
                        lastProgress =
                            percent;

                        setSyncProgress(
                            percent,
                            `Speichere POIs: ${formatNumber(
                                completed
                            )} / ${formatNumber(
                                total
                            )}`
                        );
                    }
                }
            );

            await setMeta(
                'lastSync',
                Date.now()
            );

            await setMeta(
                'poiCount',
                normalizedPois.length
            );

            await setMeta(
                'databaseVersion',
                DB_VERSION
            );

            setSyncProgress(
                100,
                'Synchronisierung abgeschlossen.'
            );

            debugLog(
                'Synchronisierung abgeschlossen.'
            );

            await updatePoiCacheStatus();

            setTimeout(
                () => {
                    showSyncProgress(
                        false
                    );
                },
                1200
            );
        } catch (error) {
            debugError(
                'Synchronisierung fehlgeschlagen:',
                error
            );

            const status =
                document.getElementById(
                    'lss-poi-cache-status'
                );

            if (status) {
                status.className =
                    'alert alert-danger';

                status.innerHTML =
                    '<strong>Synchronisierung fehlgeschlagen.</strong><br>' +
                    escapeHtml(
                        error.message ||
                        String(error)
                    );
            }

            setSyncProgress(
                0,
                'Synchronisierung fehlgeschlagen.'
            );

            showSyncProgress(
                true
            );
        } finally {
            if (syncButton) {
                syncButton.disabled = false;
            }
        }
    }

    function normalizeLSSPois(
        data
    ) {
        return data
            .filter(
                poi =>
                    poi &&
                    poi.id !== undefined &&
                    poi.latitude !== undefined &&
                    poi.longitude !== undefined
            )
            .map(
                poi => ({
                    id: Number(poi.id),
                    caption:
                        poi.caption ||
                        '',
                    latitude:
                        Number(
                            poi.latitude
                        ),
                    longitude:
                        Number(
                            poi.longitude
                        ),
                    poi_type:
                        Number(
                            poi.poi_type
                        ),
                    icon_path:
                        poi.icon_path ||
                        '',
                    flavour_url:
                        poi.flavour_url ||
                        '',
                    created:
                        Number(
                            poi.created ||
                            0
                        ),
                    updated_iso:
                        poi.updated_iso ||
                        '',
                    address:
                        poi.address ||
                        '',
                    caption_address:
                        poi.caption_address ||
                        ''
                })
            );
    }

    // Hintergrund-Synchronisierung
    function startInitialSync() {
        debugLog(
            'Starte erstmalige POI-Synchronisierung.'
        );

        syncLSSPois(
            false
        );
    }

    function startBackgroundSync() {
        debugLog(
            'Starte POI-Synchronisierung im Hintergrund.'
        );

        setTimeout(
            () => {
                syncLSSPois(
                    false
                );
            },
            500
        );
    }

    function scheduleBackgroundSync(
        delay = POST_IMPORT_SYNC_DELAY
    ) {
        debugLog(
            `Hintergrund-Synchronisierung geplant in ${Math.round(
                delay / 1000
            )} Sekunden.`
        );

        window.setTimeout(
            () => {
                debugLog(
                    'Geplante Hintergrund-Synchronisierung wird ausgeführt.'
                );

                syncLSSPois(
                    false
                );
            },
            delay
        );
    }

    // Fortschritt
    function showSyncProgress(
        visible
    ) {
        const container =
            document.getElementById(
                'lss-poi-sync-progress'
            );

        if (!container) {
            return;
        }

        container.style.display =
            visible
                ? 'block'
                : 'none';
    }

    function setSyncProgress(
        percent,
        text
    ) {
        const bar =
            document.getElementById(
                'lss-poi-sync-progress-bar'
            );

        const textElement =
            document.getElementById(
                'lss-poi-sync-progress-text'
            );

        if (bar) {
            bar.style.width =
                `${percent}%`;

            bar.textContent =
                `${percent}%`;
        }

        if (textElement) {
            textElement.textContent =
                text;
        }
    }

    // Datenbankinfo
    async function showDatabaseInfo() {
        try {
            const state =
                await getCacheState();

            const pois =
                await getAllPois();

            debugLog(
                'Datenbankstatus:',
                state
            );

            if (DEBUG_DATA) {
                console.table(
                    pois.slice(
                        0,
                        100
                    )
                );
            }

            const typeCounts =
                {};

            pois.forEach(
                poi => {
                    const type =
                        poi.poi_type;

                    typeCounts[type] =
                        (
                            typeCounts[type] ||
                            0
                        ) + 1;
                }
            );

            console.table(
                Object.entries(
                    typeCounts
                ).map(
                    ([type, count]) => ({
                        poi_type:
                            Number(type),
                        name:
                            getPoiTypeName(
                                Number(type)
                            ),
                        count
                    })
                )
            );

            alert(
                'LSS POI-Manager\n\n' +
                `POIs in IndexedDB: ${formatNumber(
                    state.poiCount
                )}\n` +
                `Letzte Synchronisierung: ${
                    state.lastSync
                        ? formatDate(
                            state.lastSync
                        )
                        : 'Noch nie'
                }\n` +
                `Cache veraltet: ${
                    state.expired
                        ? 'Ja'
                        : 'Nein'
                }\n` +
                `LSS POI-Typen erkannt: ${
                    lssPoiTypes.length
                }`
            );
        } catch (error) {
            debugError(
                'Fehler beim Ermitteln der Datenbankinfo:',
                error
            );
        }
    }

    function getPoiTypeName(
        id
    ) {
        const type =
            lssPoiTypes.find(
                poiType =>
                    poiType.id === id
            );

        return type
            ? type.name
            : `Unbekannt (${id})`;
    }

    // Hilfsfunktionen
    function formatNumber(
        value
    ) {
        return Number(
            value || 0
        ).toLocaleString(
            'de-DE'
        );
    }

    function formatDate(
        timestamp
    ) {
        return new Date(
            timestamp
        ).toLocaleString(
            'de-DE',
            {
                dateStyle: 'short',
                timeStyle: 'medium'
            }
        );
    }

    function escapeHtml(
        value
    ) {
        return String(
            value
        )
            .replace(
                /&/g,
                '&amp;'
            )
            .replace(
                /</g,
                '&lt;'
            )
            .replace(
                />/g,
                '&gt;'
            )
            .replace(
                /"/g,
                '&quot;'
            )
            .replace(
                /'/g,
                '&#039;'
            );
    }

})();
