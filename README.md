# Turn-By-WiAR 
============================

### Prerequisites: 

* An iPad running ARKit, iOS 11 or newer, A9 processor or newer. 
XCode 9 or newer.
* Apple Developer account (sign up for one at developer.apple.com)
* Access to the turnByWire lathe.
* (Optional) A gooseneck iPad stand. 

### How to run the app: 

1) Install WebARonARKit. WebARonARKit is a browser app that allows AR applications to run on top of web technologies. You can clone the project and find detailed installation instructions on their repository, https://github.com/google-ar/WebARonARKit

2) Open the WebARonARKit app, and navigate to turnbywire.glitch.me to run the main app. For the collaborator view, navigate to turnbywire.glitch.me/collab.


### How to use the app: 

#### AR view 
This instantiates the workpiece at a fixed pose relative to the iPad origin. The workpiece can be moved either by moving the iPad while pressing the screen, or for more precision, with the buttons under the "toggle pos controls" menu in the sidebar. 

#### Collaborator view 
The collaborator view is meant to be used by a remote user working in-situ. The collaborator can draw around the workpiece by pressing on the screen while moving the iPad around. The drawings are stored relative to the workpiece, and transmitted over the network. Shaking the screen will undo the latest stroke, as will tapping the undo drawing button on the sidebar. 

### How to edit the app:
The glitch branch (not master!) of this repo hosts the latest version of the web app. To run it locally, you can clone the repo and run the Express webserver in server.py. All development has been done in Glitch (a web IDE with integrated text editor, version control, hosting, and deployment.) For access to the Glitch repository, contact me.   


============================

The full technical report with specifics on interaction design, implementation details and system evaluation is hosted here: https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-70.html
