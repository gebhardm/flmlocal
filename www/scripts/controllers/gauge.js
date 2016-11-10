/*
The MIT License (MIT)

Copyright (c) 2016 Markus Gebhard <markus.gebhard@web.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
"use strict";

var GaugeCtrl = function($scope) {
    $scope.debug = false;
    $scope.alerts = [];
    $scope.gauges = [];
    $scope.message = "";
    $scope.msgCollapsed = false;
    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };
    // the FLM port configuration
    var flx;
    // link to the web server's IP address for MQTT socket connection
    var client;
    var reconnectTimeout = 2e3;
    // the FLM's web socket port from mosquitto
    var broker = location.hostname;
    var port = 8083;
    var sensors = {}, numGauges = 0;
    var row = [];
    // the web socket connect function
    function mqttConnect() {
        var wsID = "FLM" + parseInt(Math.random() * 100, 10);
        client = new Paho.MQTT.Client(broker, port, "", wsID);
        var options = {
            timeout: 3,
            onSuccess: onConnect,
            onFailure: function(message) {
                setTimeout(mqttConnect, reconnectTimeout);
            }
        };
        // define callback routines
        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;
        client.connect(options);
    }
    // event handler on connection established
    function onConnect() {
        client.subscribe("/device/+/config/flx");
        client.subscribe("/device/+/config/sensor");
        client.subscribe("/sensor/+/gauge");
    }
    // event handler on connection lost
    function onConnectionLost(responseObj) {
        setTimeout(mqttConnect, reconnectTimeout);
        if (responseObj.errorCode !== 0) {
            console.log("onConnectionLost:" + responseObj.errorMessage);
        }
    }
    // handle the received message
    function onMessageArrived(mqttMsg) {
        // split the received message at the slashes
        var topic = mqttMsg.destinationName.split("/");
        var payload = mqttMsg.payloadString;
        // the sensor message type is the third value of the topic
        switch (topic[1]) {
          case "device":
            handle_device(topic, payload);
            break;

          case "sensor":
            handle_sensor(topic, payload);
            // pass sensor message to the html part
            $scope.$apply(function() {
                $scope.message = mqttMsg.destinationName + ", " + payload;
            });
            break;

          default:
            break;
        }
    }
    // handler for device configuration
    function handle_device(topic, payload) {
        var config = JSON.parse(payload);
        switch (topic[4]) {
          case "flx":
            flx = config;
            break;

          case "sensor":
            for (var obj in config) {
                var cfg = config[obj];
                if (cfg.enable == "1") {
                    if (sensors[cfg.id] === undefined) sensors[cfg.id] = new Object();
                    sensors[cfg.id].id = cfg.id;
                    sensors[cfg.id].enum = obj;
                    if (cfg.port !== undefined) sensors[cfg.id].port = cfg.port[0];
                    if (cfg.subtype !== undefined) sensors[cfg.id].subtype = cfg.subtype;
                    if (flx !== undefined) {
                        if (flx[cfg.port] !== undefined) sensors[cfg.id].name = flx[cfg.port].name + " " + cfg.subtype;
                    }
                }
            }
            break;
        }
    }
    // handler for sensor readings
    function handle_sensor(topic, payload) {
        var sensor = {};
        // the retrieved sensor information
        var msgType = topic[3];
        // gauge or counter
        var sensorId = topic[2];
        // the sensor ID
        var value = JSON.parse(payload);
        // the transferred payload
        // check if sensor was already retrieved
        if (sensors[sensorId] === undefined) {
            sensors[sensorId] = new Object();
            sensor.id = sensorId;
            sensor.name = sensorId;
        } else sensor = sensors[sensorId];
        // set name, if undefined
        if (sensor.name === undefined) sensor.name = "S" + sensor.enum + "." + sensor.subtype;
        // now store back
        sensors[sensorId] = sensor;
        // now compute the received mqttMessage
        switch (msgType) {
          case "gauge":
            // handle the payload to obtain gauge values
            if (value.length === undefined) {
                sensor.value = value;
                sensor.unit = "";
            } else {
                switch (value.length) {
                  case 1:
                    sensor.value = value[0];
                    sensor.unit = "";
                    break;

                  case 2:
                    sensor.value = value[0];
                    sensor.unit = value[1];
                    break;

                  case 3:
                    var date = new Date(value[0] * 1e3);
                    // the timestamp
                    var now = new Date().getTime();
                    if (now / 1e3 - value[0] > 60) value[1] = 0;
                    // if too old, set to 0
                    sensor.value = value[1];
                    sensor.unit = value[2];
                    break;

                  default:
                    break;
                }
            }
            // now build the gauge display
            if (sensor.display === undefined) {
                numGauges++;
                var rowIndex = Math.floor((numGauges - 1) / 2);
                var colIndex = numGauges % 2;
                // use a trick to scale the first gauge at 50%
                if (row[rowIndex] === undefined) row[rowIndex] = new Array();
                if (numGauges > 1 && colIndex == 0) row[rowIndex].pop();
                row[rowIndex].push({
                    id: sensorId
                });
                if (colIndex == 1) row[rowIndex].push({});
                $scope.$apply(function() {
                    $scope.gauges = row;
                });
                var limit = 0, decimals = 2;
                if (sensor.unit == "W") {
                    limit = 250;
                    decimals = 0;
                } else if (sensor.unit == "°C") {
                    limit = 50;
                } else limit = 100;
                limit = sensor.value > limit ? sensor.value : limit;
                sensor.display = new JustGage({
                    id: sensor.id,
                    value: sensor.value,
                    title: sensor.name,
                    label: sensor.unit,
                    min: 0,
                    max: limit,
                    decimals: decimals
                });
            }
            // now show the current gauge value - set gaugeMax newly if required
            if (sensor.value > sensor.display.txtMaximum) {
                sensor.display.refresh(sensor.value, sensor.value);
            }
            sensor.display.refresh(sensor.value);
            sensors[sensorId] = sensor;
            break;

          default:
            break;
        }
    }
    mqttConnect();
};

// the part of the AngularJS application that handles the gauges
GaugeCtrl.$inject = [ "$scope" ];

angular.module("flmUiApp").controller("GaugeCtrl", GaugeCtrl);