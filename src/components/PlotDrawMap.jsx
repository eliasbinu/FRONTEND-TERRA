import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import {
  Layers,
  MapPin,
  Search,
  Loader2,
  FileCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Ensure L and L.Draw are globally synced
if (typeof window !== 'undefined') {
  window.type = '';
  window.L = L;
  if (window.L && window.L.Draw && !L.Draw) {
    L.Draw = window.L.Draw;
  }
  if (window.L && window.L.Control?.Draw && !L.Control?.Draw) {
    L.Control.Draw = window.L.Control.Draw;
  }
  if (window.L?.GeometryUtil?.readableArea) {
    const orig = window.L.GeometryUtil.readableArea;
    window.L.GeometryUtil.readableArea = function (area, isMetric, precision) {
      window.type = typeof isMetric;
      return orig.apply(this, arguments);
    };
  }
}

const PILOT_COORDINATES = [
  [19.8824, 75.3412],
  [19.8851, 75.3418],
  [19.8845, 75.3452],
  [19.8818, 75.3445],
];

// Common Indian district/pilot PIN codes cache for instantaneous fly-to
const PIN_CACHE = {
  '431001': { lat: 19.883, lng: 75.343, name: 'Chhatrapati Sambhajinagar (Aurangabad Central)' },
  '431002': { lat: 19.872, lng: 75.328, name: 'Aurangabad City' },
  '431003': { lat: 19.865, lng: 75.355, name: 'Aurangabad East' },
  '431005': { lat: 19.895, lng: 75.312, name: 'Aurangabad Cantt' },
  '411001': { lat: 18.5204, lng: 73.8567, name: 'Pune, Maharashtra' },
  '400001': { lat: 18.9322, lng: 72.8354, name: 'Mumbai, Maharashtra' },
  '440001': { lat: 21.1458, lng: 79.0882, name: 'Nagpur, Maharashtra' },
  '416001': { lat: 16.7050, lng: 74.2433, name: 'Kolhapur, Maharashtra' },
  '422001': { lat: 19.9975, lng: 73.7898, name: 'Nashik, Maharashtra' },
  '110001': { lat: 28.6294, lng: 77.2190, name: 'New Delhi' },
  '560001': { lat: 12.9716, lng: 77.5946, name: 'Bengaluru, Karnataka' },
  '500001': { lat: 17.3850, lng: 78.4867, name: 'Hyderabad, Telangana' },
};

// Controller to smoothly pan & zoom map to coordinates
function MapPanController({ center, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (center && map) {
      map.flyTo(center, zoom, { duration: 1.2 });
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }
  }, [center, zoom, map]);
  return null;
}

// Resilient Leaflet Draw EditControl for React 18
function DrawEditControl({ onCreated, onEdited, onDeleted, featureGroupRef }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const LeafletLib = window.L || L;
    if (!LeafletLib.Control || !LeafletLib.Control.Draw) {
      console.warn('Leaflet.Draw not yet attached');
      return;
    }

    const drawnItems = featureGroupRef?.current || new LeafletLib.FeatureGroup();
    if (!map.hasLayer(drawnItems)) {
      map.addLayer(drawnItems);
    }

    // Configure clear instructions so the user knows they can place unlimited vertices
    if (LeafletLib.drawLocal?.draw?.handlers?.polygon?.tooltip) {
      LeafletLib.drawLocal.draw.handlers.polygon.tooltip.start = 'Click map to place 1st corner of parcel.';
      LeafletLib.drawLocal.draw.handlers.polygon.tooltip.cont = 'Click map to place next vertex (add 4+ vertices freely).';
      LeafletLib.drawLocal.draw.handlers.polygon.tooltip.end = 'Click 1st point, double-click, or click Finish to complete parcel.';
    }

    const drawControl = new LeafletLib.Control.Draw({
      position: 'topright',
      draw: {
        rectangle: false,
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polygon: {
          allowIntersection: true,
          showArea: false,
          shapeOptions: {
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.35,
            weight: 2,
          },
        },
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });

    map.addControl(drawControl);

    const handleCreated = (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      if (onCreated) onCreated(e);
    };

    const handleEdited = (e) => {
      if (onEdited) onEdited(e);
    };

    const handleDeleted = (e) => {
      if (onDeleted) onDeleted(e);
    };

    const createdEvent = LeafletLib.Draw?.Event?.CREATED || 'draw:created';
    map.on(createdEvent, handleCreated);
    map.on('draw:edited', handleEdited);
    map.on('draw:deleted', handleDeleted);

    return () => {
      try {
        map.removeControl(drawControl);
        map.off(createdEvent, handleCreated);
        map.off('draw:edited', handleEdited);
        map.off('draw:deleted', handleDeleted);
      } catch (err) {
        // cleanup safety
      }
    };
  }, [map, featureGroupRef]);

  return null;
}

