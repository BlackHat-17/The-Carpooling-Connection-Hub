import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyDWwGMfCu2nrnzsjVUL-aLl4I3fQFNQ984",
    authDomain: "tcch-66288.firebaseapp.com",
    databaseURL: "https://tcch-66288-default-rtdb.firebaseio.com",
    projectId: "tcch-66288",
    storageBucket: "tcch-66288.appspot.com",
    messagingSenderId: "621738318792",
    appId: "1:621738318792:web:75ea3bb8ab4b238d28fefd",
    measurementId: "G-BL3WD7KSCV"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const ORS_API_KEY = "5b3ce3597851110001cf62486ece71d78e9541678f8539aafd9d3697";

const usersRef = ref(database, "users"); // 🔹 Fix: Define usersRef

const map = L.map('map').setView([18.5204, 73.8567], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 🔹 Location Autocomplete
async function fetchSuggestions(query, listElement) {
    if (!query) {
        listElement.innerHTML = "";
        return;
    }

    try {
        const response = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${query}&size=5`);
        const data = await response.json();
        listElement.innerHTML = "";

        if (data.features) {
            data.features.forEach((feature) => {
                const item = document.createElement("li");
                item.textContent = feature.properties.label;
                item.addEventListener("click", () => {
                    listElement.previousElementSibling.value = feature.properties.label;
                    listElement.innerHTML = "";
                });
                listElement.appendChild(item);
            });
        }
    } catch (error) {
        console.error("Error fetching suggestions:", error);
    }
}

// 🔹 Attach Autocomplete Event Listeners
document.querySelector("#from").addEventListener("input", (e) => {
    fetchSuggestions(e.target.value, document.querySelector("#fromSuggestions"));
});
document.querySelector("#to").addEventListener("input", (e) => {
    fetchSuggestions(e.target.value, document.querySelector("#toSuggestions"));
});

// 🔹 Get Coordinates from ORS API
async function getCoordinates(query) {
    const response = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${query}&size=1`
    );
    const data = await response.json();
    if (data.features && data.features.length > 0) {
        return {
            lat: data.features[0].geometry.coordinates[1],
            lon: data.features[0].geometry.coordinates[0],
        };
    }
    return null;
}

// 🔹 Haversine Distance Calculation
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// 🔹 Search for Matching Rides
document.getElementById("searchBtn").addEventListener("click", async function () {
    document.getElementById("searchSection").classList.add("hidden");
    document.getElementById("map").classList.add("hidden");

    const fromQuery = document.querySelector("#from").value.trim();
    const toQuery = document.querySelector("#to").value.trim();
    const storedDataList = document.querySelector("#storedData");
    storedDataList.innerHTML = "";

    const fromCoords = await getCoordinates(fromQuery);
    const toCoords = await getCoordinates(toQuery);

    if (!fromCoords || !toCoords) {
        alert("Invalid locations");
        return;
    }

    get(usersRef).then(async (snapshot) => {
        if (!snapshot.exists()) {
            storedDataList.innerHTML = '<li class="no-data">No users found.</li>';
            return;
        }
    
        let found = false;
        const fuelPrice = 100;
    
        snapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            const userId = childSnapshot.key;
    
            if (!user.from || !user.to) return;
    
            const fromLat = parseFloat(user.from.latitude);
            const fromLon = parseFloat(user.from.longitude);
            const toLat = parseFloat(user.to.latitude);
            const toLon = parseFloat(user.to.longitude);
    
            if (isNaN(fromLat) || isNaN(fromLon) || isNaN(toLat) || isNaN(toLon)) return;
    
            const fromDistance = haversineDistance(fromCoords.lat, fromCoords.lon, fromLat, fromLon);
            const toDistance = haversineDistance(toCoords.lat, toCoords.lon, toLat, toLon);
            const rideDistance = haversineDistance(fromLat, fromLon, toLat, toLon);
    
            if (fromDistance <= 2 && toDistance <= 2) {
                found = true;
                let img = user.gender.toLowerCase() === "male" ? "male2.png" : "female2.png";
                const car = user.car.replace(/\s/g, '');
    
                // Fetch mileage from the "cars" collection in Firebase
                const carRef = ref(database, `cars/${car}/avg`);
                get(carRef)
  .then((snapshot) => {
    if (snapshot.exists()) {
      console.log("Mileage found:", snapshot.val()); // Log the mileage value
    } else {
      console.error("Mileage not found for car:", car);
    }
  })
  .catch((error) => console.error("Error fetching mileage:", error));

                get(carRef).then((snapshot) => {

                    if (snapshot.exists()) {
                        const mileage = snapshot.val();
                        const fuelNeeded = rideDistance / mileage;
                        const totalFare = fuelNeeded * fuelPrice;
                        const farePerPerson = totalFare / user.peopleCount;
    
                        const listItem = document.createElement("li");
                        listItem.dataset.userId = userId;
                        listItem.innerHTML = `
                           <div class="data">
                                <img src="images/${img}" alt="pfp" class="pfp"><br>
                                <strong>Name:</strong> ${user.name} <br>
                                <strong>Gender:</strong> ${user.gender} <br>
                                <strong>Car:</strong> ${user.car} <br>
                                <strong>From:</strong> ${user.from.name} → <strong>To:</strong> ${user.to.name} <br>
                                <strong>Time:</strong> ${user.time} <br>
                                <strong>No of People:</strong> <span class="people-count">${user.peopleCount}</span>/5<br>
                                <strong>Fare:</strong> Rs.<span class="fare">${farePerPerson.toFixed(2)}</span><br>
                            </div>
                            <button class="select-btn">Confirm</button>
                        `;
                        storedDataList.appendChild(listItem);
                    } else {
                        console.error("Mileage not found for car:", user.car);
                    }
                });
            }
        });
    
        // 🔹 Move this outside the loop
        if (!found) {
            storedDataList.innerHTML = '<li class="no-data">No matching rides found within 2km.</li>';
        }
    });
});    


