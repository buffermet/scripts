require("timeout");
require("random");

var address, iface;

var leaseDelay, leaseDuration, leaseFilePath, leaseResetTime;

var leases = {
	active: {}, // IP mapped
	expired: [], // List of IPs
};

var ports = {
	tcp: [],
	udp: [],
};

var resetInProgress = false;

var resolver;

var selectorIfaceValidator = new RegExp("^[0-9a-zA-Z_-]{1,15}$");
var selectorIPValidator = new RegExp("^[0-9a-fA-F:.]{7,39}$");
var selectorOsBsdValidator = new RegExp("^(?:darwin|(?:free|net|open)bsd)$");

/**
 * Authorizes a client if they don't have an expired lease timeout.
 */
onEvent("captiveportal.lease.new", function(data) {
	var clientIP = data.data;
	if (!selectorIPValidator.test(clientIP)) {
		log_error("Invalid or missing 'clientIP' in captiveportal.lease.new event. (got " + clientIP + ")");
		return;
	}
	log_info("New lease requested by: " + clientIP);
	authorize(clientIP);
});

/**
 * Force-authorizes a client.
 */
onEvent("captiveportal.authorize", function(data) {
	var clientIP = data.data;
	if (!selectorIPValidator.test(clientIP)) {
		log_error("Invalid or missing 'clientIP' provided with captiveportal.authorize command. (got " + clientIP + ")");
		return;
	}
	log_info("Authorizing client: " + clientIP);
	if (leases.active[clientIP]) {
		log_info(clientIP + " already has an active lease.");
		return;
	}
	addUpstreamRulesForClient(clientIP);
	var now = new Date().getTime();
	leases.active[clientIP] = {
		expiry: now + leaseDuration * 1000,
		timestamp: now,
		usage: {}, // todo
	};
	leases.expired = leases.expired.filter(function(_clientIP) {
		return _clientIP !== clientIP;
	});
	writeLeases();
});

/**
 * Unauthorizes a client.
 */
onEvent("captiveportal.unauthorize", function(data) {
	var clientIP = data.data;
	if (!selectorIPValidator.test(clientIP)) {
		log_error("Invalid or missing 'clientIP' provided with captiveportal.unauthorize command. (got " + clientIP + ")");
		return;
	}
	log_info("Unauthorizing client: " + clientIP);
	unauthorize(clientIP);
});

/**
 * Adds firewall rules to drop all packets and only accept traffic destined to this
 * captive portal on the specified ports.
 */
function addDownstreamRules() {
	if (selectorOsBsdValidator.test(os)) {
		run("!pfctl -t authorized -T add ''"); 
		run("!pfctl -a captive -r 'block all'"); 
		run("!pfctl -a captive -r 'pass out on " + iface + " from " + address + " to any'") 
		run("!pfctl -a captive -r 'pass from <authorized> to any'") 
		ports.tcp.forEach(function(tcpPort) {
			if (address.indexOf(":") === -1) {
				run("!pfctl -a captive -r 'pass in on " + iface + " inet proto tcp from any to " + address + " port " + tcpPort + "'"); 
			} else {
				run("!pfctl -a captive -r 'pass in on " + iface + " inet6 proto tcp from any to " + address + " port " + tcpPort + "'"); 
			}
		});
		ports.udp.forEach(function(udpPort) {
			if (address.indexOf(":") === -1) {
				run("!pfctl -a captive -r 'pass in on " + iface + " inet proto udp from any to " + address + " port " + udpPort + "'"); 
			} else {
				run("!pfctl -a captive -r 'pass in on " + iface + " inet6 proto udp from any to " + address + " port " + udpPort + "'"); 
			}
		});
	} else if (os === "linux") {
		run("!iptables -I FORWARD -j DROP"); 
		run("!ip6tables -I FORWARD -j DROP"); 
		ports.tcp.forEach(function(tcpPort) {
			if (address.indexOf(":") === -1) {
				run("!iptables -I FORWARD -p tcp --dport " + tcpPort + " -d " + address + " -j ACCEPT"); 
			} else {
				run("!ip6tables -I FORWARD -p tcp --dport " + tcpPort + " -d " + address + " -j ACCEPT"); 
			}
		});
		ports.udp.forEach(function(udpPort) {
			if (address.indexOf(":") === -1) {
				run("!iptables -I FORWARD -p udp --dport " + udpPort + " -d " + address + " -j ACCEPT"); 
			} else {
				run("!ip6tables -I FORWARD -p udp --dport " + udpPort + " -d " + address + " -j ACCEPT"); 
			}
		});
	}
}

