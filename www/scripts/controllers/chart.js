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

// link to the web server's IP address for MQTT socket connection
var client;

var reconnectTimeout = 2e3;

// the FLM's web socket port from mosquitto
var broker = location.hostname;

var port = 8083;

// chart data to display and selected details
var chart = new Array(), selChart = new Array();

// chart colors
var color = 0;

// detected sensor configurations
var sensors = {};

// chart display options
var options = {
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
    },
    selection: {
        mode: "x"
    }
};

// chart display options
var fromDate, fromTime, toDate, toTime;

// the part of the AngularJS application that handles the gauges
var app = angular.module("flmUiApp");

app.controller("ChartCtrl", function($scope) {
    $scope.debug = false;
    $scope.alerts = [];
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
        client.subscribe("/sensor/+/query/#");
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
        var payload;
        // the sensor message type is the third value of the topic
        switch (topic[1]) {
          case "device":
            payload = mqttMsg.payloadString;
            handle_device(topic, payload);
            break;

          case "sensor":
            payload = mqttMsg.payloadBytes;
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
    // plot the received data series
    function handle_sensor(topic, payload) {
        var data = new Array();
        var qfrom, qto, qtime, qval, qfact;
        var i, j, n = 5;
        var gunzip = new Zlib.Gunzip(payload);
        var decom = gunzip.decompress();
        var str = "";
        for (i = 0; i < decom.length; i++) {
            str += String.fromCharCode(decom[i]);
        }
        var tmpo = JSON.parse(str);
        decom = [];
        str = "";
        switch (tmpo.h.cfg.type) {
          case "electricity":
            qfact = 3600;
            break;

          default:
            qfact = 3600;
            break;
        }
        data = [];
        qfrom = topic[4] * 1e3;
        qto = topic[5] * 1e3;
        qtime = tmpo.h.head[0] * 1e3;
        data.push([ qtime, tmpo.v[0] ]);
        // handle shorter sets of values
        if (tmpo.v.length < 6) {
            for (i = 1; i < tmpo.v.length; i++) {
                qtime += tmpo.t[i] * 1e3;
                if (qfrom <= qtime && qtime <= qto) {
                    // round to one decimal place
                    qval = qfact * tmpo.v[i] / tmpo.t[i];
                    data.push([ qtime, Math.round(qval * 10) / 10 ]);
                }
            }
        } else {
            for (i = n; i < tmpo.v.length; i++) {
                qtime += tmpo.t[i] * 1e3;
                if (qfrom <= qtime && qtime <= qto) {
                    qval = 0;
                    // perform a rolling average on the data
                    for (j = 0; j < n; j++) qval += qfact * tmpo.v[i - j] / tmpo.t[i - j];
                    qval /= n;
                    data.push([ qtime, Math.round(qval * 10) / 10 ]);
                }
            }
        }
        // get rid of zero value at the serie's begin
        data.shift();
        // check if chart has to be altered or a new series has to be added
        var obj = chart.filter(function(o) {
            return o.label == tmpo.h.cfg.function;
        });
        if (obj[0] == null) {
            obj = {};
            obj.label = tmpo.h.cfg.function;
            obj.data = data;
            obj.color = color;
            color++;
            chart.push(obj);
            // add graph selection option
            $("#choices").append("<div class='checkbox'>" + "<small><label>" + "<input type='checkbox' id='" + obj.label + "' checked='checked'></input>" + obj.label + "</label></small>" + "</div>");
        } else {
            for (i = 0; i < data.length; i++) {
                obj[0].data.push(data[i]);
            }
            obj[0].data.sort(function(a, b) {
                var x = a[0];
                var y = b[0];
                return y - x;
            });
        }
        // process the chart selection
        $("#choices").find("input").on("click", plotSelChart);
        function plotSelChart() {
            selChart = [];
            $("#choices").find("input:checked").each(function() {
                var key = $(this).attr("id");
                var s = chart.filter(function(o) {
                    return o.label == key;
                });
                selChart.push(s[0]);
            });
            $("#info").html("");
            // size the output area
            var width = $("#chartpanel").width();
            var height = width * 3 / 4;
            height = height > 600 ? 600 : height;
            $("#chart").width(width).height(height);
            $("#chart").plot(selChart, options);
        }
        // and finally plot the graph
        $("#info").html("");
        plotSelChart();
        // process hover
        $("#chart").on("plothover", function(event, pos, item) {
            if (item) {
                var itemTime = new Date(item.datapoint[0]);
                var hrs = itemTime.getHours();
                hrs = hrs < 10 ? "0" + hrs : hrs;
                var min = itemTime.getMinutes();
                min = min < 10 ? "0" + min : min;
                var sec = itemTime.getSeconds();
                sec = sec < 10 ? "0" + sec : sec;
                $("#tooltip").html(hrs + ":" + min + ":" + sec + " : " + item.datapoint[1]).css({
                    top: item.pageY + 7,
                    left: item.pageX + 5
                }).fadeIn(200);
            } else $("#tooltip").hide();
        });
        // process selection time interval
        $("#chart").on("plotselected", function(event, range) {
            var selFrom = range.xaxis.from.toFixed(0);
            var selTo = range.xaxis.to.toFixed(0);
            var details = new Array();
            // filter values within the selected time interval
            for (var i in selChart) {
                var selObj = {};
                selObj.color = selChart[i].color;
                selObj.label = selChart[i].label;
                selObj.data = selChart[i].data.filter(function(v) {
                    return v[0] >= selFrom && v[0] <= selTo;
                });
                details.push(selObj);
            }
            // size the output area
            var width = $("#chartpanel").width();
            var height = width * 3 / 4;
            height = height > 600 ? 600 : height;
            $("#chart").width(width).height(height);
            $("#chart").plot(details, options);
            $("#info").html('<div align="center"><button class="btn btn-primary btn-sm" id="reset">Reset</button></div>');
            // redraw the queried data
            $("#reset").on("click", function() {
                $("#chart").plot(selChart, options);
            });
        });
    }
    // set the time interval to the current time
    $("#refresh").on("click", function() {
        var dNow = new Date();
        var day = dNow.getDate();
        day = day < 10 ? "0" + day : day;
        var month = dNow.getMonth() + 1;
        month = month < 10 ? "0" + month : month;
        var hrs = dNow.getHours();
        hrs = hrs < 10 ? "0" + hrs : hrs;
        var min = dNow.getMinutes();
        min = min < 10 ? "0" + min : min;
        var sec = dNow.getSeconds();
        sec = sec < 10 ? "0" + sec : sec;
        var localDate = dNow.getFullYear() + "-" + month + "-" + day;
        var localTime = hrs + ":" + min + ":" + sec;
        $("#fromDate").val(localDate);
        $("#fromTime").val(localTime);
        $("#toDate").val(localDate);
        $("#toTime").val(localTime);
        // clear the chart area
        $("#chart").html("");
        $("#info").html("");
        $("#choices").html("");
    });
    // prepare and emit the query request
    $("#submit").on("click", function() {
        fromDate = $("#fromDate").val();
        fromTime = $("#fromTime").val();
        toDate = $("#toDate").val();
        toTime = $("#toTime").val();
        $("#choices").html("");
        emit();
    });
    // allow tooltip on datapoints
    $("<div id='tooltip'></div>").css({
        position: "absolute",
        display: "none",
        border: "1px solid #ccc",
        padding: "2px",
        opacity: .9
    }).appendTo("body");
    // emit the query request to the server part
    function emit() {
        var offset = new Date().getTimezoneOffset() * 60;
        var from = Date.parse(fromDate + "T" + fromTime + "Z") / 1e3 + offset;
        var to = Date.parse(toDate + "T" + toTime + "Z") / 1e3 + offset;
        $("#chart").html("");
        $("#info").html("<p class='text-center'>Loading</p>");
        var msg = new Paho.MQTT.Message("[" + from + "," + to + "]");
        for (var s in sensors) {
            msg.destinationName = "/query/" + sensors[s].id + "/tmpo";
            client.send(msg);
        }
        chart = [];
        color = 0;
    }
    mqttConnect();
});