/*************************************************
 * AR TREASURE HUNT - FIXED TREASURE LOCATION
 * Treasure placed 5m north of base coordinates
 *************************************************/

// ─── Global Configuration ────────────────────────────────────────
const VISIBILITY_DISTANCE = 20; // meters — chest visible within this distance
const CAPTURE_DISTANCE = 10; // meters — can capture/open within this distance

// BASE COORDINATES (will be set from actual GPS)
let BASE_LATITUDE = null;
let BASE_LONGITUDE = null;

// Global state
let treasureLocation = null; // Will be set to exactly 5m north of base
let activeEntity = null;
let isCaptured = false;
let sceneEl = null;
let currentUserGPS = null; // Track current GPS position
let deviceHeading = 0; // Track device compass heading
let treasureBearing = 0; // Bearing to treasure

const modelName = "Gold Chest";

// FIXED SINGLE GLB
const TREASURE_CHEST_URL = "./assets/treasure-chest/shake_treasure_chest.glb";
const TREASURE_CHEST_SCALE = [0.4, 0.4, 0.4];
const CHEST_ANIMATION_INDEX = 2;
const CHEST_ANIMATION_START_TIME = 0;
const CHEST_ANIMATION_END_TIME = null;

// FIXED ORIENTATION COMPONENT
AFRAME.registerComponent("chest-animation", {
    init: function () {
        this.modelLoaded = false;
        this.mixer = null;
        this.chestOpenAction = null;
        this.clock = new THREE.Clock();
        this.isCapturing = false;
        this.lockedPositionZ = -3.2;
        this.model = null;
    },

    tick: function () {
        if (this.mixer && this.clock) {
            const delta = this.clock.getDelta();

            if (
                this.chestOpenAction &&
                this.chestOpenAction.isRunning() &&
                CHEST_ANIMATION_END_TIME !== null
            ) {
                const currentTime = this.chestOpenAction.time;
                if (currentTime >= CHEST_ANIMATION_END_TIME) {
                    this.chestOpenAction.paused = true;
                    this.chestOpenAction.time = CHEST_ANIMATION_END_TIME;
                }
            }

            this.mixer.update(delta);
        }

        if (this.model && !this.isCapturing && this.modelLoaded) {
            this.model.rotation.y += 0.002;
        }

        if (this.model && this.isCapturing) {
            this.model.position.z = this.lockedPositionZ;
        }
    },

    playChestAnimation: function () {
        if (!this.modelLoaded || !this.el.sceneEl?.renderer) return;

        console.log("🎬 Opening chest - lid away from camera");

        this.isCapturing = true;
        this.lockedPositionZ = -3.2;

        if (this.model) {
            // const box = new THREE.Box3().setFromObject(this.model);
            // const center = box.getCenter(new THREE.Vector3());

            // Position the chest in front of camera
            // this.model.position.x = -center.x;
            // this.model.position.y = -center.y;
            // this.model.position.z = -3.2;

            // Get camera position
            const camera = this.el.sceneEl.camera;
            const worldCameraPos = new THREE.Vector3();
            camera.getWorldPosition(worldCameraPos);

            // Get model world position
            const modelWorldPos = new THREE.Vector3();
            this.model.getWorldPosition(modelWorldPos);

            // Calculate direction from camera to model
            const direction = new THREE.Vector3().subVectors(
                modelWorldPos,
                worldCameraPos,
            );
            direction.y = 0; // Keep on horizontal plane
            direction.normalize();

            // Calculate the angle to make chest face camera
            const angle = Math.atan2(direction.x, direction.z);

            // Rotate chest 180 degrees so lid opens AWAY from camera
            this.model.rotation.y = angle + Math.PI;

            console.log(
                "Camera angle:",
                ((angle * 180) / Math.PI).toFixed(2),
                "degrees",
            );
            console.log(
                "Chest rotation:",
                ((this.model.rotation.y * 180) / Math.PI).toFixed(2),
                "degrees",
            );
        }

        // const openingEl = document.getElementById('chest-opening');
        // if (openingEl) openingEl.style.display = 'block';

        if (this.chestOpenAction && this.mixer) {
            this.chestOpenAction.reset();
            this.chestOpenAction.time = CHEST_ANIMATION_START_TIME;

            const animationClip = this.chestOpenAction.getClip();
            const endTime =
                CHEST_ANIMATION_END_TIME !== null
                    ? CHEST_ANIMATION_END_TIME
                    : animationClip.duration;
            const effectiveDuration = endTime - CHEST_ANIMATION_START_TIME;

            this.chestOpenAction.play();
            // ✨ Glow burst from INSIDE chest
            if (this.glowMesh) {
                this.glowMesh.visible = true;

                // Reset
                this.glowMesh.scale.set(0.1, 0.1, 0.1);
                this.glowMesh.material.opacity = 0;

                // Scale up
                this.glowMesh.scale.set(2, 2, 2);

                // Fade in
                this.glowMesh.material.opacity = 0.9;

                // Fade out smoothly
                setTimeout(() => {
                    if (this.glowMesh) {
                        this.glowMesh.material.opacity = 0;
                    }
                }, 600);
            }

            setTimeout(
                () => {
                    this.isCapturing = false;
                    // if (openingEl) openingEl.style.display = 'none';
                    this.completeCapture();
                },
                effectiveDuration * 1000 + 300,
            );
        } else {
            setTimeout(() => {
                this.isCapturing = false;
                // if (openingEl) openingEl.style.display = 'none';
                this.completeCapture();
            }, 2000);
        }
    },

    completeCapture: function () {
        const messageEl = document.getElementById("captured-message");
        if (messageEl) {
            messageEl.innerHTML = `🎉 ${modelName} Captured! 🎉<div style="font-size: 16px; margin-top: 12px; font-weight: 500;">Treasure is now yours!</div>`;
            messageEl.style.display = "block";

            setTimeout(() => {
                messageEl.style.display = "none";
                window.completeCapture?.();
            }, 3000);
        }
    },

    onModelLoaded: function (model) {
        this.model = model;
        this.modelLoaded = true;

        model.scale.set(...TREASURE_CHEST_SCALE);

        // Center the model at origin - DO NOT position relative to camera
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x = -center.x;
        model.position.y = 0; // Ground level
        model.position.z = -center.z;

        model.traverse((child) => {
            if (child.isMesh) child.userData.clickable = true;
        });

        if (model.animations?.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            this.chestOpenAction = this.mixer.clipAction(
                model.animations[CHEST_ANIMATION_INDEX],
            );
            this.chestOpenAction.setLoop(THREE.LoopOnce);
            this.chestOpenAction.clampWhenFinished = true;
            this.chestOpenAction.time = CHEST_ANIMATION_START_TIME;
            this.chestOpenAction.setEffectiveTimeScale(1);
            this.chestOpenAction.setEffectiveWeight(1);
        }
        // 🌟 Green glow attached INSIDE the chest mesh
        // const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        // const glowMaterial = new THREE.MeshBasicMaterial({
        //   color: 0x22c55e,
        //   transparent: true,
        //   opacity: 0,
        //   depthWrite: false,
        // });

        // const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);

        // // 📍 Position INSIDE chest cavity (local to mesh)
        // glowMesh.position.set(0, 0.45, 0); // <-- tweak if needed

        // glowMesh.visible = false;

        // // 🔗 Attach glow to actual chest model
        // model.add(glowMesh);

        // // Save reference
        // this.glowMesh = glowMesh;
        const textureLoader = new THREE.TextureLoader();
        const glowTexture = textureLoader.load("./assets/yellow-glow.png");

        // Create sprite material
        const glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xffffff, // keep white so texture color shows properly
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending, // makes glow look soft & luminous
        });

        // Create sprite (NOT sphere)
        const glowMesh = new THREE.Sprite(glowMaterial);

        // 📍 Position inside chest
        glowMesh.position.set(0, 0.45, 0);

        // Initial small size
        glowMesh.scale.set(0.2, 0.2, 0.2);

        glowMesh.visible = false;

        // Attach to actual chest mesh
        model.add(glowMesh);

        // Save reference
        this.glowMesh = glowMesh;
    },
});