/**
 * Removes the firewall rules that were set by the addDownstreamRules function.
 */
function removeDownstreamRules() {
	if (selectorOsBsdValidator.test(os)) {
		run("!pfctl -a captive -F rules"); 
		run("!pfctl -t authorized -T flush"); 
	} else if (os === "linux") {
		run("!iptables -D FORWARD -j DROP &"); 
		run("!ip6tables -D FORWARD -j DROP &"); 
		ports.tcp.forEach(function(tcpPort) {
			if (address.indexOf(":") === -1) {
				run("!iptables -D FORWARD -p tcp --dport " + tcpPort + " -d " + address + " -j ACCEPT &"); 
			} else {
				run("!ip6tables -D FORWARD -p tcp --dport " + tcpPort + " -d " + address + " -j ACCEPT &"); 
			}
		});
		ports.udp.forEach(function(udpPort) {
			if (address.indexOf(":") === -1) {
				run("!iptables -I FORWARD -p udp --dport " + udpPort + " -d " + address + " -j ACCEPT &"); 
			} else {
				run("!ip6tables -I FORWARD -p udp --dport " + udpPort + " -d " + address + " -j ACCEPT &"); 
			}
		});
	}
}

/**
 * Adds firewall rules to redirect DNS traffic to specified resolver address and accept
 * all other traffic for this client.
 */
function addUpstreamRulesForClient(clientIP) {
	if (!selectorIPValidator.test(clientIP)) {
		log_error("Invalid or missing 'clientIP' provided. (got " + clientIP + ")");
		return;
	}
	if (selectorOsBsdValidator.test(os)) {
		run("!pfctl -t authorized -T add " + clientIP); 
		// redirect port 53 to resolver addr
	} else if (os === "linux") {
		if (clientIP.indexOf(":") === -1) {
			run("!iptables -I FORWARD -s " + clientIP + " -j ACCEPT"); 
			run("!iptables -I FORWARD -d " + clientIP + " -j ACCEPT"); 
			run("!iptables -I PREROUTING -t nat -s " + clientIP + " -j ACCEPT"); 
			run("!iptables -I PREROUTING -t nat -d " + clientIP + " -j ACCEPT"); 
			run("!iptables -I PREROUTING -t nat -s " + clientIP + " -p udp --dport 53 -j DNAT --to-destination " + resolver); 
		} else {
			run("!ip6tables -I FORWARD -s " + clientIP + " -j ACCEPT"); 
			run("!ip6tables -I FORWARD -d " + clientIP + " -j ACCEPT"); 
			run("!ip6tables -I PREROUTING -t nat -s " + clientIP + " -j ACCEPT"); 
			run("!ip6tables -I PREROUTING -t nat -d " + clientIP + " -j ACCEPT"); 
			run("!ip6tables -I PREROUTING -t nat -s " + clientIP + " -p udp --dport 53 -j DNAT --to-destination " + resolver); 
		}
	}
}

/**
 * Removes the firewall rules that were set by the addUpstreamRulesForClient function.
 */
