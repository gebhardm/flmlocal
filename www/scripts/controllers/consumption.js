/*
The MIT License (MIT)

Copyright (c) 2015 Markus Gebhard <markus.gebhard@web.de>

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

var ConsumptionCtrl = function($scope) {
    $scope.debug = false;
    $scope.alerts = [];
    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };
    $scope.cfgCollapsed = false;
    // link to the web server's IP address for MQTT socket connection
    var client;
    var reconnectTimeout = 2e3;
    // the FLM's web socket port from mosquitto
    var broker = location.hostname;
    var port = 8083;
    var sensors = {};
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
            break;

          default:
            break;
        }
    }
    // handler for device configuration
    function handle_device(topic, payload) {
        var deviceID = topic[2];
        if (topic[3] == "config") {
            var config = JSON.parse(payload);
            for (var obj in config) {
                var cfg = config[obj];
                if (cfg.enable == "1") {
                    if (sensors[cfg.id] == null) {
                        sensors[cfg.id] = new Object();
                        sensors[cfg.id].id = cfg.id;
                        sensors[cfg.id].name = cfg.function;
                    } else sensors[cfg.id].name = cfg.function;
                }
            }
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
        if (sensors[sensorId] == null) {
            sensors[sensorId] = new Object();
            sensor.id = sensorId;
            sensor.name = sensorId;
        } else sensor = sensors[sensorId];
        // now compute the received mqttMessage
        switch (msgType) {
          case "gauge":
            // handle the payload to obtain gauge values
            switch (value.length) {
              case 1:
                break;

              case 2:
                if (value[1] !== "W") break;
                sensor.value = value[0];
                sensor.unit = value[1];
                break;

              case 3:
                if (value[2] !== "W") break;
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
            // set up the selection and the local storage of sensor flow direction
            if (sensor.type == null && sensor.unit === "W") {
                $("#choices").append("<div class='form-inline'>" + "<label for='" + sensor.id + "' class='control-label span2'>" + sensor.name + "</label>" + "<select id='" + sensor.id + "'>" + "<option>Consumption</option>" + "<option>Production</option>" + "</select>" + "</div>");
                // on change of flow direction store the respective value
                $("#" + sensor.id).change(sensor, function(event) {
                    localStorage.setItem(event.data.id, event.target.value);
                    sensors[event.data.id].type = event.target.value;
                });
                // retrieve a flow direction value that may be previously stored
                var dirVal = localStorage.getItem(sensor.id);
                if (dirVal !== null) {
                    $("#" + sensor.id).val(dirVal);
                }
                sensor.type = $("#" + sensor.id).val();
            }
            sensors[sensorId] = sensor;
            break;

          default:
            break;
        }
        handle_display(sensor);
    }
    // handle the visualization refresh
    function handle_display(sensor) {
        var productionValue = 0;
        var consumptionValue = 0;
        for (var s in sensors) {
            if (sensors[s].unit === "W") {
                switch (sensors[s].type) {
                  case "Production":
                    productionValue += sensors[s].value;
                    break;

                  case "Consumption":
                    consumptionValue += sensors[s].value;
                    break;

                  default:
                    break;
                }
            }
        }
        // compute the consumption values
        var gridValue = consumptionValue - productionValue;
        var selfuseValue = productionValue > consumptionValue ? consumptionValue : productionValue;
        var supplyValue = productionValue > consumptionValue ? productionValue - consumptionValue : 0;
        var obtainedValue = consumptionValue - productionValue > 0 ? consumptionValue - productionValue : 0;
        // write the values to the display
        $("#grid").html(gridValue + "W");
        $("#supply").html(supplyValue + "W");
        $("#production").html(productionValue + "W");
        $("#selfuse").html(selfuseValue + "W");
        $("#consumption").html(consumptionValue + "W");
        $("#obtained").html(obtainedValue + "W");
        if (productionValue >= consumptionValue) {
            $("#status").css("background-color", "green");
        } else {
            $("#status").css("background-color", "red");
        }
    }
    function init_display() {
        // compute the scaling
        $("#image").css("position", "relative");
        var scale = $("#image").width() / 1226;
        // format the output
        $(".watt").css("position", "absolute");
        $(".watt").css("width", 307 * scale + "px");
        $(".watt").css("text-align", "center");
        $(".watt").css("color", "rgb(91,155,213)");
        $(".watt").css("font-family", "arial");
        $(".watt").css("font-size", 64 * scale + "px");
        $(".watt").css("font-weight", "bold");
        $("#grid").css("top", 245 * scale + "px");
        $("#grid").css("left", 60 * scale + "px");
        $("#supply").css("top", 40 * scale + "px");
        $("#supply").css("left", 500 * scale + "px");
        $("#selfuse").css("top", 420 * scale + "px");
        $("#selfuse").css("left", 740 * scale + "px");
        $("#production").css("top", 245 * scale + "px");
        $("#production").css("left", 910 * scale + "px");
        $("#consumption").css("top", 795 * scale + "px");
        $("#consumption").css("left", 480 * scale + "px");
        $("#obtained").css("top", 420 * scale + "px");
        $("#obtained").css("left", 220 * scale + "px");
        $("#status").css("position", "absolute");
        $("#status").css("top", 555 * scale + "px");
        $("#status").css("left", 455 * scale + "px");
        $("#status").css("width", 360 * scale + "px");
        $("#status").css("height", 360 * scale + "px");
        $("#status").css("border-radius", 60 * scale + "px");
        $("#status").css("opacity", "0.2");
    }
    init_display();
    mqttConnect();
};

// the part of the AngularJS application that handles the consumption display
ConsumptionCtrl.$inject = [ "$scope" ];

angular.module("flmUiApp").controller("ConsumptionCtrl", ConsumptionCtrl);
