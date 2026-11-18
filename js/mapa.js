// ======================================================
// 1) CREAR MAPA CENTRADO EN ROUEN   [LATITUD, LONGITUD]
// ======================================================
const map = L.map('map', { zoomControl: false }).setView([49.4432, 1.0993], 13);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Orden de capas (fondo → frente), según la guía de estilos:
// mapa base → communes Métropole → relieve (carreaux) → zona servida 300 m
// → límites de communes → límites de servicio → estaciones actuales → propuestas
const PANES = {
  metropolePane: 400,
  carreauxPane: 403,
  zonesPane: 405,
  communesPane: 410,
  limitesPane: 415,
  stationsPane: 420,
  proposeesPane: 425
};
Object.entries(PANES).forEach(([name, zIndex]) => {
  map.createPane(name);
  map.getPane(name).style.zIndex = zIndex;
});


// ======================================================
// 2) TU CLAVE DE MAPTILER
// ======================================================
// Es una clave "de cliente" (viaja en la web; es normal que se vea).
// Al publicar, restríngela a tu dominio en MapTiler Cloud → Account → Keys.
const maptilerKey = 'NpFHXouIguVfNaVNSciL';


// ======================================================
// 3) FONDOS MAPTILER (con tu clave)
// ======================================================
// Tu estilo personalizado "Base - Inurba Style 1".
// Es VECTORIAL, así que se carga con el puente MapLibre (L.maplibreGL), no como raster.
const mtInurba = L.maplibreGL({
  style: `https://api.maptiler.com/maps/01a1c511-c578-7e31-b703-959d529493ca/style.json?key=${maptilerKey}`
});
const mtBase = L.tileLayer(
  `https://api.maptiler.com/maps/base-v4/256/{z}/{x}/{y}.png?key=${maptilerKey}`,
  { maxZoom: 20, attribution: '© MapTiler © OpenStreetMap contributors' }
);
const mtStreets = L.tileLayer(
  `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${maptilerKey}`,
  { maxZoom: 20, attribution: '© MapTiler © OpenStreetMap contributors' }
);
const mtOutdoor = L.tileLayer(
  `https://api.maptiler.com/maps/outdoor-v4/256/{z}/{x}/{y}.png?key=${maptilerKey}`,
  { maxZoom: 20, attribution: '© MapTiler © OpenStreetMap contributors' }
);
const mtTopo = L.tileLayer(
  `https://api.maptiler.com/maps/topo-v4/256/{z}/{x}/{y}.png?key=${maptilerKey}`,
  { maxZoom: 20, attribution: '© MapTiler © OpenStreetMap contributors' }
);


// ======================================================
// 4) FONDOS SIN CLAVE (reserva / complemento)
// ======================================================
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 19, attribution: '© OpenStreetMap' }
);
const clair = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, maxNativeZoom: 16, attribution: 'Tiles © Esri' }
);
const satellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles © Esri' }
);
const planIGN = L.tileLayer(
  'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  { maxZoom: 19, attribution: '© IGN-F / Géoplateforme' }
);


// ======================================================
// 5) FONDO QUE SE MUESTRA AL ABRIR
// ======================================================
mtInurba.addTo(map);


// ======================================================
// 6) SELECTOR DE FONDOS Y LÍMITES DE COMMUNES (ARRIBA A LA DERECHA)
// ======================================================
const baseMaps = {
  'Inurba base map': mtInurba,
  'Base': mtBase,
  'Streets': mtStreets,
  'Outdoor': mtOutdoor,
  'Topo': mtTopo,
  'Clair (gris)': clair,
  'Satellite': satellite,
  'Plan IGN (France)': planIGN,
  'OpenStreetMap': osm
};

const communeBoundaries = L.geoJSON(null, {
  pane: 'communesPane',
  interactive: false,
  style: {
    color: '#2D3C37',
    weight: 1.5,
    opacity: 0.3,
    fill: false
  }
}).addTo(map);