/*************************************************
 * INIT
 *************************************************/
window.onload = () => {
    sceneEl = document.querySelector("a-scene");
    if (!sceneEl) {
        console.error("a-scene not found");
        return;
    }

    sceneEl.addEventListener("click", tryCapture, true);

    // Treasure location will be calculated when GPS is acquired

    waitForGPSAndStart();
    startGPSTracking();
    startVisibilityCheck();
    startOrientationTracking();
};

window.completeCapture = function () {
    isCaptured = true;
    if (activeEntity?.parentNode) {
        activeEntity.parentNode.removeChild(activeEntity);
    }
    activeEntity = null;

    updateCapturedList();

    console.log("Treasure captured successfully!");
};

/*************************************************
 * CORE FUNCTIONS
 *************************************************/
function waitForGPSAndStart() {
    const camera = document.querySelector("[gps-camera]");
    const gps = camera?.components?.["gps-camera"]?.currentCoords;

    if (!gps?.latitude || !gps?.longitude) {
        requestAnimationFrame(waitForGPSAndStart);
        return;
    }

    console.log("GPS acquired:", gps);

    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";

    // Set base coordinates from actual GPS on first load
    if (BASE_LATITUDE === null || BASE_LONGITUDE === null) {
        BASE_LATITUDE = gps.latitude;
        BASE_LONGITUDE = gps.longitude;
        console.log("Base coordinates set from GPS:", BASE_LATITUDE, BASE_LONGITUDE);

        // Calculate treasure location 5m north from base
        treasureLocation = offsetLatLng(BASE_LATITUDE, BASE_LONGITUDE, 5, 0);
        console.log("Treasure location (5m North):", treasureLocation);
    }

    // Store initial GPS
    currentUserGPS = {
        latitude: gps.latitude,
        longitude: gps.longitude,
    };

    showTreasure();
}

