import Barometer from "barometer";
import document from "document";
import clock from "clock";
import me from "appbit"
import {
    preferences,
    units
} from "user-settings";

const VALUE = document.getElementById("value");
const UNIT = document.getElementById("unit");
const CLOCK = document.getElementById("clock");
const METRIC_UNITS = units.distance === "metric";

function computeAltitude(paPressure) {
    /* https://en.wikipedia.org/wiki/Pressure_altitude */
    const atm = 101325;
    const pow = 0.190284;
    const coefficient = 145366.45;
    const feetToMeters = 0.3048;
    const ftElevation = (1 - Math.pow(paPressure / atm, pow)) * coefficient;

    return (METRIC_UNITS) ? ftElevation * feetToMeters : ftElevation;
}

function updateUI(alt) {
    VALUE.text = Math.floor(alt).toLocaleString();
    UNIT.text = (METRIC_UNITS) ? 'm' : 'ft';
}

function onBarometerEvent() {
    let pressure;

    if (barometer.readings && barometer.readings.pressure.length) {
        const sum = barometer.readings.pressure.reduce((a, b) => a + b, 0);
        pressure = (sum / barometer.readings.pressure.length) || 0;
    }

    if (!pressure)
        pressure = barometer.pressure;

    let alt = computeAltitude(pressure);
    console.log(`Barometer: ${barometer.pressure}, Altitude is ${alt}`);
    updateUI(alt);
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
};

let _onInit = true;
let barometer = new Barometer()
barometer.addEventListener("reading", () => {
    onBarometerEvent();

    if (_onInit) {
        barometer.stop();
        _onInit = false;

        barometer = new Barometer({ frequency: 1, batch: 3 });
        barometer.addEventListener("reading", onBarometerEvent);
        barometer.start();
    }
});
barometer.start();

/* Toggle barometer on display.... */

clock.addEventListener("tick", onTick);
onTick({ date: new Date() });

me.onunload = () => barometer.stop();
