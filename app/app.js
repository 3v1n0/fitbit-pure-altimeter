import Barometer from 'barometer';
import display from 'display';
import document from 'document';
import clock from 'clock';
import {
    preferences,
    units
} from 'user-settings';

const METRIC_UNITS = units.distance === 'metric';

function addZeros(num) {
    return num < 10 ? `0${num}` : num;
}

export default class App {
    valueEl = document.getElementById('value');
    bgEl = document.getElementById('bg');
    unitEl = document.getElementById('unit');
    clockEl = document.getElementById('clock');

    constructor() {
        this._defaultBgFill = this.bgEl.style.fill;
        this._lastAltitude = 0;

        clock.addEventListener('tick', this.onTick);
        this.onTick({ date: new Date() });

        this.barometer = new Barometer()
        const initialBarometerListener = () => {
            this.onBarometerEvent();

            this.barometer.removeEventListener('reading', initialBarometerListener);
            this.ensureBarometerMonitoring();
        };
        this.barometer.addEventListener('reading', initialBarometerListener);
        this.barometer.start();

        display.addEventListener('change', () => {
            if (display.aodAllowed)
                this.aodUIToggle();

            if (display.aodActive) {
                this.ensureBarometerMonitoring();
            } else {
                display.on ? this.barometer.start() : this.barometer.stop();
            }
        });
    }

    destroy() {
        this.barometer.removeEventListener('reading', this.onBarometerEvent);
        this.barometer.stop();
        this.barometer = null;

        clock.removeEventListener('tick', this.onTick);
    }

    computeAltitude(paPressure) {
        /* https://en.wikipedia.org/wiki/Pressure_altitude */
        const atm = 101325;
        const pow = 0.190284;
        const coefficient = 145366.45;
        const feetToMeters = 0.3048;
        const ftElevation = (1 - Math.pow(paPressure / atm, pow)) * coefficient;

        return (METRIC_UNITS) ? ftElevation * feetToMeters : ftElevation;
    }

    updateAltitude() {
        this.valueEl.text = Math.floor(this._lastAltitude).toLocaleString();
        this.unitEl.text = (METRIC_UNITS) ? 'm' : 'ft';
    }

    aodUIToggle() {
        this.bgEl.style.fill = display.aodActive ? 'black' : this._defaultBgFill;
    }

    onBarometerEvent = () => {
        let pressure;

        if (this.barometer.readings && this.barometer.readings.pressure) {
            const sum = this.barometer.readings.pressure.reduce((a, b) => a + b, 0);
            pressure = (sum / this.barometer.readings.pressure.length) || 0;
        }

        if (!pressure)
            pressure = this.barometer.pressure;

        this._lastAltitude = this.computeAltitude(pressure);
        console.log(`Barometer: ${this.barometer.pressure}, Altitude is ${this._lastAltitude}`);

        if (!display.aodActive)
            this.updateAltitude();
    }

    onTick = (evt) => {
        const date = evt.date;
        const hours = date.getHours();
        const mins = addZeros(date.getMinutes());

        if (preferences.clockDisplay === '12h') {
            hours = hours % 12 || 12;
        } else {
            hours = addZeros(hours);
        }
        this.clockEl.text = `${hours}:${mins}`;

        if (display.aodActive)
            this.updateAltitude();
    }

    ensureBarometerMonitoring() {
        if (this.barometer) {
            this.barometer.removeEventListener('reading', this.onBarometerEvent);
            this.barometer.stop();
        }

        this.barometer = new Barometer(display.aodActive ?
            { frequency: 0.5, batch: 30 } : { frequency: 1, batch: 3 });
        this.barometer.addEventListener('reading', this.onBarometerEvent);
        this.barometer.start();
    }
}
