import assert from "node:assert/strict";
import test from "node:test";

import {
  getAstraDefaultLocation,
  findAstraLocationByUiId,
  getAstraPrimaryLocation,
  isAstraDefaultLocation,
  mapAstraLocations,
  type AstraLocation,
} from "../src/server/api/routers/location-mapping.ts";

const locations: AstraLocation[] = [
  {
    id: "2a091b4a-f9ea-4b14-a94b-9b2aa2c5e147",
    name: "SMK N 02 Kota Magelang Lobby",
    latitude: -7.449946,
    longitude: 110.223797,
    radius_meters: 500,
    is_active: true,
    created_at: "2025-10-14T01:45:04.000Z",
  },
  {
    id: "a87eaf7b-0307-49ed-956d-ec2e9d7175f6",
    name: "SMK N 02 Kota Magelang Depan",
    latitude: -7.450075,
    longitude: 110.224092,
    radius_meters: 20,
    is_active: true,
    created_at: "2025-10-08T02:48:34.000Z",
  },
  {
    id: "a91de0fa-a40d-40a3-9acc-9d46c39ce0e5",
    name: "dev only!",
    latitude: -7.489793,
    longitude: 110.229263,
    radius_meters: 10000,
    is_active: true,
    created_at: "2025-10-16T06:56:29.000Z",
  },
];

test("UUID location ids become unique stable ordinal UI ids", () => {
  const mapped = mapAstraLocations(locations);

  assert.deepEqual(
    mapped.map((location) => [location.id, location.astraId]),
    [
      [1, "a87eaf7b-0307-49ed-956d-ec2e9d7175f6"],
      [2, "2a091b4a-f9ea-4b14-a94b-9b2aa2c5e147"],
      [3, "a91de0fa-a40d-40a3-9acc-9d46c39ce0e5"],
    ],
  );
});

test("location ordinal and mutation target do not depend on API/name order", () => {
  const reordered = mapAstraLocations([...locations].reverse());

  assert.deepEqual(
    reordered.map((location) => [location.id, location.astraId]),
    [
      [1, "a87eaf7b-0307-49ed-956d-ec2e9d7175f6"],
      [2, "2a091b4a-f9ea-4b14-a94b-9b2aa2c5e147"],
      [3, "a91de0fa-a40d-40a3-9acc-9d46c39ce0e5"],
    ],
  );
  assert.equal(
    findAstraLocationByUiId(locations, 2)?.id,
    "2a091b4a-f9ea-4b14-a94b-9b2aa2c5e147",
  );
});

test("first-created location is the protected default and primary", () => {
  const reordered = [
    { ...locations[2]!, is_active: true },
    { ...locations[0]!, is_active: true },
    { ...locations[1]!, is_active: true },
  ];

  assert.equal(
    getAstraDefaultLocation(reordered)?.id,
    "a87eaf7b-0307-49ed-956d-ec2e9d7175f6",
  );
  assert.equal(
    getAstraPrimaryLocation(reordered)?.id,
    "a87eaf7b-0307-49ed-956d-ec2e9d7175f6",
  );
  assert.equal(
    isAstraDefaultLocation(reordered, "a87eaf7b-0307-49ed-956d-ec2e9d7175f6"),
    true,
  );
  assert.equal(
    isAstraDefaultLocation(reordered, "2a091b4a-f9ea-4b14-a94b-9b2aa2c5e147"),
    false,
  );
});