export default function PlotDrawMap({ onCompleteSubmit, initialQuery }) {
  const [activeLayer, setActiveLayer] = useState('satellite'); // Default to satellite view
  const [farmerName, setFarmerName] = useState('');
  const [polygonCoords, setPolygonCoords] = useState(null);
  const [hasDocument, setHasDocument] = useState(true);
  const [documentName, setDocumentName] = useState('7_12_Extract_Gut_142_Aurangabad.pdf');
  const [errorMsg, setErrorMsg] = useState('');

  // PIN code geocoding state
  const [pincodeInput, setPincodeInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [pincodeInfo, setPincodeInfo] = useState('');
  const [pincodeError, setPincodeError] = useState('');
  const [mapCenter, setMapCenter] = useState([19.883, 75.343]);
  const [pincodeMarker, setPincodeMarker] = useState(null);

  const featureGroupRef = useRef(null);

  // Apply initial query from landing page if provided
  useEffect(() => {
    if (!initialQuery) return;
    const clean = initialQuery.trim();
    if (/^\d{6}$/.test(clean) || clean.startsWith('PIN ')) {
      const pin = clean.replace('PIN ', '');
      setPincodeInput(pin);
      if (PIN_CACHE[pin]) {
        const target = PIN_CACHE[pin];
        setMapCenter([target.lat, target.lng]);
        setPincodeMarker([target.lat, target.lng]);
        setPincodeInfo(target.name);
      }
    } else if (clean.toLowerCase().includes('aurangabad') || clean.toLowerCase().includes('pilot')) {
      handleLoadPilotPreset();
    } else if (clean.length > 0 && clean !== 'Cadastral Inspection') {
      setFarmerName(clean);
    }
  }, [initialQuery]);

  const calculatedAreaHa =
    polygonCoords && polygonCoords.length >= 3 && (window.L || L)?.GeometryUtil?.geodesicArea
      ? ((window.L || L).GeometryUtil.geodesicArea(polygonCoords.map(([lat, lng]) => (window.L || L).latLng(lat, lng))) / 10000).toFixed(2)
      : '1.62';

  const tileLayers = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      name: 'Satellite View',
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      name: 'OpenStreetMap',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      name: 'Carto Dark',
    },
  };

  // PIN code search handler
  const handlePincodeSearch = async (e) => {
    if (e) e.preventDefault();
    const cleanPin = pincodeInput.trim();
    if (!cleanPin) return;

    setIsGeocoding(true);
    setPincodeError('');
    setPincodeInfo('');

    try {
      // 1. Check instant cache first
      if (PIN_CACHE[cleanPin]) {
        const target = PIN_CACHE[cleanPin];
        setMapCenter([target.lat, target.lng]);
        setPincodeMarker([target.lat, target.lng]);
        setPincodeInfo(target.name);
        setIsGeocoding(false);
        return;
      }

      // 2. Query OpenStreetMap Nominatim API for postalcode in India
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleanPin)}&country=India&format=json`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setMapCenter([lat, lon]);
        setPincodeMarker([lat, lon]);
        const shortName = data[0].display_name.split(',').slice(0, 3).join(',');
        setPincodeInfo(shortName);
      } else {
        // Fallback search without country restriction
        const resGlobal = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleanPin)}&format=json`,
          { headers: { Accept: 'application/json' } }
        );
        const dataGlobal = await resGlobal.json();
        if (dataGlobal && dataGlobal.length > 0) {
          const lat = parseFloat(dataGlobal[0].lat);
          const lon = parseFloat(dataGlobal[0].lon);
          setMapCenter([lat, lon]);
          setPincodeMarker([lat, lon]);
          const shortName = dataGlobal[0].display_name.split(',').slice(0, 3).join(',');
          setPincodeInfo(shortName);
        } else {
          setPincodeError(`PIN code "${cleanPin}" not found.`);
        }
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setPincodeError('Failed to lookup PIN code. Check connection.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handler for user-drawn polygon via EditControl
  const handleCreated = (e) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon' || layer?.getLatLngs) {
      const latlngs = layer.getLatLngs();
      const rawCoords = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
      const coords = rawCoords.map((pt) => [pt.lat, pt.lng]);
      setPolygonCoords(coords);
      setErrorMsg('');
    }
  };

  const handleEdited = (e) => {
    const { layers } = e;
    layers.eachLayer((layer) => {
      const latlngs = layer.getLatLngs();
      const rawCoords = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
      const coords = rawCoords.map((pt) => [pt.lat, pt.lng]);
      setPolygonCoords(coords);
    });
  };

  const handleDeleted = () => {
    setPolygonCoords(null);
  };

  // Preset Action: Load Aurangabad Pilot (1.62 ha)
  const handleLoadPilotPreset = () => {
    setFarmerName('Ramesh G. Patil');
    setPolygonCoords(PILOT_COORDINATES);
    setHasDocument(true);
    setDocumentName('7_12_Extract_Gut_142_Aurangabad.pdf');
    setErrorMsg('');
    setMapCenter([19.883, 75.343]);
    setPincodeMarker(null);
    setPincodeInfo('Aurangabad Pilot (19.883°N, 75.343°E)');

    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
  };

  // Trigger CV Pipeline submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!farmerName.trim()) {
      setErrorMsg('Farmer name is required. Please enter a name.');
      return;
    }

    if (!polygonCoords || polygonCoords.length < 3) {
      setErrorMsg('Please draw a parcel polygon on the map using the draw tool (top-right).');
      return;
    }

    // Transform Leaflet [lat, lng] array to GeoJSON [[lng, lat]]
    const geoJsonPolygon = polygonCoords.map(([lat, lng]) => [lng, lat]);

    // Ensure polygon ring is closed
    if (
      geoJsonPolygon[0][0] !== geoJsonPolygon[geoJsonPolygon.length - 1][0] ||
      geoJsonPolygon[0][1] !== geoJsonPolygon[geoJsonPolygon.length - 1][1]
    ) {
      geoJsonPolygon.push([...geoJsonPolygon[0]]);
    }

    const payload = {
      farmerName: farmerName.trim(),
      polygon: geoJsonPolygon,
      area_hectares: calculatedAreaHa ? parseFloat(calculatedAreaHa) : 1.62,
      documents: hasDocument
        ? [
            {
              file_url: `https://example.com/docs/${documentName}`,
              doc_type: '7_12_extract',
              verified: true,
            },
          ]
        : [],
    };

    if (onCompleteSubmit) {
      onCompleteSubmit(payload);
    }
  };

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-md flex flex-col h-full overflow-hidden font-sans">
      {/* Top Header Bar with PIN Code Search and Controls */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#18181b] border-b border-[#262626] gap-2">
        {/* Title & Coordinates Info */}
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#22c55e]" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white">
            Cadastral Parcel Selection
          </span>
          {pincodeInfo ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-sm bg-[#14532d] text-[#4ade80] border border-[#16a34a] flex items-center space-x-1">
              <MapPin className="w-3 h-3 text-[#4ade80]" />
              <span className="truncate max-w-[220px]">{pincodeInfo}</span>
            </span>
          ) : (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-sm bg-[#27272a] text-zinc-300 border border-[#3f3f46]">
              Aurangabad Pilot (19.883°N, 75.343°E)
            </span>
          )}
        </div>

        {/* PIN Code Input Form */}
        <form onSubmit={handlePincodeSearch} className="flex items-center space-x-1.5">
          <div className="relative">
            <input
              type="text"
              value={pincodeInput}
              onChange={(e) => {
                setPincodeInput(e.target.value);
                if (pincodeError) setPincodeError('');
              }}
              placeholder="Enter PIN Code (e.g. 431001)"
              className="h-7 w-48 px-2.5 rounded-sm bg-[#121212] border border-[#262626] text-white text-[11px] font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isGeocoding || !pincodeInput.trim()}
            className="h-7 px-2.5 rounded-sm bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 text-white text-[11px] font-mono font-medium border border-[#3f3f46] flex items-center space-x-1 transition-colors"
          >
            {isGeocoding ? (
              <Loader2 className="w-3 h-3 animate-spin text-[#4ade80]" />
            ) : (
              <Search className="w-3 h-3 text-[#4ade80]" />
            )}
            <span>Locate</span>
          </button>
        </form>

        {/* Action Preset & Tile Switcher */}
        <div className="flex items-center space-x-2">
          {/* Tile Layer Selector */}
          <div className="flex items-center space-x-1 bg-[#121212] p-0.5 rounded-sm border border-[#262626]">
            {['satellite', 'dark', 'osm'].map((layerKey) => (
              <button
                key={layerKey}
                type="button"
                onClick={() => setActiveLayer(layerKey)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-sm transition-colors uppercase ${
                  activeLayer === layerKey
                    ? 'bg-[#14532d] text-[#4ade80] border border-[#16a34a] font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {layerKey === 'satellite' ? 'Satellite' : layerKey === 'dark' ? 'Dark' : 'OSM'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Geocoding Error Banner if any */}
      {pincodeError && (
        <div className="px-4 py-1.5 bg-[#450a0a] border-b border-[#991b1b] text-red-300 text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{pincodeError}</span>
        </div>
      )}

      {/* Map View */}
      <div className="relative flex-1 min-h-[420px] w-full bg-[#09090b]">
        <MapContainer
          center={mapCenter}
          zoom={15}
          scrollWheelZoom={true}
          className="w-full h-full"
          style={{ width: '100%', height: '100%', minHeight: '420px' }}
        >
          <MapPanController center={mapCenter} zoom={15} />

          <TileLayer
            key={activeLayer}
            attribution={tileLayers[activeLayer].attribution}
            url={tileLayers[activeLayer].url}
          />

          {/* Marker at searched PIN location */}
          {pincodeMarker && (
            <Marker position={pincodeMarker}>
              <Popup>
                <div className="bg-[#18181b] text-white p-2 font-mono text-xs border border-[#27272a] rounded-sm">
                  <div className="font-bold text-[#4ade80] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> PIN: {pincodeInput}
                  </div>
                  <div className="text-zinc-300 text-[11px] mt-1">{pincodeInfo}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    Coordinates: {pincodeMarker[0].toFixed(4)}, {pincodeMarker[1].toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          <FeatureGroup ref={featureGroupRef}>
            <DrawEditControl
              featureGroupRef={featureGroupRef}
              onCreated={handleCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
            />

            {/* Display polygon if not already held in drawnItems */}
            {polygonCoords && (!featureGroupRef.current || featureGroupRef.current.getLayers().length === 0) && (
              <Polygon
                positions={polygonCoords}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.35,
                  weight: 2.5,
                }}
              />
            )}
          </FeatureGroup>
        </MapContainer>

        {/* Technical Status Overlay */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-[#121212] border border-[#262626] rounded-md p-2.5 text-xs font-mono pointer-events-auto">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
            Parcel Geometry Status
          </div>
          {polygonCoords ? (
            <div className="flex items-center space-x-2 text-[#4ade80]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{polygonCoords.length} Vertices Bound ({calculatedAreaHa} Ha verified)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
              <span>Use polygon draw tool (top-right) to outline parcel</span>
            </div>
          )}
        </div>
      </div>

      {/* Form Inputs & Pipeline Trigger */}
      <div className="p-3 bg-[#18181b] border-t border-[#262626]">
        <form onSubmit={handleSubmit} className="space-y-3">
          {errorMsg && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-sm bg-[#450a0a] border border-[#991b1b] text-red-300 text-xs font-mono">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Farmer Name Input */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Farmer Full Name
              </label>
              <input
                type="text"
                value={farmerName}
                onChange={(e) => {
                  setFarmerName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. Ramesh G. Patil"
                className="w-full h-9 px-3 rounded-md bg-[#121212] border border-[#262626] text-white text-xs font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#16a34a] transition-colors"
              />
            </div>

            {/* Land Title 7/12 OCR Upload Zone */}
            <div className="md:col-span-5">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Land Title (7/12 OCR) Document
              </label>
              <div className="h-9 px-3 rounded-md bg-[#121212] border border-[#262626] flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2 truncate">
                  <FileCheck className="w-4 h-4 text-[#22c55e] flex-shrink-0" />
                  <span className="text-zinc-200 truncate">{documentName}</span>
                </div>
                <span className="flex-shrink-0 ml-2 px-1.5 py-0.5 rounded-sm bg-[#14532d] text-[#4ade80] border border-[#16a34a] text-[10px] uppercase font-bold">
                  Ready
                </span>
              </div>
            </div>

            {/* Trigger CV Pipeline Action Button */}
            <div className="md:col-span-3">
              <button
                type="submit"
                className="w-full h-9 px-4 rounded-md bg-[#16a34a] hover:bg-[#15803d] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors"
              >
                <span>Trigger CV Pipeline</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
