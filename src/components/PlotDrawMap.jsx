import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import {
  MapPin,
  Search,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  MousePointerClick,
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
function DrawEditControl({
  onCreated,
  onEdited,
  onDeleted,
  featureGroupRef,
  drawTriggerRef,
  finishTriggerRef,
  setIsDrawing,
  setPointsCount,
}) {
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
      LeafletLib.drawLocal.draw.handlers.polygon.tooltip.end = 'Click Finish button below when done (min 4 points).';
    }

    const polygonOptions = {
      allowIntersection: true,
      showArea: false,
      shapeOptions: {
        color: '#22c55e',
        fillColor: '#22c55e',
        fillOpacity: 0.35,
        weight: 2,
      },
    };

    // Draw control without the polygon button on the map (moved to bottom action bar beside Farmer name)
    const drawControl = new LeafletLib.Control.Draw({
      position: 'topright',
      draw: {
        rectangle: false,
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polygon: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });

    map.addControl(drawControl);

    // Standalone Polygon Draw Handler wired to the custom "Select you land" button
    const polygonHandler = new LeafletLib.Draw.Polygon(map, polygonOptions);

    if (drawTriggerRef) {
      drawTriggerRef.current = () => {
        if (polygonHandler.enabled()) {
          polygonHandler.disable();
          setIsDrawing(false);
          setPointsCount(0);
        } else {
          drawnItems.clearLayers();
          onDeleted();
          setPointsCount(0);
          polygonHandler.enable();
          setIsDrawing(true);
        }
      };
    }

    // Finish button programmatic completion
    if (finishTriggerRef) {
      finishTriggerRef.current = () => {
        if (polygonHandler.enabled() && polygonHandler._markers && polygonHandler._markers.length >= 4) {
          polygonHandler.completeShape();
        }
      };
    }

    const updateVertexCount = () => {
      if (polygonHandler._markers) {
        setPointsCount(polygonHandler._markers.length);
      }
    };

    const handleDrawStart = () => {
      setIsDrawing(true);
      setPointsCount(0);
    };

    const handleDrawStop = () => {
      setIsDrawing(false);
      setPointsCount(0);
    };

    const handleCreated = (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      setIsDrawing(false);
      setPointsCount(0);
      if (onCreated) onCreated(e);
    };

    const handleEdited = (e) => {
      if (onEdited) onEdited(e);
    };

    const handleDeleted = (e) => {
      setIsDrawing(false);
      setPointsCount(0);
      if (onDeleted) onDeleted(e);
    };

    const createdEvent = LeafletLib.Draw?.Event?.CREATED || 'draw:created';
    const drawStopEvent = LeafletLib.Draw?.Event?.DRAWSTOP || 'draw:drawstop';
    const drawStartEvent = LeafletLib.Draw?.Event?.DRAWSTART || 'draw:drawstart';
    const drawVertexEvent = LeafletLib.Draw?.Event?.DRAWVERTEX || 'draw:drawvertex';

    map.on(createdEvent, handleCreated);
    map.on(drawStopEvent, handleDrawStop);
    map.on(drawStartEvent, handleDrawStart);
    map.on(drawVertexEvent, updateVertexCount);
    map.on('click', updateVertexCount);
    map.on('draw:edited', handleEdited);
    map.on('draw:deleted', handleDeleted);

    return () => {
      try {
        if (polygonHandler.enabled()) {
          polygonHandler.disable();
        }
        map.removeControl(drawControl);
        map.off(createdEvent, handleCreated);
        map.off(drawStopEvent, handleDrawStop);
        map.off(drawStartEvent, handleDrawStart);
        map.off(drawVertexEvent, updateVertexCount);
        map.off('click', updateVertexCount);
        map.off('draw:edited', handleEdited);
        map.off('draw:deleted', handleDeleted);
      } catch (err) {
        // cleanup safety
      }
    };
  }, [map, featureGroupRef, drawTriggerRef, finishTriggerRef, setIsDrawing, setPointsCount]);

  return null;
}

