SSH wrapper for [VSC](https://vscentrum.be)
===========================================

To access the HPC infrastructure from KULeuven/UHasselt using command line
SSH, in general you first need to authenticate on https://firewall.vscentrum.be/
to whitelist your IP address, and only for a short while afterwards you'll be
able to SSH successfully (see also 
[Location access restrictions](https://docs.vscentrum.be/accounts/authentication.html#location-access-restrictions)
in the documentation).

When you've authenticated, you also get a token which you can use to re-authenticate
using eg 'curl', which stays valid for a few days.

This repository contains a [node.js](https://nodejs.org/) script that automates this:
if a file called '.vscbearer.dat' exists in your home directory, it will try to
do the authentication with the token string in that file. If the file does not exist,
or the token is expired, it will open the firewall page using [puppeteer](https://pptr.dev/).
Once authenticated, it will grab the token string from the web page and save it in the file. 
When the authentication worked, it will execute 'ssh' with the command line arguments
you specified.

To install the dependencies, first run 'npm install'. Then you can either execute
'sshvsc.mjs' (Linux) or 'sshvsc.bat' (Windows) like you would the 'ssh' command, for example

    ./sshvsc.mjs vsc12345@login.hpc.kuleuven.be

Prerequisites:
 - The 'ssh' command must be available and executable. If not in PATH, you can edit the .mjs
   script to use the full path to 'ssh'.
 - 'node' must be installed and executable as a command. If it's installed but not in PATH,
   you can change either the '#!' line in the .mjs file, or the .bat file to contain the full
   path to the 'node' executable.
