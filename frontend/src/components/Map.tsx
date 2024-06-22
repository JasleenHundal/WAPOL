import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./Map.css";

import {
  Capability,
  EmergencyLevel,
  Emergency,
  Resource,
} from "../types/types.ts";
import jsonData from "../data/capabilities.json";
import { useRef, useEffect, useState } from "react";
import { Geometry } from "./types.ts";

const MAPBOX_KEY = import.meta.env.VITE_MAPBOX_KEY;
type LatLong = { lat: number; long: number };
type GeoJSON = {
  type: "Feature";
  properties: {};
  geometry: Geometry;
};
type Route = {
  start: LatLong;
  end: LatLong;
  geojson: GeoJSON;
  id: string;
};

const START_POSITION = { lat: -31.9498342, long: 115.8578795 };
const END_POSITION = { lat: -31.7387003, long: 115.7672242 };

const drawLine = (route: Route, map: mapboxgl.Map) => {
  if (map.getSource(route.id)) {
    // @ts-ignore
    map.getSource(route.id).setData(route.geojson);
  } else {
    map.addLayer({
      id: route.id,
      type: "line",
      source: {
        type: "geojson",
        // @ts-ignore
        data: route.geojson,
      },

      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#3887be",
        "line-width": 5,
        "line-opacity": 0.75,
      },
    });
  }
};

type VehicleState = {
  vehicleId: number;
  location: LatLong;
  type: Capability;
  percent: number | null;
  route: Route | null;
};

const capabilityToImage: Record<Capability, string> = {
  [Capability.A]: "police_car",
  [Capability.B]: "police_van",
  [Capability.C]: "motorcycle",
  [Capability.D]: "fire_truck",
  [Capability.E]: "ambulance",
};

