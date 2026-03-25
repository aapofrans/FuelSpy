"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Station } from "./components/FuelMap";

const FuelMap = dynamic(() => import("./components/FuelMap"), {
  ssr: false,
});

const DEFAULT_CENTER: [number, number] = [61.4851, 21.7974];

const MAX_UPDATE_DISTANCE_KM = 0.5;

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
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

function formatRelativeTime(input: string) {
  const date = new Date(input);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);

  if (minutes < 1) return "just nyt";
  if (minutes < 60) return `${minutes} min sitten`;
  if (hours < 24) return `${hours} h sitten`;

  return date.toLocaleString("fi-FI");
}

export default function Home() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [radiusKm, setRadiusKm] = useState(5);

  const MAX_UPDATE_DISTANCE_KM = 0.5;

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

  useEffect(() => {
    async function loadStations() {
      try {
        setLoadingStations(true);
        setLoadError("");

        const { data: stationRows, error: stationError } = await supabase
          .from("stations")
          .select("*")
          .order("name", { ascending: true });

        if (stationError) {
          console.error("stations error:", stationError);
          setLoadError("Asemien haku epäonnistui: " + stationError.message);
          return;
        }

        const { data: priceRows, error: priceError } = await supabase
          .from("price_updates")
          .select("*")
          .order("created_at", { ascending: false });

        if (priceError) {
          console.error("price_updates error:", priceError);
          setLoadError("Hintojen haku epäonnistui: " + priceError.message);
          return;
        }

        const mapped: Station[] = (stationRows || []).map((station) => {
          const latest = (priceRows || []).find(
            (p) => p.station_id === station.id
          );

          return {
            id: station.id,
            name: station.name,
            lat: station.lat,
            lon: station.lon,
            price: latest ? Number(latest.price) : 0,
            updatedAt: latest ? formatRelativeTime(latest.created_at) : "-",
            source: latest?.source === "avg" ? "avg" : "user",
          };
        });

        setStations(mapped);
      } catch (error) {
        console.error("loadStations crash:", error);
        setLoadError("Datassa tapahtui virhe");
      } finally {
        setLoadingStations(false);
      }
    }

    loadStations();
  }, []);

  async function updateStationPrice(stationId: string) {
    const rawValue = draftPrices[stationId];

    if (!rawValue) return;

    const parsedPrice = Number(rawValue.replace(",", "."));

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      alert("Anna kelvollinen hinta, esim. 1.799");
      return;
    }

    if (!userLocation) {
      alert("Sijaintia ei löytynyt. Salli sijainnin käyttö ensin.");
      return;
    }

    const station = stations.find((s) => s.id === stationId);

    if (!station) {
      alert("Asemaa ei löytynyt.");
      return;
    }

    const distanceKm = getDistance(
      userLocation[0],
      userLocation[1],
      station.lat,
      station.lon
    );

    if (distanceKm > MAX_UPDATE_DISTANCE_KM) {
      alert(
        `Voit päivittää hinnan vain, jos olet enintään ${MAX_UPDATE_DISTANCE_KM.toFixed(
          1
        )} km päässä asemasta. Olet nyt ${distanceKm.toFixed(2)} km päässä.`
      );
      return;
    }

    const { error } = await supabase.from("price_updates").insert({
      station_id: stationId,
      price: parsedPrice,
      source: "user",
    });

    if (error) {
      console.error("insert error:", error);
      alert("Hinnan tallennus epäonnistui: " + error.message);
      return;
    }

    setStations((prevStations) =>
      prevStations.map((s) =>
        s.id === stationId
          ? {
              ...s,
              price: parsedPrice,
              updatedAt: "just nyt",
              source: "user",
            }
          : s
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
        <p className="mt-1 text-sm text-gray-600">Porin alueen asemat</p>

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

        {loadingStations && (
          <div className="mt-4 rounded-lg border border-gray-200 px-3 py-4 text-sm text-gray-500">
            Ladataan asemia...
          </div>
        )}

        {loadError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {!loadingStations && !loadError && cheapestNearby && (
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

        {!loadingStations && !loadError && (
          <>
            {filteredStations.length === 0 ? (
              <div className="mt-4 rounded-lg border border-gray-200 px-3 py-4 text-sm text-gray-500">
                Tällä säteellä ei löytynyt asemia.
              </div>
            ) : (
              <div className="mt-4 max-h-[60vh] space-y-2 overflow-auto">
                {filteredStations.map((station) => {
                  const distanceToStation = userLocation
                    ? getDistance(
                        userLocation[0],
                        userLocation[1],
                        station.lat,
                        station.lon
                      )
                    : null;

                  const canUpdate =
                    distanceToStation !== null &&
                    distanceToStation <= MAX_UPDATE_DISTANCE_KM;

                  return (
                    <div
                      key={station.id}
                      className="rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <div className="font-semibold">{station.name}</div>

                      <div className="text-sm text-gray-600">
                        {station.price.toFixed(3)} €/L
                        {userLocation && (
                          <span className="ml-2">
                            • {distanceToStation?.toFixed(1)} km
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        🕒 {station.updatedAt} •{" "}
                        {station.source === "user"
                          ? "Käyttäjän päivitys"
                          : "Keskiarvo"}
                      </div>

                      <div className="mt-3">
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

                        {userLocation && (
                          <div className="mt-2 text-xs text-gray-500">
                            Päivitys sallittu vain alle{" "}
                            {MAX_UPDATE_DISTANCE_KM} km etäisyydellä. Nyt:{" "}
                            {distanceToStation?.toFixed(2)} km
                          </div>
                        )}

                        {!userLocation && (
                          <div className="mt-2 text-xs text-gray-500">
                            Salli sijainti, jotta voit päivittää hinnan.
                          </div>
                        )}

                        <button
                          onClick={() => updateStationPrice(station.id)}
                          disabled={!canUpdate}
                          className={`mt-2 w-full rounded px-3 py-2 text-sm font-medium text-white ${
                            canUpdate
                              ? "bg-blue-600"
                              : "bg-gray-400 cursor-not-allowed"
                          }`}
                        >
                          Tallenna uusi hinta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <FuelMap
        mapCenter={mapCenter}
        userLocation={userLocation}
        radiusKm={radiusKm}
        filteredStations={filteredStations}
        cheapestNearby={cheapestNearby}
      />
    </main>
  );
}