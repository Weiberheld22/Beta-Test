// ==UserScript==
// @name         [LSS] POI-Manager
// @namespace    https://github.com/Caddy21/LSS-Scripte
// @version      0.5.0
// @description  OSM-basierte Massenverwaltung von POIs für Leitstellenspiel mit Nominatim und Overpass.
// @author       Caddy21
// @match        https://www.leitstellenspiel.de/pois*
// @icon         https://www.leitstellenspiel.de/favicon.ico
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // Konfiguration
    // ============================================================

    const DEBUG = true;

    const NOMINATIM_URL =
        'https://nominatim.openstreetmap.org/search';

    const OVERPASS_URL =
        'https://overpass-api.de/api/interpreter';

    const LSS_CREATE_POI_URL =
        '/mission_positions';

    const DEFAULT_RADIUS_KM = 5;

const MIN_RADIUS_KM = 0.5;
const MAX_RADIUS_KM = 10;
const RADIUS_STEP_KM = 0.5;

const OVERPASS_TIMEOUT = 120;

// Maximale Anzahl der von Overpass weiterverarbeiteten POIs.
// Verhindert, dass extrem große Abfragen den Manager fluten.
const MAX_OVERPASS_RESULTS = 3000;

// Mindestabstand zwischen zwei Overpass-Abfragen.
const OVERPASS_QUERY_COOLDOWN = 5000;

const CREATE_REQUEST_DELAY = 150;

const DUPLICATE_DISTANCE_METERS = 30;

