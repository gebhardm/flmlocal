#FLM local visualizations
This is a native implementation of the [Justgage](http:/justgage.com) gauges to be used in the [Fliuksometer's](http://flukso.net) AngularJS user interface.
To utilize this implementation, copy the content of the [www/](www/) folder to your FLM with firmware version >2.4.<br>
Use the linux/OSX command **scp** for this purpose; for windows use WinSCP.

`scp -r * root@<FLM ip address>:/www/`

You are prompted for the root's password, then all necessary files are transferred (option -r)

By that you gain direct access to a local gauge visualization directly from the FLM's landing page navigation when calling

`<flm ip address>`

in your browser.

<img src="FLMlocalGauge.png" width=500px> 

This code under [MIT license](LICENSE); all used libraries/includes with the respective license noted.