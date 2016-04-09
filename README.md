# FLM local visualizations
This repository contains a selection of visualizations that run directly on the [Fluksometer](http://www.flukso.net/about) as an addendum to its inherent firmware.

It contains a native implementation of [Justgage](http:/justgage.com) gauges, [Flot](http://www.flotcharts.org/) charts and graph, a plain panel and a "simple consumption view" to be used with the [Fluksometer's](http://flukso.net) AngularJS based user interface.

The implementation sits on top of the [Paho JavaScript client](https://eclipse.org/paho/clients/js/) to receive and compute MQTT (sensor) messages.

## How to use
To utilize this implementation, `git clone` the [repository](http://github.com/gebhardm/flmlocal) and copy the content of the [www/](www/) folder to your Fluksometer with firmware version >2.4.x.<br>
Alternatively [download the ZIP](https://github.com/gebhardm/flmlocal/archive/master.zip) and unpack it, but be aware that you then cannot get updates with an easy `pull`. So, take some time to learn about [Git](http://git-scm.com/) and install it on your computer.

The current implementation reflects the state as of the Fluksometer firmware version 2.5.0 (please note that the original files `www/index.html` and `www/scripts/app.js` are overwritten - factory reset remains unchanged, of course).<br>

Use the linux/OS X command **scp** for this purpose; for windows use [WinSCP](http://winscp.net). When changed to the [www/](www/) directory, perform a 

    scp -r * root@<FLM ip address>:/www/

You are prompted for the root's password (default is `root`), then all necessary files are transferred (recursively through option -r) to your Fluksometer.

By that you gain direct access to the different visualization alternatives directly from the Fluksometer's landing page navigation when calling

    http://<flm ip address>

in your browser (you may find the FLM also through Bonjour). Be aware that due to overcrowding by the larger number of navigation options I condensed the selection of the differen configuration and visualization pages into dropdown menus.

For a **step-by-step description**, please refer to the [howto/](howto/) folder and its [ReadMe](https://github.com/gebhardm/flmlocal/blob/master/howto/ReadMe.md) file.

All code is JavaScript with corresponding HTML utilizing the FLM's AngularJS user interface. With this implementation also all necessary libraries are copied; so there is no need to install anything further (especially no Java).

<img src="FLMlocalGauge.png" width=500px>

## Recognizing device configuration
From Fluksometer firmware version 2.4.6 onwards there is a dedicated MQTT topic on which the FLM's configuration is published; on topic `/device/<device id>/config/sensor` all parameters are available that indicate specific sensor settings. This is used to show the actual sensor names instead of just their IDs. For more information, please refer to the next section.

## Show arbitrary sensors
Even though the primary purpose of this implementation is to visualize Fluksometer readings, it is capable to handle also other information passed to the FLM's MQTT broker (try it with [mosquitto](http://mosquitto.org/)).<br>
So, if you have, for example, an [Arduino Ethernet](https://github.com/gebhardm/energyhacks/tree/master/AVRNetIOduino/AVRNetIO_MQTT_DS_DHT) publishing sensor data (for example on temperature or humidity), this can be visualized as well, if you properly address the FLM MQTT broker. The gauge, graph and panel take all sensor information formatted as (payload in either JSON format)

    topic: /sensor/<sensor id>/gauge
    payload: <value>
            [<value>]
            [<value>, <unit>]
            [<timestamp>, <value>, <unit>]

Note that here the `<sensor id>` is taken as name as long as you are not publishing any device configuration topic with ID, name and if enabled (other parameters are currently not used, like `class` and `type`, but may in the future).

    topic: /device/<device id>/config/sensor
    payload: { "<sensor enum>":{ "id":"<sensor id>",
                                 "function":"<sensor name>",
                                 "enable":"1" } }

<img src="FLMlocalPanel.png" width=500px>

## Querying TMPO data
Another feature of firmware 2.4.x onwards is, that there is an FLM local storage of counter values. This feature is called **TMPO**; refer to the corresponding [announcement](https://www.flukso.net/content/r246-release-notes) for more information.

With [/usr/sbin/queryd.lua](/usr/sbin/queryd.lua) and the corresponding chart tab on the FLM exists a query daemon capable to retrieve locally stored TMPO time series files and visualize them; this may be used for data analysis without having to store data on an external database.

### TMPO query daemon
To install this feature, copy the [queryd.lua](/usr/sbin/queryd.lua) file to the `/usr/sbin` folder of your FLM using **scp**.

    scp queryd.lua root@<FLM IP address>:/usr/sbin/queryd.lua

This query provider you may run with `lua /usr/sbin/queryd.lua &`.

As an alternative you may install this also as a "real" daemon. For this you have to add a  symbolic link

    ln -s /usr/sbin/luad /usr/sbin/queryd
    
and start the query daemon by

    /usr/sbin/queryd -u flukso`
    
A [pull request](https://github.com/flukso/flm02/pull/7) for integration into the FLM firmware standard is sent, that also includes proper startup on boot.

If you want to add this feature manually, then you have to change the `/etc/init.d/flukso` initialization file accordingly. Make a backup first! (`cp /etc/init.d/flukso /etc/init.d/flukso.bak`)
Take a look at a reference [flukso.init](/etc/init.d/flukso) file for what to change (basically it is just the start and stop of the query daemon).

### Query daemon functionality
The query daemon works as follows:

Sending an MQTT message to the FLM's MQTT broker with following content

    topic: /query/<sid>/tmpo
    payload: [<fromtimestamp>, <totimestamp>]

will be computed by the query daemon. Corresponding to the sent query time interval (the same timestamp format as provided by the `/sensor`-topics is used, thus a POSIX timestamp on second base) one or more fitting TMPO files are retrieved (which are compressed using **gzip**) and sent back, that is published, on

    topic: /sensor/<sid>/query/<fromtimestamp>/<totimestamp>
    payload: <gzipped tmpo file>

The content of the queried data then is decompressed and computed with a JS script in the browser. It is displayed as a FluksoChart using Flot charts like in the FluksoGraph.<br>
For smoothing the graphs (visualized is the first derivative of the counter increase values with respect to time - actually a "simple difference calculation" of the TMPO-stored counter values) a continuous average on minute based values is displayed. This is done as on raw data there are extreme "bumps" due to the discreteness and approximation of the original counter value set also on second base; if displayed directly, you will experience a kind of "pulse width modulation" which is rather inconvenient to the eye and stresses the Flot chart to an extreme. You may play with the value of *n* in [chart.js](https://github.com/gebhardm/flmlocal/blob/master/www/scripts/controllers/chart.js#L176), *function chart_sensor(sensor)*.

<img src="FLMlocalChart.png" width=500px>

In the chart you may select by mouse details from a smaller time interval (does sadly not seem to work on a tablet computer); also you may switch on and off the different graphs in the chart using the checkboxes underneath the diagram panel.

## Show Simple Consumption
As a further visualization variant, following a [discussion in the FluksoForum](https://www.flukso.net/content/simple-graphically-styled-display-summarising-everything-including-net-consumption), I made a simple consumption view, showing what is produced (e.g. by a PV installation), what is totally consumed and what is as difference taken from respective supplied to the power grid. The specialty of this visualization is, that sensors can be labelled as *producing* or *consuming* input. The sensor configuration section can be toggled for convenience of the display.

<img src="FLMlocalConsumption.png" width=500px>

## Credits
This code under [MIT license](LICENSE); all used libraries/includes with the respective license noted.

The gauge uses [JustGage](http://justgage.com/), the graphs are built using [Flot](http://www.flotcharts.org/) and the panel utilizes [jQuery Sparkline](http://omnipotent.net/jquery.sparkline/); the consumption view uses my humble own graphical representation. All utilizes [jQuery](https://jquery.com/).<br/>
Corresponding licenses are the [MIT license](http://opensource.org/licenses/mit-license.php) and the [New BSD license](http://opensource.org/licenses/BSD-3-Clause).