function removeUpstreamRulesForClient(clientIP) {
	if (!selectorIPValidator.test(clientIP)) {
		log_error("Invalid or missing 'clientIP' provided. (got " + clientIP + ")");
		return;
	}
	if (selectorOsBsdValidator.test(os)) {
		run("!pfctl -t authorized -T delete " + clientIP); 
		// remove redirect port 53 to resolver addr
	} else if (os === "linux") {
		if (clientIP.indexOf(":") === -1) {
			run("!iptables -D FORWARD -s " + clientIP + " -j ACCEPT"); 
			run("!iptables -D FORWARD -d " + clientIP + " -j ACCEPT"); 
			run("!iptables -D PREROUTING -t nat -s " + clientIP + " -j ACCEPT"); 
			run("!iptables -D PREROUTING -t nat -d " + clientIP + " -j ACCEPT"); 
			run("!iptables -D PREROUTING -t nat -s " + clientIP + " -p udp --dport 53 -j DNAT --to-destination " + resolver); 
		} else {
			run("!ip6tables -D FORWARD -s " + clientIP + " -j ACCEPT"); 
			run("!ip6tables -D FORWARD -d " + clientIP + " -j ACCEPT"); 
			run("!ip6tables -D PREROUTING -t nat -s " + clientIP + " -j ACCEPT"); 
			run("!ip6tables -D PREROUTING -t nat -d " + clientIP + " -j ACCEPT"); 
			run("!ip6tables -D PREROUTING -t nat -s " + clientIP + " -p udp --dport 53 -j DNAT --to-destination " + resolver); 
		}
	}
}

/**
 * Attempts authorization of a client with the given IP. Authorization will fail if this
 * client has an expired lease.
 * @param {string} clientIP IP address of the client.
 * @returns {bool} ok
 */
function authorize(clientIP) {
	if (!selectorIPValidator.test(clientIP)) {
		log_error("Invalid or missing 'clientIP' provided. (got " + clientIP + ")");
		return false;
	}
	if (leases.active[clientIP]) {
		log_info(clientIP + " already has an active lease.");
		return false;
	}
	if (leases.expired.indexOf(clientIP) !== -1) {
		log_info("Denied authorization attempt for " + clientIP + " due to expired lease.");
		return false;
	}
	addUpstreamRulesForClient(clientIP);
	// Create a new active lease
	var now = new Date().getTime();
	leases.active[clientIP] = {
		expiry: now + leaseDuration * 1000,
		timestamp: now,
		usage: {}, // todo
	};
	writeLeases();
	return true;
}

/**
 * Adds a given client IP to the blocklist and marks its lease as expired.
 * @param {string} clientIP IP address of the client.
 * @returns {bool} ok
 */
function unauthorize(clientIP) {
	if (!selectorIPValidator.test(clientIP)) {
		log_error("Invalid or missing 'clientIP' provided. (got " + clientIP + ")");
		return false;
	}
	if (leases.expired.indexOf(clientIP) !== -1) {
		log_info(clientIP + " already has an inactive lease.");
		return false;
	}
	removeUpstreamRulesForClient(clientIP);
	// Move lease from active to expired
	if (leases.expired.indexOf(clientIP) === -1)
		leases.expired.push(clientIP);
	if (leases.active[clientIP]) delete leases.active[clientIP];
	writeLeases();
	// If no reset time is set, allow client to reauthenticate after a specified delay
	if (!leaseResetTime) {
		setTimeout(function() {
			leases.expired = leases.expired.filter(function(ip) {
				return ip !== clientIP;
			});
			writeLeases();
		}, leaseDelay);
	}
	return true;
}

/**
 * Writes current state of leases to the 'captiveportal.lease.file' file path.
 */
function writeLeases() {
	// also write to session env
	writeFile(leaseFilePath, JSON.stringify(leases));
}

/**
 * Restores the firewall. This function is called when the bettercap session ends.
 */
function onExit() {
	console.log("Clearing firewall rules...");
	var clientIPs = Object.keys(leases.active);
	clientIPs.forEach(function(clientIP) {
		if (!selectorIPValidator.test(clientIP)) {
			log_error("Invalid or missing 'clientIP' during onExit call. (got " + clientIP + ")");
			return;
		}
		removeUpstreamRulesForClient(clientIP);
	});
	removeDownstreamRules();
}

/* Init */

