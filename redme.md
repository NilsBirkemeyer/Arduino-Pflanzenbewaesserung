/**
   Automatic Plant Watering System (APWS)
   (c) 2021 Christian Grieger
*/

/**
 * This is the unique IoT deviceId (1-255) which identifies the
 * current plant on the server component
 */
#define DEVICE_ID 1

/**
  Pins for the capacitity soil moisture sensor and the
  relay for switching the water pump
  Important: You can only use ADC1 pins (32, 33, 34, 35, 36, 39)
  to use with analogRead() when WiFi is enabled!
*/
#define PIN_SENSOR 32
#define PIN_RELAY  5
#define PIN_LED_INDICATOR LED_BUILTIN

/**
   Watering time (in seconds): Sets how long the pump
   will spread water in one action.
   (default: 10)
*/
#define WATERING_TIME 10

/**
   Time interval (in seconds) how often new commands
   are fetched from the server queue.
   (default: 60)
*/
#define COMMAND_FETCH_INTERVAL 60

/**
   Time interval (in seconds) how often the soil moisture
   is been measured and possible automatic actions are taken.
   (default: 1800; = 60 min.)
*/
#define MEASURING_INTERVAL 1800

/**
  Threshold of the measured soil moisture when
  the system begins with automatic watering.
*/
#define MOISTURE_THRESHOLD 2200
#define MOISTURE_THRESHOLD_STEP 100

/**
   WiFi settings
*/
const char* WIFI_SSID     = "mySSID";
const char* WIFI_PASSWORD = "myPassword";

/**
   Server component settings
*/
const char*    SERVER_HOST = "http://apws.example.com";
const char*    SERVER_URI  = "/";
const uint16_t SERVER_PORT = 80;
const char*    SERVER_PSK  = "mySecretPsk";

#include <WiFi.h>
#include <HTTPClient.h>

#define lmillis() ((long)millis())

#define _DEBUG_MODE
#ifdef _DEBUG_MODE
#define DEBUG_INIT(baudSpeed) Serial.begin(baudSpeed)
#define DEBUG_PRINT(value) Serial.print(value)
#define DEBUG_PRINTLN(value) Serial.println(value)
#else
// Empty macros bodies if debugging is not needed
#define DEBUG_INIT(baudSpeed)
#define DEBUG_PRINT(value)
#define DEBUG_PRINTLN(value)
#endif

#define PAUSE_WATERING     1
#define RESUME_WATERING    2
#define MANUAL_WATERING    3
#define MANUAL_MEASUREMENT 4
#define THRESHOLD_INCREASE 5
#define THRESHOLD_DECREASE 6

#define LOG_TYPE_MEASUREMENT 1
#define LOG_TYPE_ACTION      2
#define LOG_TYPE_COMMAND     3
#define LOG_TYPE_MESSAGE     4

bool automaticWateringEnabled = true;
long lastMeasurement, lastCommandFetched;
unsigned int moistureThreshold;
HTTPClient httpClient;

void setup()
{
    DEBUG_INIT(9600);
    pinMode(PIN_SENSOR, INPUT);

    pinMode(PIN_RELAY, OUTPUT);
    digitalWrite(PIN_RELAY, LOW);

    pinMode(PIN_LED_INDICATOR, OUTPUT);
    digitalWrite(PIN_LED_INDICATOR, LOW);

    lastMeasurement = lmillis() + 60;
    lastCommandFetched = lmillis() + 5;

    moistureThreshold = MOISTURE_THRESHOLD;
}

void loop()
{
    if (lmillis() - lastCommandFetched >= 0) {
        lastCommandFetched = lmillis() + COMMAND_FETCH_INTERVAL * 1000;
        String serverResult = requestServer("request", String(DEVICE_ID));
        executeCommand(serverResult.toInt());
    }

    if (lmillis() - lastMeasurement >= 0) {
        lastMeasurement = lmillis() + MEASURING_INTERVAL * 1000;
        if (isSoilDry()) {
            doWater();
        }
    }
}

bool isSoilDry()
{
    return getSoilMoisture() > moistureThreshold;
}

int getSoilMoisture()
{
    int moisture = analogRead(PIN_SENSOR);
    String mStr = String(moisture);
    DEBUG_PRINTLN("Measured moisture = " + mStr);

    logToServer(LOG_TYPE_MEASUREMENT, mStr);
    return moisture;
}

