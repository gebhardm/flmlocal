/*
The MIT License (MIT)

Copyright (c) 2014 Markus Gebhard <markus.gebhard@web.de>

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

// link to the web server's IP address for MQTT socket connection
var client;

var reconnectTimeout = 2e3;

var port = 8083;

// the FLM's web socket port from mosquitto
var wsID = "FLM" + parseInt(Math.random() * 100, 10);

// get "different" websocketIDs
var gauge = {}, names = {}, display = {}, numGauges = 0;

var row = [];

// the part of the AngularJS application that handles the gauges
var app = angular.module("flmUiApp");

app.controller("GaugeCtrl", function($scope) {
    $scope.debug = false;
    $scope.alerts = [];
    $scope.gauges = [];
    $scope.message = "";
    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };
    function pushError(error) {
        $scope.alerts.push({
            type: "error",
            msg: error
        });
    }
    // the web socket connect function
    function mqttConnect() {
        client = new Paho.MQTT.Client(location.hostname, port, "", wsID);
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
        client.subscribe("/device/#");
        client.subscribe("/sensor/#");
    }
    // event handler on connection lost
    function onConnectionLost(responseObj) {
        setTimeout(mqttConnect, reconnectTimeout);
        if (responseObj.errorCode !== 0) console.log("onConnectionLost:" + responseObj.errorMessage);
    }
    // handle the received message
    function onMessageArrived(mqttMsg) {
        // split the received message at the slashes
        var topic = mqttMsg.destinationName.split("/");
        var payload = mqttMsg.payloadString;
        // pass sensor message to the html part
        $scope.$apply(function() {
            $scope.message = mqttMsg.destinationName + ", " + payload;
        });
        // the sensor message type is the third value of the topic
        switch (topic[1]) {
          case "device":
            compute_device(topic, payload);
            break;

          case "sensor":
            compute_sensor(topic, payload);
            break;

          default:
            break;
        }
    }
    // handler for device configuration
    function compute_device(topic, payload) {
        var deviceID = topic[2];
        if (topic[3] == "config") {
            var config = JSON.parse(payload);
            for (var i = 1; i <= 13; i++) {
                if (config[i].enable == "1") {
                    names[config[i].id] = config[i].function;
                }
            }
        }
    }
    // handler for sensor readings
    function compute_sensor(topic, payload) {
        var msgType = topic[3];
        // gauge or counter
        var sensor = topic[2];
        // the sensor ID
        var value = JSON.parse(payload);
        // the transferred payload
        var unit = "";
        // now compute the received mqttMessage
        switch (msgType) {
          case "gauge":
            // handle the payload to obtain gauge values
            if (value.length == null) {
                gauge[sensor] = value;
                unit = "";
            } else {
                switch (value.length) {
                  case 1:
                    gauge[sensor] = value[0];
                    unit = "";
                    break;

                  case 2:
                    gauge[sensor] = value[0];
                    unit = value[1];
                    break;

                  case 3:
                    var date = new Date(value[0] * 1e3);
                    // the timestamp
                    var now = new Date().getTime();
                    if (now / 1e3 - value[0] > 60) value[1] = 0;
                    // if too old, set to 0
                    gauge[sensor] = value[1];
                    unit = value[2];
                    break;

                  default:
                    break;
                }
            }
            // now build the gauge display
            if (display[sensor] == null) {
                numGauges++;
                var rowIndex = Math.floor((numGauges - 1) / 2);
                var colIndex = numGauges % 2;
                // use a trick to scale the first gauge at 50%
                if (row[rowIndex] == null) row[rowIndex] = new Array();
                if (numGauges > 1 && colIndex == 0) row[rowIndex].pop();
                row[rowIndex].push({
                    id: sensor
                });
                if (colIndex == 1) row[rowIndex].push({});
                $scope.$apply(function() {
                    $scope.gauges = row;
                });
                var limit = 0, decimals = 0;
                if (unit == "W") limit = 250; else if (unit == "°C") {
                    limit = 50;
                    decimals = 2;
                } else limit = 100;
                limit = gauge[sensor] > limit ? gauge[sensor] : limit;
                display[sensor] = new JustGage({
                    id: sensor,
                    value: gauge[sensor],
                    title: names[sensor],
                    label: unit,
                    min: 0,
                    max: limit,
                    decimals: decimals
                });
            }
            // now show the current gauge value - set gaugeMax newly if required
            if (gauge[sensor] > display[sensor].txtMaximum) {
                display[sensor].refresh(gauge[sensor], gauge[sensor]);
            }
            display[sensor].refresh(gauge[sensor]);
            break;

          case "counter":
            break;

          default:
            break;
        }
    }
    mqttConnect();
});