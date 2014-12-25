/* ************************************************************
   MQTT websocket code in parts taken from the mqttws31.js example and
   jpmens.net: 
   http://jpmens.net/2014/07/03/the-mosquitto-mqtt-broker-gets-websockets-support/ 
************************************************************ */
// link to the web server's IP address for MQTT socket connection
var client;

var reconnectTimeout = 2e3;

// the FLM's web socket port from mosquitto
var broker = location.hostname, port = 8083;

var wsID = "FLM" + parseInt(Math.random() * 100, 10);

// get "different" websocketIDs
function MQTTconnect() {
    client = new Paho.MQTT.Client(broker, port, "", wsID);
    var options = {
        timeout: 3,
        onSuccess: onConnect,
        onFailure: function(message) {
            setTimeout(MQTTconnect, reconnectTimeout);
        }
    };
    // define callback routines
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;
    client.connect(options);
}

function onConnect() {
    client.subscribe("/device/#");
    client.subscribe("/sensor/#");
}

function onConnectionLost(responseObj) {
    setTimeout(MQTTconnect, reconnectTimeout);
    if (responseObj.errorCode !== 0) console.log("onConnectionLost:" + responseObj.errorMessage);
}