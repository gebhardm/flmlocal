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

var client;

var reconnectTimeout = 2e3;

var port = 8083;

var wsID = "FLM" + parseInt(Math.random() * 100, 10);

var sensors = {};

var app = angular.module("flmUiApp");

app.controller("PanelCtrl", function($scope) {
    $scope.debug = false;
    $scope.alerts = [];
    $scope.sensors = [];
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
    function mqttConnect() {
        client = new Paho.MQTT.Client(location.hostname, port, "", wsID);
        var options = {
            timeout: 3,
            onSuccess: onConnect,
            onFailure: function(message) {
                setTimeout(mqttConnect, reconnectTimeout);
            }
        };
        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;
        client.connect(options);
    }
    function onConnect() {
        client.subscribe("/device/#");
        client.subscribe("/sensor/#");
    }
    function onConnectionLost(responseObj) {
        setTimeout(mqttConnect, reconnectTimeout);
        if (responseObj.errorCode !== 0) console.log("onConnectionLost:" + responseObj.errorMessage);
    }
    function onMessageArrived(mqttMsg) {
        var topic = mqttMsg.destinationName.split("/");
        var payload = mqttMsg.payloadString;
        switch (topic[1]) {
          case "device":
            handle_device(topic, payload);
            break;

          case "sensor":
            handle_sensor(topic, payload);
            break;

          default:
            break;
        }
        $scope.sensors = sensors;
        $scope.message = mqttMsg.destinationName + ", " + payload;
        $scope.$apply();
    }
    function handle_device(topic, payload) {
        var deviceID = topic[2];
        if (topic[3] == "config") {
            var config = JSON.parse(payload);
            for (var i = 1; i <= 13; i++) {
                if (config[i].enable == "1") {
                    var sensorId = config[i].id;
                    if (sensors[sensorId] == null) {
                        sensors[sensorId] = new Object(sensorId);
                        sensors[sensorId].id = config[i].id;
                        sensors[sensorId].name = config[i].function;
                    } else sensors[sensorId].name = config[i].function;
                }
            }
        }
    }
    function handle_sensor(topic, payload) {
        var sensor = {};
        var msgType = topic[3];
        var sensorId = topic[2];
        if (sensors[sensorId] == null) {
            sensors[sensorId] = new Object(sensorId);
            sensor.id = sensorId;
            sensor.name = sensorId;
        } else sensor = sensors[sensorId];
        var value = JSON.parse(payload);
        switch (msgType) {
          case "gauge":
            if (value.length == null) {
                sensor.gaugevalue = value;
                sensor.gaugeunit = "";
                sensor.gaugetimestamp = "";
            } else {
                switch (value.length) {
                  case 1:
                    sensor.gaugevalue = value[0];
                    sensor.gaugeunit = "";
                    sensor.gaugetimestamp = "";
                    break;

                  case 2:
                    sensor.gaugevalue = value[0];
                    sensor.gaugeunit = value[1];
                    sensor.gaugetimestamp = "";
                    break;

                  case 3:
                    var date = new Date(value[0] * 1e3);
                    var now = new Date().getTime();
                    if (now / 1e3 - value[0] > 60) value[1] = 0;
                    sensor.gaugevalue = value[1];
                    sensor.gaugeunit = value[2];
                    sensor.gaugetimestamp = date.toLocaleString();
                    break;

                  default:
                    break;
                }
            }
            break;

          case "counter":
            sensor.countertimestamp = new Date(value[0] * 1e3).toLocaleString();
            sensor.countervalue = value[1] / 1e3;
            sensor.counterunit = "k" + value[2];
            break;

          default:
            break;
        }
        sensors[sensorId] = sensor;
    }
    mqttConnect();
});