function startGPSTracking() {
    setInterval(() => {
        const camera = document.querySelector("[gps-camera]");
        const gps = camera?.components?.["gps-camera"]?.currentCoords;
        const gpsInfo = document.getElementById("gps-info");
        const treasureInfo = document.getElementById("treasure-info");

        if (gps && gps.latitude && gps.longitude) {
            // Update current GPS position
            currentUserGPS = {
                latitude: gps.latitude,
                longitude: gps.longitude,
            };

            const lat = gps.latitude.toFixed(6);
            const lng = gps.longitude.toFixed(6);

            if (gpsInfo) {
                gpsInfo.innerHTML = `Your GPS:<br>Lat: ${lat}<br>Lng: ${lng}`;
            }

            // Show treasure location
            if (treasureInfo && treasureLocation) {
                const treasureLat = treasureLocation.lat.toFixed(6);
                const treasureLng = treasureLocation.lng.toFixed(6);
                treasureInfo.innerHTML = `Treasure GPS:<br>Lat: ${treasureLat}<br>Lng: ${treasureLng}`;
            }

            // Update distance display with current GPS
            updateDistanceDisplay();
        } else {
            if (gpsInfo) {
                gpsInfo.innerHTML = "GPS: waiting...";
            }
        }
    }, 500); // Update every 500ms for smooth tracking
}

function updateDistanceDisplay() {
    const distanceEl = document.getElementById("distance-info");

    if (!distanceEl || !treasureLocation || !currentUserGPS) {
        if (distanceEl) distanceEl.innerHTML = "Distance: —";
        return;
    }

    const distance = getDistanceMeters(
        currentUserGPS.latitude,
        currentUserGPS.longitude,
        treasureLocation.lat,
        treasureLocation.lng,
    );

    // Color coding based on distance
    let color = "#ff4444"; // red = far
    if (distance <= CAPTURE_DISTANCE) {
        color = "#0f0"; // green = very close (can capture)
    } else if (distance <= VISIBILITY_DISTANCE) {
        color = "#ffcc00"; // yellow = visible range
    }

    distanceEl.innerHTML = `Distance: ${distance.toFixed(1)} m`;
    distanceEl.style.color = color;
    distanceEl.style.fontWeight = "bold";
}

