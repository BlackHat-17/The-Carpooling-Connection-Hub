import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getDatabase, ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-database.js";

// Firebase Configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// OpenRouteService API Key
const ORS_API_KEY = "5b3ce3597851110001cf62486ece71d78e9541678f8539aafd9d3697";

// Function to Fetch Location Suggestions
async function fetchLocationSuggestions(query, elementId) {
    if (query.length < 3) return; // Avoid unnecessary API calls

    const response = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${query}&size=5`
    );
    const data = await response.json();

    const suggestionsList = document.getElementById(elementId);
    suggestionsList.innerHTML = ""; // Clear previous suggestions

    if (data.features) {
        data.features.forEach(place => {
            const li = document.createElement("li");
            li.textContent = place.properties.label;
            li.onclick = () => {
                document.getElementById(elementId.replace("Suggestions", "")).value = place.properties.label;
                suggestionsList.innerHTML = ""; // Clear suggestions after selection
                
                // ✅ Store coordinates in hidden fields
                document.getElementById(elementId.replace("Suggestions", "") + "Lat").value = place.geometry.coordinates[1]; // Latitude
                document.getElementById(elementId.replace("Suggestions", "") + "Lon").value = place.geometry.coordinates[0]; // Longitude
            };
            suggestionsList.appendChild(li);
        });
    }
}

// Event Listeners for fetching location suggestions
document.getElementById("from").addEventListener("input", (e) => {
    fetchLocationSuggestions(e.target.value, "fromSuggestions");
});
document.getElementById("to").addEventListener("input", (e) => {
    fetchLocationSuggestions(e.target.value, "toSuggestions");
});

// DOM Elements
const carSearchInput = document.getElementById("carSearch");
const carDropdown = document.getElementById("carDropdown");
const addCarBtn = document.getElementById("addCarBtn");
const newCarFields = document.getElementById("newCarFields");
const carMakeInput = document.getElementById("carMake");
const carMileageInput = document.getElementById("carMileage");

let carList = []; // Store fetched car models

// Function to Fetch Car Models from Firebase
function loadCarDropdown() {
    const carsRef = ref(database, "cars");

    get(carsRef).then((snapshot) => {
        if (snapshot.exists()) {
            carList = Object.keys(snapshot.val());
        } else {
            alert("No car data found in database.");
        }
    }).catch(error => {
        console.error("❌ Error fetching car data:", error);
    });
}

// Function to Filter and Show Car Dropdown
function filterCars() {
    const searchValue = carSearchInput.value.toLowerCase();
    carDropdown.innerHTML = "";
    addCarBtn.style.display = "none"; // Hide "Add New Car" button initially
    newCarFields.style.display = "none"; // Hide additional input fields

    const filteredCars = carList.filter(car => car.toLowerCase().includes(searchValue));
    
    if (filteredCars.length === 0) {
        carDropdown.style.display = "none";
        addCarBtn.style.display = "block"; // Show "Add New Car" button
        return;
    }

    filteredCars.forEach(car => {
        const div = document.createElement("div");
        div.textContent = car.replace(/\+/g, " "); // Replace `+` with spaces
        div.onclick = function () {
            carSearchInput.value = div.textContent;
            carDropdown.style.display = "none";
            addCarBtn.style.display = "none"; // Hide button since car exists
            newCarFields.style.display = "none"; // Hide additional input fields
        };
        carDropdown.appendChild(div);
    });

    carDropdown.style.display = "block";
}

// Event Listeners
carSearchInput.addEventListener("input", filterCars);
carSearchInput.addEventListener("focus", filterCars);
addCarBtn.addEventListener("click", () => {
    newCarFields.style.display = "block"; // Show extra input fields on button click
});
document.addEventListener("click", (event) => {
    if (!carSearchInput.contains(event.target) && !carDropdown.contains(event.target)) {
        carDropdown.style.display = "none";
    }
});

// Load car data when page loads
window.onload = loadCarDropdown;

// Handle Rider Form Submission
document.getElementById("riderForm").addEventListener("submit", function(event) {
    event.preventDefault();

    let selectedModel = carSearchInput.value.replace(/\s+/g, "+"); // Convert spaces to '+'
    let carMake = carMakeInput.value.replace(/\s+/g, "+");
    let mileage = carMileageInput.value;
    
    const rider = {
        name: document.getElementById("name").value,
        gender: document.getElementById("gender").value,
        car: selectedModel,
        from: {
            name: document.getElementById("from").value,
            latitude: parseFloat(document.getElementById("fromLat").value),
            longitude: parseFloat(document.getElementById("fromLon").value)
        },
        to: {
            name: document.getElementById("to").value,
            latitude: parseFloat(document.getElementById("toLat").value),
            longitude: parseFloat(document.getElementById("toLon").value)
        },
        time: document.getElementById("time").value,
        peopleCount: 0
    };

    const carRef = ref(database, "cars/" + selectedModel);

    get(carRef).then((snapshot) => {
        if (snapshot.exists()) {
            // ✅ Car exists, proceed with registration
            push(ref(database, "users"), rider).then(() => {
                alert("✅ Rider registered successfully!");
                document.getElementById("riderForm").reset();
                loadCarDropdown();
            }).catch(error => {
                alert("❌ Error: " + error.message);
            });
        } else {
            // ⚠️ Car model not found → Require car make & mileage input
            if (!carMake) {
                alert("❌ Please enter the car make!");
                return;
            }
            if (!mileage || isNaN(mileage) || mileage <= 0) {
                alert("❌ Please enter a valid mileage in km/l!");
                return;
            }

            // 🔥 Add new car to Firebase
            const newCarKey = `${carMake}+${selectedModel}`;
            set(ref(database, "cars/" + newCarKey), { avg: mileage }).then(() => {
                rider.car = newCarKey; // Update rider's car model
                return push(ref(database, "users"), rider);
            }).then(() => {
                alert("✅ Rider registered successfully!");
                document.getElementById("riderForm").reset();
                loadCarDropdown();
            }).catch(error => {
                alert("❌ Error: " + error.message);
            });
        }
    }).catch(error => {
        alert("❌ Error checking car: " + error.message);
    });
});
