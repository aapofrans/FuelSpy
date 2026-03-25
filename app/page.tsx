"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  Circle,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Station = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  price: number;
  updatedAt: string;
  source: "user" | "avg";
};

const DEFAULT_CENTER: [number, number] = [61.4851, 21.7974]; // Pori



const redIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 18px;
      height: 18px;
      background: #ef4444;
      border: 3px solid white;
      border-radius: 9999px;
      box-shadow: 0 0 0 2px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const greenIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 22px;
      height: 22px;
      background: #22c55e;
      border: 3px solid white;
      border-radius: 9999px;
      box-shadow: 0 0 0 3px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const userIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: #3b82f6;
      border: 4px solid white;
      border-radius: 9999px;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

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
    map.setView(center, 11);
  }, [center, map]);

  return null;
}

export default function Home() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [radiusKm, setRadiusKm] = useState(5);

  const [stations, setStations] = useState<Station[]>([
    {
      id: "pori-1",
      name: "Neste Pori Tiilimäki",
      lat: 61.47764,
      lon: 21.781168,
      price: 1.799,
      updatedAt: "5 min sitten",
      source: "user",
    },
    {
      id: "pori-2",
      name: "ABC Pori",
      lat: 61.478879,
      lon: 21.757725,
      price: 1.829,
      updatedAt: "18 min sitten",
      source: "avg",
    },
    {
      id: "pori-3",
      name: "Neste Express Kampus",
      lat: 61.47558,
      lon: 21.794265,
      price: 1.789,
      updatedAt: "2 min sitten",
      source: "user",
    },
    {
      id: "pori-4",
      name: "Neste Pori Siltapuisto",
      lat: 61.497764,
      lon: 21.804629,
      price: 1.819,
      updatedAt: "25 min sitten",
      source: "avg",
    },
    {
      id: "pori-5",
      name: "ABC Ulvila",
      lat: 61.42617,
      lon: 21.870421,
      price: 1.809,
      updatedAt: "just nyt",
      source: "user",
    },
  ]);

  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        console.log("Sijaintia ei sallittu");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }, []);

  function updateStationPrice(stationId: string) {
    const rawValue = draftPrices[stationId];

    if (!rawValue) return;

    const parsedPrice = Number(rawValue.replace(",", "."));

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      alert("Anna kelvollinen hinta, esim. 1.799");
      return;
    }

    setStations((prevStations) =>
      prevStations.map((station) =>
        station.id === stationId
          ? {
              ...station,
              price: parsedPrice,
              updatedAt: "just nyt",
              source: "user",
            }
          : station
      )
    );

    setDraftPrices((prev) => ({
      ...prev,
      [stationId]: "",
    }));
  }

  const filteredStations = useMemo(() => {
    if (!userLocation) return stations;

    return stations.filter((station) => {
      const distance = getDistance(
        userLocation[0],
        userLocation[1],
        station.lat,
        station.lon
      );

      return distance <= radiusKm;
    });
  }, [stations, userLocation, radiusKm]);

  const cheapestNearby = useMemo(() => {
    if (!userLocation || filteredStations.length === 0) return null;

    return filteredStations.reduce((min, current) =>
      current.price < min.price ? current : min
    );
  }, [filteredStations, userLocation]);

  const mapCenter = userLocation ?? DEFAULT_CENTER;

  return (
    <main className="h-screen w-full">
      <div className="absolute left-4 top-4 z-[1000] w-[320px] rounded-2xl bg-white/95 p-4 shadow-xl">
        <h1 className="text-2xl font-bold">FuelSpy</h1>
        <p className="mt-1 text-sm text-gray-600">Testiasemat Porin alueella</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {[5, 10, 15, 20, 40, 60, 80, 100].map((km) => (
            <button
              key={km}
              onClick={() => setRadiusKm(km)}
              className={`rounded-full px-3 py-1 text-sm font-medium border transition ${
                radiusKm === km
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {km} km
            </button>
          ))}
        </div>

        {cheapestNearby && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Halvin {radiusKm} km säteellä
            </p>
            <p className="mt-1 text-base font-bold text-gray-900">
              {cheapestNearby.name}
            </p>
            <p className="text-sm text-gray-700">
              {cheapestNearby.price.toFixed(3)} €/L
            </p>
          </div>
        )}

        {filteredStations.length === 0 ? (
          <div className="mt-4 rounded-lg border border-gray-200 px-3 py-4 text-sm text-gray-500">
            Tällä säteellä ei löytynyt asemia.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {filteredStations.map((station) => (
              <div
                key={station.id}
                className="rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="font-semibold">{station.name}</div>

                <div className="text-sm text-gray-600">
                  {station.price.toFixed(3)} €/L
                  {userLocation && (
                    <span className="ml-2">
                      •{" "}
                      {getDistance(
                        userLocation[0],
                        userLocation[1],
                        station.lat,
                        station.lon
                      ).toFixed(1)}{" "}
                      km
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  🕒 {station.updatedAt} •{" "}
                  {station.source === "user"
                    ? "Käyttäjän päivitys"
                    : "Keskiarvo"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MapContainer
        center={mapCenter}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FixMapSize />
        <RecenterMap center={mapCenter} />

        {userLocation && (
          <Marker position={userLocation} icon={userIcon}>
            <Popup>Sinä olet täällä 📍</Popup>
          </Marker>
        )}

        {userLocation && (
          <Circle
            center={userLocation}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#3b82f6",
              fillOpacity: 0.12,
            }}
          />
        )}

        {filteredStations.map((station) => {
          const isCheapest = cheapestNearby?.id === station.id;

          return (
            <Marker
              key={station.id}
              position={[station.lat, station.lon]}
              icon={isCheapest ? greenIcon : redIcon}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <strong>{station.name}</strong>
                  <br />
                  💰 {station.price.toFixed(3)} €/L
                  <br />
                  🕒 {station.updatedAt}
                  <br />
                  📌{" "}
                  {station.source === "user"
                    ? "Käyttäjän päivitys"
                    : "Keskiarvo"}

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Päivitä hinta
                    </label>

                    <input
                      type="text"
                      placeholder="Esim. 1.799"
                      value={draftPrices[station.id] ?? ""}
                      onChange={(e) =>
                        setDraftPrices((prev) => ({
                          ...prev,
                          [station.id]: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />

                    <button
                      onClick={() => updateStationPrice(station.id)}
                      className="mt-2 w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                    >
                      Tallenna uusi hinta
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </main>
  );
}