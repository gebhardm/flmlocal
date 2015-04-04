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

var PanelCtrl = function($scope) {
    $scope.debug = false;
    $scope.alerts = [];
    $scope.sensors = [];
    $scope.message = "";
    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };
    // initialize panel
    var client;
    var reconnectTimeout = 2e3;
    var broker = location.hostname;
    var port = 8083;
    var sensors = [];
    // connectivity
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
        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;
        client.connect(options);
    }
    function onConnect() {
        client.subscribe("/device/+/config/sensor");
        client.subscribe("/sensor/+/gauge");
        client.subscribe("/sensor/+/counter");
    }
    function onConnectionLost(responseObj) {
        setTimeout(mqttConnect, reconnectTimeout);
        if (responseObj.errorCode !== 0) console.log("onConnectionLost:" + responseObj.errorMessage);
    }
    function onMessageArrived(mqttMsg) {
        var topic = mqttMsg.destinationName.split("/");
        if (topic[3] !== "query") var payload = mqttMsg.payloadString; else return;
        switch (topic[1]) {
          case "device":
            handle_device(topic, payload);
            break;

          case "sensor":
            handle_sensor(topic, payload);
            $scope.$apply(function() {
                $scope.sensors = sensors;
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
                    var sensor = sensors.filter(function(s) {
                        return s.id == sensorId;
                    });
                    if (sensor[0] == null) {
                        sensor = {};
                        sensor.id = cfg.id;
                        sensor.name = cfg.function;
                        sensors.push(sensor);
                    } else sensor[0].name = cfg.function;
                }
            }
        }
    }
    function handle_sensor(topic, payload) {
        var msgType = topic[3];
        var sensorId = topic[2];
        var value = JSON.parse(payload);
        var sensor = {};
        var sIndex = sensors.filter(function(s) {
            return s.id == sensorId;
        });
        if (sIndex[0] == null) {
            sensor.id = sensorId;
            sensor.name = sensorId;
            sensors.push(sensor);
            sensor = sensors[sensors.length - 1];
        } else sensor = sIndex[0];
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
        $("#sparkline" + sensor.id).sparkline(sensor.series, {
            type: "line",
            width: "200",
            height: "50",
            tooltipFormat: '<span class="text-info bg-info">{{x}}:{{y}}</span>'
        });
        if (sensor.countervalue === undefined) sensor.countervalue = "";
    }
    mqttConnect();
};

// the part of the AngularJS application that handles the panel
PanelCtrl.$inject = [ "$scope" ];

angular.module("flmUiApp").controller("PanelCtrl", PanelCtrl);