const getRoute = async (start: LatLong, end: LatLong): Promise<Route> => {
  const requestUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.long},${start.lat};${end.long},${end.lat}?steps=true&geometries=geojson&access_token=${MAPBOX_KEY}`;
  const result = await fetch(requestUrl, {
    method: "GET",
  });
  const json = await result.json();

  const [route] = json.routes;

  const geojson = {
    type: "Feature" as const,
    properties: {},
    geometry: route.geometry,
  };

  return {
    geojson,
    start,
    end,
    id: `${start.lat}-${start.long}:${end.lat}-${end.long}`,
  };
};

  const resources: Resource[] = jsonData;

const emergencies: Emergency[] = [
  {
    capability: [Capability.A],
    location: { latitude: -32, longitude: 115.9 },
    emergencyId: 1,
    emergencyLevel: EmergencyLevel.Immediate,
    offset: 0,
  },
  {
    capability: [Capability.C],
    location: { latitude: -33, longitude: 115.9 },
    emergencyId: 2,
    emergencyLevel: EmergencyLevel.Urgent,
    offset: 1500,
  },
  {
    capability: [Capability.E],
    location: { latitude: -31, longitude: 115.9 },
    emergencyId: 3,
    emergencyLevel: EmergencyLevel.NonUrgent,
    offset: 3000,
  },
];

const drawVehicle = (map: mapboxgl.Map, vehicle: VehicleState) => {
  if (map.getSource(`src_vehicle_${vehicle.vehicleId.toString()}`)) {
    // @ts-expect-error setdata cbf fixing
    map.getSource(`src_vehicle_${vehicle.vehicleId.toString()}`).setData(
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [vehicle.location.long, vehicle.location.lat],
        },
      },
    );
  } else {

    map.addSource(`src_vehicle_${vehicle.vehicleId.toString()}`, {
      type: "geojson",
      data: {
        properties: {},
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [vehicle.location.long, vehicle.location.lat],
        },
      },
    });

    map.addLayer({
      id: `layer_vehicle_${vehicle.vehicleId.toString()}`,
      type: 'symbol',
      source: `src_vehicle_${vehicle.vehicleId.toString()}`,
      layout: {
        'icon-image': capabilityToImage[vehicle.type],
        'icon-size': 0.2
      }
    });
  }
}

const Map = () => {
  mapboxgl.accessToken = MAPBOX_KEY;
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [time, setTime] = useState(0);

  const [vehicleStates, setVehicleStates] = useState<VehicleState[]>([]);

  const emergencies: Emergency[] = [
    {
      capability: [Capability.A],
      location: { latitude: -32, longitude: 115.9 },
      emergencyId: 1,
      emergencyLevel: EmergencyLevel.Immediate,
      requirements: [1, 0, 0, 0, 0],
      offset: 0,
    },
    {
      capability: [Capability.C],
      location: { latitude: -33, longitude: 115.9 },
      emergencyId: 2,
      emergencyLevel: EmergencyLevel.Urgent,
      requirements: [0, 0, 1, 0, 0],
      offset: 15000,
    },
    {
      capability: [Capability.E],
      location: { latitude: -31, longitude: 115.9 },
      emergencyId: 3,
      requirements: [0, 0, 0, 0, 1],
      emergencyLevel: EmergencyLevel["Non-Urgent"],
      offset: 6000,
    },
  ];

  const [resources, _] = useState<Resource[]>(jsonData);

  const initialiseMap = () => {
    if (map.current || !mapContainer.current) return; // initialize map only once

    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [START_POSITION.long, START_POSITION.lat],
      zoom: 9,
    });


    Object.entries(capabilityToImage).forEach(([capability, image]) => {
      if (currentMap.hasImage(image)) {
        return
      }

      currentMap.loadImage(`${image}.png`, (error, image_obj) => {
        if (error) throw error;
        if (!image_obj) {
          return
        }

        currentMap.addImage(image, image_obj);
      })
    });

    map.current = currentMap;
  };

  const setTimer = () => {
    const interval = setInterval(() => {
      setTime((prevTime) => prevTime + 3000); // Increment time every 500ms
    }, 3000);
    return interval;
  };

  useEffect(() => {
    initialiseMap();

    fetch('capabilities.json').then((res) => res.json()).then((data) => {
      data = data.map((vehicle: any) => {
          return {
            vehicleId: vehicle.id,
            location: { lat: vehicle.latitude, long: vehicle.longitude },
            type: vehicle.capability,
          }
        }
      );
      
      setVehicleStates(data);
    });

    const interval = setTimer();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!map.current) return;

    const formattedResources = resources.map((resource) => ({
      lat: resource.latitude,
      lon: resource.longitude,
      capability: resource.capability,
      id: resource.id,
    }));

    const formattedEmergencies = emergencies.map((emergency) => {
    if (time < emergency.offset) {
      return null;
    }    
    
    return {
        lat: emergency.location.latitude,
        lon: emergency.location.longitude,
        priority: EmergencyLevel[emergency.emergencyLevel],
        requirements: emergency.requirements,
        id: emergency.emergencyId,
      };
    }).filter(emergency => emergency !== null);

    const payload = {
      cars: formattedResources,
      emergencies: formattedEmergencies,
    };

    console.log("Sending optimization data:", payload);

    fetch("https://seeking-a-route.fly.dev/optimise/", {
      body: JSON.stringify(payload),
      method: "POST",
      headers: {
        "Access-Control-Allow-Origin": "http://locahost:5173",
      },
    }).then((res) => {
      console.log(res);
    });

    emergencies.forEach((emergency) => {
      if (time === emergency.offset && map.current) {
        new mapboxgl.Marker()
          .setLngLat([
            emergency.location.longitude,
            emergency.location.latitude,
          ])
          .addTo(map.current);
      }
    });
  }, [time, emergencies]);

  routes.forEach((route) => {
    map.current && drawLine(route, map.current);
  });

  vehicleStates.forEach((vehicleState) => {
    map.current && drawVehicle(map.current, vehicleState);
  });

  return (
    <>
      <button
        onClick={async () => {
          if (!map.current) {
            return;
          }
          const route = await getRoute(START_POSITION, END_POSITION);
          setRoutes([route]);
        }}
      >
        Click me
      </button>
      <div
        ref={mapContainer}
        className="map-container"
        style={{ width: "100%", height: "100%" }}
      ></div>
    </>
  );
};
export default Map;
