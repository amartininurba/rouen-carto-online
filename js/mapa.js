// ======================================================
// 1) CREAR MAPA CENTRADO EN ROUEN   [LATITUD, LONGITUD]
// ======================================================
const map = L.map('map', { zoomControl: false }).setView([49.4432, 1.0993], 13);
L.control.zoom({ position: 'bottomright' }).addTo(map);
map.createPane('communesPane');
map.getPane('communesPane').style.zIndex = 410;
map.createPane('metropolePane');
map.getPane('metropolePane').style.zIndex = 400;
map.createPane('stationsPane');
map.getPane('stationsPane').style.zIndex = 420;


// ======================================================
// 2) TU CLAVE DE MAPTILER
// ======================================================
// Es una clave "de cliente" (viaja en la web; es normal que se vea).
// Al publicar, restríngela a tu dominio en MapTiler Cloud → Account → Keys.
const maptilerKey = 'NpFHXouIguVfNaVNSciL';


// ======================================================
// 3) FONDOS MAPTILER (con tu clave)
// ======================================================
// Estilos estándar: usan un nombre (base-v4, streets-v4...).
// Estilos PERSONALIZADOS tuyos: usan un UUID (el de tu mapa en MapTiler Cloud).
// Sus nombres/IDs están en MapTiler Cloud → Maps.

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
// Tu estilo Inurba (vectorial) de inicio.
// Cambia "mtInurba" por el que quieras (mtBase, satellite, planIGN...).
mtInurba.addTo(map);


// ======================================================
// 6) SELECTOR DE FONDOS (ARRIBA A LA DERECHA)
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

fetch('data/metropole-rouen-normandie.geojson')
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
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

fetch('data/communes.geojson')
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
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
// 7) ESTILO FIJO DE LAS ESTACIONES
// ======================================================
const stationStyle = { color: '#A10D59', radius: 3 };

// ======================================================
// 8) CARGAR ESTACIONES, DIBUJARLAS Y MOSTRAR SU FICHA (en francés)
// ======================================================
fetch('data/stations.geojson')
  .then(r => r.json())
  .then(datos => {
    L.geoJSON(datos, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        pane: 'stationsPane',
        radius: stationStyle.radius,
        color: stationStyle.color,
        weight: 1.5,
        fillColor: stationStyle.color,
        fillOpacity: 1
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(
          `<b>NOM DE LA STATION :</b> ${p['NOM DE LA STATION'] || ''}<br>
           <b>COMMUNE :</b> ${p.COMMUNE || ''}`
        );
      }
    }).addTo(map);
  })
  .catch(error => console.error('Erreur lors du chargement des stations :', error));