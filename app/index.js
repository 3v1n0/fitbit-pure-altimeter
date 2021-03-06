import App from "./app";
import display from 'display';
import me from 'appbit';

if (display.aodEnabled && me.permissions.granted('access_aod')) {
    display.aodAllowed = true;
} else {
    console.error("We're not allowed to run in AOD mode!");
}

const app = new App();

me.appTimeoutEnabled = false;
me.onunload = () => app.destroy();

// Mostly for being used in simulator
// app.enableDebugUI();