void doWater()
{
    if (!automaticWateringEnabled) {
        DEBUG_PRINTLN("Soil too dry, but automatic watering is paused.");
        logToServer(LOG_TYPE_MESSAGE, "Soil too dry but automatic watering is paused.");
        return;
    }

    logToServer(LOG_TYPE_COMMAND, "Watering " + String(WATERING_TIME) + "s (automatic)");
    DEBUG_PRINTLN("Begin automatic watering.");

    int timeWatering = WATERING_TIME * 1000;
    digitalWrite(PIN_RELAY, HIGH);

    // safetly check after every 5 sec. if moisture is above threshold, stop watering!
    do {
        if (!isSoilDry()) {
            digitalWrite(PIN_RELAY, LOW);
            DEBUG_PRINTLN("Safety stop watering!");
            return;
        }
        delay(timeWatering);
        timeWatering -= 5000;
    } while (timeWatering > 0);

    digitalWrite(PIN_RELAY, LOW);
    DEBUG_PRINTLN("Ended automatic watering.");
}

void executeCommand(byte command)
{
    DEBUG_PRINT("Executing command ");
    switch (command) {
        case PAUSE_WATERING:
            DEBUG_PRINTLN("PAUSE_WATERING");
            automaticWateringEnabled = false;
            logToServer(LOG_TYPE_COMMAND, "Automatic watering paused");
            break;
        case RESUME_WATERING:
            DEBUG_PRINTLN("RESUME_WATERING");
            automaticWateringEnabled = true;
            logToServer(LOG_TYPE_COMMAND, "Automatic watering resumed");
            break;
        case MANUAL_WATERING:
            DEBUG_PRINTLN("MANUAL_WATERING");
            digitalWrite(PIN_RELAY, HIGH);
            delay(WATERING_TIME * 1000);
            digitalWrite(PIN_RELAY, LOW);
            logToServer(LOG_TYPE_COMMAND, "Watering " + String(WATERING_TIME) + "s (manual)");
            break;
        case MANUAL_MEASUREMENT:
            DEBUG_PRINTLN("MANUAL_MEASUREMENT");
            getSoilMoisture();
            break;
        case THRESHOLD_INCREASE:
            DEBUG_PRINTLN("THRESHOLD_INCREASE");
            if (moistureThreshold < (1023 - MOISTURE_THRESHOLD_STEP)) {
                moistureThreshold += MOISTURE_THRESHOLD_STEP;
            }
            logToServer(LOG_TYPE_COMMAND, "Increased threshold by +" + String(MOISTURE_THRESHOLD_STEP));
            break;
        case THRESHOLD_DECREASE:
            DEBUG_PRINTLN("THRESHOLD_DECREASE");
            if (moistureThreshold > MOISTURE_THRESHOLD_STEP) {
                moistureThreshold -= MOISTURE_THRESHOLD_STEP;
            }
            logToServer(LOG_TYPE_COMMAND, "Decreased threshold by -" + String(MOISTURE_THRESHOLD_STEP));
            break;
        default:
            DEBUG_PRINTLN("NONE/UNKNOWN");
            break;
    }
}

void logToServer(byte logType, String message)
{
    String logTypeStr;
    switch (logType) {
        case LOG_TYPE_MEASUREMENT:
            logTypeStr = "MEASUREMENT";
            break;
        case LOG_TYPE_ACTION:
            logTypeStr = "ACTION";
            break;
        case LOG_TYPE_COMMAND:
            logTypeStr = "COMMAND";
            break;
        case LOG_TYPE_MESSAGE:
        default:
            logTypeStr = "MESSAGE";
            break;
    }

    String logMessage = logTypeStr + "," + String(DEVICE_ID) + "," + message;
    requestServer("log", logMessage);
}

String requestServer(String serverParam, String payload)
{
    String auth = "?psk=" + String(SERVER_PSK);
    String param = "&" + serverParam + "=" + payload;
    String url = String(SERVER_HOST) + ":" + String(SERVER_PORT) + SERVER_URI + auth + param;

    digitalWrite(PIN_LED_INDICATOR, HIGH);

    connectWiFi();
    httpClient.begin(url);

    String httpBody = "";
    int httpCode = httpClient.GET();
    if (httpCode > 0) {
        httpBody = httpClient.getString();
        DEBUG_PRINT("httpCode=");
        DEBUG_PRINT(httpCode);
        DEBUG_PRINT(" - httpContent=");
        DEBUG_PRINTLN(httpBody);
    } else {
        DEBUG_PRINT("ERROR requesting ");
        DEBUG_PRINT(url);
        DEBUG_PRINTLN(" - " + httpClient.errorToString(httpCode));
    }
    httpClient.end();

    digitalWrite(PIN_LED_INDICATOR, LOW);

    return httpBody;
}

void connectWiFi()
{
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }

    DEBUG_PRINT("Connecting to WiFi ");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        DEBUG_PRINT(".");
    }
    DEBUG_PRINTLN("[ok]");
}