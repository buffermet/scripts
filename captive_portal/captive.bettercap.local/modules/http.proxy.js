var addr, hostname;

var loginAttempts = {};
var loginAttemptsFilePath;

var pathAuth, pathUsage;

function onRequest(req, res) {
	if (req.Hostname === hostname) {
		req.Hostname = addr;
	}
	if (req.Hostname === addr) {
		switch (req.Path) {
		case pathAuth:
			// adjust authentication logic here
			if (req.Query) {
				if (!loginAttempts[req.Client.IP]) {
					loginAttempts[req.Client.IP] = [];
				}
				loginAttempts[req.Client.IP].push({
					headers: req.Headers,
					query: req.Query,
					time: new Date().getTime(),
				});
				writeFile(
					loginAttemptsFilePath,
					JSON.stringify(loginAttempts));
			}
			addSessionEvent("captiveportal.lease.new", req.Client.IP);
			break;
		case pathUsage:
			res.Body = env["captiveportal." + req.Client.IP + ".lease"];
			res.SetHeader("Content-Type", "application/json");
			break;
		}
	} else {
		url = "http://";
		if (hostname) {
			url += hostname;
		} else {
			url += addr;
		}
		res.SetHeader("Location", url + "/index.html");
		res.Status = 302;
	}
}

function onLoad() {
	addr = env["captiveportal.address"];
	hostname = env["captiveportal.hostname"];

	leasesString = readFile(env["captiveportal.lease.file"]);
	if (leasesString) {
		leases = JSON.parse(leasesString);
	}
	loginAttemptsFilePath = env["captiveportal.loginattempts.file"];
	loginAttemptsString = readFile(loginAttemptsFilePath);
	if (loginAttemptsString) {
		try {
			loginAttempts = JSON.parse(loginAttemptsString);
		} catch(err) {
			log_fatal("Error parsing 'captiveportal.loginattempts.file' contents: " + err);
		}
	}

	pathAuth = env["captiveportal.path.auth"];
	if (!pathAuth) {
		log_warn("Missing 'captiveportal.path.auth' path value, using default (/auth).");
		pathAuth = "/auth";
	}
	pathUsage = env["captiveportal.path.usage"];
	if (!pathUsage) {
		log_warn("Missing 'captiveportal.path.usage' path value, using default (/usage).");
		pathAuth = "/usage";
	}
}
