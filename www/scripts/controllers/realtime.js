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

var RealtimeCtrl = function($scope) {
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
    // prepare the chart display
    var ctx = document.getElementById("chart").getContext("2d");
    var myChart;
    var options = {
        responsive: true,
        scales: {
            yAxes: [ {
                ticks: {}
            } ]
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
        client.subscribe("/device/+/flx/current/+");
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
        var msg = {};
        var payload, phase, topic;
        topic = mqttMsg.destinationName.split("/");
        phase = topic[topic.length - 1];
        payload = mqttMsg.payloadString;
        try {
            payload = JSON.parse(payload);
        } catch (error) {
            console.log("Error parsing JSON");
            return;
        }
        if (payload[2] === "mV") {
            var series = payload[1];
            for (var val in series) series[val] = series[val] / 1e3;
            payload[2] = "V";
        }
        msg = {
            phase: phase,
            data: payload[1]
        };
        displayGraph(msg);
    }
    function displayGraph(msg) {
        var data;
        if (myChart === undefined) {
            data = {
                labels: [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 ],
                datasets: [ {
                    label: "L1",
                    fill: false,
                    borderColor: "#f00",
                    data: msg.data
                }, {
                    label: "L2",
                    fill: false,
                    borderColor: "#0f0",
                    data: msg.data
                }, {
                    label: "L3",
                    fill: false,
                    borderColor: "#00f",
                    data: msg.data
                } ]
            };
            myChart = new Chart(ctx, {
                type: "line",
                data: data,
                options: options
            });
        } else {
            myChart.data.datasets[msg.phase - 1].data = msg.data;
            myChart.update();
        }
    }
    mqttConnect();
};

// the part of the AngularJS application that handles the chart
RealtimeCtrl.$inject = [ "$scope" ];

angular.module("flmUiApp").controller("RealtimeCtrl", RealtimeCtrl);