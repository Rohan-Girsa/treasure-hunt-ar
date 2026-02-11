/*************************************************
 * AR TREASURE CHEST - LIVE GPS (STABLE VERSION)
 *************************************************/

const TREASURE_CHEST_URL   = "/assets/treasure-chest/shake_treasure_chest.glb";
const TREASURE_CHEST_SCALE = "0.4 0.4 0.4";

const OFFSET_METERS        = 5;     // Chest appears 5m in front
const MAX_GPS_ACCURACY     = 25;    // Ignore bad GPS (>25m)
const MAX_DISTANCE_JUMP    = 20;    // Ignore sudden GPS jumps

let lastPosition = null;
let chestPlaced  = false;

window.onload = () => {
    const scene = document.querySelector("a-scene");

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    navigator.geolocation.watchPosition(
        (position) => {

            const { latitude, longitude, accuracy } = position.coords;

            console.log("GPS:", latitude, longitude, "Accuracy:", accuracy);

            // 1️⃣ Filter bad GPS accuracy
            if (accuracy > MAX_GPS_ACCURACY) {
                console.log("Ignoring poor accuracy:", accuracy);
                return;
            }

            // 2️⃣ Prevent GPS sudden jumps
            if (lastPosition) {
                const distance = getDistance(
                    lastPosition.lat,
                    lastPosition.lng,
                    latitude,
                    longitude
                );

                if (distance > MAX_DISTANCE_JUMP) {
                    console.log("Ignoring GPS jump:", distance);
                    return;
                }
            }

            lastPosition = { lat: latitude, lng: longitude };

            // 3️⃣ Place chest only once
            if (!chestPlaced) {

                // Offset chest 5 meters north (in front of user)
                const latOffset = latitude + (OFFSET_METERS / 111111);

                const chest = document.createElement("a-entity");

                chest.setAttribute(
                    "gps-entity-place",
                    `latitude: ${latOffset}; longitude: ${longitude};`
                );

                chest.setAttribute("gltf-model", TREASURE_CHEST_URL);
                chest.setAttribute("scale", TREASURE_CHEST_SCALE);
                chest.setAttribute("animation-mixer", "");
                chest.setAttribute("look-at", "[gps-camera]");

                scene.appendChild(chest);

                chestPlaced = true;

                console.log("Treasure chest placed!");
            }
        },
        (error) => {
            console.error("GPS Error:", error);
            alert("Unable to access GPS location.");
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        }
    );
};


/*************************************************
 * Distance Calculation (Haversine Formula)
 *************************************************/
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const toRad = (value) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
