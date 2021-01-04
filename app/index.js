import Barometer from "barometer";
import display from "display";
import document from "document";
import clock from "clock";
import me from "appbit"
import {
    preferences,
    units
} from "user-settings";

const VALUE = document.getElementById("value");
const BG = document.getElementById("bg");
const UNIT = document.getElementById("unit");
const CLOCK = document.getElementById("clock");
const METRIC_UNITS = units.distance === "metric";
const DEFAULT_BG_FILL = BG.style.fill;

let _lastAltitude;

function computeAltitude(paPressure) {
    /* https://en.wikipedia.org/wiki/Pressure_altitude */
    const atm = 101325;
    const pow = 0.190284;
    const coefficient = 145366.45;
    const feetToMeters = 0.3048;
    const ftElevation = (1 - Math.pow(paPressure / atm, pow)) * coefficient;

    return (METRIC_UNITS) ? ftElevation * feetToMeters : ftElevation;
}

function updateAltitude(alt) {
    VALUE.text = Math.floor(alt).toLocaleString();
    UNIT.text = (METRIC_UNITS) ? 'm' : 'ft';
}

function aodUIToggle() {
    BG.style.fill = display.aodActive ? 'black' : DEFAULT_BG_FILL;
}

function onBarometerEvent() {
    let pressure;

    if (barometer.readings && barometer.readings.pressure) {
        const sum = barometer.readings.pressure.reduce((a, b) => a + b, 0);
        pressure = (sum / barometer.readings.pressure.length) || 0;
    }

    if (!pressure)
        pressure = barometer.pressure;

    let alt = computeAltitude(pressure);
    console.log(`Barometer: ${barometer.pressure}, Altitude is ${alt}`);
    _lastAltitude = alt;

    if (!display.aodActive)
        updateAltitude(alt);
}

function ensureBarometerMonitoring() {
    if (barometer)
        barometer.stop();

    barometer = new Barometer(display.aodActive ?
        { frequency: 0.5, batch: 30 } : { frequency: 1, batch: 3 });
    barometer.addEventListener('reading', onBarometerEvent);
    barometer.start();
}

function addZeros(num) {
    return num < 10 ? `0${num}` : num;
}

function onTick(evt) {
    const date = evt.date;
    const hours = date.getHours();
    const mins = addZeros(date.getMinutes());

    if (preferences.clockDisplay === "12h") {
        hours = hours % 12 || 12;
    } else {
        hours = addZeros(hours);
    }
    CLOCK.text = `${hours}:${mins}`;

    if (display.aodActive)
        updateAltitude(_lastAltitude);
};

clock.addEventListener("tick", onTick);
onTick({ date: new Date() });

let _onInit = true;
let barometer = new Barometer()
barometer.addEventListener("reading", () => {
    onBarometerEvent();

    if (_onInit) {
        _onInit = false;
        ensureBarometerMonitoring();
    }
});
barometer.start();

display.addEventListener('change', () => {
    if (display.aodAllowed)
        aodUIToggle();

    if (display.aodActive) {
        ensureBarometerMonitoring();
    } else {
        display.on ? barometer.start() : barometer.stop();
    }
});

if (display.aodEnabled && me.permissions.granted('access_aod')) {
    display.aodAllowed = true;
} else {
    console.error("We're not allowed to run in AOD mode!");
}

me.onunload = () => barometer.stop();
