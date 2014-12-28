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

var broker = location.hostname, port = 8083;

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
        client = new Paho.MQTT.Client(broker, port, "", wsID);
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
            $scope.$apply(function () {
                $scope.message = mqttMsg.destinationName + ", " + payload;
            });
            break;

          default:
            break;
        }
    }
    function handle_device(topic, payload) {
        var deviceID = topic[2];
        if (topic[3] == "config") {
            var config = JSON.parse(payload);
            for (var obj in config) {
                var cfg = config[obj];
                if (cfg.enable == "1") {
                    var sensorId = cfg.id;
                    if (sensors[sensorId] == null) {
                        sensors[sensorId] = new Object();
                        sensors[sensorId].id = cfg.id;
                        sensors[sensorId].name = cfg.function;
                    } else sensors[sensorId].name = cfg.function;
                }
            }
        }
    }
    function handle_sensor(topic, payload) {
        var sensor = {};
        var msgType = topic[3];
        var sensorId = topic[2];
        var value = JSON.parse(payload);
        if (sensors[sensorId] == null) {
            sensors[sensorId] = new Object();
            sensor.id = sensorId;
            sensor.name = sensorId;
        } else sensor = sensors[sensorId];
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
            // create and fill an array of last n gauge values
            if (sensor.series == null) {
                sensor.series = new Array();
                var tablerow = "<tr>" + 
                               '<td width="30%" style="vertical-align:middle;">' + 
                               '<h4 id="sensor' + sensor.id + '"></h4>' + 
                               '<small id="time' + sensor.id + '"><small>' + 
                               "</td>" + 
                               '<td style="vertical-align:middle;">' + 
                               '<span id="sparkline' + sensor.id + '"></span>' + 
                               "</td>" + 
                               '<td width="30%" style="vertical-align:middle;">' + 
                               '<h4 id="value' + sensor.id + '"></h4>' + 
                               '<small id="counter' + sensor.id + '"></small>' + 
                               "</td>" + 
                               "</tr>";
                $("#panel").append(tablerow);
            }
            if (sensor.series.length == 60) sensor.series.shift();
            sensor.series.push(sensor.gaugevalue);
            break;

          case "counter":
            sensor.countertimestamp = new Date(value[0] * 1e3).toLocaleString();
            sensor.countervalue = value[1] / 1e3;
            sensor.counterunit = "k" + value[2];
            break;

          default:
            break;
        }
        $("#sensor" + sensor.id).html(sensor.name);
        $("#time" + sensor.id).html(sensor.gaugetimestamp);
        $("#value" + sensor.id).html(sensor.gaugevalue + " " + sensor.gaugeunit);
        $("#sparkline" + sensor.id).sparkline(sensor.series, {
            type: "line",
            width: "200",
            height: "50",
            tooltipFormat: '<span class="text-info bg-info">{{x}}:{{y}}</span>'
        });
        $("#counter" + sensor.id).html("Total " + sensor.countervalue + " " + sensor.counterunit);
        sensors[sensorId] = sensor;
    }
    mqttConnect();
});