export default function PlotDrawMap({ onCompleteSubmit, initialQuery }) {
  const [activeLayer, setActiveLayer] = useState('satellite'); // Default to satellite view
  const [farmerName, setFarmerName] = useState('');
  const [areaHa, setAreaHa] = useState('1.62');
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
  const drawTriggerRef = useRef(null);
  const finishTriggerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointsCount, setPointsCount] = useState(0);

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

  // Synchronize areaHa when polygon area changes
  useEffect(() => {
    if (polygonCoords && polygonCoords.length >= 3) {
      setAreaHa(calculatedAreaHa);
    }
  }, [polygonCoords, calculatedAreaHa]);

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
    if (e) e.preventDefault();

    // 1. Read values from frontend inputs
    const finalFarmerName = document.getElementById('farmerName')?.value || farmerName;
    const finalAreaHa = parseFloat(document.getElementById('areaInput')?.value || areaHa) || 1.62;

    if (!finalFarmerName.trim()) {
      setErrorMsg('Farmer name is required. Please enter a name.');
      return;
    }

    if (!polygonCoords || polygonCoords.length < 3) {
      setErrorMsg('Please select/draw your land boundary polygon on the map before triggering.');
      return;
    }

    // Transform Leaflet [lat, lng] array to GeoJSON [[lng, lat]]
    const geoJsonPolygon = polygonCoords.map(([lat, lng]) => [
      parseFloat(Number(lng).toFixed(6)),
      parseFloat(Number(lat).toFixed(6)),
    ]);

    // Ensure polygon ring is closed
    if (
      geoJsonPolygon[0][0] !== geoJsonPolygon[geoJsonPolygon.length - 1][0] ||
      geoJsonPolygon[0][1] !== geoJsonPolygon[geoJsonPolygon.length - 1][1]
    ) {
      geoJsonPolygon.push([...geoJsonPolygon[0]]);
    }

    // Assumed global/scoped state from your map click or pilot selector
    const firstPoint = geoJsonPolygon[0] || [75.343, 19.883];
    window.selectedLon = firstPoint[0];
    window.selectedLat = firstPoint[1];
    window.selectedAreaHa = finalAreaHa;
    window.selectedIrrigation = "canal";
    window.uploadedDocPath = documentName || null;
    window.currentAssessmentId = `assess_${Date.now()}`;

    const payload = {
      assessment_id: window.currentAssessmentId,
      lat: window.selectedLat,
      lon: window.selectedLon,
      area_ha: finalAreaHa,
      area_hectares: finalAreaHa,
      irrigation: window.selectedIrrigation,
      doc_path: window.uploadedDocPath,
      farmer_name: finalFarmerName.trim(),
      farmerName: finalFarmerName.trim(),
      polygon: geoJsonPolygon,
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

    console.log("Triggering agents with payload:", payload);

    if (onCompleteSubmit) {
      onCompleteSubmit(payload);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md flex flex-col h-full overflow-hidden font-sans shadow-sm">
      {/* Top Header Bar with PIN Code Search and Controls */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 gap-2">
        {/* Location & Coordinates Info */}
        <div className="flex items-center space-x-2">
          {pincodeInfo ? (
            <span className="text-xs font-mono px-3 py-1 rounded-md bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0] flex items-center space-x-1.5 font-bold">
              <MapPin className="w-3.5 h-3.5 text-[#16a34a]" />
              <span className="truncate max-w-[260px]">{pincodeInfo}</span>
            </span>
          ) : (
            <span className="text-xs font-mono px-3 py-1 rounded-md bg-white text-slate-800 font-bold border border-slate-200 shadow-xs">
              Aurangabad Pilot • 19.883°N, 75.343°E
            </span>
          )}
        </div>

        {/* PIN Code Input Form */}
        <form onSubmit={handlePincodeSearch} className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              value={pincodeInput}
              onChange={(e) => {
                setPincodeInput(e.target.value);
                if (pincodeError) setPincodeError('');
              }}
              placeholder="Enter PIN Code e.g. 431001"
              className="h-9 w-56 px-3 rounded-md bg-white border border-slate-300 text-slate-900 text-xs font-mono font-bold placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isGeocoding || !pincodeInput.trim()}
            className="h-9 px-3.5 rounded-md bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white text-xs font-mono font-extrabold border border-[#15803d] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
          >
            {isGeocoding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Search className="w-3.5 h-3.5 text-white" />
            )}
            <span>Locate</span>
          </button>
        </form>

        {/* Action Preset & Tile Switcher */}
        <div className="flex items-center space-x-2">
          {/* Tile Layer Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200">
            {['satellite', 'osm'].map((layerKey) => (
              <button
                key={layerKey}
                type="button"
                onClick={() => setActiveLayer(layerKey)}
                className={`text-xs font-mono px-3 py-1 rounded-md transition-colors uppercase cursor-pointer ${
                  activeLayer === layerKey
                    ? 'bg-[#16a34a] text-white border border-[#15803d] font-extrabold shadow-xs'
                    : 'text-slate-700 font-bold hover:text-slate-950'
                }`}
              >
                {layerKey === 'satellite' ? 'Satellite' : 'OSM'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Geocoding Error Banner if any */}
      {pincodeError && (
        <div className="px-4 py-1.5 bg-red-50 border-b border-red-200 text-red-700 text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-600" />
          <span>{pincodeError}</span>
        </div>
      )}

      {/* Map View */}
      <div className="relative flex-1 min-h-[420px] w-full bg-slate-100">
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
                <div className="bg-white text-slate-900 p-2 font-mono text-xs border border-slate-200 rounded-sm shadow-sm">
                  <div className="font-bold text-[#15803d] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> PIN: {pincodeInput}
                  </div>
                  <div className="text-slate-700 text-[11px] mt-1">{pincodeInfo}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Coordinates: {pincodeMarker[0].toFixed(4)}, {pincodeMarker[1].toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          <FeatureGroup ref={featureGroupRef}>
            <DrawEditControl
              featureGroupRef={featureGroupRef}
              drawTriggerRef={drawTriggerRef}
              finishTriggerRef={finishTriggerRef}
              setIsDrawing={setIsDrawing}
              setPointsCount={setPointsCount}
              onCreated={handleCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
            />

            {/* Display polygon if not already held in drawnItems */}
            {polygonCoords && (!featureGroupRef.current || featureGroupRef.current.getLayers().length === 0) && (
              <Polygon
                positions={polygonCoords}
                pathOptions={{
                  color: '#16a34a',
                  fillColor: '#16a34a',
                  fillOpacity: 0.35,
                  weight: 2.5,
                }}
              />
            )}
          </FeatureGroup>
        </MapContainer>

        {/* Technical Status Overlay */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 border border-slate-200 rounded-md p-3 text-xs font-mono shadow-md pointer-events-auto">
          <div className="text-xs uppercase tracking-wider text-slate-700 font-extrabold mb-1.5">
            Parcel Geometry Status
          </div>
          {polygonCoords ? (
            <div className="flex items-center space-x-2 text-[#15803d] font-bold text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
              <span>{polygonCoords.length} Vertices Bound • {calculatedAreaHa} Ha verified</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-slate-700 font-semibold text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>
                {isDrawing
                  ? `Placing vertices: ${pointsCount} of 4 min required`
                  : 'Click "Select you land" below to outline parcel'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Form Inputs & Pipeline Trigger */}
      <div className="control-bar-footer p-3.5 bg-white border-t border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          {errorMsg && (
            <div className="flex items-center space-x-2 px-3.5 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-mono font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Farmer Name Input */}
            <div className="input-group md:col-span-3">
              <label htmlFor="farmerName" className="block text-xs font-mono uppercase tracking-wider text-slate-950 font-black mb-1.5">
                FARMER FULL NAME
              </label>
              <input
                type="text"
                id="farmerName"
                value={farmerName}
                onChange={(e) => {
                  setFarmerName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. Ramesh G. Patil"
                className="w-full h-10 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-950 text-sm font-bold placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors"
              />
            </div>

            {/* Area (Hectares) Input */}
            <div className="input-group md:col-span-2">
              <label htmlFor="areaInput" className="block text-xs font-mono uppercase tracking-wider text-slate-950 font-black mb-1.5">
                AREA (HECTARES)
              </label>
              <input
                type="number"
                id="areaInput"
                placeholder="e.g. 2.5"
                step="0.1"
                min="0"
                value={areaHa}
                onChange={(e) => {
                  setAreaHa(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full h-10 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-950 text-sm font-bold placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-[#16a34a] focus:bg-white transition-colors"
              />
            </div>

            {/* Cadastral Status & Select Land Button */}
            <div className="cadastral-status md:col-span-2">
              <span id="cadastralLabel" className="block text-xs font-mono uppercase tracking-wider text-slate-950 font-black mb-1.5 truncate">
                CADASTRAL BOUNDARY
              </span>
              <button
                type="button"
                id="selectLandBtn"
                onClick={() => {
                  if (drawTriggerRef.current) {
                    drawTriggerRef.current();
                  }
                }}
                className={`btn-secondary w-full h-10 px-2 rounded-lg font-mono text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 border-2 transition-colors cursor-pointer ${
                  isDrawing
                    ? 'bg-[#f0fdf4] text-[#15803d] border-[#16a34a]'
                    : polygonCoords
                    ? 'bg-[#f0fdf4] text-[#15803d] border-[#16a34a]'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
                }`}
                title="Click to draw parcel boundary polygon on map"
              >
                <MousePointerClick className="w-4 h-4 text-[#16a34a] flex-shrink-0" />
                <span className="truncate">
                  {isDrawing
                    ? 'Drawing Active...'
                    : polygonCoords
                    ? 'SELECT YOU LAND • Drawn'
                    : 'SELECT YOU LAND'}
                </span>
              </button>
            </div>

            {/* Complete Parcel (Finish Button) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-950 font-black mb-1.5">
                COMPLETE PARCEL
              </label>
              <button
                type="button"
                id="finishParcelBtn"
                disabled={!isDrawing || pointsCount < 4}
                onClick={() => {
                  if (finishTriggerRef.current) {
                    finishTriggerRef.current();
                  }
                }}
                className={`w-full h-10 px-2 rounded-lg font-mono text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 border transition-colors ${
                  isDrawing && pointsCount >= 4
                    ? 'bg-[#16a34a] hover:bg-[#15803d] text-white border-[#15803d] cursor-pointer shadow-sm'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
                title={
                  !isDrawing
                    ? 'Click "SELECT YOU LAND" to start drawing'
                    : pointsCount < 4
                    ? `Place at least 4 points on the map (${pointsCount}/4 points placed)`
                    : `Click to complete parcel (${pointsCount} points placed)`
                }
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  {isDrawing && pointsCount >= 4
                    ? `Finish • ${pointsCount} pts`
                    : isDrawing
                    ? `Finish • ${pointsCount} of 4`
                    : 'Finish'}
                </span>
              </button>
            </div>

            {/* Trigger Autonomous Agents Button */}
            <div className="md:col-span-3">
              <button
                type="submit"
                id="triggerAgentsBtn"
                className="btn-primary w-full h-10 px-3 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white font-mono text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-md"
              >
                <span>TRIGGER AUTONOMOUS AGENTS →</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