// Parse environment
address = env("captiveportal.address");
if (!selectorIPValidator.test(address)) {
	log_warn("Invalid or missing 'captiveportal.address' value. Using default. (<interface address>)");
	address = env("iface.ipv4");
	env("captiveportal.address", address);
}
iface = env("iface.name");
if (!selectorIfaceValidator.test(iface)) {
	log_fatal("Invalid or missing 'iface.name' value.");
}
leaseFilePath = env("captiveportal.lease.file");
if (!leaseFilePath) {
	log_fatal("Missing 'captiveportal.lease.file' path value.");
}
var leasesString = readFile(leaseFilePath);
try {
	leases = JSON.parse(leasesString);
	if (!leases.active) leases.active = {};
	if (!leases.expired) leases.expired = [];
} catch(err) {
	log_fatal("Invalid 'captiveportal.lease.file' file contents or missing file: " + err);
}
try {
	leaseDuration = parseInt(env("captiveportal.lease.duration"));
} catch(err) {
	log_warn("Error parsing captiveportal.lease.duration: " + err);
	log_info("Using default lease duration of 3600 seconds (1 hour).");
	leaseDuration = 3600;
}
leaseResetTime = env("captiveportal.lease.resettime");
if (leaseResetTime && !/\d\d:\d\d/.test(leaseResetTime)) {
	log_fatal("Error parsing captiveportal.lease.resettime: must match HH:mm 24h format (00:00).");
}
leaseDelay = env("captiveportal.lease.delay")
if (leaseDelay && !/\d+/.test(leaseDelay) || leaseDelay === 0) {
	log_error("Invalid captiveportal.lease.delay variable value. (got " + leaseDelay + ")");
}
if (!leaseResetTime && !leaseDelay) {
	log_fatal("You must configure either the captiveportal.lease.delay or captiveportal.lease.resettime variable.");
}
resolver = env("captiveportal.dns.resolver")
if (!selectorIPValidator.test(resolver)) {
	log_warn("Invalid or missing 'captiveportal.dns.resolver' value.");
	log_info("Using default DNS resolver (1.1.1.1).");
	resolver = "1.1.1.1";
}
var tcpPortStrings = env("captiveportal.ports.tcp").split(",");
tcpPortStrings.forEach(function(tcpPort) {
	tcpPort = parseInt(tcpPort);
	if (tcpPort > 0 && tcpPort < 65536) {
		ports.tcp.push(tcpPort);
	} else {
		log_fatal("Invalid port in 'captiveportal.ports.tcp'. (got " + tcpPort + ")");
	}
});
var udpPortStrings = env("captiveportal.ports.udp").split(",");
udpPortStrings.forEach(function(udpPort) {
	udpPort = parseInt(udpPort);
	if (udpPort > 0 && udpPort < 65536) {
		ports.udp.push(udpPort);
	} else {
		log_fatal("Invalid port in 'captiveportal.ports.udp'. (got " + udpPort + ")");
	}
});

// Start the HTTP server if a path is specified
if (env("http.server.path")) {
	run("http.server on");
}

// Start modules with redirection
run("http.proxy on");
run("dns.proxy on");
run("net.recon on");

// Configure the captive portal firewall
addDownstreamRules();

// Allow traffic for active leases and remove expired ones.
Object.keys(leases.active).forEach(function(clientIP) {
	if (!selectorIPValidator.test(clientIP)) {
		log_error("Invalid key for object leases.active. (got " + clientIP + ")");
		log_info("Deleting lease with invalid key.");
		delete leases.active[clientIP];
		return;
	}
	var now = new Date().getTime();
	if (leases.active[clientIP].expiry > now) {
		addUpstreamRulesForClient(clientIP);
	} else {
		delete leases.active[clientIP];
	}
});

// Check for lease expiry every 5 seconds
setInterval(function() {
	var now = new Date();
	Object.keys(leases.active).forEach(function(clientIP) {
		if (leases.active[clientIP].expiry < now.getTime()) {
			unauthorize(clientIP);
		}
		// Check if data usage limit is reached
		// todo
	});
	// Check if daily reset time is reached
	if (leaseResetTime) {
		if (!resetInProgress) {
			var timeOfDay = now.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			});
			if (timeOfDay === leaseResetTime) {
				resetInProgress = true;
				Object.keys(leases.active).forEach(function(clientIP) {
					removeUpstreamRulesForClient(clientIP);
				});
				leases = {
					active: {},
					inactive: [],
				};
				writeLeases();
				// Wait 1 minute before checking again
				setTimeout(function() {
					resetInProgress = false;
				}, 60);
			}
		}
	}
}, 5);