function startVisibilityCheck() {
    function check() {
        if (!activeEntity) {
            requestAnimationFrame(check);
            return;
        }

        if (!currentUserGPS || !treasureLocation) {
            requestAnimationFrame(check);
            return;
        }

        const distance = getDistanceMeters(
            currentUserGPS.latitude,
            currentUserGPS.longitude,
            treasureLocation.lat,
            treasureLocation.lng,
        );

        // Show/hide chest based on distance
        const shouldBeVisible = distance <= VISIBILITY_DISTANCE && !isCaptured;
        activeEntity.setAttribute("visible", shouldBeVisible);

        requestAnimationFrame(check);
    }
    check();
}

function showTreasure() {
    if (!treasureLocation) {
        console.error("Treasure location not set!");
        return;
    }

    if (isCaptured) {
        console.log("Treasure already captured!");
        return;
    }

    const entity = document.createElement("a-entity");

    entity.setAttribute(
        "gps-entity-place",
        `latitude: ${treasureLocation.lat}; longitude: ${treasureLocation.lng}`,
    );
    entity.setAttribute("gltf-model", `url(${TREASURE_CHEST_URL})`);
    entity.setAttribute("scale", "1 1 1");
    entity.setAttribute("rotation", "0 0 0");
    entity.setAttribute("visible", "false");

    entity.addEventListener("model-loaded", (e) => {
        console.log("Treasure chest model loaded!");
        entity.components?.["chest-animation"]?.onModelLoaded(e.detail.model);
    });

    entity.setAttribute("chest-animation", "");

    sceneEl.appendChild(entity);
    activeEntity = entity;

    console.log(
        `Treasure placed at: ${treasureLocation.lat.toFixed(6)}, ${treasureLocation.lng.toFixed(6)}`,
    );
}

function tryCapture(event) {
    if (event.target.tagName === "BUTTON" || !activeEntity || isCaptured) return;

    if (!currentUserGPS) {
        console.log("GPS not available");
        return;
    }

    const distance = getDistanceMeters(
        currentUserGPS.latitude,
        currentUserGPS.longitude,
        treasureLocation.lat,
        treasureLocation.lng,
    );

    console.log(
        `Distance to treasure: ${distance.toFixed(2)}m (need to be within ${CAPTURE_DISTANCE}m)`,
    );

    if (distance <= CAPTURE_DISTANCE) {
        console.log("Capturing treasure!");
        activeEntity.components?.["chest-animation"]?.playChestAnimation();
    } else {
        console.log(`Too far! Move closer to the treasure.`);
        // Optional: Show a message to user
        const messageEl = document.getElementById("captured-message");
        if (messageEl) {
            messageEl.innerHTML = `Move closer!<div style="font-size: 16px; margin-top: 12px; font-weight: 500;">You need to be within ${CAPTURE_DISTANCE}m</div>`;
            messageEl.style.background = "rgba(239, 68, 68, 0.94)";
            messageEl.style.display = "block";

            setTimeout(() => {
                messageEl.style.display = "none";
                messageEl.style.background = "rgba(74, 222, 128, 0.94)";
            }, 1500);
        }
    }
}

function updateCapturedList() {
    const list = document.getElementById("captured-items");
    const container = document.getElementById("captured-list");
    if (list && container && isCaptured) {
        list.innerHTML = `<li>${modelName}</li>`;
        container.style.display = "block";
    }
}

/*************************************************
 * ORIENTATION AND DIRECTION TRACKING
 *************************************************/

function startOrientationTracking() {
    // Check if device supports orientation
    if (window.DeviceOrientationEvent) {
        // Request permission on iOS 13+
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission()
                .then((permissionState) => {
                    if (permissionState === "granted") {
                        window.addEventListener(
                            "deviceorientation",
                            handleOrientation,
                            true,
                        );
                    } else {
                        console.warn("Device orientation permission denied");
                        // Use fallback compass
                        useFallbackCompass();
                    }
                })
                .catch(console.error);
        } else {
            // Non-iOS or older iOS
            window.addEventListener("deviceorientation", handleOrientation, true);
        }
    } else {
        console.warn("Device orientation not supported");
        useFallbackCompass();
    }

    // Update direction display regularly
    setInterval(updateDirectionDisplay, 100);
}

