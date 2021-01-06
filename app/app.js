import Barometer from 'barometer';
import display from 'display';
import document from 'document';
import clock from 'clock';
import {
    preferences,
    units
} from 'user-settings';

const METRIC_UNITS = units.distance === 'metric';
const FEET_TO_METERS = 0.3048;
const DELTA_THRESHOLD = 2.3; /* in meters */
const TIME_THRESHOLD = 20; /* in seconds */
const DEBUG_STEP = 30 /* in Pa */

function addZeros(num) {
    return num < 10 ? `0${num}` : num;
}

const Trend = Object.freeze({
    NONE: 'none',
    UP: 'up',
    DOWN: 'down',
});

export default class App {
    valueEl = document.getElementById('value');
    bgEl = document.getElementById('bg');
    unitEl = document.getElementById('unit');
    clockEl = document.getElementById('clock');
    trendUpEl = document.getElementById('trend-up');
    trendDownEl = document.getElementById('trend-down');

    constructor() {
        this._defaultBgFill = this.bgEl.style.fill;
        this._lastAltitude = undefined;
        this._lastPressure = undefined;
        this._lastRelevantAltitude = undefined;
        this._lastTrendUpdate = 0;
        this._trend = Trend.NONE;

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
            if (display.aodAllowed) {
                this.aodUIToggle();
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
        const ftElevation = (1 - Math.pow(paPressure / atm, pow)) * coefficient;

        return ftElevation * FEET_TO_METERS;
    }

    computeTrend(altitude) {
        if (this._lastRelevantAltitude === undefined) {
            this._lastRelevantAltitude = altitude;
            return Trend.NONE;
        }

        const timestamp = (Date.now() / 1000) | 0;
        const timeDiff = timestamp - this._lastTrendUpdate;
        const altDiff = altitude - this._lastRelevantAltitude;

        if (this._debugMode) {
            console.log(`timestamp: ${timestamp}`);
            console.log(`timeDiff: ${timeDiff}`);
            console.log(`altDiff: ${altDiff}`);
        }

        if (Math.abs(altDiff) < DELTA_THRESHOLD) {
            if (timeDiff < TIME_THRESHOLD)
                return this._trend;

            this._lastTrendUpdate = timestamp;
            return Trend.NONE;
        }

        this._lastRelevantAltitude = altitude;
        this._lastTrendUpdate = timestamp;

        return altDiff > 0 ? Trend.UP : Trend.DOWN;
    }

    updateAltitude() {
        const localeAltitude = (METRIC_UNITS) ?
            this._lastAltitude : this._lastAltitude / FEET_TO_METERS;

        this.valueEl.text = Math.floor(localeAltitude).toLocaleString();
        this.unitEl.text = (METRIC_UNITS) ? 'm' : 'ft';

        if (!display.aodActive) {
            document.getElementsByClassName('trend-indicator').forEach(
                e => e.style.display = 'none');

            if (this._trend === Trend.UP)
                this.trendUpEl.style.display = 'inline';
            else if (this._trend === Trend.DOWN)
                this.trendDownEl.style.display = 'inline';
        }
    }

    aodUIToggle() {
        this.bgEl.style.fill = display.aodActive ? 'black' : this._defaultBgFill;

        if (display.aodActive) {
            document.getElementsByClassName('non-aod').forEach(
                e => e.style.display = 'none');
        } else if (this._debugMode) {
            this.enableDebugUI();
        }
    }

    onBarometerEvent = () => {
        let pressure;

        if (this.barometer.readings && this.barometer.readings.pressure) {
            const sum = this.barometer.readings.pressure.reduce((a, b) => a + b, 0);
            pressure = (sum / this.barometer.readings.pressure.length) || 0;
        }

        if (!pressure)
            pressure = this.barometer.pressure;

        this.updatePressure(pressure);
    }

    updatePressure(pressure) {
        if (pressure === this._lastPressure)
            return;

        let altitude = this.computeAltitude(pressure);
        this._trend = this.computeTrend(altitude);
        this._lastPressure = pressure;
        this._lastAltitude = altitude;
        console.log(`Barometer: ${pressure} Pa, Altitude is ${altitude} m, trend: ${this._trend}`);

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

    /* Debug stuff */

    enableDebugUI() {
        document.getElementsByClassName('debug-ui').forEach(
            e => e.style.display = 'inline');

        if (this._debugMode)
            return;

        this._debugMode = true;

        const up = document.getElementById('dbg-trend-up');
        const stable = document.getElementById('dbg-trend-stable');
        const down = document.getElementById('dbg-trend-down');

        up.addEventListener('click', () => {
            this.updatePressure(this._lastPressure - DEBUG_STEP);
        });

        stable.addEventListener('click', () => {
            const action = ((Math.random() * 10) | 0) % 2;
            this.updatePressure(this._lastPressure + (action ? 1 : -1));
        });

        down.addEventListener('click', () => {
            this.updatePressure(this._lastPressure + DEBUG_STEP);
        });
    }
}
