#FLM local visualizations
This is a native implementation of the [Justgage](http:/justgage.com) gauges, the [Flot](http://www.flotcharts.org/) charts graph and a plain panel to be used in the [Fluksometer's](http://flukso.net) AngularJS based user interface. It sits on top of the [Paho JavaScript client](https://eclipse.org/paho/clients/js/) to receive and compute MQTT (sensor) messages.<br/>
To utilize this implementation, copy the content of the [www/](www/) folder to your Fluksometer with firmware version >2.4. The current implementation reflects the state as of firmware version 2.4.6 (please note that the original files www/index.html and www/scripts/app.js are overwritten - factory reset remains unchanged, of course).<br>
Use the linux/OSX command **scp** for this purpose; for windows use [WinSCP](http://winscp.net).

    scp -r * root@<FLM ip address>:/www/

You are prompted for the root's password, then all necessary files are transferred (recursively through option -r)

By that you gain direct access to a local gauge, graph and panel visualization directly from the Fluksometer's landing page navigation when calling

    <flm ip address>

in your browser.

<img src="FLMlocalGauge.png" width=500px>

From Fluksometer firmware version 2.4.6 onwards there is a dedicated topic on which the FLM's configuration is published; on topic `/device/<device id>/config` all parameters are available that indicate specific sensor settings. This is used to show the actual sensor names instead of just their IDs. For more information, please refer to the next section. 

##Show arbitrary sensors
Even though the primary purpose of this implementation is to visualize Fluksometer readings, it is capable to handle also other information passed to the FLM's MQTT broker. So, if you have, for example, an [Arduino Ethernet](https://github.com/gebhardm/energyhacks/tree/master/AVRNetIOduino/AVRNetIO_MQTT_DS_DHT) publishing sensor data (for example on temperature or humidity), this can be visualized as well, if you properly address the FLM MQTT broker. The visualizer (gauge, graph and panel) take all sensor information formatted as (payload in either JSON format)

    topic: /sensor/<sensor id>/gauge
    payload: <value> 
            [<value>] 
            [<value>, <unit>] 
            [<timestamp>, <value>, <unit>]

Note that here the `<sensor id>` is taken as name as long as you are not publishing any device configuration topic with ID, name and if enabled (other parameters are currently not used, like "class" and "type", but may in the future).

    topic: /device/<device id>/config/sensor
    payload: { "<sensor enum>":{ "id":"<sensor id>", 
                                 "function":"<sensor name>", 
                                 "enable":"1" } }

<img src="FLMlocalPanel.png" width=500px>
 
## Querying TMPO data
With [/usr/sbin/queryd.lua](/usr/sbin/queryd.lua) and the corresponding chart tab on the FLM exists a proof-of-concept of a query daemon capable to retrieve locally stored TMPO time series files (available and active also from firmware v2.4.4 onwards) and visualize them; this may be used for data analysis without having to store data on an external database. 

To install this feature, copy the query.lua file to the `/usr/sbin` folder of your FLM using **scp** as depicted above and run it with `lua /usr/sbin/queryd.lua &` without having to install a real daemon for now - a pull request for [tmpod.lua integration](https://github.com/flukso/flm02/pull/6) has been sent, but is not merged. Of course, you may install this also as a daemon by adding a symbolic link `ln -s /usr/sbin/luad /usr/sbin/queryd` and starting the query daemon by `/usr/sbin/queryd -u flukso`; startup integration to be added.

The query daemon works as follows:

Sending an MQTT message to the FLM's MQTT broker with following content

    topic: /query/<sid>/tmpo
    payload: [<fromtimestamp>, <totimestamp>]
    
will be computed by the query daemon. Corresponding to the sent query time interval (the same timestamp format as provided by the `/sensor`-topics is used, thus a POSIX timestamp on second base) one or more fitting TMPO files are retrieved and sent back, that is published, on

    topic: /sensor/<sid>/query/<fromtimestamp>/<totimestamp>
    payload: <gzipped tmpo file>
    
The content of the queried data then is decompressed and computed with a JS script in the browser. It is displayed as a FluksoChart using Flot charts like in the FluksoGraph. For smoothing the graphs (visualized is the first derivative of the counter increase values with respect to time - actually a "simple difference calculation" of the TMPO-stored counter values) a continuous average on minute based values is displayed. This is done as on raw data there are extreme "bumps" due to the discreteness and approximation of the original counter value set also on second base; if displayed directly, you will experience a kind of "pulse width modulation" which is rather inconvenient to the eye and stresses the Flot chart to an extreme. You may play with the value of *n* in [chart.js](https://github.com/gebhardm/flmlocal/blob/master/www/scripts/controllers/chart.js#L176), *function chart_sensor(sensor)*.

<img src="FLMlocalChart.png" width=500px>

In the chart you may select by mouse details from a smaller time interval (does sadly not seem to work on a tablet computer); also you may switch on and off the different graphs in the chart using the checkboxes underneath the diagram panel.

##Credits
This code under [MIT license](LICENSE); all used libraries/includes with the respective license noted.

The gauge uses [JustGage](http://justgage.com/), the graph is built using [Flot](http://www.flotcharts.org/) and the panel utilizes [jQuery Sparkline](http://omnipotent.net/jquery.sparkline/).<br/>
Corresponding licenses are the [MIT license](http://opensource.org/licenses/mit-license.php) and the [New BSD license](http://opensource.org/licenses/BSD-3-Clause).