function handleOrientation(event) {
    // Get the compass heading
    let heading = event.webkitCompassHeading || event.alpha;

    if (heading !== null && heading !== undefined) {
        // webkitCompassHeading gives true heading
        // alpha gives rotation around z-axis (0-360)
        if (event.webkitCompassHeading !== undefined) {
            deviceHeading = heading;
        } else {
            // For alpha, we need to convert (alpha is opposite direction)
            deviceHeading = 360 - heading;
        }
    }
}

function useFallbackCompass() {
    // Simple fallback - assume north is up
    console.log("Using fallback compass (assuming north is up)");
}

function updateDirectionDisplay() {
    if (!currentUserGPS || !treasureLocation) return;

    // Calculate bearing to treasure
    treasureBearing = calculateBearing(
        currentUserGPS.latitude,
        currentUserGPS.longitude,
        treasureLocation.lat,
        treasureLocation.lng,
    );

    // Calculate relative angle (where to point)
    let relativeAngle = treasureBearing - deviceHeading;

    // Normalize to -180 to 180
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;

    // Update compass arrow
    const arrow = document.getElementById("compass-arrow");
    if (arrow) {
        arrow.style.transform = `translateX(-50%) rotate(${relativeAngle}deg)`;
    }

    // Update direction text
    const directionText = document.getElementById("direction-text");
    if (directionText) {
        const cardinalDirection = getCardinalDirection(treasureBearing);
        directionText.innerHTML = `🧭 ${cardinalDirection}`;

        // Color based on distance
        const distance = getDistanceMeters(
            currentUserGPS.latitude,
            currentUserGPS.longitude,
            treasureLocation.lat,
            treasureLocation.lng,
        );

        if (distance <= CAPTURE_DISTANCE) {
            directionText.style.background = "rgba(74, 222, 128, 0.9)";
        } else if (distance <= VISIBILITY_DISTANCE) {
            directionText.style.background = "rgba(251, 191, 36, 0.9)";
        } else {
            directionText.style.background = "rgba(239, 68, 68, 0.9)";
        }
    }

    // Update large center distance
    const distanceOverlay = document.getElementById("distance-overlay");
    if (distanceOverlay) {
        const distance = getDistanceMeters(
            currentUserGPS.latitude,
            currentUserGPS.longitude,
            treasureLocation.lat,
            treasureLocation.lng,
        );

        let color = "#ff4444";
        if (distance <= CAPTURE_DISTANCE) {
            color = "#0f0";
        } else if (distance <= VISIBILITY_DISTANCE) {
            color = "#ffcc00";
        }

        distanceOverlay.innerHTML = `${distance.toFixed(1)} m`;
        distanceOverlay.style.color = color;
    }
}

function getCardinalDirection(bearing) {
    const directions = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
}

/*************************************************
 * GPS HELPER FUNCTIONS
 *************************************************/

/**
 * Calculate new GPS coordinates given a starting point, distance, and bearing
 * @param {number} lat - Starting latitude
 * @param {number} lng - Starting longitude
 * @param {number} meters - Distance in meters
 * @param {number} bearingDeg - Bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 * @returns {object} New coordinates {lat, lng}
 */
function offsetLatLng(lat, lng, meters, bearingDeg) {
    const R = 6378137; // Earth's radius in meters
    const brng = (bearingDeg * Math.PI) / 180;

    const latRad = (lat * Math.PI) / 180;

    const newLat = lat + ((meters * Math.cos(brng)) / R) * (180 / Math.PI);
    const newLng =
        lng +
        ((meters * Math.sin(brng)) / (R * Math.cos(latRad))) * (180 / Math.PI);

    return {
        lat: newLat,
        lng: newLng,
    };
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @returns {number} Distance in meters
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
}

/**
 * Calculate bearing between two GPS coordinates
 * @param {number} lat1 - Starting latitude
 * @param {number} lon1 - Starting longitude
 * @param {number} lat2 - Destination latitude
 * @param {number} lon2 - Destination longitude
 * @returns {number} Bearing in degrees (0-360, where 0 is North)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
        Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;

    // Normalize to 0-360
    bearing = (bearing + 360) % 360;

    return bearing;
}