const MAX_NOMINATIM_RESULTS = 8;

    // ============================================================
    // LSS POI-Typen
    // ============================================================

    const POI_TYPES = {
        0: 'Park',
        1: 'See',
        2: 'Krankenhaus',
        3: 'Wald',
        4: 'Bushaltestelle',
        5: 'Straßenbahnhaltestelle',
        6: 'Bahnhof (Regionalverkehr)',
        7: 'Bahnhof (Regional und Fernverkehr)',
        8: 'Güterbahnhof',
        9: 'Supermarkt (Klein)',
        10: 'Supermarkt (Groß)',
        11: 'Tankstelle',
        12: 'Schule',
        13: 'Museum',
        14: 'Einkaufszentrum',
        15: 'Auto-Werkstatt',
        16: 'Autobahnauf.- / abfahrt',
        17: 'Weihnachtsmarkt',
        18: 'Lagerhalle',
        19: 'Diskothek',
        20: 'Stadion',
        21: 'Bauernhof',
        22: 'Bürokomplex',
        23: 'Schwimmbad',
        24: 'Bahnübergang',
        25: 'Theater',
        26: 'Festplatz',
        27: 'Fluss',
        28: 'Baumarkt',
        29: 'Flughafen (klein): Start-/Landebahn',
        30: 'Flughafen (klein): Gebäude',
        31: 'Flughafen (klein): Flugzeug Standplatz',
        32: 'Flughafen (groß): Start-/Landebahn',
        33: 'Flughafen (groß): Terminal',
        34: 'Flughafen (groß): Vorfeld / Standplätze',
        35: 'Flughafen (groß): Parkhaus',
        36: 'Biogasanlage',
        37: 'Bank',
        38: 'Kirche',
        39: 'Chemiepark',
        40: 'Industrie-Allgemein',
        41: 'Automobilindustrie',
        42: 'Müllverbrennungsanlage',
        43: 'Eishalle',
        44: 'Holzverarbeitung',
        45: 'Motorsportanlage',
        46: 'Tunnel',
        47: 'Klärwerk',
        48: 'Innenstadt',
        49: 'Möbelhaus',
        50: 'Campingplatz',
        51: 'Kompostieranlage',
        52: 'Textilverarbeitung',
        53: 'Moor',
        54: 'Hüttenwerk',
        55: 'Kraftwerk',
        56: 'Werksgelände',
        57: 'Seilbahn',
        58: 'Brücke',
        59: 'U-Bahn Station',
        60: 'Eisenbahntunnel',
        61: 'Zoo',
        62: 'Kohlekraftwerk',
        63: 'JVA',
        64: 'Solarpark',
        65: 'Raffinerie',
        66: 'Schiffswerft'
    };

    // ============================================================
    // OSM-Mapping
    // ============================================================

    const OSM_MAPPING = [
        { tags: { amenity: 'hospital' }, type: 2 },
        { tags: { amenity: 'clinic' }, type: 2 },

        { tags: { railway: 'station', station: 'subway' }, type: 59 },
        { tags: { railway: 'station', usage: 'main' }, type: 7 },
        { tags: { railway: 'station' }, type: 6 },
        { tags: { railway: 'halt' }, type: 6 },
        { tags: { railway: 'tram_stop' }, type: 5 },
        { tags: { railway: 'level_crossing' }, type: 24 },

        { tags: { highway: 'bus_stop' }, type: 4 },
        { tags: { amenity: 'bus_station' }, type: 4 },

        { tags: { aeroway: 'terminal' }, type: 33 },
        { tags: { aeroway: 'aerodrome', aerodrome: 'international' }, type: 32 },
        { tags: { aeroway: 'aerodrome' }, type: 29 },
        { tags: { aeroway: 'runway' }, type: 29 },

        { tags: { amenity: 'university' }, type: 12 },
        { tags: { amenity: 'college' }, type: 12 },
        { tags: { amenity: 'school' }, type: 12 },
        { tags: { building: 'school' }, type: 12 },

        { tags: { shop: 'supermarket' }, type: 10 },
        { tags: { shop: 'convenience' }, type: 9 },
        { tags: { shop: 'kiosk' }, type: 9 },

        { tags: { shop: 'department_store' }, type: 14 },
        { tags: { shop: 'mall' }, type: 14 },
        { tags: { shop: 'furniture' }, type: 49 },

        { tags: { shop: 'doityourself' }, type: 28 },
        { tags: { shop: 'hardware' }, type: 28 },

        { tags: { shop: 'car_repair' }, type: 15 },
        { tags: { amenity: 'fuel' }, type: 11 },
        { tags: { amenity: 'bank' }, type: 37 },

        { tags: { building: 'cathedral' }, type: 38 },
        { tags: { building: 'church' }, type: 38 },

        {
            tags: {
                amenity: 'place_of_worship'
            },
            type: 38,
            excludeIf: [
                { building: 'chapel' },
                { place_of_worship: 'chapel' },
                { amenity: 'wayside_shrine' },
                { amenity: 'wayside_cross' },
                { tourism: 'wayside_shrine' },
                { historic: 'wayside_cross' },
                { historic: 'wayside_shrine' },
                { man_made: 'cross' }
            ]
        },

        { tags: { leisure: 'water_park' }, type: 23 },

        {
            tags: {
                leisure: 'swimming_pool'
            },
            type: 23,
            requireAny: [
                { access: 'public' },
                { access: 'yes' },
                { fee: 'yes' },
                { amenity: 'public_bath' },
                { sport: 'swimming' }
            ]
        },

        {
            tags: {
                amenity: 'swimming_pool'
            },
            type: 23,
            requireAny: [
                { access: 'public' },
                { access: 'yes' },
                { fee: 'yes' },
                { sport: 'swimming' }
            ]
        },

        { tags: { amenity: 'public_bath' }, type: 23 },

        { tags: { leisure: 'ice_rink' }, type: 43 },

        {
            tags: {
                leisure: 'stadium'
            },
            type: 20,
            excludeIf: [
                { indoor: 'yes' },
                { building: 'sports_hall' },
                { building: 'gym' },
                { sport: 'fitness' },
                { sport: 'gymnastics' },
                { leisure: 'fitness_centre' },
                { leisure: 'fitness_station' }
            ]
        },

        { tags: { amenity: 'theatre' }, type: 25 },
        { tags: { amenity: 'cinema' }, type: 25 },
        { tags: { amenity: 'nightclub' }, type: 19 },

        { tags: { tourism: 'museum' }, type: 13 },
        { tags: { tourism: 'zoo' }, type: 61 },

        { tags: { tourism: 'camp_site' }, type: 50 },
        { tags: { tourism: 'caravan_site' }, type: 50 },

        { tags: { leisure: 'park' }, type: 0 },
        { tags: { leisure: 'garden' }, type: 0 },

        { tags: { landuse: 'forest' }, type: 3 },
        { tags: { natural: 'wood' }, type: 3 },

        { tags: { natural: 'water', water: 'lake' }, type: 1 },
        { tags: { natural: 'water', water: 'reservoir' }, type: 1 },
        { tags: { natural: 'water' }, type: 1 },

        { tags: { natural: 'wetland', wetland: 'bog' }, type: 53 },
        { tags: { natural: 'wetland' }, type: 53 },

        { tags: { waterway: 'river' }, type: 27 },
        { tags: { waterway: 'stream' }, type: 27 },

        {
            tags: {
                power: 'plant',
                plant_source: 'coal'
            },
            type: 62
        },

        {
            tags: {
                power: 'plant',
                plant_source: 'solar'
            },
            type: 64
        },

        {
            tags: {
                power: 'plant',
                plant_source: 'biogas'
            },
            type: 36
        },

        { tags: { power: 'plant' }, type: 55 },

        {
            tags: {
                man_made: 'wastewater_plant'
            },
            type: 47
        },

        {
            tags: {
                man_made: 'works'
            },
            type: 56
        },

        {
            tags: {
                industrial: 'shipyard'
            },
            type: 66
        },

        {
            tags: {
                man_made: 'shipyard'
            },
            type: 66
        },

        {
            tags: {
                landuse: 'industrial'
            },
            type: 40
        },

        {
            tags: {
                building: 'industrial'
            },
            type: 40
        },

        {
            tags: {
                building: 'warehouse'
            },
            type: 18
        },

        {
            tags: {
                landuse: 'warehouse'
            },
            type: 18
        },

        {
            tags: {
                aerialway: 'gondola'
            },
            type: 57
        },

        {
            tags: {
                aerialway: 'cable_car'
            },
            type: 57
        },

        {
            tags: {
                highway: 'motorway_junction'
            },
            type: 16
        },

        {
            tags: {
                landuse: 'farmyard'
            },
            type: 21
        },

        {
            tags: {
                building: 'farm'
            },
            type: 21
        },

        {
            tags: {
                amenity: 'prison'
            },
            type: 63
        },

        {
            tags: {
                leisure: 'motorsport'
            },
            type: 45
        },

        {
            tags: {
                landuse: 'solar_farm'
            },
            type: 64
        },

        {
            tags: {
                building: 'office'
            },
            type: 22
        },

        {
            tags: {
                office: 'government'
            },
            type: 22
        },

        {
            tags: {
                office: 'company'
            },
            type: 22
        },

        {
            tags: {
                office: 'yes'
            },
            type: 22
        },

        {
            tags: {
                building: 'commercial'
            },
            type: 22
        },

        {
            tags: {
                landuse: 'commercial'
            },
            type: 22
        },

        {
            tags: {
                man_made: 'bridge'
            },
            type: 58
        },

        {
            tags: {
                bridge: 'aqueduct'
            },
            type: 58
        }
    ];

    // ============================================================
    // Debug
    // ============================================================

    function log(...args) {
        if (!DEBUG) return;

        console.log(
            '[LSS] POI-Manager:',
            ...args
        );
    }

    function warn(...args) {
        if (!DEBUG) return;

        console.warn(
            '[LSS] POI-Manager:',
            ...args
        );
    }

    function error(...args) {
        console.error(
            '[LSS] POI-Manager:',
            ...args
        );
    }

    // ============================================================
    // Hilfsfunktionen
    // ============================================================

    function sleep(ms) {
        return new Promise(
            resolve =>
            setTimeout(
                resolve,
                ms
            )
        );
    }

    function escapeHtml(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatNumber(value) {
        return Number(
            value || 0
        ).toLocaleString('de-DE');
    }

    function formatDistance(meters) {
        if (
            meters === null ||
            meters === undefined
        ) {
            return '';
        }

        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }

        return `${(
            meters / 1000
        ).toFixed(2)} km`;
    }

    function normalizeRadius(
    value
) {
    let radius =
        Number(value);

    if (
        !Number.isFinite(radius)
    ) {
        radius =
            DEFAULT_RADIUS_KM;
    }

    radius =
        Math.round(
            radius /
            RADIUS_STEP_KM
        ) *
        RADIUS_STEP_KM;

    radius =
        Math.max(
            MIN_RADIUS_KM,
            Math.min(
                MAX_RADIUS_KM,
                radius
            )
        );

    return Number(
        radius.toFixed(1)
    );
}

    function distanceMeters(
        lat1,
        lon1,
        lat2,
        lon2
    ) {
        const R = 6371000;

        const dLat =
            (
                lat2 -
                lat1
            ) *
            Math.PI /
            180;

        const dLon =
            (
                lon2 -
                lon1
            ) *
            Math.PI /
            180;

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(
                lat1 *
                Math.PI /
                180
            ) *
            Math.cos(
                lat2 *
                Math.PI /
                180
            ) *
            Math.sin(dLon / 2) ** 2;

        return (
            2 *
            R *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            )
        );
    }

    function getOsmCoordinates(element) {
        if (
            element.type === 'node'
        ) {
            return {
                latitude: Number(
                    element.lat
                ),
                longitude: Number(
                    element.lon
                )
            };
        }

        if (
            element.center &&
            Number.isFinite(
                Number(element.center.lat)
            ) &&
            Number.isFinite(
                Number(element.center.lon)
            )
        ) {
            return {
                latitude: Number(
                    element.center.lat
                ),
                longitude: Number(
                    element.center.lon
                )
            };
        }

        return null;
    }

    // ============================================================
    // Mapping prüfen
    // ============================================================

    function tagsMatch(
        tags,
        required
    ) {
        return Object.entries(
            required
        ).every(
            ([key, value]) =>
                String(
                    tags?.[key] ?? ''
                ).toLowerCase() ===
                String(
                    value
                ).toLowerCase()
        );
    }

    function matchesExclude(
        tags,
        excludeIf
    ) {
        if (!Array.isArray(excludeIf)) {
            return false;
        }

        return excludeIf.some(
            condition =>
            tagsMatch(
                tags,
                condition
            )
        );
    }

    function matchesRequireAny(
        tags,
        requireAny
    ) {
        if (
            !Array.isArray(
                requireAny
            ) ||
            !requireAny.length
        ) {
            return true;
        }

        return requireAny.some(
            condition =>
            tagsMatch(
                tags,
                condition
            )
        );
    }

    function mapOsmElement(
        element
    ) {
        const tags =
            element.tags || {};

        for (
            const mapping of OSM_MAPPING
        ) {
            if (
                !tagsMatch(
                    tags,
                    mapping.tags
                )
            ) {
                continue;
            }

            if (
                matchesExclude(
                    tags,
                    mapping.excludeIf
                )
            ) {
                continue;
            }

            if (
                !matchesRequireAny(
                    tags,
                    mapping.requireAny
                )
            ) {
                continue;
            }

            return {
                type:
                    mapping.type,

                caption:
                    POI_TYPES[
                        mapping.type
                    ] ||
                    `POI-Typ ${mapping.type}`
            };
        }

        return null;
    }

    // ============================================================
    // HTTP JSON
    // ============================================================

    async function fetchJson(
        url,
        options = {}
    ) {
        log(
            'Request:',
            url
        );

        const response =
            await fetch(
                url,
                options
            );

        if (
            !response.ok
        ) {
            throw new Error(
                `HTTP ${response.status} ${response.statusText}`
            );
        }

        const text =
            await response.text();

        if (
            !text.trim()
        ) {
            throw new Error(
                'Leere Serverantwort.'
            );
        }

        try {
            return JSON.parse(
                text
            );
        } catch (err) {
            console.error(
                text.substring(
                    0,
                    1000
                )
            );

            throw new Error(
                'Server lieferte kein gültiges JSON.'
            );
        }
    }

    // ============================================================
    // Nominatim
    // ============================================================

    async function searchLocation(
        query
    ) {
        if (
            !query.trim()
        ) {
            throw new Error(
                'Bitte einen Ort oder eine Adresse eingeben.'
            );
        }

        const params =
            new URLSearchParams();

        params.set(
            'q',
            query.trim()
        );

        params.set(
            'format',
            'jsonv2'
        );

        params.set(
            'addressdetails',
            '1'
        );

        params.set(
            'limit',
            String(
                MAX_NOMINATIM_RESULTS
            )
        );

        params.set(
            'countrycodes',
            'de'
        );

        const url =
            `${NOMINATIM_URL}?${params.toString()}`;

        return fetchJson(
            url,
            {
                method: 'GET',
                headers: {
                    'Accept':
                        'application/json'
                }
            }
        );
    }

    // ============================================================
    // Overpass Query erzeugen
    // ============================================================

    function buildOverpassQuery(
        latitude,
        longitude,
        radiusKm
    ) {
        const radius =
            Math.round(
                radiusKm *
                1000
            );

        const tagQueries =
            OSM_MAPPING
            .map(
                mapping => {
                    return Object.entries(
                        mapping.tags
                    )
                    .map(
                        ([key, value]) => {

                            const escapedKey =
                                key.replace(
                                    /"/g,
                                    '\\"'
                                );

                            const escapedValue =
                                String(
                                    value
                                ).replace(
                                    /"/g,
                                    '\\"'
                                );

                            return `[${escapedKey}="${escapedValue}"]`;
                        }
                    )
                    .join('');
                }
            )
            .filter(Boolean);

        const uniqueQueries =
            [
                ...new Set(
                    tagQueries
                )
            ];

        const blocks =
            uniqueQueries.map(
                selector => {

                    return `
    nwr(
        around:${radius},${latitude},${longitude}
    )${selector};
                    `;
                }
            );

        return `
[out:json][timeout:${OVERPASS_TIMEOUT}];

(
${blocks.join('\n')}
);

out center tags;
        `.trim();
    }

    // ============================================================
    // Overpass
    // ============================================================

    async function searchOverpass(
    location,
    radiusKm
) {
    const now =
        Date.now();

    const elapsed =
        now -
        lastOverpassQueryTime;

    if (
        elapsed <
        OVERPASS_QUERY_COOLDOWN
    ) {
        const remaining =
            Math.ceil(
                (
                    OVERPASS_QUERY_COOLDOWN -
                    elapsed
                ) /
                1000
            );

        throw new Error(
            `Bitte noch ${remaining} Sekunden warten, bevor eine weitere Overpass-Abfrage gestartet wird.`
        );
    }

    lastOverpassQueryTime =
        now;

    const query =
        buildOverpassQuery(
            location.latitude,
            location.longitude,
            radiusKm
        );

    log(
        'Overpass Query:',
        query
    );

    const response =
        await fetch(
            OVERPASS_URL,
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded;charset=UTF-8',
                    'Accept':
                        'application/json'
                },
                body:
                    `data=${encodeURIComponent(query)}`
            }
        );

    if (
        !response.ok
    ) {
        throw new Error(
            `Overpass HTTP ${response.status} ${response.statusText}`
        );
    }

    const data =
        await response.json();

    if (
        !Array.isArray(
            data.elements
        )
    ) {
        throw new Error(
            'Overpass lieferte keine gültige Element-Liste.'
        );
    }

    log(
        `Overpass lieferte ${data.elements.length} Elemente.`
    );

    const originalCount =
        data.elements.length;

    if (
        originalCount >
        MAX_OVERPASS_RESULTS
    ) {
        warn(
            `Overpass lieferte ${originalCount} Elemente. ` +
            `Es werden maximal ${MAX_OVERPASS_RESULTS} verarbeitet.`
        );

        data.elements =
            data.elements.slice(
                0,
                MAX_OVERPASS_RESULTS
            );

        data._lssPoiManagerLimited =
            true;

        data._lssPoiManagerOriginalCount =
            originalCount;
    }

    return data;
}

    // ============================================================
    // OSM-Daten verarbeiten
    // ============================================================

    function processOverpassResults(
        elements,
        center
    ) {
        const results = [];

        const seen =
            new Set();

        for (
            const element of
            elements || []
        ) {
            const mapped =
                mapOsmElement(
                    element
                );

            if (!mapped) {
                continue;
            }

            const coordinates =
                getOsmCoordinates(
                    element
                );

            if (!coordinates) {
                continue;
            }

            if (
                !Number.isFinite(
                    coordinates.latitude
                ) ||
                !Number.isFinite(
                    coordinates.longitude
                )
            ) {
                continue;
            }

            const osmKey =
                `${element.type}/${element.id}`;

            if (
                seen.has(osmKey)
            ) {
                continue;
            }

            seen.add(
                osmKey
            );

            const tags =
                element.tags || {};

            const name =
                tags.name ||
                tags['name:de'] ||
                '';

            const address =
                buildOsmAddress(
                    tags
                );

            const distance =
                distanceMeters(
                    center.latitude,
                    center.longitude,
                    coordinates.latitude,
                    coordinates.longitude
                );

            results.push({
                osmType:
                    element.type,

                osmId:
                    element.id,

                osmKey,

                latitude:
                    coordinates.latitude,

                longitude:
                    coordinates.longitude,

                type:
                    mapped.type,

                typeName:
                    mapped.caption,

                name,

                address,

                tags,

                distance,

                duplicate:
                    false
            });
        }

        results.sort(
            (a, b) =>
                a.distance -
                b.distance
        );

        return results;
    }

    // ============================================================
    // OSM-Adresse
    // ============================================================

    function buildOsmAddress(
        tags
    ) {
        const parts = [];

        const street =
            tags['addr:street'];

        const house =
            tags['addr:housenumber'];

        if (
            street
        ) {
            parts.push(
                house
                ? `${street} ${house}`
                : street
            );
        }

        if (
            tags['addr:postcode']
        ) {
            parts.push(
                tags['addr:postcode']
            );
        }

        if (
            tags['addr:city']
        ) {
            parts.push(
                tags['addr:city']
            );
        }

        return parts.join(
            ', '
        );
    }

    // ============================================================
    // Duplikatprüfung
    // ============================================================

    function isDuplicate(
        poi,
        existingPois
    ) {
        return existingPois.some(
            existing => {

                const distance =
                    distanceMeters(
                        poi.latitude,
                        poi.longitude,
                        Number(
                            existing.latitude
                        ),
                        Number(
                            existing.longitude
                        )
                    );

                return (
                    distance <=
                    DUPLICATE_DISTANCE_METERS
                );
            }
        );
    }

    // ============================================================
    // LSS-POIs laden
    //
    // Der kaputte Generic Worker wird NICHT mehr verwendet.
    //
    // Wir versuchen hier zunächst den normalen JSON-Endpunkt.
    // ============================================================

    async function loadExistingLSSPois() {
    const urls = [
        '/pois/pois_json?limit=10000',
        '/pois/pois_json?limit=10000&afterID=0'
    ];

    for (
        const url of
        urls
    ) {
        try {
            log(
                'Versuche vorhandene LSS-POIs zu laden:',
                url
            );

            const response =
                await fetch(
                    url,
                    {
                        method: 'GET',
                        credentials:
                            'same-origin',
                        cache:
                            'no-store',
                        headers: {
                            'Accept':
                                'application/json'
                        }
                    }
                );

            if (
                !response.ok
            ) {
                warn(
                    `LSS-POI-Abfrage ${url} lieferte HTTP ${response.status}.`
                );

                continue;
            }

            const json =
                await response.json();

            let data = [];

            if (
                Array.isArray(
                    json
                )
            ) {
                data =
                    json;
            } else if (
                Array.isArray(
                    json.data
                )
            ) {
                data =
                    json.data;
            } else if (
                Array.isArray(
                    json.pois
                )
            ) {
                data =
                    json.pois;
            }

            if (
                data.length
            ) {
                log(
                    `Vorhandene LSS-POIs geladen: ${data.length}`
                );

                return data;
            }

            // Ein gültiges, aber leeres Ergebnis ist ebenfalls
            // eine erfolgreiche Abfrage.
            if (
                Array.isArray(data)
            ) {
                log(
                    'LSS-POI-Abfrage war erfolgreich, enthält aber keine POIs.'
                );

                return [];
            }

        } catch (err) {
            warn(
                'LSS-POIs konnten über diesen Endpunkt nicht geladen werden:',
                err
            );
        }
    }

    warn(
        'Es konnten keine vorhandenen LSS-POIs geladen werden.'
    );

    return [];
}

    // ============================================================
    // POI erstellen
    // ============================================================

    async function createLSSPoi(
        poi
    ) {
        const form =
            new URLSearchParams();

        form.set(
            'utf8',
            '✓'
        );

        form.set(
            'mission_position[poi_type]',
            String(
                poi.type
            )
        );

        form.set(
            'mission_position[latitude]',
            String(
                poi.latitude
            )
        );

        form.set(
            'mission_position[longitude]',
            String(
                poi.longitude
            )
        );

        form.set(
            'mission_position[frame]',
            ''
        );

        form.set(
            'mission_position[address]',
            poi.address ||
            poi.name ||
            ''
        );

        const response =
            await fetch(
                LSS_CREATE_POI_URL,
                {
                    method: 'POST',
                    credentials:
                        'same-origin',
                    cache:
                        'no-store',
                    headers: {
                        'Content-Type':
                            'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept':
                            'application/json'
                    },
                    body:
                        form.toString()
                }
            );

        const text =
            await response.text();

        let json;

        try {
            json =
                JSON.parse(
                    text
                );
        } catch {
            throw new Error(
                `LSS lieferte keine JSON-Antwort: ${text.substring(0, 300)}`
            );
        }

        if (
            !response.ok
        ) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        if (
            json?.flash?.type !==
            'success'
        ) {
            throw new Error(
                json?.flash?.message ||
                'LSS hat den POI nicht bestätigt.'
            );
        }

        return json;
    }

    // ============================================================
    // UI
    // ============================================================

    let modal = null;

    let currentLocation = null;

    let currentResults = [];

    let existingLSSPois = [];

    let searchRunning = false;

    let creationRunning = false;

    let lastOverpassQueryTime = 0;

    function createStyles() {
        if (
            document.getElementById(
                'lss-poi-manager-style'
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'lss-poi-manager-style';

        style.textContent = `
            #lss-poi-manager-modal {
                z-index: 100000;
            }

            #lss-poi-manager-modal .modal-dialog {
                width: 1100px;
                max-width: calc(100vw - 30px);
            }

            #lss-poi-manager-modal .modal-body {
                max-height: 80vh;
                overflow-y: auto;
            }

            .lss-poi-manager-toolbar {
                display: flex;
                gap: 5px;
                flex-wrap: wrap;
                margin-bottom: 15px;
            }

            .lss-poi-manager-location-result {
                cursor: pointer;
                padding: 8px;
                border-bottom: 1px solid #ddd;
            }

            .lss-poi-manager-location-result:hover {
                background: #f5f5f5;
            }

            .lss-poi-manager-location-result strong {
                display: block;
            }

            .lss-poi-manager-location-result small {
                color: #777;
            }

            .lss-poi-manager-selected-location {
                padding: 10px;
                margin-top: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #f9f9f9;
            }

            .lss-poi-manager-type-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 5px 0;
                border-bottom: 1px solid #eee;
            }

            .lss-poi-manager-type-row input {
                margin: 0;
            }

            .lss-poi-manager-type-count {
                margin-left: auto;
                min-width: 50px;
                text-align: right;
            }

            .lss-poi-manager-results {
                max-height: 450px;
                overflow-y: auto;
                border: 1px solid #ddd;
                border-radius: 4px;
            }

            .lss-poi-manager-result {
                padding: 8px;
                border-bottom: 1px solid #eee;
            }

            .lss-poi-manager-result:last-child {
                border-bottom: none;
            }

            .lss-poi-manager-result-name {
                font-weight: bold;
            }

            .lss-poi-manager-result-meta {
                color: #777;
                font-size: 12px;
            }

            .lss-poi-manager-stat {
                text-align: center;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }

            .lss-poi-manager-stat strong {
                display: block;
                font-size: 22px;
            }

            .lss-poi-manager-progress {
                display: none;
                margin-top: 15px;
            }

            .lss-poi-manager-muted {
                color: #777;
            }

            .lss-poi-manager-danger {
                color: #a94442;
            }

            .lss-poi-manager-success {
                color: #3c763d;
            }

            .lss-poi-manager-warning {
                color: #8a6d3b;
            }

            #lss-poi-manager-map-link {
                margin-left: 5px;
            }

            .lss-poi-manager-radius-input {
    max-width: 90px;
}
        `;

        document.head.appendChild(
            style
        );
    }

    // ============================================================
    // Button
    // ============================================================

    function addPoiManagerButton() {
        if (
            document.getElementById(
                'poi-manager-btn'
            )
        ) {
            return true;
        }

        const navbarHeaders =
            document.querySelectorAll(
                '.navbar-header'
            );

        for (
            const navbarHeader of
            navbarHeaders
        ) {
            const brand =
                navbarHeader.querySelector(
                    'a.navbar-brand'
                );

            if (
                !brand ||
                brand.textContent.trim() !==
                'POI-Verwaltung'
            ) {
                continue;
            }

            const searchForm =
                navbarHeader.querySelector(
                    '#poi_map_adress_search_form'
                );

            if (!searchForm) {
                continue;
            }

            const searchInput =
                searchForm.querySelector(
                    '#poi_map_adress_search'
                );

            if (!searchInput) {
                continue;
            }

            const button =
                document.createElement(
                    'button'
                );

            button.type =
                'button';

            button.id =
                'poi-manager-btn';

            button.className =
                'btn btn-default navbar-btn';

            button.title =
                'POI-Manager öffnen';

            button.innerHTML =
                '<span class="glyphicon glyphicon-road"></span>' +
                '&nbsp; POI-Manager';

            button.style.marginLeft =
                '5px';

            button.addEventListener(
                'click',
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    openPoiManager();
                }
            );

            searchForm.parentNode.insertBefore(
                button,
                searchForm.nextSibling
            );

            log(
                'POI-Manager Button eingefügt.'
            );

            return true;
        }

        return false;
    }

    // ============================================================
    // Modal
    // ============================================================

    function createModal() {
        if (
            document.getElementById(
                'lss-poi-manager-modal'
            )
        ) {
            modal =
                document.getElementById(
                    'lss-poi-manager-modal'
                );

            return modal;
        }

        createStyles();

        const wrapper =
            document.createElement(
                'div'
            );

        wrapper.innerHTML = `
            <div
                id="lss-poi-manager-modal"
                class="modal fade"
                tabindex="-1"
                role="dialog"
                aria-hidden="true"
            >
                <div
                    class="modal-dialog modal-lg"
                    role="document"
                >
                    <div class="modal-content">

                        <div class="modal-header">

                            <button
                                type="button"
                                class="close"
                                data-dismiss="modal"
                            >
                                <span>&times;</span>
                            </button>

                            <h4 class="modal-title">
                                <span class="glyphicon glyphicon-road"></span>
                                &nbsp;LSS POI-Manager
                            </h4>

                        </div>

                        <div class="modal-body">

                            <div class="row">

                                <div class="col-sm-4">
                                    <div class="lss-poi-manager-stat">
                                        <strong id="lss-poi-manager-found">
                                            0
                                        </strong>
                                        OSM-POIs gefunden
                                    </div>
                                </div>

                                <div class="col-sm-3">
        <div class="lss-poi-manager-stat">
            <strong id="lss-poi-manager-new">
                0
            </strong>
            neue POIs
        </div>
    </div>

    <div class="col-sm-3">
        <div class="lss-poi-manager-stat">
            <strong id="lss-poi-manager-duplicate">
                0
            </strong>
            bereits vorhanden
        </div>
    </div>

                            </div>

                            <hr>

                            <h4>
                                <span class="glyphicon glyphicon-search"></span>
                                Ort suchen
                            </h4>

                            <div class="row">

                                <div class="col-sm-8">

                                    <input
                                        type="text"
                                        id="lss-poi-manager-location-search"
                                        class="form-control"
                                        placeholder="z. B. Hamburg, München, Berlin..."
                                    >

                                </div>

                                <div class="col-sm-4">

                                    <button
                                        type="button"
                                        id="lss-poi-manager-location-button"
                                        class="btn btn-primary btn-block"
                                    >
                                        <span class="glyphicon glyphicon-search"></span>
                                        Ort suchen
                                    </button>

                                </div>

                            </div>

                            <div
                                id="lss-poi-manager-location-results"
                                style="margin-top:10px;"
                            ></div>

                            <div
                                id="lss-poi-manager-selected-location"
                                class="lss-poi-manager-selected-location"
                                style="display:none;"
                            ></div>

                            <hr>

                            <div class="row">

                                <div class="col-sm-3">

    <label>
        Suchradius
    </label>

    <div class="input-group" style="width:120px;">

                                        <input
    type="number"
    id="lss-poi-manager-radius"
    class="form-control lss-poi-manager-radius-input"
    value="${DEFAULT_RADIUS_KM}"
    min="${MIN_RADIUS_KM}"
    max="${MAX_RADIUS_KM}"
    step="${RADIUS_STEP_KM}"
>

                                        <span class="input-group-addon">
                                            km
                                        </span>

                                    </div>

                                </div>

                                <div class="col-sm-9">

                                    <label>
                                        Aktionen
                                    </label>

                                    <div class="lss-poi-manager-toolbar">

                                        <button
                                            type="button"
                                            id="lss-poi-manager-osm-search"
                                            class="btn btn-success"
                                            disabled
                                        >
                                            <span class="glyphicon glyphicon-globe"></span>
                                            OSM-POIs laden
                                        </button>

                                        <button
                                            type="button"
                                            id="lss-poi-manager-select-all"
                                            class="btn btn-default"
                                        >
                                            Alle auswählen
                                        </button>

                                        <button
                                            type="button"
                                            id="lss-poi-manager-select-none"
                                            class="btn btn-default"
                                        >
                                            Alle abwählen
                                        </button>

                                    </div>

                                </div>

                            </div>

                            <hr>

                            <h4>
                                <span class="glyphicon glyphicon-list"></span>
                                POI-Typen
                            </h4>

                            <div
                                id="lss-poi-manager-type-list"
                            >
                                <div class="alert alert-info">
                                    Noch keine OSM-Daten geladen.
                                </div>
                            </div>

                            <hr>

                            <div
                                id="lss-poi-manager-result-summary"
                            >
                                <div class="alert alert-info">
                                    Suche einen Ort und lade anschließend die OSM-POIs.
                                </div>
                            </div>

                            <div
                                id="lss-poi-manager-results"
                                class="lss-poi-manager-results"
                                style="display:none;"
                            ></div>

                            <div
                                id="lss-poi-manager-progress"
                                class="lss-poi-manager-progress"
                            >

                                <div class="progress">

                                    <div
                                        id="lss-poi-manager-progress-bar"
                                        class="progress-bar progress-bar-success"
                                        role="progressbar"
                                        style="width:0%;"
                                    >
                                        0%
                                    </div>

                                </div>

                                <div
                                    id="lss-poi-manager-progress-text"
                                    class="text-center"
                                >
                                    Bereit
                                </div>

                            </div>

                            <div
                                id="lss-poi-manager-status"
                                style="margin-top:15px;"
                            ></div>

                        </div>

                        <div class="modal-footer">

                            <span
                                id="lss-poi-manager-footer-info"
                                class="pull-left lss-poi-manager-muted"
                            >
                                Bereit
                            </span>

                            <button
                                type="button"
                                id="lss-poi-manager-create"
                                class="btn btn-primary"
                                disabled
                            >
                                <span class="glyphicon glyphicon-plus"></span>
                                POIs im LSS erstellen
                            </button>

                            <button
                                type="button"
                                class="btn btn-default"
                                data-dismiss="modal"
                            >
                                Schließen
                            </button>

                        </div>

                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(
            wrapper.firstElementChild
        );

        modal =
            document.getElementById(
                'lss-poi-manager-modal'
            );

        bindModalEvents();

        return modal;
    }

    // ============================================================
    // Events
    // ============================================================

    function bindModalEvents() {
        document
            .getElementById(
                'lss-poi-manager-location-button'
            )
            ?.addEventListener(
                'click',
                searchLocationFromUI
            );

        document
            .getElementById(
                'lss-poi-manager-location-search'
            )
            ?.addEventListener(
                'keydown',
                event => {
                    if (
                        event.key ===
                        'Enter'
                    ) {
                        event.preventDefault();

                        searchLocationFromUI();
                    }
                }
            );

        document
            .getElementById(
                'lss-poi-manager-osm-search'
            )
            ?.addEventListener(
                'click',
                searchOsmFromUI
            );

        document
            .getElementById(
                'lss-poi-manager-select-all'
            )
            ?.addEventListener(
                'click',
                () => {
                    setAllTypeCheckboxes(
                        true
                    );

                    updateSelection();
                }
            );

        document
            .getElementById(
                'lss-poi-manager-select-none'
            )
            ?.addEventListener(
                'click',
                () => {
                    setAllTypeCheckboxes(
                        false
                    );

                    updateSelection();
                }
            );

        document
            .getElementById(
                'lss-poi-manager-create'
            )
            ?.addEventListener(
                'click',
                createSelectedPois
            );
    }

    // ============================================================
    // Ort suchen
    // ============================================================

    async function searchLocationFromUI() {
        if (searchRunning) {
            return;
        }

        const input =
            document.getElementById(
                'lss-poi-manager-location-search'
            );

        const results =
            document.getElementById(
                'lss-poi-manager-location-results'
            );

        if (
            !input ||
            !results
        ) {
            return;
        }

        const query =
            input.value.trim();

        if (!query) {
            showStatus(
                'Bitte einen Ort oder eine Adresse eingeben.',
                'warning'
            );

            return;
        }

        searchRunning =
            true;

        setLocationLoading(
            true
        );

        try {
            results.innerHTML = `
                <div class="alert alert-info">
                    <span class="glyphicon glyphicon-refresh"></span>
                    Suche Ort über OpenStreetMap...
                </div>
            `;

            const locations =
                await searchLocation(
                    query
                );

            if (
                !locations.length
            ) {
                results.innerHTML = `
                    <div class="alert alert-warning">
                        Kein passender Ort gefunden.
                    </div>
                `;

                return;
            }

            results.innerHTML =
                locations.map(
                    (location, index) => `
                        <div
                            class="lss-poi-manager-location-result"
                            data-location-index="${index}"
                        >
                            <strong>
                                ${escapeHtml(
                                    location.display_name
                                )}
                            </strong>

                            <small>
                                ${escapeHtml(
                                    location.type ||
                                    ''
                                )}
                                |
                                ${escapeHtml(
                                    location.lat
                                )},
                                ${escapeHtml(
                                    location.lon
                                )}
                            </small>
                        </div>
                    `
                ).join('');

            results
                .querySelectorAll(
                    '.lss-poi-manager-location-result'
                )
                .forEach(
                    element => {

                        element.addEventListener(
                            'click',
                            () => {

                                const index =
                                    Number(
                                        element.dataset
                                            .locationIndex
                                    );

                                selectLocation(
                                    locations[index]
                                );
                            }
                        );
                    }
                );

        } catch (err) {
            error(
                'Ortssuche fehlgeschlagen:',
                err
            );

            showStatus(
                `Ortssuche fehlgeschlagen: ${err.message}`,
                'danger'
            );

        } finally {
            searchRunning =
                false;

            setLocationLoading(
                false
            );
        }
    }

    // ============================================================
    // Ort auswählen
    // ============================================================

    function selectLocation(
        location
    ) {
        currentLocation = {
            latitude:
                Number(
                    location.lat
                ),

            longitude:
                Number(
                    location.lon
                ),

            displayName:
                location.display_name,

            raw:
                location
        };

        const results =
            document.getElementById(
                'lss-poi-manager-location-results'
            );

        const selected =
            document.getElementById(
                'lss-poi-manager-selected-location'
            );

        if (results) {
            results.innerHTML = '';
        }

        if (selected) {
            selected.style.display =
                'block';

            selected.innerHTML = `
                <strong>
                    ${escapeHtml(
                        location.display_name
                    )}
                </strong>

                <br>

                <small>
                    ${escapeHtml(
                        String(
                            location.lat
                        )
                    )},
                    ${escapeHtml(
                        String(
                            location.lon
                        )
                    )}
                </small>
            `;
        }

        const button =
            document.getElementById(
                'lss-poi-manager-osm-search'
            );

        if (button) {
            button.disabled =
                false;
        }

        currentResults = [];

        renderTypeList();

        updateStats();

        showStatus(
            'Ort ausgewählt. Jetzt können die OSM-POIs geladen werden.',
            'success'
        );
    }

    // ============================================================
    // OSM-Suche
    // ============================================================

    async function searchOsmFromUI() {
        if (
            !currentLocation
        ) {
            showStatus(
                'Bitte zuerst einen Ort auswählen.',
                'warning'
            );

            return;
        }

        const radiusInput =
            document.getElementById(
                'lss-poi-manager-radius'
            );

        const radius =
    normalizeRadius(
        radiusInput?.value
    );

if (radiusInput) {
    radiusInput.value =
        radius;
}

        setOsmLoading(
            true
        );

        try {
            showStatus(
                `Frage Overpass im Radius von ${radius} km ab...`,
                'info'
            );

            const response =
                await searchOverpass(
                    currentLocation,
                    radius
                );

            log(
                'Overpass Antwort:',
                response
            );

           if (
    response._lssPoiManagerLimited
) {
    showStatus(
        `Overpass lieferte mehr als ${formatNumber(
            MAX_OVERPASS_RESULTS
        )} Objekte. ` +
        `Es wurden nur die ersten ${formatNumber(
            MAX_OVERPASS_RESULTS
        )} verarbeitet. ` +
        `Verkleinere gegebenenfalls den Suchradius.`,
        'warning'
    );
}

            log(
                `Nach Mapping: ${currentResults.length} POIs`
            );

            await checkDuplicates();

            renderTypeList();

            renderOsmResults();

            updateStats();

            const newCount =
                currentResults.filter(
                    poi =>
                        !poi.duplicate
                ).length;

            let resultMessage =
    `${formatNumber(
        currentResults.length
    )} passende OSM-POIs gefunden, ` +
    `${formatNumber(
        newCount
    )} davon neu.`;

if (
    response._lssPoiManagerLimited
) {
    resultMessage +=
        ` Die Overpass-Antwort wurde auf ` +
        `${formatNumber(
            MAX_OVERPASS_RESULTS
        )} Objekte begrenzt. ` +
        `Verkleinere gegebenenfalls den Suchradius.`;

    showStatus(
        resultMessage,
        'warning'
    );
} else {
    showStatus(
        resultMessage,
        'success'
    );
}

        } catch (err) {
            error(
                'OSM-Suche fehlgeschlagen:',
                err
            );

            showStatus(
                `OSM-Suche fehlgeschlagen: ${err.message}`,
                'danger'
            );

        } finally {
            setOsmLoading(
                false
            );
        }
    }

    // ============================================================
    // Duplikate prüfen
    // ============================================================

    async function checkDuplicates() {
        existingLSSPois =
            await loadExistingLSSPois();

        if (
            !existingLSSPois.length
        ) {
            warn(
                'Keine vorhandenen LSS-POIs verfügbar. Duplikatprüfung nicht möglich.'
            );

            return;
        }

        for (
            const poi of
            currentResults
        ) {
            poi.duplicate =
                isDuplicate(
                    poi,
                    existingLSSPois
                );
        }
    }

    // ============================================================
    // Typ-Liste
    // ============================================================

    function getTypeStatistics() {
        const map =
            new Map();

        for (
            const poi of
            currentResults
        ) {
            if (
                !map.has(
                    poi.type
                )
            ) {
                map.set(
                    poi.type,
                    {
                        total: 0,
                        new: 0,
                        duplicate: 0
                    }
                );
            }

            const entry =
                map.get(
                    poi.type
                );

            entry.total++;

            if (
                poi.duplicate
            ) {
                entry.duplicate++;
            } else {
                entry.new++;
            }
        }

        return map;
    }

    function renderTypeList() {
        const container =
            document.getElementById(
                'lss-poi-manager-type-list'
            );

        if (!container) {
            return;
        }

        if (
            !currentResults.length
        ) {
            container.innerHTML = `
                <div class="alert alert-info">
                    Noch keine OSM-Daten geladen.
                </div>
            `;

            return;
        }

        const stats =
            getTypeStatistics();

        const sorted =
            [
                ...stats.entries()
            ].sort(
                (a, b) =>
                    POI_TYPES[a[0]].localeCompare(
                        POI_TYPES[b[0]],
                        'de'
                    )
            );

        container.innerHTML =
            sorted.map(
                ([type, data]) => `
                    <div
                        class="lss-poi-manager-type-row"
                    >

                        <input
                            type="checkbox"
                            class="lss-poi-manager-type-checkbox"
                            data-type="${type}"
                            checked
                        >

                        <span>
                            ${escapeHtml(
                                POI_TYPES[type] ||
                                `POI-Typ ${type}`
                            )}
                        </span>

                        <span class="lss-poi-manager-type-count">

                            ${formatNumber(
                                data.new
                            )}

                            ${
                                data.duplicate
                                ? `<span class="lss-poi-manager-muted">
                                    / ${formatNumber(
                                        data.duplicate
                                    )} vorhanden
                                </span>`
                                : ''
                            }

                        </span>

                    </div>
                `
            ).join('');

        container
            .querySelectorAll(
                '.lss-poi-manager-type-checkbox'
            )
            .forEach(
                checkbox => {

                    checkbox.addEventListener(
                        'change',
                        () => {
                            updateSelection();
                        }
                    );
                }
            );

        updateSelection();
    }

    // ============================================================
    // Auswahl
    // ============================================================

    function setAllTypeCheckboxes(
        checked
    ) {
        document
            .querySelectorAll(
                '.lss-poi-manager-type-checkbox'
            )
            .forEach(
                checkbox => {
                    checkbox.checked =
                        checked;
                }
            );
    }

    function getSelectedTypes() {
        return new Set(
            [
                ...document.querySelectorAll(
                    '.lss-poi-manager-type-checkbox:checked'
                )
            ]
            .map(
                checkbox =>
                    Number(
                        checkbox.dataset.type
                    )
            )
        );
    }

    function updateSelection() {
        const selectedTypes =
            getSelectedTypes();

        const selected =
            currentResults.filter(
                poi =>
                    selectedTypes.has(
                        poi.type
                    ) &&
                    !poi.duplicate
            );

        const button =
            document.getElementById(
                'lss-poi-manager-create'
            );

        if (button) {
            button.disabled =
                creationRunning ||
                selected.length === 0;
        }

        const footer =
            document.getElementById(
                'lss-poi-manager-footer-info'
            );

        if (footer) {
            footer.textContent =
                `${formatNumber(
                    selected.length
                )} POIs zur Erstellung ausgewählt`;
        }
    }

    // ============================================================
    // OSM-Ergebnisse
    // ============================================================

    function renderOsmResults() {
        const container =
            document.getElementById(
                'lss-poi-manager-results'
            );

        if (!container) {
            return;
        }

        if (
            !currentResults.length
        ) {
            container.style.display =
                'none';

            return;
        }

        const selectedTypes =
            getSelectedTypes();

        const visible =
            currentResults
            .filter(
                poi =>
                    selectedTypes.has(
                        poi.type
                    )
            )
            .slice(
                0,
                1000
            );

        container.innerHTML =
            visible.map(
                poi => {

                    const status =
                        poi.duplicate
                        ? `
                            <span class="label label-warning">
                                bereits vorhanden
                            </span>
                        `
                        : `
                            <span class="label label-success">
                                neu
                            </span>
                        `;

                    return `
                        <div
                            class="lss-poi-manager-result"
                        >

                            <div
                                class="lss-poi-manager-result-name"
                            >
                                ${
                                    escapeHtml(
                                        poi.name ||
                                        poi.typeName
                                    )
                                }

                                &nbsp;

                                ${status}
                            </div>

                            <div>
                                <span class="label label-default">
                                    ${escapeHtml(
                                        poi.typeName
                                    )}
                                </span>
                            </div>

                            <div
                                class="lss-poi-manager-result-meta"
                            >
                                ${
                                    escapeHtml(
                                        poi.address ||
                                        'Keine OSM-Adresse'
                                    )
                                }
                                <br>
                                ${
                                    formatDistance(
                                        poi.distance
                                    )
                                }
                                |
                                OSM:
                                ${escapeHtml(
                                    poi.osmType
                                )}/
                                ${escapeHtml(
                                    poi.osmId
                                )}
                                |
                                ${escapeHtml(
                                    String(
                                        poi.latitude
                                    )
                                )},
                                ${escapeHtml(
                                    String(
                                        poi.longitude
                                    )
                                )}
                            </div>

                        </div>
                    `;
                }
            ).join('');

        container.style.display =
            'block';

        if (
            currentResults.length >
            1000
        ) {
            container.innerHTML += `
                <div class="alert alert-info">
                    Es werden maximal 1.000 Ergebnisse angezeigt.
                    Die Erstellung berücksichtigt trotzdem alle ausgewählten POIs.
                </div>
            `;
        }
    }

    // ============================================================
    // Statistik
    // ============================================================

    function updateStats() {
    const existing =
        existingLSSPois.length;

    const found =
        currentResults.length;

    const duplicate =
        currentResults.filter(
            poi =>
                poi.duplicate
        ).length;

    const selectedTypes =
        getSelectedTypes();

    const newPois =
        currentResults.filter(
            poi =>
                !poi.duplicate &&
                selectedTypes.has(
                    poi.type
                )
        ).length;

    const existingElement =
        document.getElementById(
            'lss-poi-manager-existing'
        );

    const foundElement =
        document.getElementById(
            'lss-poi-manager-found'
        );

    const newElement =
        document.getElementById(
            'lss-poi-manager-new'
        );

    const duplicateElement =
        document.getElementById(
            'lss-poi-manager-duplicate'
        );

    if (existingElement) {
        existingElement.textContent =
            formatNumber(
                existing
            );
    }

    if (foundElement) {
        foundElement.textContent =
            formatNumber(
                found
            );
    }

    if (newElement) {
        newElement.textContent =
            formatNumber(
                newPois
            );
    }

    if (duplicateElement) {
        duplicateElement.textContent =
            formatNumber(
                duplicate
            );
    }

    const summary =
        document.getElementById(
            'lss-poi-manager-result-summary'
        );

    if (summary) {
        if (!found) {
            summary.innerHTML = `
                <div class="alert alert-info">
                    Keine passenden POIs gefunden.
                </div>
            `;
        } else {
            summary.innerHTML = `
                <div class="alert alert-info">

                    <strong>
                        ${formatNumber(found)}
                    </strong>
                    passende OSM-Objekte gefunden.

                    Davon:

                    <strong>
                        ${formatNumber(
                            duplicate
                        )}
                    </strong>
                    bereits vorhanden und

                    <strong>
                        ${formatNumber(
                            newPois
                        )}
                    </strong>
                    neu ausgewählt.

                </div>
            `;
        }
    }

    updateSelection();
}

    // ============================================================
    // POIs erstellen
    // ============================================================

    async function createSelectedPois() {
        if (
            creationRunning
        ) {
            return;
        }

        const selectedTypes =
            getSelectedTypes();

        const selectedPois =
            currentResults.filter(
                poi =>
                    selectedTypes.has(
                        poi.type
                    ) &&
                    !poi.duplicate
            );

        if (
            !selectedPois.length
        ) {
            showStatus(
                'Keine neuen POIs ausgewählt.',
                'warning'
            );

            return;
        }

        const confirmed =
            confirm(
                `Sollen ${formatNumber(
                    selectedPois.length
                )} POIs im Leitstellenspiel erstellt werden?\n\n` +
                `Bereits vorhandene POIs werden nicht erstellt.`
            );

        if (!confirmed) {
            return;
        }

        creationRunning =
            true;

        setCreationLoading(
            true
        );

        let created = 0;
        let skipped = 0;
        let failed = 0;

        const errors = [];

        try {
            for (
                let index = 0;
                index <
                selectedPois.length;
                index++
            ) {
                const poi =
                    selectedPois[index];

                updateProgress(
                    index + 1,
                    selectedPois.length,
                    poi
                );

                try {
                    await createLSSPoi(
                        poi
                    );

                    created++;

                    poi.created =
                        true;

                } catch (err) {
                    failed++;

                    errors.push({
                        poi,
                        error:
                            err
                    });

                    error(
                        'POI konnte nicht erstellt werden:',
                        poi,
                        err
                    );
                }

                if (
                    index <
                    selectedPois.length - 1
                ) {
                    await sleep(
                        CREATE_REQUEST_DELAY
                    );
                }
            }

            showCreationResult(
                created,
                skipped,
                failed,
                errors
            );

            // Neu erstellte POIs als vorhanden markieren.
            for (
                const poi of
                selectedPois
            ) {
                if (
                    poi.created
                ) {
                    poi.duplicate =
                        true;
                }
            }

            renderTypeList();

            renderOsmResults();

            updateStats();

        } finally {
            creationRunning =
                false;

            setCreationLoading(
                false
            );
        }
    }

    // ============================================================
    // Fortschritt
    // ============================================================

    function updateProgress(
        current,
        total,
        poi
    ) {
        const percentage =
            Math.round(
                (
                    current /
                    total
                ) *
                100
            );

        const bar =
            document.getElementById(
                'lss-poi-manager-progress-bar'
            );

        const text =
            document.getElementById(
                'lss-poi-manager-progress-text'
            );

        if (bar) {
            bar.style.width =
                `${percentage}%`;

            bar.textContent =
                `${percentage}%`;
        }

        if (text) {
            text.textContent =
                `${formatNumber(
                    current
                )} / ${formatNumber(
                    total
                )} – ${
                    poi.name ||
                    poi.typeName
                }`;
        }
    }

    function showCreationResult(
        created,
        skipped,
        failed,
        errors
    ) {
        const messages = [];

        messages.push(
            `<strong>Erstellung abgeschlossen.</strong>`
        );

        messages.push(
            `Erstellt: <strong>${formatNumber(
                created
            )}</strong>`
        );

        if (skipped) {
            messages.push(
                `Übersprungen: <strong>${formatNumber(
                    skipped
                )}</strong>`
            );
        }

        messages.push(
            `Fehler: <strong>${formatNumber(
                failed
            )}</strong>`
        );

        if (
            errors.length
        ) {
            messages.push(
                '<hr>'
            );

            messages.push(
                '<strong>Fehlerdetails:</strong><br>'
            );

            messages.push(
                errors
                .slice(
                    0,
                    20
                )
                .map(
                    entry =>
                        `${escapeHtml(
                            entry.poi.name ||
                            entry.poi.typeName
                        )}: ${escapeHtml(
                            entry.error?.message ||
                            String(
                                entry.error
                            )
                        )}`
                )
                .join(
                    '<br>'
                )
            );

            if (
                errors.length >
                20
            ) {
                messages.push(
                    `<br>... und ${
                        errors.length - 20
                    } weitere Fehler.`
                );
            }
        }

        showStatus(
            messages.join(
                '<br>'
            ),
            failed
            ? 'warning'
            : 'success',
            true
        );
    }

    // ============================================================
    // Status
    // ============================================================

    function showStatus(
        message,
        type = 'info',
        html = false
    ) {
        const element =
            document.getElementById(
                'lss-poi-manager-status'
            );

        if (!element) {
            return;
        }

        element.className =
            `alert alert-${type}`;

        if (html) {
            element.innerHTML =
                message;
        } else {
            element.textContent =
                message;
        }
    }

    // ============================================================
    // Loading
    // ============================================================

    function setLocationLoading(
        loading
    ) {
        const button =
            document.getElementById(
                'lss-poi-manager-location-button'
            );

        if (!button) {
            return;
        }

        button.disabled =
            loading;

        button.innerHTML =
            loading
            ? `
                <span class="glyphicon glyphicon-refresh"></span>
                Suche...
            `
            : `
                <span class="glyphicon glyphicon-search"></span>
                Ort suchen
            `;
    }

    function setOsmLoading(
        loading
    ) {
        const button =
            document.getElementById(
                'lss-poi-manager-osm-search'
            );

        if (!button) {
            return;
        }

        button.disabled =
            loading ||
            !currentLocation;

        button.innerHTML =
            loading
            ? `
                <span class="glyphicon glyphicon-refresh"></span>
                OSM wird geladen...
            `
            : `
                <span class="glyphicon glyphicon-globe"></span>
                OSM-POIs laden
            `;
    }

    function setCreationLoading(
        loading
    ) {
        const button =
            document.getElementById(
                'lss-poi-manager-create'
            );

        if (button) {
            button.disabled =
                loading;

            button.innerHTML =
                loading
                ? `
                    <span class="glyphicon glyphicon-refresh"></span>
                    POIs werden erstellt...
                `
                : `
                    <span class="glyphicon glyphicon-plus"></span>
                    POIs im LSS erstellen
                `;
        }

        const progress =
            document.getElementById(
                'lss-poi-manager-progress'
            );

        if (progress) {
            progress.style.display =
                loading
                ? 'block'
                : 'none';
        }
    }

    // ============================================================
    // Modal öffnen
    // ============================================================

    async function openPoiManager() {
    createModal();

    if (
        typeof window.jQuery !==
            'undefined' &&
        typeof window.jQuery.fn.modal ===
            'function'
    ) {
        window.jQuery(
            modal
        ).modal(
            'show'
        );
    } else {
        modal.style.display =
            'block';

        modal.classList.add(
            'in'
        );
    }

    if (!existingLSSPois.length) {
        try {
            existingLSSPois =
                await loadExistingLSSPois();

            log(
                `Beim Öffnen ${existingLSSPois.length} vorhandene LSS-POIs geladen.`
            );

        } catch (err) {
            warn(
                'Vorhandene LSS-POIs konnten beim Öffnen nicht geladen werden:',
                err
            );
        }
    }

    updateStats();
}

    // ============================================================
    // Initialisierung
    // ============================================================

    function init() {
        log(
            'POI-Manager 0.5.0 wird initialisiert.'
        );

        if (
            !addPoiManagerButton()
        ) {
            const observer =
                new MutationObserver(
                    () => {

                        if (
                            addPoiManagerButton()
                        ) {
                            observer.disconnect();
                        }
                    }
                );

            observer.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );

            setTimeout(
                () => {
                    observer.disconnect();
                },
                30000
            );
        }

        log(
            'POI-Manager 0.5.0 bereit.'
        );
    }

    init();

})();
