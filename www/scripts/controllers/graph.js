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

var GraphCtrl = function($scope) {
    $scope.debug = false;
    $scope.alerts = [];
    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };
    // link to the web server's IP address for MQTT socket connection
    var client;
    var reconnectTimeout = 2e3;
    // the FLM's web socket port from mosquitto
    var broker = location.hostname;
    var port = 8083;
    // prepare graph display
    // the received values
    var series = new Array(), sensors = {};
    // the selected series to show
    var selSeries = new Array();
    var color = 0;
    var flotOptions = {
        series: {
            lines: {
                show: true,
                steps: true
            },
            points: {
                show: false
            }
        },
        grid: {
            hoverable: true
        },
        xaxis: {
            mode: "time",
            timezone: "browser"
        },
        yaxis: {
            min: 0
        }
    };
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
        client.subscribe("/device/#");
        client.subscribe("/sensor/+/gauge");
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
        var msgType = topic[3];
        var sensorId = topic[2];
        if (sensors[sensorId] == null) {
            sensors[sensorId] = new Object();
            sensor.id = sensorId;
            sensor.name = sensorId;
        } else sensor = sensors[sensorId];
        var value = JSON.parse(payload);
        var now = new Date().getTime();
        var diff = 0;
        // now compute the gauge
        switch (msgType) {
          case "gauge":
            if (value.length == null) {
                sensor.gaugetimestamp = now;
                sensor.gaugevalue = value;
                sensor.gaugeunit = "";
            } else {
                switch (value.length) {
                  case 1:
                    sensor.gaugetimestamp = now;
                    sensor.gaugevalue = value[0];
                    sensor.gaugeunit = "";
                    break;

                  case 2:
                    sensor.gaugetimestamp = now;
                    sensor.gaugevalue = value[0];
                    sensor.gaugeunit = value[1];
                    break;

                  case 3:
                    // check time difference of received value to current time
                    // this is due to pulses being send on occurance, so potentially outdated
                    diff = now / 1e3 - value[0];
                    // flot.time requires UTC-like timestamps;
                    // see https://github.com/flot/flot/blob/master/API.md#time-series-data
                    sensor.gaugetimestamp = value[0] * 1e3;
                    sensor.gaugevalue = value[1];
                    sensor.gaugeunit = value[2];
                    break;

                  default:
                    break;
                }
                // check if current sensor was already registered
                var obj = series.filter(function(o) {
                    return o.label == sensor.name;
                });
                // if time difference is too large, skip gauge
                if (diff > 100) break;
                // ...if current sensor does not exist yet, register it
                if (obj[0] == null) {
                    obj = {};
                    obj.label = sensor.name;
                    obj.data = [ sensor.gaugetimestamp, sensor.gaugevalue ];
                    obj.color = color;
                    color++;
                    series.push(obj);
                    // add graph select option
                    $("#choices").append("<div class='checkbox'>" + "<small><label>" + "<input type='checkbox' id='" + sensor.name + "' checked='checked'></input>" + sensor.name + "</label></small>" + "</div>");
                } else {
                    obj[0].data.push([ sensor.gaugetimestamp, sensor.gaugevalue ]);
                    // move out values older than 5 minutes
                    var limit = parseInt(obj[0].data[0]);
                    diff = (sensor.gaugetimestamp - limit) / 1e3;
                    if (diff > 300) {
                        var selGraph = new Array();
                        for (var i in series) {
                            var selObj = {};
                            selObj.label = series[i].label;
                            selObj.data = series[i].data.filter(function(v) {
                                return v[0] > limit;
                            });
                            selObj.color = series[i].color;
                            if (selObj.data != null) selGraph.push(selObj);
                        }
                        series = selGraph;
                    }
                }
            }
            break;

          default:
            break;
        }
        // check the selected checkboxes
        selSeries = [];
        $("#choices").find("input:checked").each(function() {
            var key = $(this).attr("id");
            var s = series.filter(function(o) {
                return o.label == key;
            });
            selSeries.push(s[0]);
        });
        // plot the selection
        // compute graph boundaries
        var width = $("#graphpanel").width();
        var height = width * 3 / 4;
        height = height > 600 ? 600 : height;
        $("#graph").width(width).height(height);
        if ($("#graph").length) $.plot("#graph", selSeries, flotOptions);
        // and store the sensor configuration
        sensors[sensorId] = sensor;
    }
    // the jquery related graph handling
    $(function() {
        // allow tooltip on datapoints
        $("<div id='tooltip'></div>").css({
            position: "absolute",
            display: "none",
            border: "1px solid #ccc",
            padding: "2px",
            opacity: .9
        }).appendTo("body");
        // assign hover function
        $("#graph").on("plothover", function(event, pos, item) {
            if (item) {
                var itemTime = new Date(item.datapoint[0]);
                var hrs = itemTime.getHours();
                hrs = hrs < 10 ? "0" + hrs : hrs;
                var min = itemTime.getMinutes();
                min = min < 10 ? "0" + min : min;
                var sec = itemTime.getSeconds();
                sec = sec < 10 ? "0" + sec : sec;
                var unit = "";
                for (var s in sensors) {
                    if (sensors[s].name == item.series.label) {
                        unit = sensors[s].gaugeunit;
                        break;
                    }
                }
                $("#tooltip").html(item.series.label + " (" + hrs + ":" + min + ":" + sec + "): " + item.datapoint[1] + " " + unit).css({
                    top: item.pageY + 7,
                    left: item.pageX + 5
                }).fadeIn(200);
            } else $("#tooltip").hide();
        });
    });
    mqttConnect();
};

// the part of the AngularJS application that handles the graph
GaugeCtrl.$inject = [ "$scope" ];

angular.module("flmUiApp").controller("GraphCtrl", GraphCtrl);