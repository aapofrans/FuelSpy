"use client";

import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type Station = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  price: number;
  updatedAt: string;
  source: "user" | "avg";
};

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

export default function FuelMap({
  mapCenter,
  userLocation,
  radiusKm,
  filteredStations,
  cheapestNearby,
}: {
  mapCenter: [number, number];
  userLocation: [number, number] | null;
  radiusKm: number;
  filteredStations: Station[];
  cheapestNearby: Station | null;
}) {
  return (
    <MapContainer
      center={mapCenter}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FixMapSize />
      <RecenterMap center={mapCenter} />

      {userLocation && (
        <>
          <Circle
            center={userLocation}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#3b82f6",
              fillOpacity: 0.12,
            }}
          />
          <CircleMarker
            center={userLocation}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#2563eb",
              fillOpacity: 1,
            }}
          >
            <Popup>Sinä olet täällä 📍</Popup>
          </CircleMarker>
        </>
      )}

      {filteredStations.map((station) => {
        const isCheapest = cheapestNearby?.id === station.id;

        return (
          <CircleMarker
            key={station.id}
            center={[station.lat, station.lon]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: isCheapest ? "#22c55e" : "#ef4444",
              fillOpacity: 1,
            }}
          >
            <Popup>
              <strong>{station.name}</strong>
              <br />
              💰 {station.price.toFixed(3)} €/L
              <br />
              🕒 {station.updatedAt}
              <br />
              📌 {station.source === "user" ? "Käyttäjän päivitys" : "Keskiarvo"}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}