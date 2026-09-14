// ==UserScript==
// @name         [LSS] Fahrzeug-Manager
// @namespace    https://leitstellenspiel.de/
// @version      1.1
// @description  Zeigt fehlden Fahrzeuge pro Wache, je Einstellung an und ermöglicht den Kauf dieser.
// @author       Caddy21
// @match        https://www.leitstellenspiel.de/*
// @match        https://polizei.leitstellenspiel.de/*
// @icon         https://github.com/Caddy21/-docs-assets-css/raw/main/yoshi_icon__by_josecapes_dgqbro3-fullview.png
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Globale Daten
    let buildingDataGlobal = [];
    let vehicleDataGlobal = [];
    let vehicleMapGlobal = {};
    let vehicleTypeMapGlobal = {};
    let equipmentTypeMapGlobal = {};
    let equipmentDataGlobal = [];
    let equipmentMapGlobal = {};
    let lssmBuildingDefsGlobal = null;
    let currentCredits = 0;
    let currentCoins = 0;

    const buildingTypeNames = {
        '0_normal': 'Feuerwache (Normal)',
        '0_small': 'Feuerwache (Kleinwache)',
        '2_normal': 'Rettungswache (Normal)',
        '2_small': 'Rettungswache (Kleinwache)',
        '5_normal': 'Rettungshubschrauber-Station',
        '6_normal': 'Polizeiwache (Normal)',
        '6_small': 'Polizeiwache (Kleinwache)',
        '9_normal': 'Technisches Hilfswerk',
        '11_normal': 'Bereitschaftspolizei',
        '12_normal': 'Schnelleinsatzgruppe (SEG)',
        '13_normal': 'Polizeihubschrauberstation',
        '15_normal': 'Wasserrettung',
        '17_normal': 'Polizei-Sondereinheiten',
        '24_normal': 'Reiterstaffel',
        '25_normal': 'Bergrettungswache',
        '26_normal': 'Seenotrettungswache',
        '29_normal': 'Autobahnpolizei',
    };
    const specialEquipmentBuildings = {
        police_lift: [13],
        rescue_lift: [5],
        mountain_drone: [25]
    };

    // Button ins Profil-Dropdown einfügen
    const menu = document.querySelector('#menu_profile + ul.dropdown-menu');
    if (menu) {
        const divider = menu.querySelector('li.divider');
        if (divider) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.id = 'fahrzeug-manager-btn';
            a.innerHTML = '<span class="glyphicon glyphicon-road"></span>&nbsp;&nbsp; Fahrzeug-Manager';
            li.appendChild(a);
            menu.insertBefore(li, divider);
        }
    }

    // Modal HTML
    const modalHTML = `
        <div class="modal fade" id="fahrzeugManagerModal" tabindex="-1" role="dialog" aria-labelledby="fahrzeugManagerLabel">
          <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
              <div class="modal-header fm-sticky-header">
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                      <h3 class="modal-title" id="fahrzeugManagerLabel" style="font-weight: bold; margin: 0;">🚒 Der Fahrzeug-Manager🚒</h3>
                      <div style="display: flex; gap: 10px; align-items: center;">
                          <button type="button" class="fm-config-btn" id="fm-config-btn">Fahrzeugkonfiguration ⚙️</button>
                          <button type="button" class="fm-log-btn" id="fm-log-btn">Kaufprotokoll 📝</button>
                          <button type="button" class="fm-close-btn" data-dismiss="modal">Schließen ✖</button>
                      </div>
                  </div>
                    <div class="fm-description"
                         style="font-size: 14px; color: #555; background-color: var(--spoiler-body-bg); padding: 5px 0; line-height: 1.5;">
                      Nutze den <strong>Fahrzeug-Manager</strong>, um deine Fahrzeugflotte effizient zu verwalten.<br>
                      Du kannst pro Wachentyp deine Fahrzeuge individuell konfigurieren – über den Button oben rechts.<br>
                      Außerdem kannst du deine Wachen deutlich schneller mit Fahrzeugen bestücken und behältst dabei stets die Kosten im Blick.
                    </div>
                  <div style="display: grid; grid-template-columns: max-content 1fr; gap: 15px; row-gap: 3px; align-items: center; font-size: 14px;">
                      <div>Aktuelle Credits: <span id="fm-credits" style="color: #5cb85c; font-weight: bold;">0</span></div>
                      <div>Ausgewählte Credits: <span id="fm-costs-credits" style="color: #5cb85c; font-weight: bold;">0</span></div>
                      <div>Aktuelle Coins: <span id="fm-coins" style="color: #dc3545; font-weight: bold;">0</span></div>
                      <div>Ausgewählte Coins: <span id="fm-costs-coins" style="color: #dc3545; font-weight: bold;">0</span></div>
                  </div>
                  <div id="fm-progress-container" style="width: 100%; display: none; margin-top: 5px;">
                    <div id="fm-progress-text" style="font-size: 13px; margin-bottom: 3px; font-weight: bold; color: #007bff;">
                        Kauf gestartet...
                    </div>
                    <div style="background: #e0e0e0; border-radius: 4px; overflow: hidden; height: 8px;">
                        <div id="fm-progress-bar" style="width: 0%; height: 100%; background: #28a745; transition: width 0.3s ease;"></div>
                    </div>
                </div>
              </div>
              <div class="modal-body" id="fahrzeug-manager-content">
                <p>Lade die eingestellten Konfigurationen, je nach Auswahl kann dies einen Augenblick dauern.</p>
              </div>
            </div>
          </div>
        </div>`;

    // Fahrzeugkonfigurations-Modal
    const configModalHTML = `
    <div class="modal fade" id="fahrzeugConfigModal" tabindex="-1" role="dialog" aria-labelledby="fahrzeugConfigLabel">
      <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3 class="modal-title" id="fahrzeugConfigLabel" style="font-weight: bold; margin: 0;">⚙️ Fahrzeugkonfiguration ⚙️</h3>
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" class="fm-export-btn" id="fm-export-profiles" title="Alle Profile exportieren">💾 Export</button>
              <button type="button" class="fm-import-btn" id="fm-import-profiles" title="Profile importieren">📂 Import</button>
              <button type="button" class="fm-close-btn" data-dismiss="modal">Schließen ✖</button>
            </div>
          </div>
            <br><div id="fahrzeug-config-content">
              <p>Bitte warten, Daten werden geladen...</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;

    // Kaufprotokoll-Modal
    const logModalHTML = `
        <div class="modal fade" id="fahrzeugLogModal" tabindex="-1" role="dialog" aria-labelledby="fahrzeugLogLabel">
      <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3 class="modal-title" id="fahrzeugLogLabel">📝 Kaufprotokoll 📝</h3>
            <button type="button" class="fm-reset-log-btn" id="fm-reset-log-btn">Protokoll zurücksetzen</button>
            <button type="button" class="fm-close-btn" data-dismiss="modal">Schließen ✖</button>
          </div>
          <div class="modal-body" id="fahrzeug-log-content">
            <p>Lade Protokoll...</p>
          </div>
        </div>
      </div>
    </div>`;

    // CSS
    GM_addStyle(`
        #fahrzeugManagerModal .modal-dialog { max-width: 2500px; width: 95%; margin: 30px auto; }
        #fahrzeugManagerModal .modal-content { width: 100%; overflow-x: auto; }
        #fahrzeugManagerModal { z-index: 10000 !important; }
        #fahrzeugManagerModal .modal-content { display: flex;  flex-direction: column;  height: 90vh; /* gesamte Modalhöhe */ }
        #fahrzeugManagerModal .modal-header { flex-shrink: 0;  position: sticky;  top: 0;  z-index: 10;  background: var(--spoiler-body-bg); }
        #fahrzeugManagerModal .modal-body { overflow-y: auto;  flex-grow: 1; }
        #fahrzeugConfigModal .modal-dialog { max-width: 2000px; width: 90%; margin: 30px auto; }
        #fahrzeugConfigModal .modal-content { width: 100%; overflow-x: auto; }
        #fahrzeugConfigModal { z-index: 10001 !important; }  /* höher als FahrzeugManager */
        #fahrzeugConfigModal + .modal-backdrop { z-index: 10000 !important; }
        #fahrzeugLogModal { z-index: 10002 !important; }
        #fahrzeugLogModal .modal-content { width: 100%; overflow-x: auto; }
        #fahrzeugLogModal .modal-dialog { max-width: 1500px; width: 70%; margin: 30px auto; }
        #fahrzeugLogModal + .modal-backdrop { z-index: 10001 !important; }
        .fm-close-btn { background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 5px 10px; font-size: 13px; cursor: pointer; }
        .fm-close-btn:hover { background-color: #c82333; }
        .fm-select { cursor: pointer; }
        .fm-spoiler { border: 1px solid var(--spoiler-border); border-radius: 4px; margin-bottom: 8px; overflow: hidden; }
        .fm-spoiler-header { background-color: var(--spoiler-header-bg); color: var(--spoiler-header-text); padding: 8px 12px; cursor: pointer; font-weight: bold; user-select: none; transition: background-color 0.2s; }
        .fm-spoiler-header:hover { background-color: var(--spoiler-header-hover); }
        .fm-spoiler-body { display: none; padding: 10px; background: var(--spoiler-body-bg); color: var(--spoiler-body-text); overflow-x: auto; }
        .fm-spoiler-body.active { display: block; }
        .fm-spoiler table { border-collapse: collapse; width: 100%; table-layout: auto; min-width: 800px; }
        .fm-spoiler table th, .fm-spoiler table td, .fm-spoiler table .fm-filter-row td { border: none; padding: 6px 8px; text-align: center; vertical-align: middle; white-space: nowrap; }
        .fm-spoiler table thead th, .fm-spoiler table .fm-filter-row td { background-color: var(--table-header-bg); font-weight: bold; }
        .fm-filter-row select, .fm-filter-row button.fm-filter-reset { font-size: 12px; padding: 2px 4px; min-width: 100px; width: 100%; }
        .fm-badge-green { background-color: #28a745 !important; color: #fff !important; }
        .fm-vehicle-list { white-space: normal !important; word-break: normal !important; overflow-wrap: normal !important; max-width: 350px; display: inline-block; }
        .fm-config-btn { background-color: #007bff; color: white; border: none; border-radius: 4px; padding: 5px 10px; font-size: 13px; cursor: pointer; }
        .fm-config-btn:hover { background-color: #0069d9; }
        .fm-log-btn { background-color: #17a2b8; color: white; border: none; border-radius: 4px; padding: 5px 10px; font-size: 13px; cursor: pointer; }
        .fm-reset-log-btn { background-color: #ffc107; color: #333; border: none; border-radius: 4px; padding: 5px 10px; font-size: 13px; cursor: pointer; margin-left: 10px; }
        .fm-reset-log-btn:hover { background-color: #e0a800; }
        .fm-building-profile { background-color: var(--bs-body-bg, #fff); color: var(--bs-body-color, #000); }
        .fm-building-profile { background-color: #222; color: #f0f0f0; border-color: #444; }
        .fm-building-link,
        .fm-building-link:visited,
        .fm-building-link:hover,
        .fm-building-link:active { color: inherit; font-weight: inherit; text-decoration: inherit; }
        .fm-building-link,
        .fm-building-link:visited,
        .fm-building-link:hover,
        .fm-building-link:active { color: inherit !important; font-weight: normal !important; text-decoration: none !important; background: none !important; }
        .fm-export-btn { background-color: #28a745; color: white; border: none; border-radius: 4px; padding: 5px 10px; font-size: 13px; cursor: pointer; }
        .fm-export-btn:hover { background-color: #218838; }
        .fm-import-btn { background-color: #6f42c1; color: white; border: none; border-radius: 4px; padding: 5px 10px; font-size: 13px; cursor: pointer; }
        .fm-import-btn:hover { background-color: #5a32a3; }
        .modal-backdrop { z-index: 9999 !important; }
        .btn-xs { padding: 2px 6px; font-size: 12px; }
        body:not(.dark) { --spoiler-border: #ddd; --spoiler-header-bg: #f7f7f7; --spoiler-header-text: #000; --spoiler-header-hover: #eaeaea; --spoiler-body-bg: #fff; --spoiler-body-text: #000; --table-header-bg: #f1f1f1; --spoiler-input-bg: #ffffff; --spoiler-input-text: #000000; }
        body.dark { --spoiler-border: #444; --spoiler-header-bg: #333; --spoiler-header-text: #eee; --spoiler-header-hover: #444; --spoiler-body-bg: #222; --spoiler-body-text: #ddd; --table-header-bg: #333; --spoiler-input-bg: #3a3a3a; --spoiler-input-text: #ffffff; }

    `);

    // Stellplatzberechnung für alle Gebäudetypen
    function calcMaxParkingLots(building, lssmBuildings) {
        const bTypeId = String(building.building_type);
        const lssmDef = lssmBuildings?.[bTypeId];
        if (!lssmDef) return (building.level ?? 0) + 1;
        let max = lssmDef.startParkingLots || 0;
        if (Array.isArray(building.extensions)) {
            for (const ext of building.extensions) {
                const lssmExt = lssmDef.extensions?.find(e =>
                                                         (typeof ext.type_id !== "undefined" && typeof e.type_id !== "undefined" && e.type_id === ext.type_id) ||
                                                         (e.caption && ext.caption && e.caption === ext.caption)
                                                        );
                if (lssmExt && lssmExt.givesParkingLots) {
                    if (ext.available === true) {
                        max += lssmExt.givesParkingLots;
                    }
                }
            }
        }
        if (lssmDef.maxLevel > 0) {
            max += (building.level ?? 0);
        }
        return max;
    }

    // Fügt den Gebäudelink hinzu
    function buildBuildingLink(building) {
        const url = `/buildings/${building.id}`;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="fm-building-link">${building.caption}</a>`;
    }

    // Fahrzeugtypen laden
    async function loadVehicleTypesLSSM() {
        try {
            const res = await fetch('https://api.lss-manager.de/de_DE/vehicles');

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            return Object.entries(data).reduce((map, [id, vehicle]) => {
                map[id] = {
                    ...vehicle,
                    id: Number(id)
                };

                return map;
            }, {});
        } catch (e) {
            console.error('Fehler beim Laden der LSSM Fahrzeugtypen:', e);
            return {};
        }
    }

    // LSSM Equipment-Typen laden
    async function loadEquipmentTypesLSSM() {
        const url = 'https://raw.githubusercontent.com/LSS-Manager/LSSM-V.4/dev/src/i18n/de_DE/equipment.ts';
        const text = await fetch(url).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
        });
        const equipment = {};
        const regex = /id:\s*['"]([^'"]+)['"][\s\S]*?caption:\s*['"]([^'"]+)['"][\s\S]*?size:\s*(\d+)[\s\S]*?credits:\s*([\d_]+)[\s\S]*?coins:\s*(\d+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const [, id, caption, size, credits, coins] = match;

            equipment[id] = {
                id,
                caption,
                size: parseInt(size),
                credits: parseInt(credits.replace(/_/g, '')),
                coins: parseInt(coins),
                itemType: 'equipment',
                type: 'equipment'
            };
        }
        return equipment;
    }

    async function loadEquipmentsFromAPI() {
        try {
            const res = await fetch('/api/equipments');

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const equipments = await res.json();

            return Array.isArray(equipments)
                ? equipments
            : [];

        } catch (e) {
            console.error(
                '[FM] Fehler beim Laden der vorhandenen Equipment-Daten:',
                e
            );

            return [];
        }
    }

    function buildEquipmentMap(equipments) {
        const map = {};
        equipments.forEach(equipment => {
            const buildingId =
                  equipment.building_id ??
                  equipment.buildingId;

            const typeId =
                  equipment.equipment_type ??
                  equipment.equipmentType ??
                  equipment.type_id ??
                  equipment.typeId;

            if (buildingId == null || typeId == null) return;
            if (!map[buildingId]) {
                map[buildingId] = {};
            }

            const key = String(typeId);

            map[buildingId][key] =
                (map[buildingId][key] || 0) + 1;
        });
        return map;
    }

    // Building-Definitionen laden
    async function loadLSSMBuildingDefs() {
        try {
            const res = await fetch('https://api.lss-manager.de/de_DE/buildings');
            const data = await res.json();
            return data;
        } catch (e) {
            console.error('Fehler beim Laden der LSSM Building-Defs:', e);
            return {};
        }
    }

    // Fahrzeuge laden und nach Gebäude gruppieren
    async function loadVehiclesFromAPI_raw() {
        try {
            const res = await fetch('/api/vehicles');
            const vehicles = await res.json();
            return vehicles;
        } catch (error) {
            console.error('Fehler beim Laden der Fahrzeugdaten:', error);
            return [];
        }
    }

    // Gesamte Übersicht laden
    async function loadBuildingsFromAPI() {
        const content = document.getElementById('fahrzeug-manager-content');
        content.innerHTML = '<p><span class="glyphicon glyphicon-refresh glyphicon-spin"></span> Lade die eingestellten Konfigurationen, je nach Auswahl kann dies einen Augenblick dauern.</p>';
        try {
            const [buildings, vehiclesRaw, vehicleTypeMap, lssmBuildingDefs, equipmentTypeMap, equipments
                  ] = await Promise.all([
                      fetch('/api/buildings').then(r => r.json()),
                      loadVehiclesFromAPI_raw(),
                      loadVehicleTypesLSSM(),
                      loadLSSMBuildingDefs(),
                      loadEquipmentTypesLSSM(),
                      loadEquipmentsFromAPI()
                  ]);
            buildingDataGlobal = buildings;
            vehicleDataGlobal = vehiclesRaw;
            vehicleTypeMapGlobal = vehicleTypeMap;
            lssmBuildingDefsGlobal = lssmBuildingDefs;
            equipmentDataGlobal = Object.values(equipmentTypeMap);
            equipmentMapGlobal = buildEquipmentMap(equipments);

            const vehicleMap = {};
            vehicleDataGlobal.forEach(v => {
                if (!vehicleMap[v.building_id]) vehicleMap[v.building_id] = [];
                vehicleMap[v.building_id].push(v);
            });
            vehicleMapGlobal = vehicleMap;

            const leitstellenMap = {};
            buildings.forEach(b => { if(b.building_type===7 || b.is_leitstelle) leitstellenMap[b.id]=b.caption; });
            buildings.forEach(b => {
                b.leitstelle_caption = b.leitstelle_building_id && leitstellenMap[b.leitstelle_building_id] ? leitstellenMap[b.leitstelle_building_id] : "-";
                b.vehicle_count = (vehicleMap[b.id] || []).length;
            });

            const filteredBuildings = buildings.filter(b=>getBuildingTypeName(b)!==null);
            content.innerHTML = buildBuildingsByType(filteredBuildings, vehicleMap, vehicleTypeMap, lssmBuildingDefsGlobal);
            document.querySelectorAll('.fm-spoiler-header').forEach(header=>{
                header.addEventListener('click', ()=>{
                    const targetId = header.dataset.target;
                    document.querySelectorAll('.fm-spoiler-body').forEach(body=>{
                        body.id===targetId ? body.classList.toggle('active') : body.classList.remove('active');
                    });
                });
            });
            attachAllTableListeners();
        } catch(err) {
            content.innerHTML = `<div class="alert alert-danger">❌ Fehler beim Laden der Daten: ${err}</div>`;
        }
    }

    // Lade die gespeicherte Konfiguration
    async function loadVehicleConfig() {
        const content = document.getElementById('fahrzeug-config-content');
        content.innerHTML = '<p><span class="glyphicon glyphicon-refresh glyphicon-spin"></span> Lade Fahrzeugkonfiguration...</p>';

        try {
            const [buildingTypes, vehicleTypes] = await Promise.all([
                fetch('https://api.lss-manager.de/de_DE/buildings').then(r => r.json()),
                loadVehicleTypesLSSM()
            ]);

            const sortedBuildingKeys = Object.keys(buildingTypeNames);
            let html = '';

            sortedBuildingKeys.forEach(key => {
                const buildingId = parseInt(key.split('_')[0], 10);
                const buildingCaption = buildingTypeNames[key];
                if (!buildingCaption) return;

                const vehiclesForBuilding = Object.values(vehicleTypes).filter(v =>
                                                                               Array.isArray(v.possibleBuildings) &&
                                                                               v.possibleBuildings.includes(buildingId)
                                                                              );

                const equipmentForBuilding = Object.values(equipmentDataGlobal).filter(e => {
                    const allowedBuildings = specialEquipmentBuildings[e.id];
                    if (!allowedBuildings) {
                        return buildingId === 0;
                    }
                    return allowedBuildings.includes(buildingId);
                });

                const itemsForBuilding = [
                    ...vehiclesForBuilding.map(v => ({
                        ...v,
                        itemType: 'vehicle',
                        type: 'vehicle'
                    })),
                    ...equipmentForBuilding.map(e => ({
                        ...e,
                        itemType: 'equipment',
                        type: 'equipment'
                    }))
                ];

                if (itemsForBuilding.length > 0) {
                    html += `
                    <div class="fm-spoiler">
                        <div class="fm-spoiler-header" data-target="fm-config-body-${key}">
                            ${buildingCaption} – wird geladen …
                        </div>
                        <div id="fm-config-body-${key}" class="fm-spoiler-body">
                            ${buildConfigGrid(
                        itemsForBuilding,
                        key,
                        10,
                        buildingCaption
                    )}
                        </div>
                    </div>`;
                }
            });

            content.innerHTML = html ||
                '<div class="alert alert-info">Keine passenden Fahrzeuge gefunden.</div>';

            document.querySelectorAll('#fahrzeugConfigModal .fm-spoiler-header').forEach(header => {
                header.addEventListener('click', () => {
                    const targetId = header.dataset.target;

                    document.querySelectorAll(
                        '#fahrzeugConfigModal .fm-spoiler-body'
                    ).forEach(body => {
                        body.id === targetId
                            ? body.classList.toggle('active')
                        : body.classList.remove('active');
                    });
                });
            });

        } catch (err) {
            content.innerHTML =
                `<div class="alert alert-danger">❌ Fehler beim Laden der Konfigurationsdaten: ${err}</div>`;
        }
    }

    // Maximale Stellplätze berechnen
    function getMaxVehiclesForBuilding(building, lssmBuildingDefs) {
        let max = building.level !== undefined ? building.level + 1 : 1;
        if (Array.isArray(building.extensions) && lssmBuildingDefs) {
            building.extensions.forEach(ext => {
                max += getParkingLotsForExtension(building.building_type, ext.type_id ?? ext.caption, lssmBuildingDefs);
            });
        }
        return max;
    }

    // Gebäudepname bestimmen
    function getBuildingTypeName(building) {
        let typeId = building.building_type;
        const size = building.small_building ? 'small' : 'normal';
        const key = `${typeId}_${size}`;
        return buildingTypeNames[key] ?? null;
    }

    // Hilfsfunktion: Gibt die Stellplätze für eine Erweiterung zurück
    function getParkingLotsForExtension(buildingTypeId, extensionTypeIdOrCaption, lssmBuildingDefs) {
        const buildingDef = lssmBuildingDefs[String(buildingTypeId)];
        if (!buildingDef || !Array.isArray(buildingDef.extensions)) return 0;
        const extDef = buildingDef.extensions.find(ext =>
                                                   (ext.type_id !== undefined && ext.type_id === extensionTypeIdOrCaption) ||
                                                   (typeof extensionTypeIdOrCaption === "string" && ext.caption === extensionTypeIdOrCaption)
                                                  );
        return extDef && extDef.givesParkingLots ? extDef.givesParkingLots : 0;
    }

    // Ermittelt den Erweiterungsstatus eines Gebäudes für einen bestimmten Fahrzeugtyp
    function getExtensionStatusForVehicle(building, vehicleTypeId, lssmBuildingDefs) {
        if (!building || !lssmBuildingDefs) return null;

        const buildingDef = lssmBuildingDefs[building.building_type];

        if (!buildingDef || !Array.isArray(buildingDef.extensions)) {
            return null;
        }

        const typeId = Number(vehicleTypeId);
        const vehicleType = vehicleTypeMapGlobal?.[typeId];

        if (!vehicleType) return null;

        const extensions = buildingDef.extensions;

        const matchingExtDef = extensions.find(extDef =>
                                               Array.isArray(extDef.unlocksVehicleTypes) &&
                                               extDef.unlocksVehicleTypes.some(
            id => Number(id) === typeId
        )
                                              );
        if (!matchingExtDef) {
            return null;
        }
        const realExtension = building.extensions?.find(ext =>
                                                        ext.caption &&
                                                        matchingExtDef.caption &&
                                                        ext.caption.trim().toLowerCase() ===
                                                        matchingExtDef.caption.trim().toLowerCase()
                                                       );
        if (!realExtension) {
            return 'missing';
        }
        if (
            realExtension.available === false &&
            realExtension.enabled === true
        ) {
            return 'in_progress';
        }
        if (
            realExtension.available === true &&
            realExtension.enabled === false
        ) {
            return 'ok';
        }
        return 'ok';
    }

    // Ermittelt alle eigenen RC / Winden
    function getEquipmentById(typeId) {
        const id = String(typeId);

        return equipmentDataGlobal.find(
            e => String(e.id) === id
        ) || equipmentTypeMapGlobal[id] || null;
    }

    // Prüft den Status der Lager jeder Wache (Fehlt/Baut/Vorhanden)
    function getBuildingStorageInfo(building) {
        const storageTotal = Number(building?.storage_total || 0);
        const storageAvailable = Number(building?.storage_available || 0);

        const storageUpgrade = Array.isArray(building?.storage_upgrades)
        ? building.storage_upgrades.find(
            u => u.upgrade_type === 'Lagerraum'
        )
        : null;

        return {
            hasStorage: storageTotal > 0,
            available: storageTotal > 0 && storageAvailable > 0,
            total: storageTotal,
            free: Math.max(storageAvailable, 0),
            upgrade: storageUpgrade
        };
    }

    // Nach Typ gruppieren und Spoiler bauen
    function buildBuildingsByType(buildings, vehicleMap, vehicleTypeMap, lssmBuildingDefs) {
        const grouped = {};
        buildings.forEach(b => {
            const typeName = getBuildingTypeName(b);
            if(!typeName) return;
            if(!grouped[typeName]) grouped[typeName]=[];
            grouped[typeName].push(b);
        });

        let html='';
        Object.keys(buildingTypeNames).forEach((key, idx) => {
            const typeName = buildingTypeNames[key];
            if(grouped[typeName]){
                const filteredBuildings = grouped[typeName].filter(b => {
                    const vehiclesCount = (vehicleMap[b.id] || []).length;
                    const maxVehicles = calcMaxParkingLots(b, lssmBuildingDefs);
                    return vehiclesCount < maxVehicles;
                });
                if(filteredBuildings.length > 0) {
                    html+=
                        `<div class="fm-spoiler">
                         <div class="fm-spoiler-header" data-target="fm-spoiler-body-${idx}">${typeName}</div>
                         <div id="fm-spoiler-body-${idx}" class="fm-spoiler-body">${buildFahrzeugTable(filteredBuildings, idx, vehicleMap, vehicleTypeMap, lssmBuildingDefs)}</div>
                         </div>`;
                }
            }
        });
        return html;
    }

    // Einzelne Tabellen: Event-Listener zentral anlegen
    function attachAllTableListeners() {
        const content = document.getElementById('fahrzeug-manager-content');
        if (!content) return;

        // Delegierte Events
        content.addEventListener('change', e => {
            const table = e.target.closest('.fm-table');
            if (!table) return;

            // Filter geändert
            if (e.target.classList.contains('fm-filter-leitstelle') ||
                e.target.classList.contains('fm-filter-wache')) {
                applyFilters(table);
            }

            // einzelne Checkbox geändert
            if (e.target.classList.contains('fm-select')) {
                updateSelectAll(table);
                updateSelectedCosts();
            }

            // Select-All geändert
            if (e.target.classList.contains('fm-select-all')) {
                const checked = e.target.checked;
                table.querySelectorAll('tbody tr').forEach(row => {
                    if (row.style.display !== 'none') {
                        const cb = row.querySelector('.fm-select');
                        if (cb) cb.checked = checked;
                    }
                });
                updateSelectedCosts();
            }
        });

        content.addEventListener('click', e => {
            if (!e.target.classList.contains('fm-filter-reset')) return;
            const table = e.target.closest('.fm-table');
            if (!table) return;
            const filterLeitstelle = table.querySelector('.fm-filter-leitstelle');
            const filterWache = table.querySelector('.fm-filter-wache');
            if (filterLeitstelle) filterLeitstelle.value = '';
            if (filterWache) filterWache.value = '';
            applyFilters(table);
        });

        function applyFilters(table) {
            const leitstelle = table.querySelector('.fm-filter-leitstelle')?.value || '';
            const wache = table.querySelector('.fm-filter-wache')?.value || '';
            const rows = [...table.querySelectorAll('tbody tr')];
            rows.forEach(row => {
                const rowLeitstelle = row.cells[1]?.textContent.trim() || '';
                const rowWache = row.cells[2]?.textContent.trim() || '';
                row.style.display = (leitstelle && rowLeitstelle !== leitstelle) ||
                    (wache && rowWache !== wache) ? 'none' : '';
            });
            updateSelectAll(table);
        }

        function updateSelectAll(table) {
            const rows = [...table.querySelectorAll('tbody tr')];
            const visibleCheckboxes = rows
            .filter(r => r.style.display !== 'none')
            .map(r => r.querySelector('.fm-select'))
            .filter(Boolean);
            const allCheckbox = table.querySelector('.fm-select-all');
            if (allCheckbox) {
                allCheckbox.checked = visibleCheckboxes.length > 0 &&
                    visibleCheckboxes.every(cb => cb.checked);
            }
        }

        // Initial Filter anwenden
        document.querySelectorAll('.fm-table').forEach(table => applyFilters(table));
    }

    // Berechnet den aktuellen Kaufpreis je nach Auswahl
    function updateBuyButtons() {
        document.querySelectorAll('#fahrzeugManagerModal table tbody tr').forEach(row => {
            const creditsCost = parseInt(row.querySelector('.fm-select')?.dataset.credits || '0', 10);
            const coinsCost = parseInt(row.querySelector('.fm-select')?.dataset.coins || '0', 10);

            const creditBtn = row.querySelector('.fm-buy-credit');
            const coinBtn = row.querySelector('.fm-buy-coin');

            if (creditBtn) {
                if (creditsCost > currentCredits) {
                    creditBtn.disabled = true;
                    creditBtn.title = `Benötigt: ${creditsCost.toLocaleString()} Credits (nur ${currentCredits.toLocaleString()} vorhanden)`;
                } else {
                    creditBtn.disabled = false;
                    creditBtn.title = '';
                }
            }

            if (coinBtn) {
                if (coinsCost > currentCoins) {
                    coinBtn.disabled = true;
                    coinBtn.title = `Benötigt: ${coinsCost.toLocaleString()} Coins (nur ${currentCoins.toLocaleString()} vorhanden)`;
                } else {
                    coinBtn.disabled = false;
                    coinBtn.title = '';
                }
            }
        });
    }

    // Ausgewählte Kosten berechnen
    function updateSelectedCosts(){
        let totalCredits=0,totalCoins=0;
        document.querySelectorAll('.fm-select:checked').forEach(cb=>{
            totalCredits += parseInt(cb.dataset.credits,10)||0;
            totalCoins += parseInt(cb.dataset.coins,10)||0;
        });
        document.getElementById('fm-costs-credits').textContent=totalCredits.toLocaleString();
        document.getElementById('fm-costs-coins').textContent=totalCoins.toLocaleString();
    }

    // Lädt die gespeicherten Profile für ein bestimmtes Gebäude
    function loadProfiles(buildingKey) {
        try {
            const raw = localStorage.getItem(`fm-config-${buildingKey}-profiles`);
            if (!raw) {
                return {
                    activeProfile: null,
                    profiles: {}
                };
            }

            const parsed = JSON.parse(raw);

            if (!parsed.profiles) parsed.profiles = {};

            // 🔥 Cleanup
            if (parsed.profiles["null"]) {
                delete parsed.profiles["null"];
            }

            if (!parsed.activeProfile || parsed.activeProfile === "null") {
                parsed.activeProfile = Object.keys(parsed.profiles)[0] || null;
            }

            return parsed;

        } catch (e) {
            console.warn(`[FM][Config] Fehler beim Laden der Profile ${buildingKey}:`, e);
            return {
                activeProfile: null,
                profiles: {}
            };
        }
    }

    // Speichert die Profile für ein bestimmtes Gebäude
    function saveProfiles(buildingKey, data) {
        localStorage.setItem(`fm-config-${buildingKey}-profiles`, JSON.stringify(data));
    }

    // Export: Alle Profile als JSON-Datei herunterladen
    function exportAllProfiles() {
        const exportData = {};

        // Alle Profile für jeden Wachentyp sammeln
        Object.keys(buildingTypeNames).forEach(key => {
            const profilesData = loadProfiles(key);
            if (Object.keys(profilesData.profiles).length > 0) {
                exportData[key] = profilesData;
            }
        });

        if (Object.keys(exportData).length === 0) {
            alert('Es gibt keine Profile zum Exportieren.');
            return;
        }

        // JSON erstellen und herunterladen
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fahrzeug-manager-profile-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(`✅ ${Object.keys(exportData).length} Wachentypen exportiert!`);
    }

    // Import: Profile aus JSON-Datei importieren
    function importAllProfiles() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                if (!file) return;

                const content = await file.text();
                const importData = JSON.parse(content);

                if (typeof importData !== 'object' || !Object.keys(importData).length) {
                    alert('❌ Ungültige Dateiformat oder leere Datei.');
                    return;
                }

                let importedCount = 0;
                let existingCount = 0;

                // Alle Profile importieren
                Object.entries(importData).forEach(([key, data]) => {
                    if (data.profiles && Object.keys(data.profiles).length > 0) {
                        const existingData = loadProfiles(key);

                        // Merge-Modus: Neuer Profile hinzufügen, bestehende nicht überschreiben
                        Object.entries(data.profiles).forEach(([profileName, profileConfig]) => {
                            if (existingData.profiles[profileName]) {
                                existingCount++;
                            } else {
                                existingData.profiles[profileName] = profileConfig;
                                importedCount++;
                            }
                        });

                        // Active Profile setzen (falls noch nicht gesetzt)
                        if (!existingData.activeProfile && data.activeProfile) {
                            existingData.activeProfile = data.activeProfile;
                        }

                        saveProfiles(key, existingData);
                    }
                });

                alert(`✅ Import abgeschlossen!\n• ${importedCount} neue Profile hinzugefügt\n• ${existingCount} Profile (bereits vorhanden, nicht überschrieben)`);

                // Config-Modal neu laden
                loadVehicleConfig();

            } catch (err) {
                alert(`❌ Fehler beim Import: ${err.message}`);
                console.error(err);
            }
        };
        input.click();
    }

    // Gibt die Konfiguration des aktuell aktiven Profils für ein bestimmtes Gebäude zurück.
    function getActiveProfileConfig(buildingKey) {
        const data = loadProfiles(buildingKey);

        if (!data.activeProfile) return [];

        return data.profiles[data.activeProfile] || [];
    }

    // Speichert eine neue Konfiguration für das aktuell aktive Profil eines Gebäudes.
    function saveActiveProfileConfig(buildingKey, config) {
        const data = loadProfiles(buildingKey);

        if (!data.activeProfile) return; // 💥 verhindert "null"-Profil

        data.profiles[data.activeProfile] = config;
        saveProfiles(buildingKey, data);
    }

    // Speichert pro Wache das aktive Profil für einen bestimmten Gebäudetyp
    function setBuildingActiveProfile(buildingId, buildingKey, profileName) {
        const key = `fm-config-building-profile-${buildingId}`;
        localStorage.setItem(key, JSON.stringify({ buildingKey, profileName }));
    }

    // Lädt das aktive Profil einer Wache
    function getBuildingActiveProfile(buildingId, buildingKey) {
        try {
            const profilesData = loadProfiles(buildingKey);
            const profiles = profilesData.profiles || {};

            const raw = localStorage.getItem(
                `fm-config-building-profile-${buildingId}`
            );

            // Keine individuelle Zuordnung vorhanden
            if (!raw) {
                return profilesData.activeProfile || null;
            }

            const data = JSON.parse(raw);
            const profileName = data?.profileName;

            // Keine gültige Profilzuordnung vorhanden
            if (!profileName) {
                return profilesData.activeProfile || null;
            }

            // Profil existiert noch
            if (
                Object.prototype.hasOwnProperty.call(
                    profiles,
                    profileName
                )
            ) {
                return profileName;
            }

            // Profil wurde gelöscht -> alte Zuordnung entfernen
            localStorage.removeItem(
                `fm-config-building-profile-${buildingId}`
            );

            // Auf das aktuell aktive Profil des Gebäudetyps zurückfallen
            return profilesData.activeProfile || null;

        } catch (e) {
            console.warn(
                '[FM][Config] Fehler beim Laden des Wachenprofils:',
                buildingId,
                buildingKey,
                e
            );

            return loadProfiles(buildingKey).activeProfile || null;
        }
    }

    // Funktion für das Konfigurationsmenü
    function buildConfigGrid(vehicles, tableId, itemsPerRow = 10, buildingCaption = '') {
        if (!vehicles || vehicles.length === 0) {
            return '<div>Keine Fahrzeuge oder RCs vorhanden</div>';
        }

        vehicles = [...vehicles].sort((a, b) =>
                                      String(a.caption || '').localeCompare(String(b.caption || ''), 'de')
                                     );

        const profilesData = loadProfiles(tableId);
        const profileNames = Object.keys(profilesData.profiles || {});
        const hasProfiles = profileNames.length > 0;
        const activeProfile = profilesData.activeProfile;
        const savedConfig = getActiveProfileConfig(tableId) || [];
        const firstStart = !hasProfiles;
        const categories = {
            fahrzeuge: { title: '🚒 Fahrzeuge', items: [] },
            ab: { title: '🚛 AB-Rollcontainer', items: [] },
            anhaenger: { title: '🛻 Anhänger', items: [] },
            rc: { title: '📦 RC', items: [] }
        };

        let migratedProfileConfig = false;

        savedConfig.forEach(saved => {
            // RCs haben eigene IDs und werden hier nicht angefasst.
            if ((saved.itemType || 'vehicle') === 'equipment') return;

            const currentVehicle = vehicles.find(v =>
                                                 (v.itemType || v.type || 'vehicle') === 'vehicle' &&
                                                 v.caption &&
                                                 saved.caption &&
                                                 v.caption === saved.caption
                                                );

            if (!currentVehicle) return;

            const currentTypeId = parseInt(currentVehicle.id, 10);
            const savedTypeId = parseInt(saved.typeId, 10);

            if (
                Number.isInteger(currentTypeId) &&
                savedTypeId !== currentTypeId
            ) {

                saved.typeId = currentTypeId;
                migratedProfileConfig = true;
            }
        });

        if (migratedProfileConfig) {
            saveActiveProfileConfig(tableId, savedConfig);

        }

        function getConfigCategory(vehicle) {
            const itemType = vehicle.itemType || vehicle.type || 'vehicle';

            if (itemType === 'equipment') return 'rc';

            if (vehicle.isTrailer === true) {
                const tractiveVehicles = Array.isArray(vehicle.tractiveVehicles)
                ? vehicle.tractiveVehicles
                : [];

                return tractiveVehicles.includes(46) ? 'ab' : 'anhaenger';
            }

            return 'fahrzeuge';
        }

        vehicles.forEach(vehicle => {
            const category = getConfigCategory(vehicle);
            if (categories[category]) categories[category].items.push(vehicle);
        });

        let html = `
        <div class="fm-config-header" style="margin-bottom:5px;display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
            ${hasProfiles ? `
                <label>Profil(e):</label>
                <select class="fm-profile-select" data-table="${tableId}" style="padding:2px 4px;border:1px solid var(--spoiler-border);border-radius:4px;background:var(--spoiler-body-bg);color:var(--spoiler-body-text);">
                    ${profileNames.map(name =>
                                       `<option value="${name}" ${name === activeProfile ? 'selected' : ''}>${name}</option>`
                                      ).join('')}
                </select>
            ` : ''}
            <button class="btn btn-primary btn-xs fm-profile-saveas" data-table="${tableId}">Profil anlegen</button>
            <button class="btn btn-danger btn-xs fm-profile-delete" ${!hasProfiles ? 'disabled' : ''} data-table="${tableId}">Profil löschen</button>
            <button class="btn btn-success btn-xs fm-config-select-all" ${!hasProfiles ? 'disabled' : ''}>Alle anwählen</button>
            <button class="btn btn-danger btn-xs fm-config-deselect-all" ${!hasProfiles ? 'disabled' : ''}>Alle abwählen</button>
            <button class="btn btn-warning btn-xs fm-config-toggle" ${!hasProfiles ? 'disabled' : ''}>Abgewählte Fahrzeuge anzeigen</button>
        </div>
    `;

        if (firstStart) {
            html += `
            <div class="fm-config-hint" style="margin-bottom:8px;padding:8px;border:1px solid var(--spoiler-border);border-radius:4px;background:var(--spoiler-body-bg);font-size:12px;">
                Es wurden noch keine Profile erstellt.<br>
                Lege zuerst ein Profil an, dann erscheinen die Fahrzeuge und RCs und du kannst direkt deine Auswahl treffen. 🙂
            </div>
        `;
        }

        function buildCategorySpoiler(categoryKey) {
            const category = categories[categoryKey];
            if (!category || !category.items.length) return '';

            const spoilerId = `fm-config-category-${tableId}-${categoryKey}`;
            const isOpen = categoryKey === 'fahrzeuge';

            let categoryHtml = `
            <div class="fm-config-category-spoiler" style="border:1px solid var(--spoiler-border);border-radius:4px;margin-bottom:7px;overflow:hidden;">
                <div class="fm-config-category-header" data-category="${categoryKey}" data-category-target="${spoilerId}" style="background-color:var(--spoiler-header-bg);color:var(--spoiler-header-text);padding:8px 12px;cursor:pointer;font-weight:bold;user-select:none;display:flex;justify-content:space-between;align-items:center;">
                    <span>${category.title} <span style="font-size:11px;font-weight:normal;opacity:.7;margin-left:4px;">(${category.items.length})</span></span>
                    <span class="fm-config-category-arrow" style="font-size:12px;opacity:.7;">${isOpen ? '▼' : '▶'}</span>
                </div>
                <div id="${spoilerId}" class="fm-config-category-body" data-category="${categoryKey}" style="display:${isOpen ? 'block' : 'none'};padding:8px;background:var(--spoiler-body-bg);color:var(--spoiler-body-text);">
                    <div class="fm-config-grid" data-config-category="${categoryKey}" style="display:${hasProfiles ? 'grid' : 'none'};grid-template-columns:repeat(${itemsPerRow},minmax(120px,1fr));gap:4px 8px;width:100%;">
        `;

            category.items.forEach(vehicle => {
                const itemType = vehicle.itemType || vehicle.type || 'vehicle';

                const saved = savedConfig.find(c =>
                                               String(c.typeId) === String(vehicle.id) &&
                                               (c.itemType || 'vehicle') === itemType
                                              ) || savedConfig.find(c =>
                                                                    c.caption === vehicle.caption &&
                                                                    (c.itemType || 'vehicle') === itemType
                                                                   );

                const checked = saved ? !!saved.checked : hasProfiles;
                const display = checked ? 'flex' : 'none';
                const amount = saved ? parseInt(saved.amount, 10) || 1 : 1;
                const typeId = itemType === 'equipment'
                ? String(vehicle.id)
                : parseInt(vehicle.id, 10);

                categoryHtml += `
                <div class="fm-config-cell" data-category="${categoryKey}" style="white-space:nowrap;display:${display};flex-direction:column;gap:4px;padding:4px 6px;border:1px solid var(--spoiler-border);border-radius:4px;background:var(--spoiler-body-bg);">
                    <label style="cursor:pointer;display:flex;gap:4px;align-items:center;min-width:0;">
                        <input type="checkbox" class="fm-config-select" data-type-id="${typeId}" data-item-type="${itemType}" data-caption="${vehicle.caption}" ${checked ? 'checked' : ''}>
                        <span title="${vehicle.caption}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${vehicle.caption}</span>
                    </label>
                    <input type="number" class="fm-config-amount" value="${amount}" min="1" style="width:100%;padding:2px 4px;border:1px solid var(--spoiler-border);border-radius:3px;background:var(--spoiler-input-bg,#ffffff);color:var(--spoiler-input-text,#000000);color-scheme:light dark;">
                </div>
            `;
            });

            return categoryHtml + `
                    </div>
                </div>
            </div>
        `;
        }

        html += `
        <div class="fm-config-categories" id="fm-config-table-${tableId}" style="display:${hasProfiles ? 'block' : 'none'};width:100%;">
            ${buildCategorySpoiler('fahrzeuge')}
            ${buildCategorySpoiler('ab')}
            ${buildCategorySpoiler('anhaenger')}
            ${buildCategorySpoiler('rc')}
        </div>
    `;

        setTimeout(() => {
            const container = document.getElementById(`fm-config-table-${tableId}`);
            if (!container) return;
            const wrapper = container.parentElement;
            if (!wrapper || wrapper.dataset.eventsAttached) return;
            wrapper.dataset.eventsAttached = 'true';
            let profilesData = loadProfiles(tableId);
            let currentProfile = profilesData.activeProfile;
            let currentConfig = getActiveProfileConfig(tableId) || [];

            function getCurrentConfigFromDOM() {
                const config = [];

                wrapper.querySelectorAll('.fm-config-cell').forEach(cell => {
                    const cb = cell.querySelector('.fm-config-select');
                    const input = cell.querySelector('.fm-config-amount');

                    if (!cb) return;

                    const itemType = cb.dataset.itemType || 'vehicle';

                    config.push({
                        typeId: itemType === 'equipment'
                        ? String(cb.dataset.typeId)
                        : parseInt(cb.dataset.typeId, 10),
                        caption: cb.dataset.caption,
                        checked: cb.checked,
                        amount: parseInt(input?.value, 10) || 1,
                        itemType
                    });
                });

                return config;
            }
            function saveAndSync() {
                currentConfig = getCurrentConfigFromDOM();
                saveActiveProfileConfig(tableId, currentConfig);
                updateHeaderCount();
            }
            function updateHeaderCount() {
                let totalVehicles = 0;
                let totalEquipment = 0;

                currentConfig.forEach(entry => {
                    if (!entry.checked) return;

                    const amount = parseInt(entry.amount, 10) || 0;

                    if ((entry.itemType || 'vehicle') === 'equipment') {
                        totalEquipment += amount;
                    } else {
                        totalVehicles += amount;
                    }
                });

                const header = document.querySelector(
                    `[data-target="fm-config-body-${tableId}"]`
                );

                if (!header) return;

                profilesData = loadProfiles(tableId);
                currentProfile = profilesData.activeProfile;

                const names = Object.keys(profilesData.profiles || {});

                const profileText = names.length
                ? ` (${names.map(name =>
                                 name === currentProfile
                                 ? `<strong>${name}</strong>`
                                 : name
                                ).join(' | ')})`
                : '';

                header.innerHTML =
                    `${buildingCaption} – ${totalVehicles} Fahrzeuge` +
                    (totalEquipment ? ` – ${totalEquipment} RCs` : '') +
                    profileText;
            }
            function reRenderAndSync() {
                const openCategory =
                      wrapper.querySelector(
                          '.fm-config-category-body[style*="display: block"]'
                      )?.dataset.category || 'fahrzeuge';

                wrapper.innerHTML = buildConfigGrid(
                    vehicles,
                    tableId,
                    itemsPerRow,
                    buildingCaption
                );

                setTimeout(() => {
                    const newContainer = document.getElementById(
                        `fm-config-table-${tableId}`
                    );

                    if (!newContainer) return;

                    newContainer.querySelectorAll('.fm-config-category-body').forEach(body => {
                        const open = body.dataset.category === openCategory;
                        body.style.display = open ? 'block' : 'none';

                        const header = newContainer.querySelector(
                            `[data-category-target="${body.id}"]`
                        );

                        const arrow = header?.querySelector(
                            '.fm-config-category-arrow'
                        );

                        if (arrow) arrow.textContent = open ? '▼' : '▶';
                    });

                    profilesData = loadProfiles(tableId);
                    currentProfile = profilesData.activeProfile;
                    currentConfig = getActiveProfileConfig(tableId) || [];

                    updateHeaderCount();
                }, 0);
            }

            wrapper.addEventListener('input', e => {
                if (e.target.classList.contains('fm-config-amount')) {
                    saveAndSync();
                }
            });
            wrapper.addEventListener('change', e => {
                if (e.target.classList.contains('fm-profile-select')) {
                    profilesData = loadProfiles(tableId);

                    const selectedProfile = e.target.value;

                    if (!profilesData.profiles?.[selectedProfile]) return;

                    profilesData.activeProfile = selectedProfile;
                    saveProfiles(tableId, profilesData);

                    currentProfile = selectedProfile;
                    currentConfig = profilesData.profiles[selectedProfile] || [];

                    reRenderAndSync();
                    return;
                }
                if (e.target.classList.contains('fm-config-select')) {
                    const cell = e.target.closest('.fm-config-cell');
                    if (!cell) return;

                    cell.style.display = e.target.checked ? 'flex' : 'none';
                    saveAndSync();
                }
            });
            wrapper.addEventListener('click', e => {
                const categoryHeader = e.target.closest('.fm-config-category-header');

                if (categoryHeader) {
                    const targetId = categoryHeader.dataset.categoryTarget;
                    const clickedBody = document.getElementById(targetId);

                    if (!clickedBody) return;

                    const categoryContainer =
                          wrapper.querySelector('.fm-config-categories');

                    if (!categoryContainer) return;

                    const wasOpen = clickedBody.style.display === 'block';

                    categoryContainer
                        .querySelectorAll('.fm-config-category-body')
                        .forEach(body => {
                        body.style.display = 'none';

                        const header = categoryContainer.querySelector(
                            `[data-category-target="${body.id}"]`
                        );

                        const arrow = header?.querySelector(
                            '.fm-config-category-arrow'
                        );

                        if (arrow) arrow.textContent = '▶';
                    });

                    if (!wasOpen) {
                        clickedBody.style.display = 'block';

                        const arrow = categoryHeader.querySelector(
                            '.fm-config-category-arrow'
                        );

                        if (arrow) arrow.textContent = '▼';
                    }

                    return;
                }
                if (e.target.classList.contains('fm-profile-saveas')) {
                    const newName = prompt('Name des neuen Profils:')?.trim();

                    if (!newName) return;

                    profilesData = loadProfiles(tableId);

                    if (profilesData.profiles[newName]) {
                        alert('Profil existiert bereits.');
                        return;
                    }

                    const config = vehicles.map(v => {
                        const itemType = v.itemType || v.type || 'vehicle';
                        const isEquipment = itemType === 'equipment';

                        return {
                            typeId: isEquipment
                            ? String(v.id)
                            : parseInt(v.id, 10),
                            caption: v.caption,
                            checked: true,
                            amount: 1,
                            itemType: isEquipment ? 'equipment' : 'vehicle'
                        };
                    });

                    profilesData.profiles[newName] = config;
                    profilesData.activeProfile = newName;

                    saveProfiles(tableId, profilesData);

                    currentProfile = newName;
                    currentConfig = config;

                    reRenderAndSync();
                    return;
                }
                if (e.target.classList.contains('fm-profile-delete')) {
                    profilesData = loadProfiles(tableId);

                    const active = profilesData.activeProfile;

                    if (!active) return;
                    if (!confirm(`Profil "${active}" löschen?`)) return;

                    // Profil löschen
                    delete profilesData.profiles[active];

                    // Neues aktives Profil bestimmen
                    const remaining = Object.keys(profilesData.profiles || {});
                    profilesData.activeProfile = remaining[0] || null;

                    // Profile speichern
                    saveProfiles(tableId, profilesData);

                    // Alle Wachen-Zuordnungen zu diesem gelöschten Profil entfernen
                    const prefix = 'fm-config-building-profile-';

                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);

                        if (!key || !key.startsWith(prefix)) {
                            continue;
                        }

                        try {
                            const raw = localStorage.getItem(key);
                            if (!raw) continue;

                            const assignment = JSON.parse(raw);

                            if (
                                assignment &&
                                assignment.buildingKey === tableId &&
                                assignment.profileName === active
                            ) {
                                localStorage.removeItem(key);
                            }

                        } catch (err) {
                            console.warn(
                                '[FM][Config] Fehler beim Bereinigen der Profilzuordnung:',
                                key,
                                err
                            );
                        }
                    }

                    currentProfile = profilesData.activeProfile;
                    currentConfig = getActiveProfileConfig(tableId) || [];

                    reRenderAndSync();
                    return;
                }
                if (
                    e.target.classList.contains('fm-config-select-all') ||
                    e.target.classList.contains('fm-config-deselect-all')
                ) {
                    const selectAll =
                          e.target.classList.contains('fm-config-select-all');

                    wrapper.querySelectorAll('.fm-config-select').forEach(cb => {
                        cb.checked = selectAll;
                    });

                    wrapper.querySelectorAll('.fm-config-cell').forEach(cell => {
                        cell.style.display = selectAll ? 'flex' : 'none';
                    });

                    saveAndSync();
                    return;
                }
                if (e.target.classList.contains('fm-config-toggle')) {
                    const hidden = e.target.dataset.hidden === 'true';
                    const newState = !hidden;

                    wrapper.querySelectorAll('.fm-config-cell').forEach(cell => {
                        const cb = cell.querySelector('.fm-config-select');

                        if (cb && !cb.checked) {
                            cell.style.display = newState ? 'flex' : 'none';
                        }
                    });

                    e.target.dataset.hidden = String(newState);
                    e.target.textContent = newState
                        ? 'Abgewählte Fahrzeuge ausblenden'
                    : 'Abgewählte Fahrzeuge anzeigen';

                    return;
                }
            });
            updateHeaderCount();
        }, 0);
        return html;
    }

    // Tabelle(n) bauen
    function buildFahrzeugTable(buildings, tableId, vehicleMap, vehicleTypeMap, lssmBuildingDefs, filters = {}) {
        const filterLeitstelle = filters.leitstelle || '';
        const filterWache = filters.wache || '';

        const leitstellen = [...new Set(
            buildings.map(b => b.leitstelle_caption).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'de'));

        const wachen = [...new Set(
            buildings.map(b => b.caption).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'de'));

        let html = `
    <table class="table fm-table" id="fm-table-${tableId}">
      <thead>
        <tr>
          <th>Auswahl</th>
          <th>Leitstelle</th>
          <th>Wache</th>
          <th>Profil</th>
          <th>Fahrzeuge</th>
          <th>Freie Stellplätze</th>
          <th>Fahrzeuge / RCs auf Wache</th>
          <th>Fehlende Fahrzeuge / RCs</th>
          <th>Kaufen mit Credits</th>
          <th>Kaufen mit Coins</th>
        </tr>

        <tr class="fm-filter-row">
          <td>
            <input type="checkbox" class="fm-select-all" data-table="${tableId}">
          </td>

          <td>
            <select class="fm-filter-leitstelle" data-table="${tableId}">
              <option value="">Alle</option>
              ${leitstellen.map(n => `<option value="${n}">${n}</option>`).join('')}
            </select>
          </td>

          <td>
            <select class="fm-filter-wache" data-table="${tableId}">
              <option value="">Alle</option>
              ${wachen.map(n => `<option value="${n}">${n}</option>`).join('')}
            </select>
          </td>

          <td>
            <button class="fm-filter-reset btn btn-primary btn-xs" data-table="${tableId}">
              Filter zurücksetzen
            </button>
          </td>

          <td></td>
          <td></td>
          <td></td>

          <td style="text-align:center;">
            <button class="btn btn-info btn-xs fm-toggle-hide-no-missing"
                    data-table="${tableId}"
                    title="Blendet Wachen aus, bei denen keine Fahrzeuge oder RCs fehlen">
              Keine fehlenden
            </button>
          </td>

          <td style="text-align:center;">
            <button class="btn btn-success btn-xs fm-buy-selected-credits"
                    data-table="${tableId}">
              💳 Alle kaufen
            </button>
          </td>

          <td style="text-align:center;">
            <button class="btn btn-danger btn-xs fm-buy-selected-coins"
                    data-table="${tableId}">
              🪙 Alle kaufen
            </button>
          </td>
        </tr>
      </thead>

      <tbody>
    `;

        const sortedBuildings = buildings
        .slice()
        .sort((a, b) => a.caption.localeCompare(b.caption));

        sortedBuildings.forEach((b, idx) => {
            if (filterLeitstelle && b.leitstelle_caption !== filterLeitstelle) return;
            if (filterWache && b.caption !== filterWache) return;

            const vehiclesOnBuilding = vehicleMap[b.id] || [];

            // =========================================================
            // Fahrzeuge auf der Wache
            // =========================================================
            const typeCountMapOnBuilding = {};

            vehiclesOnBuilding.forEach(v => {
                const typeId = v.vehicle_type;
                const key = `vehicle:${typeId}`;

                const typeName =
                      vehicleTypeMap[typeId]?.caption ||
                      `Unbekannt (Typ ${typeId})`;

                if (!typeCountMapOnBuilding[key]) {
                    typeCountMapOnBuilding[key] = {
                        type: 'vehicle',
                        id: String(typeId),
                        name: typeName,
                        count: 0
                    };
                }

                typeCountMapOnBuilding[key].count++;
            });

            // =========================================================
            // RCs auf der Wache
            // =========================================================
            const buildingEquipment =
                  equipmentMapGlobal[b.id] || {};

            Object.entries(buildingEquipment).forEach(([equipmentId, count]) => {
                const equipment = getEquipmentById(equipmentId);
                if (!equipment || !count) return;

                const key = `equipment:${equipmentId}`;

                typeCountMapOnBuilding[key] = {
                    type: 'equipment',
                    id: String(equipmentId),
                    name: equipment.caption,
                    count: Number(count) || 0
                };
            });

            const vehicleNames = Object.values(typeCountMapOnBuilding)
            .map(item => {
                const displayName =
                      item.count > 1
                ? `${item.count}x ${item.name}`
                : item.name;

                if (item.type === 'equipment') {
                    return `<span style="color:brown;"
                                  title="Rollcontainer">${displayName}</span>`;
                }

                return displayName;
            })
            .join(',<wbr> ') || 'Keine Fahrzeuge / RCs auf Wache vorhanden';

            // =========================================================
            // Profil
            // =========================================================
            const configKey =
                  `${b.building_type}_${b.small_building ? 'small' : 'normal'}`;

            const profilesData = loadProfiles(configKey);
            const profileNames = Object.keys(profilesData.profiles);
            const hasProfiles = profileNames.length > 0;

            const activeProfile = hasProfiles
            ? getBuildingActiveProfile(b.id, configKey)
            : null;

            // =========================================================
            // Fehlende Fahrzeuge / RCs
            // =========================================================
            const missingData = getMissingVehiclesForBuilding(
                b,
                vehicleMap,
                vehicleTypeMap,
                lssmBuildingDefs
            );

            const buyableData = getBuyableMissingVehicles(
                b,
                vehicleMap,
                vehicleTypeMap,
                lssmBuildingDefs
            );

            // =========================================================
            // Fehlende Elemente gruppieren
            // =========================================================
            const missingGrouped = {};

            (missingData.vehiclesIds || []).forEach(id => {
                const key = String(id);
                missingGrouped[key] = (missingGrouped[key] || 0) + 1;
            });

            const coloredMissingNames = Object.entries(missingGrouped)
            .map(([id, count]) => {

                // =================================================
                // RC / Rollcontainer
                // =================================================
                if (id.startsWith('equipment:')) {
                    const equipmentId =
                          id.substring('equipment:'.length);

                    const equipment =
                          getEquipmentById(equipmentId);

                    if (!equipment) {
                        return `Unbekannter RC (${equipmentId})`;
                    }

                    const displayName =
                          count > 1
                    ? `${count}x ${equipment.caption}`
                    : equipment.caption;

                    const storageTotal =
                          Number(b.storage_total || 0);

                    const storageUpgrade =
                          Array.isArray(b.storage_upgrades)
                    ? b.storage_upgrades.find(
                        u => u.upgrade_type === 'Lagerraum'
                    )
                    : null;

                    // ---------------------------------------------
                    // Lager vorhanden
                    // ---------------------------------------------
                    if (storageTotal > 0) {
                        return displayName;
                    }

                    // ---------------------------------------------
                    // Lagererweiterung im Bau
                    // ---------------------------------------------
                    if (
                        storageUpgrade &&
                        storageUpgrade.available === false &&
                        storageUpgrade.available_at
                    ) {
                        return `<span style="color:orange;font-weight:bold;"
                   title="Lager im Bau">${displayName}</span>`;
                    }

                    // ---------------------------------------------
                    // Lager fehlt
                    // ---------------------------------------------
                    return `<span style="color:red;font-weight:bold;"
                                   title="Lager fehlt">${displayName}</span>`;
                }

                // =================================================
                // Fahrzeug / AB / Anhänger
                // =================================================
                const typeId = parseInt(id, 10);

                const status = getExtensionStatusForVehicle(
                    b,
                    typeId,
                    lssmBuildingDefs
                );

                const name =
                      vehicleTypeMap[typeId]?.caption ||
                      `Unbekannt (Typ ${id})`;

                const displayName =
                      count > 1
                ? `${count}x ${name}`
                : name;

                switch (status) {
                    case 'locked':
                    case 'missing':
                        return `<span style="color:red;font-weight:bold;"
                                       title="Erweiterung fehlt">${displayName}</span>`;

                    case 'in_progress':
                        return `<span style="color:orange;font-weight:bold;"
                                       title="Erweiterung im Bau">${displayName}</span>`;

                    default:
                        return displayName;
                }
            })
            .join(',<wbr>&nbsp;') || missingData.names;

            const missingVehiclesJson =
                  JSON.stringify(missingData.vehiclesIds || []);

            // =========================================================
            // Stellplätze
            // RCs zählen NICHT als Fahrzeug-Stellplätze
            // =========================================================
            const maxVehicles =
                  calcMaxParkingLots(b, lssmBuildingDefs);

            const freieStellplaetze =
                  Math.max(
                      maxVehicles - vehiclesOnBuilding.length,
                      0
                  );

            // =========================================================
            // Profil-Zelle
            // =========================================================
            const profileCell = hasProfiles
            ? `<select class="fm-building-profile"
                       data-building-id="${b.id}"
                       data-config-key="${configKey}"
                       style="padding:2px 4px;
                              border:1px solid var(--spoiler-border);
                              border-radius:4px;
                              background:var(--spoiler-body-bg);
                              color:var(--spoiler-body-text);
                              width:100%;">
          ${profileNames
            .map(p => `
              <option value="${p}" ${p === activeProfile ? 'selected' : ''}>
                ${p}
              </option>
            `)
            .join('')}
        </select>`
            : `<span style="color:var(--text-color-secondary,#999);
                             font-style:italic;">
                 – kein Profil –
               </span>`;

            // =========================================================
            // Tabellenzeile
            // =========================================================
            html += `
      <tr data-building-id="${b.id}"
          data-config-key="${configKey}"
          data-missing-vehicle-ids='${missingVehiclesJson}'>

        <td>
          <input type="checkbox"
                 class="fm-select"
                 id="fm-select-${tableId}-${idx}"
                 data-credits="${buyableData.totalCredits}"
                 data-coins="${buyableData.totalCoins}">
        </td>

        <td>${b.leitstelle_caption ?? '-'}</td>

        <td>${buildBuildingLink(b)}</td>

        <td>${profileCell}</td>

        <td>${b.vehicle_count ?? 0}</td>

        <td>
          <span class="badge fm-badge-green">
            ${freieStellplaetze}
          </span>
        </td>

        <td>
          <span class="fm-vehicle-list">
            ${vehicleNames}
          </span>
        </td>

        <td>
          <span class="fm-vehicle-list">
            ${coloredMissingNames}
          </span>
        </td>

        <td>
          <button class="btn btn-success btn-xs fm-buy-credit"
            ${
            buyableData.totalCredits === 0
                ? 'disabled title="Keine kaufbaren Fahrzeuge oder RCs"'
            : buyableData.totalCredits > currentCredits
                ? 'disabled title="Nicht genug Credits"'
            : ''
        }>
            ${buyableData.totalCredits.toLocaleString()} Credits
          </button>
        </td>

        <td>
          <button class="btn btn-danger btn-xs fm-buy-coin"
            ${
            buyableData.totalCoins === 0
                ? 'disabled title="Keine kaufbaren Fahrzeuge oder RCs"'
            : buyableData.totalCoins > currentCoins
                ? 'disabled title="Nicht genug Coins"'
            : ''
        }>
            ${buyableData.totalCoins.toLocaleString()} Coins
          </button>
        </td>

      </tr>
    `;
        });

        html += '</tbody></table>';

        setTimeout(
            () => setupTableEventListeners(
                tableId,
                buildings,
                vehicleMap,
                vehicleTypeMap,
                lssmBuildingDefs
            ),
            0
        );

        return html;
    }

    // Funktion für alle Event-Listener
    function setupTableEventListeners(tableId, buildings, vehicleMap, vehicleTypeMap, lssmBuildingDefs) {
        const table = document.getElementById(`fm-table-${tableId}`);
        if (!table) return;

        const storageKey = `fm-hide-no-missing-${tableId}`;
        let hideNoMissing = localStorage.getItem(storageKey) === 'true';

        // --- Profilwechsel ---
        table.querySelectorAll('.fm-building-profile').forEach(sel => {
            sel.addEventListener('change', e => {
                const buildingId = e.target.dataset.buildingId;
                const configKey = e.target.dataset.configKey;
                const selectedProfile = e.target.value;

                setBuildingActiveProfile(
                    buildingId,
                    configKey,
                    selectedProfile
                );

                const selectedBuildings = new Set(
                    Array.from(
                        table.querySelectorAll('.fm-select:checked')
                    ).map(
                        cb => cb.closest('tr')?.dataset.buildingId
                    )
                );

                const masterChecked =
                      table.querySelector('.fm-select-all')?.checked || false;

                const container = table.parentElement;
                container.style.visibility = 'hidden';

                const filterLeitstelle =
                      table.querySelector('.fm-filter-leitstelle')?.value || '';

                const filterWache =
                      table.querySelector('.fm-filter-wache')?.value || '';

                container.innerHTML = buildFahrzeugTable(
                    buildings,
                    tableId,
                    vehicleMap,
                    vehicleTypeMap,
                    lssmBuildingDefs,
                    {
                        leitstelle: filterLeitstelle,
                        wache: filterWache
                    }
                );

                const newTable =
                      document.getElementById(`fm-table-${tableId}`);

                if (newTable) {
                    const leitstelleSelect =
                          newTable.querySelector('.fm-filter-leitstelle');

                    const wacheSelect =
                          newTable.querySelector('.fm-filter-wache');

                    if (leitstelleSelect) {
                        leitstelleSelect.value = filterLeitstelle;
                    }

                    if (wacheSelect) {
                        wacheSelect.value = filterWache;
                    }

                    newTable.querySelectorAll('tbody tr').forEach(row => {
                        const id = row.dataset.buildingId;

                        if (selectedBuildings.has(id)) {
                            const cb = row.querySelector('.fm-select');
                            if (cb) cb.checked = true;
                        }
                    });

                    const master =
                          newTable.querySelector('.fm-select-all');

                    if (master) {
                        master.checked = masterChecked;
                    }

                    updateBuyButtons(newTable);
                }

                container.style.visibility = 'visible';
            });
        });

        // --- Toggle "Keine fehlenden" ---
        const toggleBtn =
              table.querySelector(
                  `.fm-toggle-hide-no-missing[data-table="${tableId}"]`
              );

        if (toggleBtn) {
            toggleBtn.classList.toggle(
                'active',
                hideNoMissing
            );

            toggleBtn.textContent =
                hideNoMissing
                ? 'Alle anzeigen'
            : '"Keine" ausblenden';

            toggleBtn.addEventListener('click', () => {
                hideNoMissing = !hideNoMissing;

                localStorage.setItem(
                    storageKey,
                    hideNoMissing ? 'true' : 'false'
                );

                toggleBtn.classList.toggle(
                    'active',
                    hideNoMissing
                );

                toggleBtn.textContent =
                    hideNoMissing
                    ? 'Alle anzeigen'
                : '"Keine" ausblenden';

                applyRowFilter();
            });
        }

        // --- Filterfunktion ---
        function applyRowFilter() {
            const filterLeitstelle =
                  table.querySelector(
                      '.fm-filter-leitstelle'
                  )?.value || '';

            const filterWache =
                  table.querySelector(
                      '.fm-filter-wache'
                  )?.value || '';

            table.querySelectorAll('tbody tr').forEach(row => {
                const rowLeitstelle =
                      row.children[1]?.textContent.trim();

                const rowWache =
                      row.children[2]?.textContent.trim();

                const missingText =
                      row.children[7]?.innerText.trim() || '';

                let visible = true;

                if (
                    filterLeitstelle &&
                    rowLeitstelle !== filterLeitstelle
                ) {
                    visible = false;
                }

                if (
                    filterWache &&
                    rowWache !== filterWache
                ) {
                    visible = false;
                }

                if (
                    hideNoMissing &&
                    missingText === 'Keine'
                ) {
                    visible = false;
                }

                row.style.display =
                    visible ? '' : 'none';

                if (!visible) {
                    const cb =
                          row.querySelector('.fm-select');

                    if (cb) cb.checked = false;
                }
            });

            updateBuyButtons(table);
        }

        // --- Checkboxen ---
        table.addEventListener('change', e => {
            if (
                e.target.classList.contains('fm-select') ||
                e.target.classList.contains('fm-select-all')
            ) {
                updateBuyButtons(table);
            }
        });

        // --- Mastercheckbox ---
        table.querySelector('.fm-select-all')
            ?.addEventListener('change', e => {
            const checked = e.target.checked;

            const visibleCheckboxes =
                  [...table.querySelectorAll('tbody .fm-select')]
            .filter(
                cb =>
                cb.closest('tr')?.offsetParent !== null
            );

            visibleCheckboxes.forEach(cb => {
                cb.checked = checked;
            });

            updateBuyButtons(table);
        });

        // --- Filter Leitstelle ---
        table.querySelector(
            '.fm-filter-leitstelle'
        )?.addEventListener(
            'change',
            applyRowFilter
        );

        // --- Filter Wache ---
        table.querySelector(
            '.fm-filter-wache'
        )?.addEventListener(
            'change',
            applyRowFilter
        );

        // --- Filter zurücksetzen ---
        table.querySelector(
            '.fm-filter-reset'
        )?.addEventListener('click', () => {
            const container = table.parentElement;

            container.innerHTML = buildFahrzeugTable(
                buildings,
                tableId,
                vehicleMap,
                vehicleTypeMap,
                lssmBuildingDefs,
                {
                    leitstelle: '',
                    wache: ''
                }
            );
        });

        // --- initial anwenden ---
        applyRowFilter();
    }

    // Gibt die tatsächlich kaufbaren Fahrzeuge und RCs zurück
    function getBuyableMissingVehicles(building, vehicleMap, vehicleTypeMap, lssmBuildingDefs) {
        const vehiclesOnBuilding = vehicleMap[building.id] || [];
        const istByType = {};

        vehiclesOnBuilding.forEach(v => {
            const tid = String(v.vehicle_type);
            istByType[tid] = (istByType[tid] || 0) + 1;
        });

        const buildingKey =
              `${building.building_type}_${building.small_building ? 'small' : 'normal'}`;

        const activeProfile =
              getBuildingActiveProfile(building.id, buildingKey);

        const profilesData = loadProfiles(buildingKey);
        const config = profilesData.profiles[activeProfile] || [];
        console.log(
            '[FM][Config-Test]',
            {
                buildingId: building.id,
                building: building.caption,
                buildingKey,
                activeProfile,
                configExists: !!profilesData.profiles[activeProfile],
                configLength: config.length,
                checked: config.filter(c => c.checked).length,
                config: config
            }
        );

        let totalCredits = 0;
        let totalCoins = 0;

        const missingVehicleIds = [];

        // Für RCs:
        const storage = getBuildingStorageInfo(building);
        let remainingStorage = storage.free;

        config.forEach(c => {
            if (!c.checked) return;

            const itemType = c.itemType || c.type || 'vehicle';
            const requestedAmount = parseInt(c.amount, 10) || 1;
            if (itemType === 'equipment') {
                const equipmentTypeId = String(c.typeId);
                const ist =
                      equipmentMapGlobal[building.id]?.[equipmentTypeId] || 0;

                const missingAmount =
                      Math.max(requestedAmount - ist, 0);

                if (missingAmount <= 0) return;

                const equipment =
                      getEquipmentById(equipmentTypeId);

                if (!equipment) return;

                const size =
                      Number(equipment.size || 0);

                /*
             * Ohne Lager können keine RCs gekauft werden.
             */
                if (!storage.hasStorage || !storage.available || size <= 0) {
                    return;
                }

                /*
             * Ermitteln, wie viele der fehlenden RCs
             * tatsächlich noch ins Lager passen.
             */
                const maxBuyable =
                      Math.min(
                          missingAmount,
                          Math.floor(remainingStorage / size)
                      );

                if (maxBuyable <= 0) return;

                totalCredits +=
                    Number(equipment.credits || 0) * maxBuyable;

                totalCoins +=
                    Number(equipment.coins || 0) * maxBuyable;

                remainingStorage -= maxBuyable * size;

                for (let i = 0; i < maxBuyable; i++) {
                    missingVehicleIds.push(
                        `equipment:${equipmentTypeId}`
                    );
                }

                return;
            }

            let typeId =
                c.typeId != null
            ? String(c.typeId)
            : null;

            if (!typeId) {
                const vtEntry =
                      Object.entries(vehicleTypeMap).find(
                          ([id, v]) =>
                          (v.caption || '').trim() ===
                          (c.caption || '').trim()
                      );

                if (vtEntry) {
                    typeId = String(vtEntry[0]);
                }
            }

            if (!typeId) return;

            const ist = istByType[typeId] || 0;

            const diff =
                  Math.max(requestedAmount - ist, 0);

            if (diff <= 0) return;

            const status =
                  getExtensionStatusForVehicle(
                      building,
                      parseInt(typeId, 10),
                      lssmBuildingDefs
                  );

            if (status !== 'ok' && status !== null) return;

            const vt = vehicleTypeMap[typeId];

            if (vt) {
                totalCredits +=
                    Number(vt.credits || 0) * diff;

                totalCoins +=
                    Number(vt.coins || 0) * diff;
            }

            for (let i = 0; i < diff; i++) {
                missingVehicleIds.push(
                    parseInt(typeId, 10)
                );
            }
        });

        return {
            totalCredits,
            totalCoins,
            vehiclesIds: missingVehicleIds
        };
    }

    // Ermittelt, welche Fahrzeuge und RCs einer Wache fehlen
    function getMissingVehiclesForBuilding(building, vehicleMap, vehicleTypeMap, lssmBuildingDefs) {
        const vehiclesOnBuilding = vehicleMap[building.id] || [];
        const istByType = {};

        vehiclesOnBuilding.forEach(v => {
            const tid = String(v.vehicle_type);
            istByType[tid] = (istByType[tid] || 0) + 1;
        });

        const buildingKey = `${building.building_type}_${building.small_building ? 'small' : 'normal'}`;
        const activeProfile = getBuildingActiveProfile(building.id, buildingKey);
        const profilesData = loadProfiles(buildingKey);
        const config = profilesData.profiles[activeProfile] || [];
        console.log(
            '[FM][Config-Test]',
            {
                buildingId: building.id,
                building: building.caption,
                buildingKey,
                activeProfile,
                configExists: !!profilesData.profiles[activeProfile],
                configLength: config.length,
                checked: config.filter(c => c.checked).length,
                config: config
            }
        );

        const missing = [];
        const missingVehicleIds = [];
        let totalCredits = 0;
        let totalCoins = 0;

        config.forEach(c => {
            if (!c.checked) return;

            const itemType = c.itemType || c.type || 'vehicle';
            const requestedAmount = parseInt(c.amount, 10) || 1;

            // RC / Equipment
            if (itemType === 'equipment') {
                const equipmentTypeId = String(c.typeId);
                const ist = equipmentMapGlobal[building.id]?.[equipmentTypeId] || 0;
                const diff = Math.max(requestedAmount - ist, 0);

                if (diff <= 0) return;

                const equipment = getEquipmentById(equipmentTypeId);
                if (!equipment) return;

                for (let i = 0; i < diff; i++) {
                    missingVehicleIds.push(`equipment:${equipmentTypeId}`);
                }

                missing.push(
                    diff > 1
                    ? `${diff}x ${equipment.caption}`
                    : equipment.caption
                );

                totalCredits += (equipment.credits || 0) * diff;
                totalCoins += (equipment.coins || 0) * diff;

                return;
            }

            // Fahrzeug / AB / Anhänger
            let typeId = c.typeId != null ? String(c.typeId) : null;

            if (!typeId) {
                const vtEntry = Object.entries(vehicleTypeMap).find(
                    ([id, v]) =>
                    (v.caption || '').trim() ===
                    (c.caption || '').trim()
                );

                if (vtEntry) typeId = String(vtEntry[0]);
            }

            if (!typeId) return;

            const ist = istByType[typeId] || 0;
            const diff = Math.max(requestedAmount - ist, 0);

            if (diff <= 0) return;

            const vt = vehicleTypeMap[typeId];

            // IMMER anzeigen – unabhängig vom Erweiterungsstatus
            for (let i = 0; i < diff; i++) {
                missingVehicleIds.push(parseInt(typeId, 10));
            }

            missing.push(
                diff > 1
                ? `${diff}x ${c.caption}`
                : c.caption
            );

            // Kosten ebenfalls nur anhand des Fahrzeugs berechnen.
            // Ob es tatsächlich kaufbar ist, entscheidet später
            // getBuyableMissingVehicles().
            if (vt) {
                totalCredits += (vt.credits || 0) * diff;
                totalCoins += (vt.coins || 0) * diff;
            }
        });

        return {
            names: missing.join(',<wbr> ') || 'Keine',
            totalCredits,
            totalCoins,
            vehiclesIds: missingVehicleIds
        };
    }

    // Funktion zum füllen der Kaufprotokolltabelle
    function showPurchaseLog() {
        const content = document.getElementById('fahrzeug-log-content');
        let log = [];
        try { log = JSON.parse(localStorage.getItem('fm-purchase-log')) || []; } catch {}

        if (log.length === 0) {
            content.innerHTML = '<div class="alert alert-info">Keine Käufe protokolliert.</div>';
            return;
        }

        let html = '<table class="table table-striped"><thead><tr><th>Zeitpunkt</th><th>Wache</th><th>Fahrzeug</th><th>Preis</th><th>Währung</th></tr></thead><tbody>';
        log.slice().reverse().forEach(entry => {
            const dateStr = new Date(entry.time).toLocaleString();
            html += `<tr>
            <td>${dateStr}</td>
            <td>${entry.buildingName}</td>
            <td>${entry.vehicleName}</td>
            <td>${entry.price.toLocaleString()}</td>
            <td>${entry.currency}</td>
        </tr>`;
        });
        html += '</tbody></table>';
        content.innerHTML = html;
    }

    // Aktuelle Credits/Coins holen und aktualisieren
    async function updateUserResources(){
        try {
            const res = await fetch('/api/userinfo');
            const data = await res.json();
            currentCredits = data.credits_user_current || 0;
            currentCoins = data.coins_user_current || 0;

            document.getElementById('fm-credits').textContent = currentCredits.toLocaleString();
            document.getElementById('fm-coins').textContent = currentCoins.toLocaleString();

            // Buttons nachführen
            updateBuyButtons();
        } catch(e) {
            console.warn(e);
        }
    }

    // Kauffunktion für die Fahrzeuge
    async function buyVehicles(rows, currency, confirmBeforeBuy = true, controller = null, progressText = null, progressBar = null, spinner = null, cancelBtn = null) {
        if (!rows || rows.length === 0) return;
        if (!controller) controller = new AbortController();

        let cancelRequested = false;

        // Buttons sperren
        const setAllButtonsDisabled = (disabled, excludeBtn = null) => {
            document.querySelectorAll('button').forEach(btn => {
                if (btn !== excludeBtn) btn.disabled = disabled;
            });
        };

        // Progressbar
        const container = document.getElementById('fm-progress-container');
        const isDynamicUI =
              !progressText ||
              !progressBar ||
              !spinner ||
              !cancelBtn;

        if (isDynamicUI) {
            if (!container) return;

            container.style.display = 'block';
            container.style.padding = '8px';
            container.style.border = '1px solid #444';
            container.style.borderRadius = '6px';
            container.style.background = 'rgba(0,0,0,0.1)';
            container.style.opacity = '1';

            container.innerHTML = `
            <div style="margin-bottom:6px;">
                <span id="fm-spinner">⏳</span>
                <span id="fm-progress-text">Kauf gestartet...</span>
            </div>

            <div style="width:100%;background:#333;height:12px;border-radius:4px;overflow:hidden;margin-bottom:6px;">
                <div id="fm-progress-bar"
                     style="width:0%;height:100%;background:#4caf50;"></div>
            </div>

            <div style="text-align:right;">
                <button id="fm-cancel-btn"
                        class="btn btn-warning btn-xs">
                    ⛔ Abbrechen
                </button>
            </div>
        `;

            await new Promise(r => setTimeout(r, 0));

            progressText =
                document.getElementById('fm-progress-text');

            progressBar =
                document.getElementById('fm-progress-bar');

            spinner =
                document.getElementById('fm-spinner');

            cancelBtn =
                document.getElementById('fm-cancel-btn');
        }

        // Abbrechen
        cancelBtn.onclick = () => {
            cancelRequested = true;
            controller.abort();

            cancelBtn.disabled = true;
            cancelBtn.textContent = 'Wird abgebrochen...';

            if (spinner) {
                spinner.textContent = '⛔';
            }
        };

        setAllButtonsDisabled(true, cancelBtn);

        try {
            /*
         * =========================================================
         * KAUFPLAN ERSTELLEN
         * =========================================================
         */

            const buyPlanMap = {};
            let totalWanted = 0;

            rows.forEach(row => {
                const items =
                      JSON.parse(
                          row.dataset.missingVehicleIds || '[]'
                      );

                const buildingId =
                      Number(row.dataset.buildingId);

                items.forEach(item => {
                    const itemString = String(item);

                    const itemType =
                          itemString.startsWith('equipment:')
                    ? 'equipment'
                    : 'vehicle';

                    const itemId =
                          itemType === 'equipment'
                    ? itemString.substring(
                        'equipment:'.length
                    )
                    : Number(itemString);

                    const key =
                          `${buildingId}-${itemType}-${itemId}`;

                    if (!buyPlanMap[key]) {
                        buyPlanMap[key] = {
                            buildingId,
                            itemType,
                            itemId,
                            wanted: 0
                        };
                    }

                    buyPlanMap[key].wanted++;
                    totalWanted++;
                });
            });

            if (totalWanted === 0) {
                if (progressText) {
                    progressText.textContent =
                        'Keine fehlenden Fahrzeuge oder RCs vorhanden.';
                }

                if (spinner) {
                    spinner.textContent = 'ℹ️';
                }

                return;
            }

            /*
         * =========================================================
         * AKTUELLE FAHRZEUGE LADEN
         * =========================================================
         */

            let freshVehiclesData = [];

            try {
                const res = await fetch(
                    '/api/vehicles',
                    { signal: controller.signal }
                );

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                freshVehiclesData = await res.json();

            } catch (e) {
                if (e.name === 'AbortError') {
                    cancelRequested = true;
                    return;
                }

                console.error(
                    '[FM] Fehler beim Nachladen der Fahrzeugliste:',
                    e
                );

                alert(
                    'Fehler beim Nachladen der aktuellen Fahrzeugliste. Kauf abgebrochen.'
                );

                return;
            }

            const freshVehicleMap = {};

            freshVehiclesData.forEach(v => {
                const buildingId =
                      Number(v.building_id);

                if (!freshVehicleMap[buildingId]) {
                    freshVehicleMap[buildingId] = [];
                }

                freshVehicleMap[buildingId].push(v);
            });

            /*
         * =========================================================
         * KAUFLISTE ERSTELLEN
         * =========================================================
         */

            const requestsByBuilding = {};

            Object.values(buyPlanMap).forEach(request => {
                const buildingId =
                      Number(request.buildingId);

                if (!requestsByBuilding[buildingId]) {
                    requestsByBuilding[buildingId] = [];
                }

                requestsByBuilding[buildingId].push(request);
            });

            const filteredBuyList = [];

            let wantedVehicles = 0;
            let actualVehiclesToBuy = 0;

            let wantedEquipment = 0;
            let actualEquipmentToBuy = 0;

            let blockedByParking = 0;
            let blockedByStorage = 0;
            let blockedByNoStorage = 0;

            /*
         * =========================================================
         * JEDE WACHE PRÜFEN
         * =========================================================
         */

            Object.entries(requestsByBuilding).forEach(
                ([buildingIdString, requests]) => {

                    const buildingId =
                          Number(buildingIdString);

                    const buildingObj =
                          (buildingDataGlobal || []).find(
                              b => Number(b.id) === buildingId
                          );

                    /*
                 * -------------------------------------------------
                 * FAHRZEUG-STELLPLÄTZE
                 * -------------------------------------------------
                 */

                    let freeSlots = Infinity;

                    if (buildingObj) {
                        try {
                            const max =
                                  calcMaxParkingLots(
                                      buildingObj,
                                      lssmBuildingDefsGlobal
                                  );

                            const current =
                                  (
                                      freshVehicleMap[buildingId] || []
                                  ).length;

                            freeSlots =
                                Math.max(
                                max - current,
                                0
                            );

                        } catch {
                            freeSlots = 0;
                        }
                    }

                    /*
                 * -------------------------------------------------
                 * LAGERPLATZ
                 * -------------------------------------------------
                 */

                    const storage =
                          getBuildingStorageInfo(
                              buildingObj
                          );

                    let remainingStorage =
                        storage.free;

                    /*
                 * -------------------------------------------------
                 * REQUESTS DIESER WACHE
                 * -------------------------------------------------
                 */

                    requests.forEach(request => {
                        const {
                            itemType,
                            itemId,
                            wanted
                        } = request;

                        /*
                     * =================================================
                     * RC / EQUIPMENT
                     * =================================================
                     */

                        if (itemType === 'equipment') {
                            wantedEquipment += wanted;

                            const equipment =
                                  getEquipmentById(itemId);

                            if (!equipment) {
                                console.warn(
                                    '[FM] RC-Daten nicht gefunden:',
                                    itemId
                                );

                                blockedByStorage += wanted;
                                return;
                            }

                            const size =
                                  Number(
                                      equipment.size || 0
                                  );

                            /*
                         * Ohne Lager können keine RCs gekauft werden.
                         */
                            if (
                                !storage.hasStorage ||
                                size <= 0
                            ) {
                                blockedByNoStorage += wanted;
                                return;
                            }

                            /*
                         * Lager existiert, hat aber keinen freien Platz.
                         */
                            if (
                                remainingStorage <= 0
                            ) {
                                blockedByStorage += wanted;
                                return;
                            }

                            /*
                         * Wie viele Stück passen noch ins Lager?
                         */
                            const maxBuyable =
                                  Math.min(
                                      wanted,
                                      Math.floor(
                                          remainingStorage / size
                                      )
                                  );

                            if (maxBuyable <= 0) {
                                blockedByStorage += wanted;
                                return;
                            }

                            /*
                         * Kaufbare RCs hinzufügen.
                         */
                            for (
                                let i = 0;
                                i < maxBuyable;
                                i++
                            ) {
                                filteredBuyList.push({
                                    buildingId,
                                    itemType: 'equipment',
                                    itemId: String(itemId)
                                });
                            }

                            actualEquipmentToBuy +=
                                maxBuyable;

                            /*
                         * Lagerplatz reduzieren.
                         */
                            remainingStorage -=
                                maxBuyable * size;

                            /*
                         * Nicht kaufbare Restmenge merken.
                         */
                            if (
                                maxBuyable < wanted
                            ) {
                                blockedByStorage +=
                                    wanted - maxBuyable;
                            }

                            return;
                        }

                        /*
                     * =================================================
                     * FAHRZEUG / AB / ANHÄNGER
                     * =================================================
                     */

                        wantedVehicles += wanted;

                        const toBuy =
                              Math.min(
                                  wanted,
                                  freeSlots
                              );

                        for (
                            let i = 0;
                            i < toBuy;
                            i++
                        ) {
                            filteredBuyList.push({
                                buildingId,
                                itemType: 'vehicle',
                                itemId: Number(itemId)
                            });
                        }

                        actualVehiclesToBuy +=
                            toBuy;

                        const blocked =
                              wanted - toBuy;

                        if (blocked > 0) {
                            blockedByParking += blocked;
                        }

                        freeSlots -= toBuy;
                    });
                }
            );

            const actualToBuy =
                  filteredBuyList.length;

            if (actualToBuy === 0) {
                let message =
                    'Es kann nichts gekauft werden.\n\n';

                if (blockedByParking > 0) {
                    message +=
                        `${blockedByParking} Fahrzeug(e) ` +
                        `haben keinen freien Stellplatz.\n`;
                }

                if (blockedByNoStorage > 0) {
                    message +=
                        `${blockedByNoStorage} RC(s) ` +
                        `können nicht gekauft werden, ` +
                        `weil kein nutzbares Lager vorhanden ist.\n`;
                }

                if (blockedByStorage > 0) {
                    message +=
                        `${blockedByStorage} RC(s) ` +
                        `passen nicht mehr in das vorhandene Lager.\n`;
                }

                alert(message);

                if (progressText) {
                    progressText.textContent =
                        'Keine kaufbaren Fahrzeuge oder RCs.';
                }

                if (spinner) {
                    spinner.textContent = 'ℹ️';
                }

                return;
            }

            const warnings = [];

            if (blockedByParking > 0) {
                warnings.push(
                    `${blockedByParking} Fahrzeug(e) ` +
                    `können wegen fehlender Stellplätze nicht gekauft werden.`
                );
            }

            if (
                blockedByNoStorage > 0
            ) {
                warnings.push(
                    `${blockedByNoStorage} RC(s) können nicht gekauft werden, ` +
                    `weil kein nutzbares Lager vorhanden ist.`
                );
            }

            if (
                blockedByStorage > 0
            ) {
                warnings.push(
                    `${blockedByStorage} RC(s) können wegen fehlendem Lagerplatz nicht gekauft werden.`
                );
            }

            if (
                warnings.length > 0 &&
                confirmBeforeBuy
            ) {
                const proceed =
                      confirm(
                          warnings.join('\n') +
                          '\n\n' +
                          'Die kaufbaren Fahrzeuge und RCs trotzdem kaufen?'
                      );

                if (!proceed) {
                    return;
                }
            }

            let totalCost = 0;

            filteredBuyList.forEach(item => {
                let itemData;

                if (item.itemType === 'equipment') {
                    itemData =
                        getEquipmentById(
                        item.itemId
                    );
                } else {
                    itemData =
                        vehicleTypeMapGlobal[
                        item.itemId
                    ];
                }

                if (!itemData) {
                    console.warn(
                        '[FM] Keine Daten für Kaufobjekt gefunden:',
                        item
                    );

                    return;
                }

                totalCost +=
                    currency === 'credits'
                    ? Number(
                    itemData.credits || 0
                )
                : Number(
                    itemData.coins || 0
                );
            });

            const available =
                  currency === 'credits'
            ? currentCredits
            : currentCoins;

            if (totalCost > available) {
                alert(
                    `Nicht genug ${currency === 'credits' ? 'Credits' : 'Coins'}!\n\n` +
                    `Benötigt: ${totalCost.toLocaleString()}\n` +
                    `Vorhanden: ${available.toLocaleString()}`
                );

                return;
            }

            if (confirmBeforeBuy) {
                const vehicleCount =
                      filteredBuyList.filter(
                          x => x.itemType === 'vehicle'
                      ).length;

                const equipmentCount =
                      filteredBuyList.filter(
                          x => x.itemType === 'equipment'
                      ).length;

                const parts = [];

                if (vehicleCount > 0) {
                    parts.push(
                        `${vehicleCount} Fahrzeug` +
                        `${vehicleCount === 1 ? '' : 'e'}`
                    );
                }

                if (equipmentCount > 0) {
                    parts.push(
                        `${equipmentCount} RC` +
                        `${equipmentCount === 1 ? '' : 's'}`
                    );
                }

                const proceed =
                      confirm(
                          `Möchtest du wirklich ${parts.join(' und ')} für ` +
                          `${totalCost.toLocaleString()} ` +
                          `${currency === 'credits' ? 'Credits' : 'Coins'} kaufen?`
                      );

                if (!proceed) return;
            }

            let boughtCount = 0;

            for (
                let i = 0;
                i < filteredBuyList.length;
                i++
            ) {
                if (cancelRequested) break;

                const item =
                      filteredBuyList[i];

                const {
                    buildingId,
                    itemType,
                    itemId
                } = item;

                let itemData;

                if (itemType === 'equipment') {
                    itemData =
                        getEquipmentById(itemId);
                } else {
                    itemData =
                        vehicleTypeMapGlobal[itemId];
                }

                if (!itemData) {
                    console.warn(
                        '[FM] Kaufobjekt nicht gefunden:',
                        item
                    );

                    continue;
                }

                const url = itemType === 'equipment'
                ? `/buildings/${buildingId}/equipment/${itemId}/${currency}?return_tab=rolling_containers`
                : `/buildings/${buildingId}/vehicle/${buildingId}/${itemId}/${currency}?building=${buildingId}`;

                try {
                    const res =
                          await fetch(
                              url,
                              {
                                  signal:
                                  controller.signal
                              }
                          );

                    if (res.ok) {
                        boughtCount++;

                        let purchaseLog = [];

                        try {
                            purchaseLog =
                                JSON.parse(
                                localStorage.getItem(
                                    'fm-purchase-log'
                                )
                            ) || [];
                        } catch {}

                        const buildingObj =
                              (buildingDataGlobal || []).find(
                                  b =>
                                  Number(b.id) ===
                                  Number(buildingId)
                              );

                        purchaseLog.push({
                            time: Date.now(),
                            buildingId,
                            buildingName:
                            buildingObj?.caption ||
                            `Wache ${buildingId}`,
                            itemType,
                            itemId,

                            vehicleName:
                            itemData.caption ||
                            (
                                itemType === 'equipment'
                                ? `Equipment ${itemId}`
                                : `Fahrzeug ${itemId}`
                            ),

                            price:
                            currency === 'credits'
                            ? Number(
                                itemData.credits || 0
                            )
                            : Number(
                                itemData.coins || 0
                            ),

                            currency:
                            currency === 'credits'
                            ? 'Credits'
                            : 'Coins'
                        });

                        localStorage.setItem(
                            'fm-purchase-log',
                            JSON.stringify(
                                purchaseLog
                            )
                        );
                    }

                } catch (err) {
                    if (
                        err.name === 'AbortError'
                    ) {
                        cancelRequested = true;
                        break;
                    }

                    console.error(
                        `[Kauf] Fehler ${itemType} ${itemId} Wache ${buildingId}:`,
                        err
                    );
                }

                if (
                    progressText &&
                    progressBar
                ) {
                    progressText.textContent =
                        `${i + 1} / ${filteredBuyList.length} verarbeitet`;

                    progressBar.style.width =
                        `${Math.round(
                        ((i + 1) /
                         filteredBuyList.length) *
                        100
                    )}%`;
                }

                if (
                    confirmBeforeBuy &&
                    !cancelRequested
                ) {
                    await new Promise(
                        r => setTimeout(r, 500)
                    );
                }
            }

            if (cancelRequested) {
                if (progressText && spinner) {
                    progressText.textContent = `Der Kauf wurde abgebrochen. ` + `Es wurden ${boughtCount} Käufe durchgeführt.`; spinner.textContent = '⛔';}
                await new Promise( r => setTimeout(r, 5000));
            } else if (progressText && spinner) {progressText.textContent = `Kauf abgeschlossen (${boughtCount} Käufe)`; spinner.textContent = '✅';}
            await loadBuildingsFromAPI();
            updateUserResources();
            updateSelectedCosts();
        } finally {
            setAllButtonsDisabled(false);
            if (container) {
                container.style.opacity = '0';
                setTimeout(() => {
                    container.style.display = 'none';
                    container.innerHTML = '';
                }, 300);
            }
        }
    }

    // Funktion für blinde (Coinsausgabe absicherung)
    function confirmCoinPurchase() {
        return confirm('⚠️ Bist du dir sicher, Coins ausgeben zu wollen?\nCoins sind eine Währung die mit Echtgeld gekauft werden und sind für immer weg.');
    }

    // Helper: fügt Modal nur ein, wenn noch nicht vorhanden
    function ensureModalInserted(modalId, html) {
        if (!document.getElementById(modalId)) {
            document.body.insertAdjacentHTML('beforeend', html);
        }
    }

    document.addEventListener('click', e => {
        if (e.target && e.target.id === 'fm-config-btn') {
            e.preventDefault();
            ensureModalInserted('fahrzeugConfigModal', configModalHTML);
            $('#fahrzeugConfigModal').modal('show');
            loadVehicleConfig();
        }
    }); // Konfigbutton
    document.addEventListener('click', e => {
        if (e.target && e.target.id === 'fm-log-btn') {
            e.preventDefault();
            ensureModalInserted('fahrzeugLogModal', logModalHTML);
            $('#fahrzeugLogModal').modal('show');
            showPurchaseLog();
        }
    }); // Kaufprotokoll
    document.addEventListener('click', e => {
        if (e.target && e.target.id === 'fm-reset-log-btn') {
            if (confirm('Möchtest du das Kaufprotokoll wirklich zurücksetzen?')) {
                const now = Date.now();
                localStorage.setItem('fm-purchase-log', JSON.stringify([]));
                localStorage.setItem('fm-purchase-log-reset', now.toString());
                showPurchaseLog();
            }
        }
    }); // Resetbutton
    document.addEventListener('click', e => {
        if(e.target && e.target.id==='fahrzeug-manager-btn'){
            e.preventDefault();
            ensureModalInserted('fahrzeugManagerModal', modalHTML);
            $('#fahrzeugManagerModal').modal('show');
            updateUserResources();
            loadBuildingsFromAPI();
        }
    }); // Managerbutton
    document.addEventListener('click', e => {
        if (e.target && e.target.id === 'fm-export-profiles') {
            e.preventDefault();
            exportAllProfiles();
        }
    }); // Exportbutton
    document.addEventListener('click', e => {
        if (e.target && e.target.id === 'fm-import-profiles') {
            e.preventDefault();
            importAllProfiles();
        }
    }); // Importbutton
    document.addEventListener('click', async e => {
        if (e.target && (e.target.classList.contains('fm-buy-credit') || e.target.classList.contains('fm-buy-coin'))) {
            e.preventDefault();
            const row = e.target.closest('tr');
            if (!row) return;
            const isCoins = e.target.classList.contains('fm-buy-coin');
            if (isCoins && !confirmCoinPurchase()) return;
            const currency = isCoins ? 'coins' : 'credits';
            let cancelRequested = false;
            const controller = new AbortController();
            const container = document.getElementById('fm-progress-container');
            container.style.display = 'block';
            container.style.padding = '8px';
            container.style.border = '1px solid #444';
            container.style.borderRadius = '6px';
            container.style.background = 'rgba(0,0,0,0.1)';
            container.style.opacity = '1';
            container.innerHTML = `
            <div style="margin-bottom:6px;">
                <span id="fm-spinner">⏳</span>
                <span id="fm-progress-text">Kauf gestartet...</span>
            </div>
            <div style="width:100%; background:#333; height:12px; border-radius:4px; overflow:hidden; margin-bottom:6px;">
                <div id="fm-progress-bar" style="width:0%; height:100%; background:#4caf50;"></div>
            </div>
            <div style="text-align:right;">
                <button id="fm-cancel-btn" class="btn btn-warning btn-xs">⛔ Abbrechen</button>
            </div>
        `;
            await new Promise(r => setTimeout(r, 0));
            const progressText = document.getElementById('fm-progress-text');
            const progressBar = document.getElementById('fm-progress-bar');
            const spinner = document.getElementById('fm-spinner');
            const cancelBtn = document.getElementById('fm-cancel-btn');
            cancelBtn.onclick = () => {
                cancelRequested = true;
                controller.abort();
                cancelBtn.disabled = true;
                cancelBtn.textContent = 'Wird abgebrochen...';
                spinner.textContent = '⛔';
            };
            const setAllButtonsDisabled = (disabled, excludeBtn = null) => {
                document.querySelectorAll('button').forEach(btn => {
                    if (btn !== excludeBtn) btn.disabled = disabled;
                });
            };
            setAllButtonsDisabled(true, cancelBtn);
            try {
                await buyVehicles([row], currency, false, controller, progressText, progressBar, spinner, cancelBtn);
            } finally {
                if (cancelRequested) {
                    await new Promise(r => setTimeout(r, 3000));
                }
                await loadBuildingsFromAPI();
                updateSelectedCosts();
                setAllButtonsDisabled(false);
                container.style.opacity = '0';
                setTimeout(() => container.style.display = 'none', 300);
            }
        }
    }); // Einzelkauf
    document.addEventListener('click', async e => {
        if (e.target && (e.target.classList.contains('fm-buy-selected-credits') || e.target.classList.contains('fm-buy-selected-coins'))) {
            e.preventDefault();
            const table = e.target.closest('table');
            if (!table) return;
            const isCoins = e.target.classList.contains('fm-buy-selected-coins');
            if (isCoins && !confirmCoinPurchase()) return;
            const currency = isCoins ? 'coins' : 'credits';
            const selectedRows = [...table.querySelectorAll('tbody tr input.fm-select:checked')]
            .map(cb => cb.closest('tr'));
            if (selectedRows.length === 0) {
                alert('Bitte mindestens eine Wache auswählen.');
                return;
            }
            await buyVehicles(selectedRows, currency, true);
        }
    }); // Sammelkauf
    $(document).on('hidden.bs.modal', '#fahrzeugConfigModal', async function () {
        if (!document.getElementById('fahrzeugManagerModal')) return;
        try {
            await updateUserResources();
            await loadBuildingsFromAPI();
        } catch (err) {
            console.warn('[FM] Fehler beim Neuladen nach Schließen des Konfig-Modals:', err);
            const content = document.getElementById('fahrzeug-manager-content');
            if (!content) return;
            const filteredBuildings = buildingDataGlobal.filter(b => getBuildingTypeName(b) !== null);
            content.innerHTML = buildBuildingsByType(filteredBuildings, vehicleMapGlobal, vehicleTypeMapGlobal, lssmBuildingDefsGlobal);
            document.querySelectorAll('.fm-spoiler-header').forEach(header => {
                header.addEventListener('click', () => {
                    const targetId = header.dataset.target;
                    document.querySelectorAll('.fm-spoiler-body').forEach(body => {
                        body.id === targetId ? body.classList.toggle('active') : body.classList.remove('active');
                    });
                });
            });
            setTimeout(() => {
                document.querySelectorAll('.fm-table').forEach(table => {
                    const allCheckbox = table.querySelector('.fm-select-all');
                    const filterLeitstelle = table.querySelector('.fm-filter-leitstelle');
                    const filterWache = table.querySelector('.fm-filter-wache');
                    const resetBtn = table.querySelector('.fm-filter-reset');
                    if (!allCheckbox || !filterLeitstelle || !filterWache || !resetBtn) return;

                    function applyFilters() {
                        const leitstelle = filterLeitstelle.value;
                        const wache = filterWache.value;
                        table.querySelectorAll('tbody tr').forEach(row => {
                            const rowLeitstelle = row.cells[1].textContent.trim();
                            const rowWache = row.cells[2].textContent.trim();
                            row.style.display = (leitstelle && rowLeitstelle !== leitstelle) || (wache && rowWache !== wache) ? 'none' : '';
                        });
                        const visibleCheckboxes = [...table.querySelectorAll('tbody tr')]
                        .filter(r => r.style.display !== 'none')
                        .map(r => r.querySelector('.fm-select'));
                        allCheckbox.checked = visibleCheckboxes.length > 0 && visibleCheckboxes.every(cb => cb && cb.checked);
                    }

                    allCheckbox.addEventListener('change', () => {
                        const checked = allCheckbox.checked;
                        table.querySelectorAll('tbody tr').forEach(row => {
                            if (row.style.display !== 'none') {
                                const cb = row.querySelector('.fm-select');
                                if (cb) cb.checked = checked;
                            }
                        });
                        updateSelectedCosts();
                    });
                    filterLeitstelle.addEventListener('change', applyFilters);
                    filterWache.addEventListener('change', applyFilters);
                    resetBtn.addEventListener('click', () => { filterLeitstelle.value=''; filterWache.value=''; applyFilters(); });
                    table.querySelectorAll('.fm-select').forEach(cb => {
                        cb.addEventListener('change', () => { applyFilters(); updateSelectedCosts(); });
                    });
                });
            }, 0);
        }
        try {
            document.querySelectorAll('.fm-select').forEach(cb => cb.checked = false);
            updateSelectedCosts();
            updateBuyButtons();
        } catch (e) {}
    }); // Tabellen nach Schließen des Config-Modals aktualisieren
    $(document).on('shown.bs.modal', '#fahrzeugManagerModal', function () {
        document.querySelectorAll('.fm-select').forEach(cb => cb.checked = false);
        document.getElementById('fm-costs-credits').textContent = '0';
        document.getElementById('fm-costs-coins').textContent = '0';
        updateUserResources();
        loadBuildingsFromAPI();
    });

    window.fm_updateSelectedCosts = updateSelectedCosts;



})();