const metropoleCommunes = L.geoJSON(null, {
  pane: 'metropolePane',
  interactive: false,
  style: {
    color: '#A10D59',
    weight: 0.6,
    opacity: 0.4,
    fillColor: '#694c64',
    fillOpacity: 0.2
  }
}).addTo(map);

L.control.layers(baseMaps, {
  'Communes de la Métropole': metropoleCommunes,
  'Limites des communes LOVELO': communeBoundaries
}, {
  collapsed: true,
  position: 'topright'
}).addTo(map);

function loadJSON(url) {
  return fetch(url).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status} — ${url}`);
    return response.json();
  });
}

loadJSON('data/metropole-rouen-normandie.geojson')
  .then(data => metropoleCommunes.addData(data))
  .catch(error => console.error('Erreur lors du chargement des communes de la Métropole :', error));

// Le fichier des communes est en EPSG:3857; Leaflet attend des coordonnées WGS84.
function convertCoordinatesToWgs84(coordinates) {
  if (typeof coordinates[0] === 'number') {
    const earthRadius = 6378137;
    const longitude = (coordinates[0] / earthRadius) * (180 / Math.PI);
    const latitude = (2 * Math.atan(Math.exp(coordinates[1] / earthRadius)) - Math.PI / 2) * (180 / Math.PI);
    return [longitude, latitude, ...coordinates.slice(2)];
  }

  return coordinates.map(convertCoordinatesToWgs84);
}

loadJSON('data/communes.geojson')
  .then(data => {
    const crsName = data.crs?.properties?.name || '';
    if (crsName.includes('3857')) {
      data.features.forEach(feature => {
        feature.geometry.coordinates = convertCoordinatesToWgs84(feature.geometry.coordinates);
      });
    }
    communeBoundaries.addData(data);
  })
  .catch(error => console.error('Erreur lors du chargement des communes :', error));


// ======================================================
// 7) PROJET D'EXTENSION LOVÉLO — CONFIGURACIÓN (guía de estilos nov. 2026)
// ======================================================
// Se usan los CINCO GeoJSON individuales. NO cargar además
// lovelo_projet_extension_2026-11.geojson (contiene las mismas entidades).

// Escenario al abrir el mapa: 'actuel', 'A', 'B' o 'C'.
const DEFAULT_SCENARIO = 'actuel';

// Escenarios ACUMULATIVOS: cada uno incluye las propuestas de los anteriores.
const SCENARIOS = {
  actuel: { label: 'Réseau actuel',                 proposals: [],              coverageField: 'couvert_actuel' },
  A:      { label: 'A — Vélos mécaniques',          proposals: ['A'],           coverageField: 'couvert_A' },
  B:      { label: 'B — Extension VAE prioritaire', proposals: ['A', 'B'],      coverageField: 'couvert_B' },
  C:      { label: 'C — Extension VAE maximale',    proposals: ['A', 'B', 'C'], coverageField: 'couvert_C' }
};

// Les estaciones actuales conservan el lila corporativo del mapa.
const EXISTING_STATION_COLOR = '#A10D59';

const COLORS = {
  proposal: { A: '#059669', B: '#D97706', C: '#7C3AED' },
  zoneFill: '#38BDF8',
  zoneStroke: '#0284C7',
  limits: [
    { prefix: 'Périmètre du CCTP',     color: '#64748B', legend: 'Périmètre CCTP' },
    { prefix: 'Limite VAE',            color: '#7C3AED', legend: 'Limite VAE' },
    { prefix: 'Limite vélo mécanique', color: '#0891B2', legend: 'Limite vélo mécanique' },
    { prefix: 'Zone de confort',       color: '#16A34A', legend: 'Zone de confort vélo mécanique' }
  ],
  relief: [
    { prefix: 'Terrain plat',    color: '#93C5FD', legend: 'Terrain plat (≤ 30 m)' },
    { prefix: 'Dénivelé modéré', color: '#86EFAC', legend: 'Dénivelé modéré (30–70 m)' },
    { prefix: 'Dénivelé élevé',  color: '#FCD34D', legend: 'Dénivelé élevé (70–100 m)' },
    { prefix: 'Fort dénivelé',   color: '#FCA5A5', legend: 'Fort dénivelé (> 100 m)' }
  ]
};

// Prioridad visible por tamaño (no por color): P1 = 7 px, P2 = 6 px, P3 = 5 px.
const PRIORITY_RADIUS = { P1: 7, P2: 6, P3: 5 };
const RELIEF_MIN_ZOOM = 12;

const state = {
  scenario: DEFAULT_SCENARIO,
  showZones: true,
  showProposals: true,
  showCctp: true,
  showAccessLimits: false,
  showRelief: false
};

const data = {
  existing: null,   // FeatureCollection estaciones actuales
  proposals: [],    // features propuestas
  zones: [],        // features cobertura 300 m
  carreaux: null,   // FeatureCollection (carga diferida)
  carreauxLoading: false
};


// ======================================================
// 8) UTILIDADES DE FORMATO (fr-FR)
// ======================================================
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function num(value, formatter = nf0, suffix = '') {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '—';
  return formatter.format(Number(value)) + suffix;
}

function popupTable(title, rows) {
  const body = rows
    .filter(row => row)
    .map(([label, value]) => `<tr><th>${esc(label)}</th><td>${value}</td></tr>`)
    .join('');
  return `<div class="lv-popup"><h4>${esc(title)}</h4><table>${body}</table></div>`;
}

function matchStyle(list, text) {
  return list.find(item => String(text || '').startsWith(item.prefix));
}

function scenarioOfZone(feature) {
  const label = feature.properties.scenario_libelle || '';
  if (label === 'Réseau actuel') return 'actuel';
  const code = label.charAt(0);
  return SCENARIOS[code] && label.startsWith(`${code} `) ? code : null;
}


// ======================================================
// 9) CAPAS DEL PROYECTO
// ======================================================

// 9.1 Carreaux de 200 m — relieve (canvas para rendimiento, 3.263 polígonos)
const carreauxRenderer = L.canvas({ pane: 'carreauxPane', padding: 0.3 });
const carreauxLayer = L.geoJSON(null, {
  pane: 'carreauxPane',
  renderer: carreauxRenderer,
  style: feature => {
    const relief = matchStyle(COLORS.relief, feature.properties.classe_relief);
    return {
      stroke: false,
      fillColor: relief ? relief.color : '#CBD5E1',
      fillOpacity: 0.44
    };
  },
  onEachFeature: (feature, layer) => {
    // Popup evaluado al abrir: la desserte depende del escenario activo.
    layer.bindPopup(() => {
      const p = feature.properties;
      const sc = SCENARIOS[state.scenario];
      return popupTable('Carreau de 200 m', [
        ['Commune', esc(p.commune)],
        ['Classe de relief', esc(p.classe_relief)],
        ['Population estimée', `≈ ${num(p.population, nf1)} hab.`],
        ['Dénivelé', num(p.denivele_depuis_centre_m, nf0, ' m')],
        [`Desserte (${sc.label})`, esc(p[sc.coverageField] || '—')]
      ]);
    });
  }
});

// 9.2 Zona servida a 300 m — un único polígono, el del escenario activo
const zonesLayer = L.geoJSON(null, {
  pane: 'zonesPane',
  style: () => ({
    color: COLORS.zoneStroke,
    weight: 1,
    opacity: 0.9,
    fillColor: COLORS.zoneFill,
    fillOpacity: state.showRelief ? 0.08 : 0.17
  }),
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    layer.bindPopup(popupTable('Zone desservie à 300 m', [
      ['Scénario', esc(p.scenario_libelle)],
      ['Stations cumulées', num(p.nb_stations)],
      ['Population desservie', `${num(p.population_300m)} hab.`]
    ]));
  }
});

// 9.3 Límites de servicio — contorno discontinuo 2 px, sin relleno
function limitOptions() {
  return {
    pane: 'limitesPane',
    style: feature => {
      const limit = matchStyle(COLORS.limits, feature.properties.couche);
      return {
        color: limit ? limit.color : '#64748B',
        weight: 2,
        dashArray: '6 5',
        fill: false
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(popupTable(p.couche, [
        ['Critère', esc(p.critere)],
        ['Surface', num(p.surface_km2, nf1, ' km²')]
      ]));
    }
  };
}
const cctpLayer = L.geoJSON(null, limitOptions());
const accessLimitsLayer = L.geoJSON(null, limitOptions());

// 9.4 Estaciones existentes — lila corporativo, radio 5,2 px, borde blanco 1,7 px
const existingLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
    pane: 'stationsPane',
    radius: 5.2,
    color: '#FFFFFF',
    weight: 1.7,
    fillColor: EXISTING_STATION_COLOR,
    fillOpacity: 1
  }),
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    layer.bindPopup(popupTable('Station existante', [
      ['Nom', esc(p.nom)],
      ['Commune', esc(p.commune)],
      ['Départs (2025)', num(p.departs_2025)],
      ['Arrivées (2025)', num(p.arrivees_2025)],
      ['Ratio arrivées / départs', num(p.ratio_arrivees_departs, nf2)],
      ['Altitude (m)', num(p.altitude_m)],
      p.renforcement_capacite ? ['Renforcement de capacité', esc(p.renforcement_capacite)] : null
    ]));
  }
}).addTo(map);

// 9.5 Estaciones propuestas — color por escenario, radio por prioridad
const proposalsLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const p = feature.properties;
    return L.circleMarker(latlng, {
      pane: 'proposeesPane',
      radius: PRIORITY_RADIUS[p.priorite_client] || 5,
      color: '#FFFFFF',
      weight: 1.5,
      fillColor: COLORS.proposal[p.scenario] || '#64748B',
      fillOpacity: 1
    });
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    layer.bindPopup(popupTable('Station proposée', [
      ['Nom', esc(p.nom)],
      ['Commune', esc(p.commune)],
      ['Scénario', esc(p.scenario_libelle)],
      ['Priorité client', esc(p.priorite_client)],
      ['Implantation', esc(p.type_implantation)],
      ['Type de vélo', esc(p.type_velo_adapte)],
      ['Nouvelle population desservie (300 m)', `${num(p.population_nouvelle_300m)} hab.`],
      ['Distance au réseau actuel (m)', num(p.distance_reseau_actuel_m)],
      ['Vélos (hypothèse)', num(p.velos_hypothese)],
      ['Trajets/an (hypothèse)', num(p.trajets_annuels_hypothese)]
    ]) + '<p class="lv-popup-note">Hypothèses de planification, non des prévisions garanties.</p>');
  }
});


// ======================================================
// 10) PANEL DE CONTROL (ESCENARIO, CAPAS, LEYENDA, AVISOS)
// ======================================================
const ProjectPanel = L.Control.extend({
  options: { position: 'topright' },
  onAdd() {
    const div = L.DomUtil.create('div', 'lv-panel');
    const collapsed = window.matchMedia('(max-width: 600px)').matches;
    if (collapsed) div.classList.add('is-collapsed');

    const scenarioOptions = Object.entries(SCENARIOS)
      .map(([code, sc]) => `<option value="${code}"${code === state.scenario ? ' selected' : ''}>${esc(sc.label)}</option>`)
      .join('');

    const dot = (color, size = 10, border = '#FFFFFF') =>
      `<span class="lv-dot" style="width:${size}px;height:${size}px;background:${color};border-color:${border}"></span>`;
    const line = color => `<span class="lv-line" style="border-color:${color}"></span>`;
    const swatch = (fill, stroke, opacity) =>
      `<span class="lv-swatch" style="background:${fill};opacity:${opacity};border-color:${stroke}"></span>`;

    div.innerHTML = `
      <button type="button" class="lv-panel-head" aria-expanded="${!collapsed}">
        <span>Projet d’extension Lovélo</span><span class="lv-chevron" aria-hidden="true"></span>
      </button>
      <div class="lv-panel-body">
        <label class="lv-field">
          <span class="lv-label">Scénario à afficher</span>
          <select id="lv-scenario">${scenarioOptions}</select>
        </label>

        <div class="lv-kpis">
          <div><span class="lv-kpi" id="lv-total">—</span><span class="lv-kpi-label">stations au total</span></div>
          <div><span class="lv-kpi" id="lv-pop">—</span><span class="lv-kpi-label">habitants à 300 m</span></div>
        </div>
        <p class="lv-detail" id="lv-detail"></p>

        <fieldset class="lv-toggles">
          <label><input type="checkbox" data-key="showZones" ${state.showZones ? 'checked' : ''}> Zones desservies à 300 m</label>
          <label><input type="checkbox" data-key="showProposals" ${state.showProposals ? 'checked' : ''}> Stations proposées (selon le scénario)</label>
          <label><input type="checkbox" data-key="showCctp" ${state.showCctp ? 'checked' : ''}> Périmètre du CCTP</label>
          <label><input type="checkbox" data-key="showAccessLimits" ${state.showAccessLimits ? 'checked' : ''}> Limites d’accessibilité vélo / VAE</label>
          <label><input type="checkbox" data-key="showRelief" ${state.showRelief ? 'checked' : ''}> Carreaux de 200 m — relief (zoom ≥ 12)</label>
          <p class="lv-hint" id="lv-relief-hint" hidden></p>
        </fieldset>

        <div class="lv-legend">
          <span class="lv-label">Légende</span>
          <ul>
            <li>${dot(EXISTING_STATION_COLOR, 11)} Station existante</li>
            <li data-legend="A">${dot(COLORS.proposal.A, 12)} Proposition A</li>
            <li data-legend="B">${dot(COLORS.proposal.B, 12)} Proposition B</li>
            <li data-legend="C">${dot(COLORS.proposal.C, 12)} Proposition C</li>
            <li data-legend="priority" class="lv-priority">
              ${dot('#64748B', 14)} P1 ${dot('#64748B', 12)} P2 ${dot('#64748B', 10)} P3
              <small>taille = priorité client</small>
            </li>
            <li data-legend="zones">${swatch(COLORS.zoneFill, COLORS.zoneStroke, 0.55)} Zone desservie à 300 m</li>
            ${COLORS.limits.map((l, i) => `<li data-legend="${i === 0 ? 'cctp' : 'access'}">${line(l.color)} ${esc(l.legend)}</li>`).join('')}
            ${COLORS.relief.map(r => `<li data-legend="relief">${swatch(r.color, r.color, 0.8)} ${esc(r.legend)}</li>`).join('')}
          </ul>
        </div>

        <div class="lv-disclaimer">
          <strong>Données d’étude — novembre 2026</strong>
          Les scénarios sont cumulatifs. Les volumes de vélos et de trajets sont des hypothèses de planification, non des prévisions garanties.
        </div>
      </div>`;

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    const head = div.querySelector('.lv-panel-head');
    head.addEventListener('click', () => {
      const isCollapsed = div.classList.toggle('is-collapsed');
      head.setAttribute('aria-expanded', String(!isCollapsed));
    });

    div.querySelector('#lv-scenario').addEventListener('change', event => {
      state.scenario = event.target.value;
      render();
    });

    div.querySelectorAll('input[data-key]').forEach(input => {
      input.addEventListener('change', () => {
        state[input.dataset.key] = input.checked;
        if (input.dataset.key === 'showRelief' && input.checked) ensureCarreaux();
        render();
      });
    });

    return div;
  }
});
const panel = new ProjectPanel().addTo(map);
const panelEl = panel.getContainer();


// ======================================================
// 11) RENDER — sincroniza capas, contadores y leyenda con el estado
// ======================================================
function setLayerVisible(layer, visible) {
  if (visible && !map.hasLayer(layer)) layer.addTo(map);
  if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
}

function activeProposals() {
  const codes = SCENARIOS[state.scenario].proposals;
  return data.proposals.filter(f => codes.includes(f.properties.scenario));
}

// Las capas filtradas solo se reconstruyen si cambia el escenario, el relieve
// (opacidad de la zona) o llegan los datos; así un zoom no cierra los popups.
let builtKey = null;

function render() {
  const sc = SCENARIOS[state.scenario];
  const proposals = activeProposals();
  const zone = data.zones.find(f => scenarioOfZone(f) === state.scenario);

  const key = `${state.scenario}|${state.showRelief}|${data.proposals.length}|${data.zones.length}`;
  if (key !== builtKey) {
    builtKey = key;
    // Estaciones propuestas (incrementales)
    proposalsLayer.clearLayers();
    proposalsLayer.addData(proposals);
    // Zona servida: solo el polígono del escenario activo
    zonesLayer.clearLayers();
    if (zone) zonesLayer.addData(zone);
  }
  setLayerVisible(proposalsLayer, state.showProposals && proposals.length > 0);
  setLayerVisible(zonesLayer, state.showZones && !!zone);

  // Límites
  setLayerVisible(cctpLayer, state.showCctp);
  setLayerVisible(accessLimitsLayer, state.showAccessLimits);

  // Relieve: solo a zoom ≥ 12; la zona servida baja al 8 % y deja pasar los clics
  const reliefZoomOk = map.getZoom() >= RELIEF_MIN_ZOOM;
  setLayerVisible(carreauxLayer, state.showRelief && reliefZoomOk && !!data.carreaux);
  map.getPane('zonesPane').classList.toggle('lv-passive', state.showRelief);

  const hint = panelEl.querySelector('#lv-relief-hint');
  if (state.showRelief && data.carreauxLoading) {
    hint.textContent = 'Chargement des carreaux…';
    hint.hidden = false;
  } else if (state.showRelief && !reliefZoomOk) {
    hint.textContent = `Zoomez (niveau ≥ ${RELIEF_MIN_ZOOM}) pour afficher les carreaux.`;
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }

  // Contadores (calculados a partir de los datos, no fijos)
  const existingCount = data.existing ? data.existing.features.length : 0;
  panelEl.querySelector('#lv-total').textContent = nf0.format(existingCount + proposals.length);
  panelEl.querySelector('#lv-pop').textContent = zone ? nf0.format(zone.properties.population_300m) : '—';
  panelEl.querySelector('#lv-detail').textContent = proposals.length
    ? `${existingCount} existantes + ${proposals.length} proposées · ${sc.label}`
    : `${existingCount} stations existantes · ${sc.label}`;

  // Leyenda: solo lo que está visible
  const show = (key, visible) => panelEl
    .querySelectorAll(`[data-legend="${key}"]`)
    .forEach(el => { el.hidden = !visible; });
  ['A', 'B', 'C'].forEach(code => show(code, state.showProposals && sc.proposals.includes(code)));
  show('priority', state.showProposals && sc.proposals.length > 0);
  show('zones', state.showZones);
  show('cctp', state.showCctp);
  show('access', state.showAccessLimits);
  show('relief', state.showRelief);
}

map.on('zoomend', render);


// ======================================================
// 12) CARGA DE DATOS
// ======================================================
function ensureCarreaux() {
  if (data.carreaux || data.carreauxLoading) return;
  data.carreauxLoading = true;
  loadJSON('data/lovelo_carreaux_relief_couverture.geojson')
    .then(json => {
      data.carreaux = json;
      carreauxLayer.addData(json);
    })
    .catch(error => console.error('Erreur lors du chargement des carreaux :', error))
    .finally(() => {
      data.carreauxLoading = false;
      render();
    });
}

Promise.all([
  loadJSON('data/lovelo_stations_existantes.geojson'),
  loadJSON('data/lovelo_stations_proposees.geojson'),
  loadJSON('data/lovelo_zones_desservies_300m.geojson'),
  loadJSON('data/lovelo_limites_de_service.geojson')
])
  .then(([existing, proposals, zones, limits]) => {
    data.existing = existing;
    existingLayer.addData(existing);

    data.proposals = proposals.features;
    data.zones = zones.features;

    limits.features.forEach(feature => {
      const isCctp = String(feature.properties.couche || '').startsWith('Périmètre du CCTP');
      (isCctp ? cctpLayer : accessLimitsLayer).addData(feature);
    });

    render();
  })
  .catch(error => console.error('Erreur lors du chargement des données Lovélo :', error));

render();
